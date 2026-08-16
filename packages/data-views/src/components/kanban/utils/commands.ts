import type {
  KanbanCard,
  KanbanCommand,
  KanbanHistoryEntry,
  KanbanLocation,
} from "../types.js"

let mutationSequence = 0
let operationSequence = 0
export function createKanbanMutationId() {
  mutationSequence += 1
  return `kanban-${Date.now().toString(36)}-${mutationSequence.toString(36)}`
}

export function createKanbanOperationSequence() {
  operationSequence += 1
  return operationSequence
}

export function toKanbanLocations(cards: readonly KanbanCard[]) {
  return Object.fromEntries(cards.map((card) => [card.id, {
    groupId: card.groupId,
    ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
    rank: card.rank,
  } satisfies KanbanLocation]))
}

export function createKanbanHistoryEntry(
  command: KanbanCommand,
  createId: () => string = createKanbanMutationId
): KanbanHistoryEntry {
  let inverse: KanbanCommand | null = null
  if (command.type === "delete-cards") {
    inverse = { type: "restore-cards", clientMutationId: createId(), cardIds: command.cardIds, destinations: command.sources }
  } else if (command.type === "restore-cards") {
    inverse = { type: "delete-cards", clientMutationId: createId(), cardIds: command.cardIds, sources: command.destinations }
  } else if (command.type === "move-cards") {
    const firstSource = command.sources[command.cardIds[0] ?? ""]
    if (firstSource && command.cardIds.every((id) => command.sources[id]?.groupId === firstSource.groupId && command.sources[id]?.swimlaneId === firstSource.swimlaneId)) {
      inverse = {
        type: "move-cards",
        clientMutationId: createId(),
        cardIds: command.cardIds,
        sources: Object.fromEntries(command.cardIds.map((id) => [id, {
          groupId: command.destination.groupId,
          ...(command.destination.swimlaneId === undefined ? {} : { swimlaneId: command.destination.swimlaneId }),
          rank: command.sources[id]?.rank ?? "",
        }])),
        destination: { groupId: firstSource.groupId, ...(firstSource.swimlaneId === undefined ? {} : { swimlaneId: firstSource.swimlaneId }) },
        neighbors: { beforeId: null, afterId: null },
      }
    }
  }
  return { command, inverse }
}
