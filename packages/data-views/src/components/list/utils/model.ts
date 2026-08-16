import { DATA_LIST_MAX_HIERARCHY_DEPTH } from "../constants.js"
import type {
  DataListConfig,
  DataListAnyProperty,
  DataListDisplayEntry,
  DataListErrorContext,
  DataListItem,
  DataListModel,
  DataListResolvedGroup,
} from "../types.js"

interface BuildDataListModelOptions<TData> {
  readonly config: DataListConfig<TData>
  readonly query: string
  readonly collapsedGroups: ReadonlySet<string>
  readonly toggledItems: ReadonlySet<string>
}

function safeString(value: unknown) {
  if (typeof value === "string") return value
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }
  return ""
}

function compareValues(left: unknown, right: unknown, collator: Intl.Collator) {
  if (Object.is(left, right)) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === "number" && typeof right === "number") {
    if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1
    if (Number.isNaN(right)) return -1
    return left - right
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime()
  }
  return collator.compare(safeString(left), safeString(right))
}

function createDiagnosticsReporter(diagnostics: DataListErrorContext[]) {
  const keys = new Set<string>()
  return (diagnostic: DataListErrorContext) => {
    const key = `${diagnostic.code}:${diagnostic.itemId ?? ""}:${diagnostic.propertyId ?? ""}:${diagnostic.message}`
    if (keys.has(key)) return
    keys.add(key)
    diagnostics.push(diagnostic)
  }
}

function flattenHierarchy<TData>(
  items: readonly DataListItem<TData>[],
  config: DataListConfig<TData>,
  toggledItems: ReadonlySet<string>,
  groupKey: string | undefined,
  report: (diagnostic: DataListErrorContext) => void
) {
  const hierarchy = config.hierarchy ?? { mode: "disabled" as const }
  const entries: Extract<
    DataListDisplayEntry<TData>,
    { readonly kind: "item" }
  >[] = []
  if (hierarchy.mode === "disabled") {
    return items.map((item, index) => ({
      kind: "item" as const,
      key: `item:${item.id}`,
      item,
      groupKey,
      depth: 0,
      hasChildren: false,
      positionInSet: index + 1,
      setSize: items.length,
    }))
  }

  const ids = new Set(items.map((item) => item.id))
  const children = new Map<string | null, DataListItem<TData>[]>()
  const normalizedParentById = new Map<string, string | null>()
  for (const item of items) {
    let parentId = item.parentId ?? null
    if (parentId === item.id) {
      report({
        code: "hierarchy-cycle",
        message: `Item "${item.id}" cannot be its own parent.`,
        itemId: item.id,
      })
      parentId = null
    } else if (parentId && !ids.has(parentId)) {
      report({
        code: "missing-parent",
        message: `Parent "${parentId}" for item "${item.id}" is not present in the same list section.`,
        itemId: item.id,
      })
      parentId = null
    }
    const siblings = children.get(parentId) ?? []
    siblings.push(item)
    children.set(parentId, siblings)
    normalizedParentById.set(item.id, parentId)
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const maxDepth = hierarchy.maxDepth ?? DATA_LIST_MAX_HIERARCHY_DEPTH
  const append = (
    item: DataListItem<TData>,
    depth: number,
    positionInSet: number,
    setSize: number
  ) => {
    if (visited.has(item.id)) return
    if (visiting.has(item.id)) {
      report({
        code: "hierarchy-cycle",
        message: `Hierarchy cycle includes item "${item.id}".`,
        itemId: item.id,
      })
      return
    }
    if (depth > maxDepth) {
      report({
        code: "hierarchy-depth",
        message: `Item "${item.id}" exceeds the maximum hierarchy depth of ${maxDepth}.`,
        itemId: item.id,
      })
      return
    }
    visiting.add(item.id)
    const itemChildren = children.get(item.id) ?? []
    entries.push({
      kind: "item",
      key: `item:${item.id}`,
      item,
      groupKey,
      depth: hierarchy.mode === "nested" ? depth : 0,
      hasChildren: itemChildren.length > 0,
      positionInSet,
      setSize,
    })
    visited.add(item.id)
    const defaultExpanded =
      hierarchy.mode !== "nested" || hierarchy.defaultExpanded !== false
    const expanded = toggledItems.has(item.id)
      ? !defaultExpanded
      : defaultExpanded
    if (expanded || hierarchy.mode === "flattened") {
      itemChildren.forEach((child, index) =>
        append(child, depth + 1, index + 1, itemChildren.length)
      )
    }
    visiting.delete(item.id)
  }

  const roots = children.get(null) ?? []
  roots.forEach((item, index) => append(item, 0, index + 1, roots.length))
  for (const item of items) {
    if (!visited.has(item.id)) {
      const ancestry = new Set<string>()
      let currentId: string | null = item.id
      let cyclic = false
      while (currentId) {
        if (ancestry.has(currentId)) {
          cyclic = true
          break
        }
        ancestry.add(currentId)
        currentId = normalizedParentById.get(currentId) ?? null
      }
      if (!cyclic) continue
      report({
        code: "hierarchy-cycle",
        message: `Item "${item.id}" was detached from a cyclic hierarchy and rendered at the root.`,
        itemId: item.id,
      })
      append(item, 0, roots.length + 1, roots.length + 1)
    }
  }
  return entries
}

export function buildDataListModel<TData>({
  config,
  query,
  collapsedGroups,
  toggledItems,
}: BuildDataListModelOptions<TData>): DataListModel<TData> {
  const diagnostics: DataListErrorContext[] = []
  const report = createDiagnosticsReporter(diagnostics)
  const itemsById = new Map<string, DataListItem<TData>>()
  for (const item of config.items) {
    if (!item.id || itemsById.has(item.id)) {
      report({
        code: "duplicate-item-id",
        message: item.id
          ? `Duplicate item ID "${item.id}" was ignored.`
          : "An item with an empty ID was ignored.",
        itemId: item.id,
      })
      continue
    }
    itemsById.set(item.id, item)
  }

  const propertiesById = new Map<string, DataListAnyProperty<TData>>()
  for (const property of config.properties ?? []) {
    if (!property.id || propertiesById.has(property.id)) {
      report({
        code: "duplicate-property-id",
        message: property.id
          ? `Duplicate property ID "${property.id}" was ignored.`
          : "A property with an empty ID was ignored.",
        propertyId: property.id,
      })
      continue
    }
    propertiesById.set(property.id, property)
  }

  const preferenceOrder = config.preferences?.propertyOrder ?? []
  const orderIndex = new Map(preferenceOrder.map((id, index) => [id, index]))
  const visibleIds = config.preferences?.visiblePropertyIds
    ? new Set(config.preferences.visiblePropertyIds)
    : null
  const visibleProperties = [...propertiesById.values()]
    .filter((property) => !visibleIds || visibleIds.has(property.id))
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })

  const accessorCache = new Map<string, Map<string, unknown>>()
  const getValue = (
    item: DataListItem<TData>,
    property: DataListAnyProperty<TData>
  ) => {
    let values = accessorCache.get(item.id)
    if (!values) {
      values = new Map()
      accessorCache.set(item.id, values)
    }
    if (values.has(property.id)) return values.get(property.id)
    try {
      const value = property.accessor(item.data)
      values.set(property.id, value)
      return value
    } catch (cause) {
      report({
        code: "operation",
        message: `Property accessor "${property.id}" failed for item "${item.id}".`,
        itemId: item.id,
        propertyId: property.id,
        cause,
      })
      values.set(property.id, undefined)
      return undefined
    }
  }

  const operations = config.operations ?? { mode: "client" as const }
  let operatedItems = [...itemsById.values()]
  const locale = operations.mode === "client" ? operations.locale : undefined
  const normalizedQuery = query.trim().toLocaleLowerCase(locale)
  const matchIds: string[] = []
  if (operations.mode === "client") {
    if (normalizedQuery) {
      operatedItems = operatedItems.filter((item) => {
        let text = ""
        try {
          text = operations.getSearchText?.(item) ?? ""
        } catch (cause) {
          report({
            code: "operation",
            message: `Search accessor failed for item "${item.id}".`,
            itemId: item.id,
            cause,
          })
        }
        if (!text) {
          text = [...propertiesById.values()]
            .filter((property) => property.capabilities?.searchable)
            .map((property) => safeString(getValue(item, property)))
            .join(" ")
        }
        const matches = text
          .toLocaleLowerCase(operations.locale)
          .includes(normalizedQuery)
        if (matches) matchIds.push(item.id)
        return matches
      })
    }
    for (const filter of operations.filters ?? []) {
      const property = filter.propertyId
        ? propertiesById.get(filter.propertyId)
        : undefined
      operatedItems = operatedItems.filter((item) => {
        try {
          return filter.predicate(
            item,
            property ? getValue(item, property) : undefined
          )
        } catch (cause) {
          report({
            code: "operation",
            message: `Filter "${filter.id}" failed for item "${item.id}".`,
            itemId: item.id,
            propertyId: filter.propertyId,
            cause,
          })
          return false
        }
      })
    }
    if (operations.sort?.length) {
      const collator = new Intl.Collator(operations.locale, {
        numeric: true,
        sensitivity: "base",
      })
      const originalIndex = new Map(
        operatedItems.map((item, index) => [item.id, index])
      )
      operatedItems.sort((left, right) => {
        for (const descriptor of operations.sort ?? []) {
          const property = propertiesById.get(descriptor.propertyId)
          if (!property?.capabilities?.sortable) continue
          const comparison = compareValues(
            getValue(left, property),
            getValue(right, property),
            collator
          )
          if (comparison !== 0) {
            return descriptor.direction === "ascending"
              ? comparison
              : -comparison
          }
        }
        return (
          (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0)
        )
      })
    }
  } else {
    matchIds.push(...operatedItems.map((item) => item.id))
  }
  if (!normalizedQuery) matchIds.push(...operatedItems.map((item) => item.id))

  // Populate the one-pass value cache for rendering. Renderers consume this
  // cache instead of invoking consumer accessors again for every commit.
  for (const item of operatedItems) {
    for (const property of visibleProperties) getValue(item, property)
  }

  const grouping = config.grouping ?? { mode: "none" as const }
  const groups: DataListResolvedGroup<TData>[] = []
  if (grouping.mode === "resolved") {
    const assigned = new Set<string>()
    for (const supplied of grouping.groups) {
      const suppliedItems = (supplied.items ?? [])
        .map((item) => itemsById.get(item.id))
        .filter((item): item is DataListItem<TData> => Boolean(item))
        .filter((item) => {
          if (assigned.has(item.id)) return false
          assigned.add(item.id)
          return operatedItems.some((operated) => operated.id === item.id)
        })
      groups.push({
        key: supplied.key,
        label: supplied.label,
        textLabel: supplied.textLabel ?? supplied.key,
        items: suppliedItems,
        count: suppliedItems.length,
        aggregate: supplied.aggregate,
        disabled: supplied.disabled,
      })
    }
    const unassigned = operatedItems.filter((item) => !assigned.has(item.id))
    if (unassigned.length) {
      groups.push({
        key: "__ungrouped__",
        label: "Ungrouped",
        textLabel: "Ungrouped",
        items: unassigned,
        count: unassigned.length,
      })
    }
  } else if (grouping.mode === "derived") {
    const buckets = new Map<string, DataListItem<TData>[]>()
    const ungroupedKey = grouping.ungroupedKey ?? "__ungrouped__"
    for (const item of operatedItems) {
      let key = ungroupedKey
      try {
        key = grouping.getKey(item) ?? ungroupedKey
      } catch (cause) {
        report({
          code: "operation",
          message: `Group accessor failed for item "${item.id}".`,
          itemId: item.id,
          cause,
        })
      }
      const bucket = buckets.get(key) ?? []
      bucket.push(item)
      buckets.set(key, bucket)
    }
    const definitions = new Map(
      (grouping.groups ?? []).map((group) => [group.key, group])
    )
    const orderedKeys = [
      ...(grouping.groups ?? []).map((group) => group.key),
      ...[...buckets.keys()].filter((key) => !definitions.has(key)),
    ]
    for (const key of orderedKeys) {
      const items = buckets.get(key) ?? []
      if (!items.length && !grouping.showEmptyGroups) continue
      const definition = definitions.get(key)
      const label =
        definition?.label ??
        (key === ungroupedKey
          ? (grouping.ungroupedLabel ?? "Ungrouped")
          : (grouping.getLabel?.(key) ?? key))
      groups.push({
        key,
        label,
        textLabel: definition?.textLabel ?? grouping.getTextLabel?.(key) ?? key,
        items,
        count: items.length,
        aggregate: definition?.aggregate,
        disabled: definition?.disabled,
      })
    }
  }

  const entries: DataListDisplayEntry<TData>[] = []
  if (grouping.mode === "none") {
    entries.push(
      ...flattenHierarchy(
        operatedItems,
        config,
        toggledItems,
        undefined,
        report
      )
    )
  } else {
    for (const group of groups) {
      entries.push({ kind: "group", key: `group:${group.key}`, group })
      if (!collapsedGroups.has(group.key)) {
        entries.push(
          ...flattenHierarchy(
            group.items,
            config,
            toggledItems,
            group.key,
            report
          )
        )
      }
    }
  }
  const itemEntries = entries.filter(
    (
      entry
    ): entry is Extract<
      DataListDisplayEntry<TData>,
      { readonly kind: "item" }
    > => entry.kind === "item"
  )

  return {
    entries,
    itemEntries,
    itemsById,
    propertiesById,
    visibleProperties,
    valuesByItemId: accessorCache,
    groups,
    matchIds,
    totalCount:
      operations.mode === "server"
        ? (operations.totalCount ?? itemsById.size)
        : itemsById.size,
    resultCount:
      operations.mode === "server"
        ? (operations.matchingCount ?? operatedItems.length)
        : operatedItems.length,
    loadedCount: operatedItems.length,
    filtered:
      normalizedQuery.length > 0 ||
      Boolean(operations.filters?.length) ||
      Boolean(operations.sort?.length),
    diagnostics,
  }
}
