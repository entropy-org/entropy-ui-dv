import type {
  KanbanCommand,
  KanbanCommandResult,
  KanbanPendingOperation,
} from "../types.js"
import type { NormalizedKanbanData } from "./normalize.js"
import { getPlacementKey } from "./normalize.js"

export type KanbanCommandReconciliation =
  | { readonly status: "confirmed" }
  | { readonly status: "pending" }
  | { readonly status: "conflict"; readonly reason: string }

function confirmsNeighbors(
  orderedIds: readonly string[],
  movedIds: readonly string[],
  beforeId: string | null,
  afterId: string | null
) {
  const moved = new Set(movedIds)
  const firstIndex = orderedIds.findIndex((id) => moved.has(id))
  if (firstIndex < 0) return false
  const block = orderedIds.slice(firstIndex, firstIndex + movedIds.length)
  if (
    block.length !== movedIds.length ||
    block.some((id, index) => id !== movedIds[index])
  )
    return false
  const previous = orderedIds[firstIndex - 1] ?? null
  const next = orderedIds[firstIndex + movedIds.length] ?? null
  return previous === beforeId && next === afterId
}

export function reconcileKanbanCommand(
  command: KanbanCommand,
  normalized: NormalizedKanbanData
): KanbanCommandReconciliation {
  if (command.type === "delete-cards") {
    return command.cardIds.every((id) => !normalized.cardsById.has(id))
      ? { status: "confirmed" }
      : { status: "pending" }
  }

  if (command.type === "restore-cards") {
    const missingId = command.cardIds.find(
      (id) => !normalized.cardsById.has(id)
    )
    if (missingId) return { status: "pending" }
    const confirmed = command.cardIds.every((id) => {
      const card = normalized.cardsById.get(id)
      const destination = command.destinations[id]
      return (
        card &&
        destination &&
        card.groupId === destination.groupId &&
        card.swimlaneId === destination.swimlaneId
      )
    })
    return confirmed ? { status: "confirmed" } : { status: "pending" }
  }

  if (command.type === "move-cards") {
    const missingId = command.cardIds.find(
      (id) => !normalized.cardsById.has(id)
    )
    if (missingId) {
      return {
        status: "conflict",
        reason: `Moved card "${missingId}" was removed by authoritative data.`,
      }
    }
    if (!normalized.groupsById.has(command.destination.groupId)) {
      return {
        status: "conflict",
        reason: "The destination group was removed.",
      }
    }
    if (
      command.destination.swimlaneId &&
      !normalized.swimlanesById.has(command.destination.swimlaneId)
    ) {
      return {
        status: "conflict",
        reason: "The destination swimlane was removed.",
      }
    }
    const cards = command.cardIds.map((id) => normalized.cardsById.get(id)!)
    if (
      !cards.every(
        (card) =>
          card.groupId === command.destination.groupId &&
          card.swimlaneId === command.destination.swimlaneId
      )
    ) {
      return { status: "pending" }
    }
    const placement =
      normalized.cardIdsByPlacement.get(
        getPlacementKey(
          command.destination.groupId,
          command.destination.swimlaneId
        )
      ) ?? []
    return confirmsNeighbors(
      placement,
      command.cardIds,
      command.neighbors.beforeId,
      command.neighbors.afterId
    )
      ? { status: "confirmed" }
      : { status: "pending" }
  }

  if (command.type === "reorder-groups") {
    if (!normalized.groupsById.has(command.groupId)) {
      return { status: "conflict", reason: "The reordered group was removed." }
    }
    return confirmsNeighbors(
      normalized.orderedGroupIds,
      [command.groupId],
      command.neighbors.beforeId,
      command.neighbors.afterId
    )
      ? { status: "confirmed" }
      : { status: "pending" }
  }

  // The board cannot infer IDs allocated for duplicated records. The command
  // handler's accepted response is the authoritative confirmation boundary.
  return { status: "pending" }
}

function operationKeys(operation: KanbanPendingOperation) {
  if (operation.command.type === "reorder-groups")
    return new Set([`group:${operation.command.groupId}`])
  return new Set(operation.affectedCardIds.map((id) => `card:${id}`))
}

export function hasLaterOverlappingOperation(
  operation: KanbanPendingOperation,
  pending: readonly KanbanPendingOperation[]
) {
  const keys = operationKeys(operation)
  return pending.some(
    (candidate) =>
      candidate.sequence > operation.sequence &&
      [...operationKeys(candidate)].some((key) => keys.has(key))
  )
}

export function isKanbanCommandResult(
  value: unknown
): value is KanbanCommandResult {
  if (!value || typeof value !== "object" || !("status" in value)) return false
  const status = (value as { readonly status?: unknown }).status
  return status === "accepted" || status === "rejected"
}
