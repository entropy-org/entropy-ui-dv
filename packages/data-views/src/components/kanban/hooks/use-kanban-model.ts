import { useMemo } from "react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanData } from "../context/kanban-data-context.js"
import { useKanbanStore } from "./use-kanban-store.js"
import { selectKanbanSearchQuery } from "../store/selectors.js"
import { createKanbanDisplayModel } from "../utils/display-model.js"
import { defaultKanbanSearchText, normalizeKanbanSearchText } from "../utils/search.js"

export function useKanbanModel() {
  const config = useKanbanConfig()
  const { filterCard, getGroupCardCount, getSearchText, search } = config
  const { normalized, preferences } = useKanbanData()
  const query = useKanbanStore(selectKanbanSearchQuery)
  const normalizedQuery = normalizeKanbanSearchText(query)
  const { matchingIds, groupCardCounts, callbackError } = useMemo(() => {
    const ids = new Set<string>()
    const loadedCounts = new Map<string, number>()
    for (const card of normalized.acceptedCards) loadedCounts.set(card.groupId, (loadedCounts.get(card.groupId) ?? 0) + 1)
    const counts = new Map(loadedCounts)
    let error: Error | null = null
    for (const card of normalized.acceptedCards) {
      try {
        if (filterCard && !filterCard(card)) continue
        if (search?.mode === "server" || !normalizedQuery) {
          ids.add(card.id)
          continue
        }
        const searchText = normalizeKanbanSearchText((getSearchText ?? defaultKanbanSearchText)(card))
        if (searchText.includes(normalizedQuery)) ids.add(card.id)
      } catch (cause) {
        error = cause instanceof Error ? cause : new Error("A Kanban search or filter callback failed.", { cause })
        break
      }
    }
    if (!error && getGroupCardCount) {
      for (const group of normalized.acceptedGroups) {
        try {
          const count = getGroupCardCount(group, loadedCounts.get(group.id) ?? 0)
          if (!Number.isInteger(count) || count < (loadedCounts.get(group.id) ?? 0)) {
            throw new Error(`getGroupCardCount returned an invalid count for group "${group.id}".`)
          }
          counts.set(group.id, count)
        } catch (cause) {
          error = cause instanceof Error ? cause : new Error("A Kanban group count callback failed.", { cause })
          break
        }
      }
    }
    return { matchingIds: ids, groupCardCounts: counts, callbackError: error }
  }, [filterCard, getGroupCardCount, getSearchText, normalized.acceptedCards, normalized.acceptedGroups, normalizedQuery, search])
  const display = useMemo(
    () => createKanbanDisplayModel(normalized, preferences, matchingIds, groupCardCounts),
    [groupCardCounts, matchingIds, normalized, preferences]
  )
  const resultCount = search?.mode !== "local" && search?.resultCount !== undefined
    ? search.resultCount
    : display.resultCount
  return { normalized, preferences, display: { ...display, resultCount }, query, matchingIds, groupCardCounts, callbackError }
}
