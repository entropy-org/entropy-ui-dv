import type { ReactNode } from "react"

export type DataViewId = string
export type DataViewPropertyId = string
export type DataViewRecordId = string

export type DataViewJsonPrimitive = string | number | boolean | null
export type DataViewJsonValue =
  | DataViewJsonPrimitive
  | readonly DataViewJsonValue[]
  | { readonly [key: string]: DataViewJsonValue }

export interface DataViewRecordAdapter<TRecord> {
  readonly getId: (record: TRecord) => DataViewRecordId
  readonly getLabel: (record: TRecord) => string
  readonly getSearchText?: (record: TRecord) => string
  readonly getParentId?: (record: TRecord) => DataViewRecordId | null
  readonly getRank?: (record: TRecord) => string | null
}

export interface DataViewOption {
  readonly id: string
  readonly label: string
  readonly color?: string
  readonly disabled?: boolean
}

interface DataViewPropertyBase<TRecord, TValue> {
  readonly id: DataViewPropertyId
  readonly label: string
  readonly getValue: (record: TRecord) => TValue
  readonly description?: string
  readonly readOnly?: boolean
  readonly hidden?: boolean
}

export interface DataViewTitleProperty<TRecord>
  extends DataViewPropertyBase<TRecord, string> {
  readonly type: "title"
}

export interface DataViewTextProperty<TRecord>
  extends DataViewPropertyBase<TRecord, string | null> {
  readonly type: "text"
  readonly multiline?: boolean
}

export interface DataViewNumberProperty<TRecord>
  extends DataViewPropertyBase<TRecord, number | null> {
  readonly type: "number"
  readonly format?: "number" | "currency" | "percent"
  readonly currency?: string
}

export interface DataViewSelectProperty<TRecord>
  extends DataViewPropertyBase<TRecord, string | null> {
  readonly type: "select"
  readonly options: readonly DataViewOption[]
}

export interface DataViewMultiSelectProperty<TRecord>
  extends DataViewPropertyBase<TRecord, readonly string[]> {
  readonly type: "multi-select"
  readonly options: readonly DataViewOption[]
}

export interface DataViewDateProperty<TRecord>
  extends DataViewPropertyBase<TRecord, Date | string | null> {
  readonly type: "date"
  readonly includesTime?: boolean
}

export interface DataViewDateRangeValue {
  readonly start: Date | string
  readonly end: Date | string
}

export interface DataViewDateRangeProperty<TRecord>
  extends DataViewPropertyBase<TRecord, DataViewDateRangeValue | null> {
  readonly type: "date-range"
  readonly includesTime?: boolean
}

export interface DataViewCheckboxProperty<TRecord>
  extends DataViewPropertyBase<TRecord, boolean> {
  readonly type: "checkbox"
}

export interface DataViewUrlProperty<TRecord>
  extends DataViewPropertyBase<TRecord, string | null> {
  readonly type: "url"
}

export interface DataViewEmailProperty<TRecord>
  extends DataViewPropertyBase<TRecord, string | null> {
  readonly type: "email"
}

export interface DataViewPersonValue {
  readonly id: string
  readonly name: string
  readonly avatarUrl?: string
}

export interface DataViewPersonProperty<TRecord>
  extends DataViewPropertyBase<
    TRecord,
    DataViewPersonValue | readonly DataViewPersonValue[] | null
  > {
  readonly type: "person"
  readonly multiple?: boolean
}

export interface DataViewCustomProperty<TRecord>
  extends DataViewPropertyBase<TRecord, unknown> {
  readonly type: "custom"
  readonly valueType: string
  readonly renderValue?: (record: TRecord, value: unknown) => ReactNode
  readonly serializeFilterValue?: (value: unknown) => DataViewJsonValue
}

export type DataViewProperty<TRecord> =
  | DataViewTitleProperty<TRecord>
  | DataViewTextProperty<TRecord>
  | DataViewNumberProperty<TRecord>
  | DataViewSelectProperty<TRecord>
  | DataViewMultiSelectProperty<TRecord>
  | DataViewDateProperty<TRecord>
  | DataViewDateRangeProperty<TRecord>
  | DataViewCheckboxProperty<TRecord>
  | DataViewUrlProperty<TRecord>
  | DataViewEmailProperty<TRecord>
  | DataViewPersonProperty<TRecord>
  | DataViewCustomProperty<TRecord>

export interface DataViewSchema<TRecord> {
  readonly adapter: DataViewRecordAdapter<TRecord>
  readonly properties: readonly DataViewProperty<TRecord>[]
}

export type DataViewDataStatus =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly message?: string }
  | { readonly status: "ready"; readonly isFetching?: boolean }
  | {
      readonly status: "error"
      readonly error: unknown
      readonly hasStaleData: boolean
    }

export interface DataViewPageInfo {
  readonly totalCount?: number
  readonly hasNextPage: boolean
  readonly isLoadingNextPage?: boolean
}

export interface DataViewServerOperationRequest {
  readonly requestId: string
  readonly sourceId: string
  readonly viewId: DataViewId
  readonly query: DataViewQuery
  readonly reason: "search" | "filters" | "sorts" | "grouping" | "refresh"
}

export type DataViewDataSource<TRecord> =
  | {
      readonly mode: "client"
      readonly id: string
      readonly label?: string
      readonly records: readonly TRecord[]
      readonly status?: DataViewDataStatus
    }
  | {
      readonly mode: "server"
      readonly id: string
      readonly label?: string
      readonly records: readonly TRecord[]
      readonly status: DataViewDataStatus
      readonly pageInfo: DataViewPageInfo
      readonly onLoadMore?: () => void | Promise<void>
      readonly onRetry?: () => void
      readonly onQueryChange?: (
        request: DataViewServerOperationRequest
      ) => void | Promise<void>
    }

export type DataViewFilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "is-empty"
  | "is-not-empty"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal"
  | "before"
  | "after"
  | "on-or-before"
  | "on-or-after"

export type DataViewFilter =
  | {
      readonly type: "condition"
      readonly id: string
      readonly propertyId: DataViewPropertyId
      readonly operator: DataViewFilterOperator
      readonly value?: DataViewJsonValue
    }
  | {
      readonly type: "group"
      readonly id: string
      readonly operator: "and" | "or"
      readonly filters: readonly DataViewFilter[]
    }

export interface DataViewSort {
  readonly id: string
  readonly propertyId: DataViewPropertyId
  readonly direction: "ascending" | "descending"
}

export interface DataViewGroupingDescriptor {
  readonly id: string
  readonly propertyId: DataViewPropertyId
  readonly direction?: "ascending" | "descending"
}

export interface DataViewQuery {
  readonly search: string
  readonly filters: readonly DataViewFilter[]
  readonly sorts: readonly DataViewSort[]
  readonly grouping: readonly DataViewGroupingDescriptor[]
}

interface DataViewDefinitionBase {
  readonly visiblePropertyIds?: readonly DataViewPropertyId[]
}

export interface DataViewListDefinition extends DataViewDefinitionBase {
  readonly type: "list"
  readonly density?: "compact" | "default" | "comfortable"
  readonly groupByPropertyId?: DataViewPropertyId
  readonly showColumnHeaders?: boolean
}

export interface DataViewKanbanDefinition extends DataViewDefinitionBase {
  readonly type: "kanban"
  readonly groupByPropertyId: DataViewPropertyId
  readonly swimlaneByPropertyId?: DataViewPropertyId
  readonly cardSize?: "compact" | "comfortable"
}

export interface DataViewCalendarDefinition extends DataViewDefinitionBase {
  readonly type: "calendar"
  readonly datePropertyId: DataViewPropertyId
  readonly endDatePropertyId?: DataViewPropertyId
  readonly mode?: "month" | "week" | "agenda"
  readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  readonly showWeekends?: boolean
  readonly density?: "compact" | "comfortable"
  readonly timeZone?: string
  readonly timeFormat?: "12h" | "24h"
}

export interface DataViewTimelineDefinition extends DataViewDefinitionBase {
  readonly type: "timeline"
  readonly startDatePropertyId: DataViewPropertyId
  readonly endDatePropertyId: DataViewPropertyId
  readonly parentPropertyId?: DataViewPropertyId
  readonly zoom?:
    | "hours"
    | "day"
    | "week"
    | "bi-week"
    | "month"
    | "quarter"
    | "year"
}

export interface DataViewCustomDefinition extends DataViewDefinitionBase {
  readonly type: "custom"
  readonly pluginId: string
  readonly config: DataViewJsonValue
}

export type DataViewDefinition =
  | DataViewListDefinition
  | DataViewKanbanDefinition
  | DataViewCalendarDefinition
  | DataViewTimelineDefinition
  | DataViewCustomDefinition

export interface SavedDataView {
  readonly schemaVersion: 1
  readonly id: DataViewId
  readonly name: string
  readonly definition: DataViewDefinition
  readonly query: DataViewQuery
}

export type SavedDataViewChange =
  | { readonly type: "rename"; readonly viewId: DataViewId }
  | { readonly type: "query"; readonly viewId: DataViewId }
  | { readonly type: "configuration"; readonly viewId: DataViewId }
  | { readonly type: "reorder"; readonly viewId: DataViewId }

export type DataViewCreateRequest =
  | { readonly type: "list" | "kanban" | "calendar" | "timeline" }
  | { readonly type: "custom"; readonly pluginId: string }

export type DataViewFlowState<TRecord> =
  | { readonly mode: "closed" }
  | {
      readonly mode: "create"
      readonly viewId: DataViewId
      readonly initialValues?: Readonly<Record<DataViewPropertyId, unknown>>
    }
  | {
      readonly mode: "edit"
      readonly viewId: DataViewId
      readonly record: TRecord
    }

export type DataViewIntent<TRecord> =
  | {
      readonly type: "create-record"
      readonly view: SavedDataView
      readonly initialValues?: Readonly<Record<DataViewPropertyId, unknown>>
    }
  | {
      readonly type: "edit-record"
      readonly view: SavedDataView
      readonly record: TRecord
    }
  | {
      readonly type: "delete-records"
      readonly view: SavedDataView
      readonly records: readonly TRecord[]
    }
  | {
      readonly type: "update-property"
      readonly view: SavedDataView
      readonly record: TRecord
      readonly propertyId: DataViewPropertyId
      readonly value: unknown
    }

export type DataViewSelection =
  | { readonly type: "explicit"; readonly recordIds: readonly DataViewRecordId[] }
  | {
      readonly type: "all-matching"
      readonly excludedRecordIds: readonly DataViewRecordId[]
      readonly matchingCount?: number
    }

export interface DataViewRendererContext<TRecord> {
  readonly source: DataViewDataSource<TRecord>
  readonly schema: DataViewSchema<TRecord>
  readonly view: SavedDataView
  readonly readOnly: boolean
  readonly selectedRecordIds: ReadonlySet<DataViewRecordId>
  readonly setSelectedRecordIds: (
    recordIds: ReadonlySet<DataViewRecordId>
  ) => void
  readonly emitIntent: (intent: DataViewIntent<TRecord>) => void
  readonly updateView: (
    view: SavedDataView,
    change: SavedDataViewChange
  ) => void
}

export interface DataViewPlugin<TRecord> {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  readonly render: (context: DataViewRendererContext<TRecord>) => ReactNode
}

export interface DataViewController<TRecord> {
  readonly source: DataViewDataSource<TRecord>
  readonly schema: DataViewSchema<TRecord>
  readonly views: readonly SavedDataView[]
  readonly activeView: SavedDataView
  readonly readOnly: boolean
  readonly activateView: (viewId: DataViewId) => void
  readonly updateActiveView: (
    view: SavedDataView,
    change: SavedDataViewChange
  ) => void
  readonly emitIntent: (intent: DataViewIntent<TRecord>) => void
}

export const EMPTY_DATA_VIEW_QUERY: DataViewQuery = {
  search: "",
  filters: [],
  sorts: [],
  grouping: [],
}
