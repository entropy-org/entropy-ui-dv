import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { resolveKanbanPreferences } from "../constants.js"
import { KanbanConfigContext } from "./kanban-config-context.js"
import { KanbanContext } from "./kanban-context.js"
import { KanbanDataContext } from "./kanban-data-context.js"
import { createKanbanStore } from "../store/create-store.js"
import type { KanbanConfig } from "../types.js"
import { normalizeKanbanData } from "../utils/normalize.js"
import { hasLaterOverlappingOperation, reconcileKanbanCommand } from "../utils/reconciliation.js"

export interface KanbanProviderProps {
  readonly config: KanbanConfig
  readonly children: ReactNode
}

export function KanbanProvider({ config, children }: KanbanProviderProps) {
  const { dataVersion, onCommandSettled, onInvalidItem, onMutationRejected, pendingTimeoutMs } = config
  const [store] = useState(() => createKanbanStore({ historyLimit: config.historyLimit }))
  const normalized = useMemo(
    () => normalizeKanbanData(config.cards, config.groups, config.swimlanes),
    [config.cards, config.groups, config.swimlanes]
  )
  const preferences = useMemo(() => resolveKanbanPreferences(config.preferences), [config.preferences])
  const reportedIssues = useRef(new Set<string>())

  const reconcilePending = useCallback(() => {
    const actions = store.getState().actions
    const pending = store.getState().pending
    for (const operation of pending) {
      if (operation.status !== "awaiting-data") continue
      const { command } = operation
      const result = reconcileKanbanCommand(command, normalized)
      const requiredVersionReached = operation.acceptedDataVersion === undefined
        || (dataVersion !== undefined && dataVersion >= operation.acceptedDataVersion)
      if (result.status === "confirmed" && requiredVersionReached) {
        actions.settleCommand(command.clientMutationId, "confirmed")
        onCommandSettled?.({ status: "confirmed", command })
        continue
      }
      const snapshotAdvanced = operation.acceptedDataVersion !== undefined
        ? requiredVersionReached
        : operation.issuedDataVersion !== undefined && dataVersion !== undefined && dataVersion > operation.issuedDataVersion
      if ((result.status === "conflict" || (result.status === "pending" && snapshotAdvanced)) && hasLaterOverlappingOperation(operation, pending)) {
        actions.settleCommand(command.clientMutationId, "superseded")
        onCommandSettled?.({ status: "superseded", command })
        continue
      }
      if (result.status === "conflict" || (result.status === "pending" && snapshotAdvanced)) {
        const reason = result.status === "conflict"
          ? result.reason
          : `Authoritative data version ${dataVersion} did not contain the accepted command.`
        actions.settleCommand(command.clientMutationId, "conflict")
        actions.announce("Kanban change conflicted with authoritative data.")
        onMutationRejected?.({ type: "authoritative-conflict", command, reason })
        onCommandSettled?.({ status: "conflict", command, reason })
      }
    }
  }, [dataVersion, normalized, onCommandSettled, onMutationRejected, store])

  useEffect(() => {
    const actions = store.getState().actions
    const validIds = new Set(normalized.acceptedCards.map(({ id }) => id))
    actions.reconcileCardIds(validIds, normalized.acceptedCards.map(({ id }) => id))
    const groupIds = new Set(normalized.acceptedGroups.map(({ id }) => id))
    const laneIds = new Set(normalized.acceptedSwimlanes.map(({ id }) => id))
    const interaction = store.getState().interaction
    if (interaction.type === "card-drag") {
      if (!groupIds.has(interaction.destinationGroupId) || (interaction.destinationSwimlaneId && !laneIds.has(interaction.destinationSwimlaneId))) {
        actions.setInteraction({ type: "idle" })
        actions.announce("Move cancelled because its destination was removed.")
      }
    }
    reconcilePending()
  }, [normalized, reconcilePending, store])

  useEffect(() => {
    let reconciling = false
    return store.subscribe((state, previous) => {
      if (reconciling || state.pending === previous.pending) return
      reconciling = true
      reconcilePending()
      reconciling = false
    })
  }, [reconcilePending, store])

  useEffect(() => {
    if (pendingTimeoutMs === undefined || pendingTimeoutMs <= 0) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const schedule = () => {
      const pending = store.getState().pending
      for (const operation of pending) {
        const id = operation.command.clientMutationId
        if (timers.has(id)) continue
        const remaining = Math.max(0, pendingTimeoutMs - (Date.now() - operation.createdAt))
        timers.set(id, setTimeout(() => {
          timers.delete(id)
          const current = store.getState().pending
          const active = current.find(({ command }) => command.clientMutationId === id)
          if (!active) return
          if (hasLaterOverlappingOperation(active, current)) {
            store.getState().actions.settleCommand(id, "superseded")
            onCommandSettled?.({ status: "superseded", command: active.command })
            return
          }
          store.getState().actions.settleCommand(id, "timed-out")
          store.getState().actions.announce("Kanban change timed out.")
          onMutationRejected?.({ type: "timed-out", command: active.command, timeoutMs: pendingTimeoutMs })
          onCommandSettled?.({ status: "timed-out", command: active.command })
        }, remaining))
      }
      for (const [id, timer] of timers) {
        if (pending.some(({ command }) => command.clientMutationId === id)) continue
        clearTimeout(timer)
        timers.delete(id)
      }
    }
    schedule()
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.pending !== previous.pending) schedule()
    })
    return () => {
      unsubscribe()
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }, [onCommandSettled, onMutationRejected, pendingTimeoutMs, store])

  useEffect(() => {
    for (const [index, issue] of normalized.issues.entries()) {
      const key = `${issue.type}:${"id" in issue ? issue.id : "cardId" in issue ? issue.cardId : "groupId" in issue ? issue.groupId : index}:${issue.message}`
      if (reportedIssues.current.has(key)) continue
      reportedIssues.current.add(key)
      onInvalidItem?.(issue)
    }
    if (normalized.issues.length > 0) {
      store.getState().actions.announce(`${normalized.issues.length} invalid Kanban item${normalized.issues.length === 1 ? " was" : "s were"} not displayed.`)
    }
  }, [normalized.issues, onInvalidItem, store])

  const dataValue = useMemo(() => ({ normalized, preferences }), [normalized, preferences])
  return (
    <KanbanConfigContext.Provider value={config}>
      <KanbanDataContext.Provider value={dataValue}>
        <KanbanContext.Provider value={store}>{children}</KanbanContext.Provider>
      </KanbanDataContext.Provider>
    </KanbanConfigContext.Provider>
  )
}
