import type {
  DataViewFilter,
  DataViewFilterOperator,
  DataViewQuery,
  DataViewSchema,
} from "./types.js"

function normalizeComparable(value: unknown) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? value.toLocaleLowerCase() : timestamp
  }
  return value
}

function toSearchText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toSearchText).join(" ")
  if (typeof value === "object") {
    return Object.values(value).map(toSearchText).join(" ")
  }
  return String(value)
}

function evaluateOperator(
  actual: unknown,
  operator: DataViewFilterOperator,
  expected: unknown
) {
  const actualText = toSearchText(actual).toLocaleLowerCase()
  const expectedText = toSearchText(expected).toLocaleLowerCase()
  const left = normalizeComparable(actual)
  const right = normalizeComparable(expected)

  if (operator === "is-empty") {
    return actual === null || actual === undefined || actualText.length === 0
  }
  if (operator === "is-not-empty") {
    return actual !== null && actual !== undefined && actualText.length > 0
  }
  if (operator === "contains") return actualText.includes(expectedText)
  if (operator === "not-contains") return !actualText.includes(expectedText)
  if (operator === "starts-with") return actualText.startsWith(expectedText)
  if (operator === "ends-with") return actualText.endsWith(expectedText)
  if (operator === "equals") return actualText === expectedText
  if (operator === "not-equals") return actualText !== expectedText

  const compare = (a: unknown, b: unknown) => {
    if (typeof a === "number" && typeof b === "number") return a - b
    return String(a).localeCompare(String(b))
  }
  const difference = compare(left, right)
  if (operator === "greater-than" || operator === "after") return difference > 0
  if (operator === "greater-than-or-equal" || operator === "on-or-after") {
    return difference >= 0
  }
  if (operator === "less-than" || operator === "before") return difference < 0
  return difference <= 0
}

function matchesFilter<TRecord>(
  record: TRecord,
  filter: DataViewFilter,
  schema: DataViewSchema<TRecord>
): boolean {
  if (filter.type === "group") {
    return filter.operator === "and"
      ? filter.filters.every((child) => matchesFilter(record, child, schema))
      : filter.filters.some((child) => matchesFilter(record, child, schema))
  }
  const property = schema.properties.find(
    (candidate) => candidate.id === filter.propertyId
  )
  if (!property) return false
  return evaluateOperator(
    property.getValue(record),
    filter.operator,
    filter.value
  )
}

/** Applies a serializable saved-view query to client-owned records. */
export function applyDataViewQuery<TRecord>(
  records: readonly TRecord[],
  query: DataViewQuery,
  schema: DataViewSchema<TRecord>
) {
  const search = query.search.trim().toLocaleLowerCase()
  const filtered = records.filter((record) => {
    if (
      search &&
      !(schema.adapter.getSearchText?.(record) ??
        [
          schema.adapter.getLabel(record),
          ...schema.properties.map((property) =>
            toSearchText(property.getValue(record))
          ),
        ].join(" "))
        .toLocaleLowerCase()
        .includes(search)
    ) {
      return false
    }
    return query.filters.every((filter) => matchesFilter(record, filter, schema))
  })

  if (query.sorts.length === 0) return filtered
  const originalIndex = new Map(filtered.map((record, index) => [record, index]))
  return filtered.toSorted((leftRecord, rightRecord) => {
    for (const sort of query.sorts) {
      const property = schema.properties.find(
        (candidate) => candidate.id === sort.propertyId
      )
      if (!property) continue
      const left = normalizeComparable(property.getValue(leftRecord))
      const right = normalizeComparable(property.getValue(rightRecord))
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left ?? "").localeCompare(String(right ?? ""))
      if (comparison !== 0) {
        return sort.direction === "ascending" ? comparison : -comparison
      }
    }
    return (originalIndex.get(leftRecord) ?? 0) - (originalIndex.get(rightRecord) ?? 0)
  })
}

export function formatDataViewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (value instanceof Date) return value.toLocaleString()
  if (Array.isArray(value)) return value.map(formatDataViewValue).join(", ")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") {
    if ("name" in value && typeof value.name === "string") return value.name
    return JSON.stringify(value)
  }
  return String(value)
}
