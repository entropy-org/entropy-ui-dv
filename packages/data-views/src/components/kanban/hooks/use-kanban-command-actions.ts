import { useCallback, useEffect, useMemo, useRef } from "react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanData } from "../context/kanban-data-context.js"
import { useKanbanStoreApi } from "../context/kanban-context.js"
import type { KanbanCommand, KanbanCommandResult, KanbanHistoryEntry } from "../types.js"
import { createKanbanHistoryEntry, createKanbanMutationId, createKanbanOperationSequence, toKanbanLocations } from "../utils/commands.js"
import { getKanbanNeighbors } from "../utils/neighbors.js"
import { getPlacementKey } from "../utils/normalize.js"
import { hasLaterOverlappingOperation, isKanbanCommandResult, reconcileKanbanCommand } from "../utils/reconciliation.js"

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value && (typeof value === "object" || typeof value === "function") && "then" in value)
}

export function useKanbanCommandActions() {
  const config = useKanbanConfig()
  const { normalized } = useKanbanData()
  const store = useKanbanStoreApi()
  const createId = config.createMutationId ?? createKanbanMutationId
  const configRef = useRef(config)
  const normalizedRef = useRef(normalized)
  useEffect(() => {
    configRef.current = config
    normalizedRef.current = normalized
  }, [config, normalized])

  const emit = useCallback((command: KanbanCommand, history: KanbanHistoryEntry | null) => {
    const currentConfig = configRef.current
    if (currentConfig.readOnly || !currentConfig.onCommand) return false
    const cardIds = command.type === "duplicate-cards"
      ? command.sourceCardIds
      : command.type === "reorder-groups" ? [] : command.cardIds
    store.getState().actions.enqueueCommand({
      status: "submitting",
      command,
      affectedCardIds: cardIds,
      createdAt: Date.now(),
      sequence: createKanbanOperationSequence(),
      ...(currentConfig.dataVersion === undefined ? {} : { issuedDataVersion: currentConfig.dataVersion }),
    }, history)

    const settle = (status: "confirmed" | "rejected" | "conflict" | "superseded") => {
      const operation = store.getState().pending.find(({ command: pendingCommand }) => pendingCommand.clientMutationId === command.clientMutationId)
      if (!operation) return false
      store.getState().actions.settleCommand(command.clientMutationId, status)
      if (status === "confirmed") configRef.current.onCommandSettled?.({ status, command })
      else if (status === "superseded") configRef.current.onCommandSettled?.({ status, command })
      return true
    }

    const isSuperseded = () => {
      const pending = store.getState().pending
      const operation = pending.find(({ command: pendingCommand }) => pendingCommand.clientMutationId === command.clientMutationId)
      return operation ? hasLaterOverlappingOperation(operation, pending) : false
    }

    const reject = (result: Extract<KanbanCommandResult, { readonly status: "rejected" }> | null, error: unknown) => {
      if (isSuperseded()) {
        settle("superseded")
        return
      }
      if (!settle("rejected")) return
      store.getState().actions.announce(result?.message ?? "Kanban change was rejected.")
      if (result) {
        configRef.current.onMutationRejected?.({
          type: "server-rejected",
          command,
          code: result.code,
          message: result.message,
          ...(result.error === undefined ? {} : { error: result.error }),
        })
      } else {
        configRef.current.onMutationRejected?.({ type: "consumer-rejected", command, error })
      }
      configRef.current.onCommandSettled?.({ status: "rejected", command, error })
    }

    const accept = (result?: Extract<KanbanCommandResult, { readonly status: "accepted" }>) => {
      if (!store.getState().pending.some(({ command: pendingCommand }) => pendingCommand.clientMutationId === command.clientMutationId)) return
      if (command.type === "duplicate-cards") {
        settle("confirmed")
        return
      }
      const requiredVersion = result?.dataVersion
      const currentVersion = configRef.current.dataVersion
      const versionSatisfied = requiredVersion === undefined
        || (currentVersion !== undefined && currentVersion >= requiredVersion)
      const reconciliation = reconcileKanbanCommand(command, normalizedRef.current)
      if (versionSatisfied && reconciliation.status === "confirmed") {
        settle("confirmed")
        return
      }
      if (versionSatisfied && reconciliation.status === "conflict") {
        if (isSuperseded()) {
          settle("superseded")
          return
        }
        if (settle("conflict")) {
          store.getState().actions.announce("Kanban change conflicted with authoritative data.")
          configRef.current.onMutationRejected?.({ type: "authoritative-conflict", command, reason: reconciliation.reason })
          configRef.current.onCommandSettled?.({ status: "conflict", command, reason: reconciliation.reason })
        }
        return
      }
      store.getState().actions.markCommandAccepted(command.clientMutationId, requiredVersion)
    }

    try {
      const result = currentConfig.onCommand(command)
      if (isPromiseLike<void | KanbanCommandResult>(result)) {
        void result.then((outcome) => {
          if (!isKanbanCommandResult(outcome)) accept()
          else if (outcome.status === "rejected") reject(outcome, outcome.error ?? new Error(outcome.message))
          else accept(outcome)
        }).catch((error: unknown) => {
          reject(null, error)
        })
      } else if (!isKanbanCommandResult(result)) accept()
      else if (result.status === "rejected") reject(result, result.error ?? new Error(result.message))
      else accept(result)
      return true
    } catch (error) {
      reject(null, error)
      return false
    }
  }, [store])

  return useMemo(() => ({
    deleteCards(cardIds: readonly string[]) {
      const cards = cardIds.map((id) => normalized.cardsById.get(id)).filter((card) => card !== undefined)
      if (cards.length === 0) return false
      const command: KanbanCommand = { type: "delete-cards", clientMutationId: createId(), cardIds: cards.map(({ id }) => id), sources: toKanbanLocations(cards) }
      return emit(command, createKanbanHistoryEntry(command, createId))
    },
    deleteSelected(visibleOrder: readonly string[]) {
      const selected = store.getState().selectedIds
      return this.deleteCards(visibleOrder.filter((id) => selected.has(id)))
    },
    duplicateCards(cardIds: readonly string[]) {
      const cards = cardIds.map((id) => normalized.cardsById.get(id)).filter((card) => card !== undefined)
      const last = cards.at(-1)
      if (!last) return false
      const placement = normalized.cardIdsByPlacement.get(getPlacementKey(last.groupId, last.swimlaneId)) ?? []
      const command: KanbanCommand = {
        type: "duplicate-cards", clientMutationId: createId(), sourceCardIds: cards.map(({ id }) => id),
        destination: { groupId: last.groupId, ...(last.swimlaneId === undefined ? {} : { swimlaneId: last.swimlaneId }) },
        neighbors: getKanbanNeighbors(placement, placement.indexOf(last.id) + 1, new Set(cards.map(({ id }) => id))),
      }
      return emit(command, null)
    },
    moveCards(cardIds: readonly string[], groupId: string, swimlaneId: string | undefined, insertionIndex: number) {
      const cards = cardIds.map((id) => normalized.cardsById.get(id)).filter((card) => card !== undefined)
      if (cards.length === 0 || !normalized.groupsById.has(groupId)) return false
      const placement = normalized.cardIdsByPlacement.get(getPlacementKey(groupId, swimlaneId)) ?? []
      const excluded = new Set(cards.map(({ id }) => id))
      const neighbors = getKanbanNeighbors(placement, insertionIndex, excluded)
      const samePlacement = cards.every((card) => card.groupId === groupId && card.swimlaneId === swimlaneId)
      if (samePlacement) {
        const available = placement.filter((id) => !excluded.has(id))
        const currentBefore = available[placement.indexOf(cards[0]!.id) - 1] ?? null
        if (neighbors.beforeId === currentBefore && cards.length === 1) return false
      }
      const command: KanbanCommand = {
        type: "move-cards", clientMutationId: createId(), cardIds: cards.map(({ id }) => id), sources: toKanbanLocations(cards),
        destination: { groupId, ...(swimlaneId === undefined ? {} : { swimlaneId }) }, neighbors,
      }
      return emit(command, createKanbanHistoryEntry(command, createId))
    },
    reorderGroup(groupId: string, insertionIndex: number) {
      const group = normalized.groupsById.get(groupId)
      if (!group) return false
      const command: KanbanCommand = {
        type: "reorder-groups", clientMutationId: createId(), groupId, sourceRank: group.rank,
        neighbors: getKanbanNeighbors(normalized.orderedGroupIds, insertionIndex, new Set([groupId])),
      }
      return emit(command, null)
    },
    undo() {
      const entry = store.getState().actions.popUndo()
      if (!entry?.inverse) return false
      return emit({ ...entry.inverse, clientMutationId: createId() }, null)
    },
    redo() {
      const entry = store.getState().actions.popRedo()
      if (!entry) return false
      return emit({ ...entry.command, clientMutationId: createId() }, null)
    },
  }), [createId, emit, normalized, store])
}
