import type { CalendarItem } from "../types.js"

export type CalendarSearchTextResolver = (item: CalendarItem) => string

function collectSearchValues(
  value: unknown,
  values: string[],
  visited: Set<object>,
  depth: number
): void {
  if (value == null || depth > 5) return
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    values.push(String(value))
    return
  }
  if (value instanceof Date) {
    if (Number.isFinite(value.getTime())) values.push(value.toISOString())
    return
  }
  if (typeof value !== "object" || visited.has(value)) return
  visited.add(value)
  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    collectSearchValues(nested, values, visited, depth + 1)
  }
}

export function getDefaultCalendarSearchText(item: CalendarItem): string {
  const values = [item.id, item.calendarId ?? ""]
  collectSearchValues(item.data, values, new Set(), 0)
  return values.join(" ")
}

export function itemMatchesCalendarSearch(
  item: CalendarItem,
  query: string,
  getSearchText: CalendarSearchTextResolver = getDefaultCalendarSearchText
): boolean {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const text = getSearchText(item).toLocaleLowerCase()
  return tokens.every((token) => text.includes(token))
}

export function filterCalendarItems(
  items: readonly CalendarItem[],
  query: string,
  getSearchText: CalendarSearchTextResolver = getDefaultCalendarSearchText
): CalendarItem[] {
  return items.filter((item) =>
    itemMatchesCalendarSearch(item, query, getSearchText)
  )
}
