import type {
  KanbanCard,
  KanbanGroup,
  KanbanWipEvaluation,
} from "../types.js"

export function countCardsByGroup(cards: readonly KanbanCard[]) {
  const counts = new Map<string, number>()
  for (const card of cards) counts.set(card.groupId, (counts.get(card.groupId) ?? 0) + 1)
  return counts
}

export function evaluateKanbanWip(
  group: KanbanGroup,
  currentCount: number,
  incoming = 0,
  outgoing = 0
): KanbanWipEvaluation {
  const count = currentCount + incoming - outgoing
  const limit = group.wipLimit
  if (!limit) return { status: "none", count, maximum: null }
  if (count <= limit.maximum) return { status: "below-limit", count, maximum: limit.maximum }
  return limit.type === "hard"
    ? { status: "hard-blocked", count, maximum: limit.maximum }
    : { status: "warning", count, maximum: limit.maximum }
}

export function evaluateMoveWip(
  cards: readonly KanbanCard[],
  group: KanbanGroup,
  movingIds: ReadonlySet<string>,
  authoritativeCount?: number
) {
  const currentCount = authoritativeCount ?? cards.filter((card) => card.groupId === group.id).length
  const incoming = cards.filter((card) => movingIds.has(card.id) && card.groupId !== group.id).length
  if (incoming === 0 && group.wipLimit?.type === "hard" && currentCount > group.wipLimit.maximum) {
    return { status: "warning", count: currentCount, maximum: group.wipLimit.maximum } as const
  }
  return evaluateKanbanWip(group, currentCount, incoming, 0)
}
