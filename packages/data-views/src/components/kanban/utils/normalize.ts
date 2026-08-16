import type {
  KanbanCard,
  KanbanGroup,
  KanbanInvalidItem,
  KanbanSwimlane,
} from "../types.js"

export interface NormalizedKanbanData {
  readonly cardsById: ReadonlyMap<string, KanbanCard>
  readonly groupsById: ReadonlyMap<string, KanbanGroup>
  readonly swimlanesById: ReadonlyMap<string, KanbanSwimlane>
  readonly orderedGroupIds: readonly string[]
  readonly orderedSwimlaneIds: readonly string[]
  readonly cardIdsByPlacement: ReadonlyMap<string, readonly string[]>
  readonly acceptedCards: readonly KanbanCard[]
  readonly acceptedGroups: readonly KanbanGroup[]
  readonly acceptedSwimlanes: readonly KanbanSwimlane[]
  readonly issues: readonly KanbanInvalidItem[]
}

export function getPlacementKey(groupId: string, swimlaneId?: string) {
  return `${groupId}\u0000${swimlaneId ?? ""}`
}

function validateIdentity<T extends { readonly id: string; readonly rank: string }>(
  values: readonly T[],
  entity: "card" | "group" | "swimlane",
  issues: KanbanInvalidItem[]
) {
  const accepted: T[] = []
  const ids = new Set<string>()
  for (const [index, item] of values.entries()) {
    if (item.id.trim() === "") {
      issues.push({ type: "empty-id", entity, index, item, message: `${entity} at index ${index} has an empty id.` })
      continue
    }
    if (ids.has(item.id)) {
      issues.push({ type: "duplicate-id", entity, id: item.id, index, item, message: `Duplicate ${entity} id "${item.id}" was ignored.` })
      continue
    }
    ids.add(item.id)
    if (item.rank.trim() === "") {
      issues.push({ type: "empty-rank", entity, id: item.id, index, item, message: `${entity} "${item.id}" has an empty rank.` })
      continue
    }
    accepted.push(item)
  }
  return accepted
}

function removeDuplicateRanks<T extends { readonly id: string; readonly rank: string }>(
  values: readonly T[],
  entity: "card" | "group" | "swimlane",
  scope: (value: T) => string,
  issues: KanbanInvalidItem[]
) {
  const seen = new Set<string>()
  return values.filter((item) => {
    const itemScope = scope(item)
    const key = `${itemScope}\u0000${item.rank}`
    if (!seen.has(key)) {
      seen.add(key)
      return true
    }
    issues.push({
      type: "duplicate-rank",
      entity,
      id: item.id,
      rank: item.rank,
      scope: itemScope,
      item,
      message: `${entity} "${item.id}" has duplicate rank "${item.rank}" in ${itemScope || "the board"}.`,
    })
    return false
  })
}

export function normalizeKanbanData(
  cards: readonly KanbanCard[],
  groups: readonly KanbanGroup[],
  swimlanes: readonly KanbanSwimlane[] = []
): NormalizedKanbanData {
  const issues: KanbanInvalidItem[] = []
  const identityGroups = validateIdentity(groups, "group", issues)
  const validWipGroups = identityGroups.filter((group) => {
    if (!group.wipLimit || (Number.isInteger(group.wipLimit.maximum) && group.wipLimit.maximum >= 0)) return true
    issues.push({ type: "invalid-wip-limit", groupId: group.id, item: group, message: `Group "${group.id}" has an invalid WIP maximum.` })
    return false
  })
  const acceptedGroups = removeDuplicateRanks(validWipGroups, "group", () => "board", issues)
    .toSorted((left, right) => left.rank.localeCompare(right.rank))
  const acceptedSwimlanes = removeDuplicateRanks(
    validateIdentity(swimlanes, "swimlane", issues),
    "swimlane",
    () => "board",
    issues
  ).toSorted((left, right) => left.rank.localeCompare(right.rank))

  const groupsById = new Map(acceptedGroups.map((group) => [group.id, group]))
  const swimlanesById = new Map(acceptedSwimlanes.map((lane) => [lane.id, lane]))
  const lanesEnabled = acceptedSwimlanes.length > 0
  const identityCards = validateIdentity(cards, "card", issues)
  const placedCards = identityCards.filter((card) => {
    if (!groupsById.has(card.groupId)) {
      issues.push({ type: "missing-group", cardId: card.id, groupId: card.groupId, item: card, message: `Card "${card.id}" references missing group "${card.groupId}".` })
      return false
    }
    if (lanesEnabled && card.swimlaneId === undefined) {
      issues.push({ type: "missing-swimlane", cardId: card.id, item: card, message: `Card "${card.id}" needs a swimlane while swimlanes are enabled.` })
      return false
    }
    if (lanesEnabled && card.swimlaneId !== undefined && !swimlanesById.has(card.swimlaneId)) {
      issues.push({ type: "orphaned-swimlane", cardId: card.id, swimlaneId: card.swimlaneId, item: card, message: `Card "${card.id}" references missing swimlane "${card.swimlaneId}".` })
      return false
    }
    if (!lanesEnabled && card.swimlaneId !== undefined) {
      issues.push({ type: "unexpected-swimlane", cardId: card.id, swimlaneId: card.swimlaneId, item: card, message: `Card "${card.id}" has a swimlane but no swimlanes are configured.` })
      return false
    }
    return true
  })
  const acceptedCards = removeDuplicateRanks(
    placedCards,
    "card",
    (card) => getPlacementKey(card.groupId, card.swimlaneId),
    issues
  ).toSorted((left, right) => left.rank.localeCompare(right.rank))
  const cardIdsByPlacement = new Map<string, string[]>()
  for (const card of acceptedCards) {
    const key = getPlacementKey(card.groupId, card.swimlaneId)
    const ids = cardIdsByPlacement.get(key) ?? []
    ids.push(card.id)
    cardIdsByPlacement.set(key, ids)
  }

  return {
    cardsById: new Map(acceptedCards.map((card) => [card.id, card])),
    groupsById,
    swimlanesById,
    orderedGroupIds: acceptedGroups.map(({ id }) => id),
    orderedSwimlaneIds: acceptedSwimlanes.map(({ id }) => id),
    cardIdsByPlacement,
    acceptedCards,
    acceptedGroups,
    acceptedSwimlanes,
    issues,
  }
}
