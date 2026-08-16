import type { KanbanPreferences, KanbanWipEvaluation } from "../types.js"
import type { NormalizedKanbanData } from "./normalize.js"
import { getPlacementKey } from "./normalize.js"
import { countCardsByGroup, evaluateKanbanWip } from "./wip.js"

export interface KanbanDisplayIntersection {
  readonly key: string
  readonly groupId: string
  readonly swimlaneId?: string
  readonly cardIds: readonly string[]
}

export interface KanbanDisplayGroup {
  readonly id: string
  readonly collapsed: boolean
  readonly cardCount: number
  readonly visibleCardCount: number
  readonly wip: KanbanWipEvaluation
  readonly intersections: readonly KanbanDisplayIntersection[]
}

export interface KanbanDisplayLane {
  readonly id: string
  readonly collapsed: boolean
  readonly cardCount: number
  readonly visibleCardCount: number
}

export interface KanbanDisplayModel {
  readonly groups: readonly KanbanDisplayGroup[]
  readonly lanes: readonly KanbanDisplayLane[]
  readonly visibleCardIds: readonly string[]
  readonly resultCount: number
}

export function createKanbanDisplayModel(
  normalized: NormalizedKanbanData,
  preferences: KanbanPreferences,
  matchingIds: ReadonlySet<string>,
  authoritativeGroupCounts?: ReadonlyMap<string, number>
): KanbanDisplayModel {
  const loadedGroupCounts = countCardsByGroup(normalized.acceptedCards)
  const groupCounts = authoritativeGroupCounts ?? loadedGroupCounts
  const collapsedGroups = new Set(preferences.collapsedGroupIds)
  const collapsedLanes = new Set(preferences.collapsedSwimlaneIds)
  const laneIds: readonly (string | undefined)[] = normalized.orderedSwimlaneIds.length > 0
    ? normalized.orderedSwimlaneIds
    : [undefined]
  const visibleCardIds: string[] = []

  const groups = normalized.orderedGroupIds.map((groupId) => {
    const collapsed = collapsedGroups.has(groupId)
    const intersections = laneIds.map((swimlaneId) => {
      const all = normalized.cardIdsByPlacement.get(getPlacementKey(groupId, swimlaneId)) ?? []
      const cardIds = collapsed || (swimlaneId !== undefined && collapsedLanes.has(swimlaneId))
        ? []
        : all.filter((id) => matchingIds.has(id))
      visibleCardIds.push(...cardIds)
      return { key: getPlacementKey(groupId, swimlaneId), groupId, ...(swimlaneId === undefined ? {} : { swimlaneId }), cardIds }
    })
    const group = normalized.groupsById.get(groupId)!
    return {
      id: groupId,
      collapsed,
      cardCount: groupCounts.get(groupId) ?? 0,
      visibleCardCount: intersections.reduce((sum, item) => sum + item.cardIds.length, 0),
      wip: evaluateKanbanWip(group, groupCounts.get(groupId) ?? 0),
      intersections,
    }
  })

  const lanes = normalized.orderedSwimlaneIds.map((id) => {
    const cards = normalized.acceptedCards.filter((card) => card.swimlaneId === id)
    return {
      id,
      collapsed: collapsedLanes.has(id),
      cardCount: cards.length,
      visibleCardCount: visibleCardIds.filter((cardId) => normalized.cardsById.get(cardId)?.swimlaneId === id).length,
    }
  })
  return { groups, lanes, visibleCardIds, resultCount: matchingIds.size }
}
