import type { TimelineItem } from "../types.js"

type SearchTextGetter = (item: TimelineItem) => string

function collectPrimitiveText(
  value: unknown,
  seen: Set<object>,
  depth: number
): string[] {
  if (value === null || value === undefined || depth > 4) return []

  switch (typeof value) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
      return [String(value)]
    case "object": {
      if (value instanceof Date) return [value.toISOString()]
      if (seen.has(value)) return []
      seen.add(value)

      const entries = Array.isArray(value) ? value : Object.values(value)
      return entries.flatMap((entry) =>
        collectPrimitiveText(entry, seen, depth + 1)
      )
    }
    default:
      return []
  }
}

/**
 * Default searchable text for an item. Consumer data is intentionally unknown,
 * so primitive values are collected safely from common nested payloads.
 */
export function getDefaultItemSearchText(item: TimelineItem): string {
  return [item.id, ...collectPrimitiveText(item.data, new Set(), 0)].join(" ")
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
}

/**
 * Matches every whitespace-delimited query term, in any order.
 */
export function itemMatchesSearch(
  item: TimelineItem,
  query: string,
  getSearchText: SearchTextGetter = getDefaultItemSearchText
): boolean {
  const terms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const searchableText = normalizeSearchText(
    `${item.id} ${getSearchText(item)}`
  )
  return terms.every((term) => searchableText.includes(term))
}
