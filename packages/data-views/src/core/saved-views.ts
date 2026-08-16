import {
  EMPTY_DATA_VIEW_QUERY,
  type DataViewDefinition,
  type DataViewJsonValue,
  type DataViewQuery,
  type SavedDataView,
} from "./types.js"

export interface SavedDataViewIssue {
  readonly path: string
  readonly code:
    | "invalid-shape"
    | "invalid-version"
    | "duplicate-id"
    | "missing-property"
    | "missing-plugin"
    | "not-serializable"
  readonly message: string
}

export interface SavedDataViewValidationOptions {
  readonly propertyIds?: ReadonlySet<string>
  readonly pluginIds?: ReadonlySet<string>
}

export interface SavedDataViewMigrationResult {
  readonly views: readonly SavedDataView[]
  readonly issues: readonly SavedDataViewIssue[]
  readonly migrated: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, seen = new Set<object>()): value is DataViewJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value)
  }
  if (typeof value !== "object") return false
  if (seen.has(value)) return false
  seen.add(value)
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, seen))
    : Object.values(value).every((entry) => isJsonValue(entry, seen))
  seen.delete(value)
  return valid
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function readQuery(value: unknown): DataViewQuery | null {
  if (!isObject(value)) return null
  const { search, filters, sorts, grouping = [] } = value
  if (
    typeof search !== "string" ||
    !Array.isArray(filters) ||
    !Array.isArray(sorts) ||
    !isJsonValue(filters) ||
    !isJsonValue(sorts) ||
    !Array.isArray(grouping) ||
    !isJsonValue(grouping)
  ) {
    return null
  }
  return { search, filters, sorts, grouping } as DataViewQuery
}

function hasOptionalStringArray(
  value: Record<string, unknown>,
  key: string
) {
  return value[key] === undefined || isStringArray(value[key])
}

function readDefinition(value: unknown): DataViewDefinition | null {
  if (!isObject(value) || typeof value.type !== "string") return null
  if (!hasOptionalStringArray(value, "visiblePropertyIds")) return null

  if (value.type === "list") {
    if (
      value.groupByPropertyId !== undefined &&
      typeof value.groupByPropertyId !== "string"
    ) {
      return null
    }
    return value as unknown as DataViewDefinition
  }
  if (value.type === "kanban") {
    return typeof value.groupByPropertyId === "string"
      ? (value as unknown as DataViewDefinition)
      : null
  }
  if (value.type === "calendar") {
    return typeof value.datePropertyId === "string"
      ? (value as unknown as DataViewDefinition)
      : null
  }
  if (value.type === "timeline") {
    return typeof value.startDatePropertyId === "string" &&
      typeof value.endDatePropertyId === "string"
      ? (value as unknown as DataViewDefinition)
      : null
  }
  if (value.type === "custom") {
    return typeof value.pluginId === "string" && isJsonValue(value.config)
      ? (value as unknown as DataViewDefinition)
      : null
  }
  return null
}

function readVersionOneView(value: unknown): SavedDataView | null {
  if (!isObject(value)) return null
  const definition = readDefinition(value.definition)
  const query = readQuery(value.query)
  if (
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    definition === null ||
    query === null
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    id: value.id,
    name: value.name,
    definition,
    query,
  }
}

function migrateVersionZeroView(value: unknown): SavedDataView | null {
  if (!isObject(value)) return null
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.type !== "string"
  ) {
    return null
  }
  const config = isObject(value.config) ? value.config : {}
  const definition = readDefinition({ type: value.type, ...config })
  if (!definition) return null
  return {
    schemaVersion: 1,
    id: value.id,
    name: value.name,
    definition,
    query: readQuery(value.query) ?? EMPTY_DATA_VIEW_QUERY,
  }
}

function collectDefinitionPropertyIds(definition: DataViewDefinition) {
  const ids = [...(definition.visiblePropertyIds ?? [])]
  if (definition.type === "list" && definition.groupByPropertyId) {
    ids.push(definition.groupByPropertyId)
  }
  if (definition.type === "kanban") {
    ids.push(definition.groupByPropertyId)
    if (definition.swimlaneByPropertyId) ids.push(definition.swimlaneByPropertyId)
  }
  if (definition.type === "calendar") {
    ids.push(definition.datePropertyId)
    if (definition.endDatePropertyId) ids.push(definition.endDatePropertyId)
  }
  if (definition.type === "timeline") {
    ids.push(definition.startDatePropertyId, definition.endDatePropertyId)
    if (definition.parentPropertyId) ids.push(definition.parentPropertyId)
  }
  return ids
}

export function validateSavedDataViews(
  views: readonly SavedDataView[],
  options: SavedDataViewValidationOptions = {}
) {
  const issues: SavedDataViewIssue[] = []
  const seen = new Set<string>()

  views.forEach((view, index) => {
    const path = `[${index}]`
    if (seen.has(view.id)) {
      issues.push({
        path: `${path}.id`,
        code: "duplicate-id",
        message: `Saved view id "${view.id}" is duplicated.`,
      })
    }
    seen.add(view.id)

    if (!isJsonValue(view)) {
      issues.push({
        path,
        code: "not-serializable",
        message: "Saved views must contain JSON-serializable data only.",
      })
    }

    if (options.propertyIds) {
      for (const propertyId of collectDefinitionPropertyIds(view.definition)) {
        if (!options.propertyIds.has(propertyId)) {
          issues.push({
            path: `${path}.definition`,
            code: "missing-property",
            message: `Property "${propertyId}" is not present in the data schema.`,
          })
        }
      }
      const visitFilter = (
        filter: DataViewQuery["filters"][number],
        filterPath: string
      ) => {
        if (filter.type === "group") {
          filter.filters.forEach((child, childIndex) =>
            visitFilter(child, `${filterPath}.filters[${childIndex}]`)
          )
        } else if (!options.propertyIds?.has(filter.propertyId)) {
          issues.push({
            path: `${filterPath}.propertyId`,
            code: "missing-property",
            message: `Property "${filter.propertyId}" is not present in the data schema.`,
          })
        }
      }
      view.query.filters.forEach((filter, filterIndex) =>
        visitFilter(filter, `${path}.query.filters[${filterIndex}]`)
      )
      view.query.sorts.forEach((sort, sortIndex) => {
        if (!options.propertyIds?.has(sort.propertyId)) {
          issues.push({
            path: `${path}.query.sorts[${sortIndex}].propertyId`,
            code: "missing-property",
            message: `Property "${sort.propertyId}" is not present in the data schema.`,
          })
        }
      })
      view.query.grouping.forEach((group, groupIndex) => {
        if (!options.propertyIds?.has(group.propertyId)) {
          issues.push({
            path: `${path}.query.grouping[${groupIndex}].propertyId`,
            code: "missing-property",
            message: `Property "${group.propertyId}" is not present in the data schema.`,
          })
        }
      })
    }

    if (
      view.definition.type === "custom" &&
      options.pluginIds &&
      !options.pluginIds.has(view.definition.pluginId)
    ) {
      issues.push({
        path: `${path}.definition.pluginId`,
        code: "missing-plugin",
        message: `Plugin "${view.definition.pluginId}" is not registered.`,
      })
    }
  })

  return issues
}

export function migrateSavedDataViews(
  input: unknown,
  options: SavedDataViewValidationOptions = {}
): SavedDataViewMigrationResult {
  if (!Array.isArray(input)) {
    return {
      views: [],
      migrated: false,
      issues: [
        {
          path: "$",
          code: "invalid-shape",
          message: "Saved views must be supplied as an array.",
        },
      ],
    }
  }

  let migrated = false
  const views: SavedDataView[] = []
  const issues: SavedDataViewIssue[] = []
  input.forEach((candidate, index) => {
    const versionOne = readVersionOneView(candidate)
    if (versionOne) {
      views.push(versionOne)
      return
    }
    const versionZero = migrateVersionZeroView(candidate)
    if (versionZero) {
      migrated = true
      views.push(versionZero)
      return
    }
    issues.push({
      path: `[${index}]`,
      code:
        isObject(candidate) && "schemaVersion" in candidate
          ? "invalid-version"
          : "invalid-shape",
      message: "Saved view could not be read or migrated.",
    })
  })

  issues.push(...validateSavedDataViews(views, options))
  return { views, issues, migrated }
}

export function createSavedDataView(
  input: Omit<SavedDataView, "schemaVersion" | "query"> & {
    readonly query?: DataViewQuery
  }
): SavedDataView {
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    definition: input.definition,
    query: input.query ?? EMPTY_DATA_VIEW_QUERY,
  }
}
