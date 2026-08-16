import type { ReactNode } from "react"
import type {
  DATA_LIST_DENSITIES,
  DATA_LIST_HIERARCHY_MODES,
  DATA_LIST_SEMANTIC_MODES,
} from "./constants.js"

export type DataListDensity = (typeof DATA_LIST_DENSITIES)[number]
export type DataListHierarchyMode = (typeof DATA_LIST_HIERARCHY_MODES)[number]
export type DataListSemanticMode = (typeof DATA_LIST_SEMANTIC_MODES)[number]

export interface DataListItem<TData> {
  readonly id: string
  readonly rank?: string
  readonly parentId?: string
  readonly data: TData
}

export interface DataListPropertyCapabilities {
  readonly searchable?: boolean
  readonly sortable?: boolean
  readonly filterable?: boolean
  readonly editable?: boolean
  readonly required?: boolean
  readonly collapsible?: boolean
  readonly priority?: number
}

export interface DataListItemState {
  readonly selected: boolean
  readonly focused: boolean
  readonly pending: boolean
  readonly readOnly: boolean
}

export interface ListPropertyRenderContext<TData, TValue> {
  readonly item: DataListItem<TData>
  readonly value: TValue
  readonly state: DataListItemState
}

export interface ListEditorRenderContext<TData, TValue> {
  readonly item: DataListItem<TData>
  readonly value: TValue
  readonly error?: string
  readonly validating: boolean
  readonly pending: boolean
  readonly setValue: (value: TValue) => void
  readonly commit: () => void
  readonly cancel: () => void
}

export type DataListValidationResult =
  { readonly valid: true } | { readonly valid: false; readonly message: string }

export interface DataListEditor<TData, TValue> {
  readonly render?: (
    context: ListEditorRenderContext<TData, TValue>
  ) => ReactNode
  readonly validate?: (
    value: TValue,
    item: DataListItem<TData>
  ) => DataListValidationResult | Promise<DataListValidationResult>
  readonly commitOnBlur?: boolean
}

export interface DataListProperty<TData, TValue = unknown> {
  readonly id: string
  readonly label: string
  readonly accessor: (data: TData) => TValue
  readonly render: (
    context: ListPropertyRenderContext<TData, TValue>
  ) => ReactNode
  readonly capabilities?: DataListPropertyCapabilities
  readonly editor?: DataListEditor<TData, TValue>
  readonly className?: string
}

/** Existential property type used by heterogeneous property collections. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataListAnyProperty<TData> = DataListProperty<TData, any>

export interface DataListTitleRenderContext<TData> {
  readonly item: DataListItem<TData>
  readonly state: DataListItemState
}

export interface DataListGroup<TData> {
  readonly key: string
  readonly label: ReactNode
  readonly textLabel?: string
  readonly data?: unknown
  readonly aggregate?: ReactNode
  readonly disabled?: boolean
  readonly items?: readonly DataListItem<TData>[]
}

export type DataListGrouping<TData> =
  | { readonly mode: "none" }
  | {
      readonly mode: "derived"
      readonly getKey: (item: DataListItem<TData>) => string | null | undefined
      readonly getLabel?: (key: string) => ReactNode
      readonly getTextLabel?: (key: string) => string
      readonly groups?: readonly DataListGroup<TData>[]
      readonly showEmptyGroups?: boolean
      readonly collapsible?: boolean
      readonly ungroupedKey?: string
      readonly ungroupedLabel?: ReactNode
      readonly onAdd?: (context: DataListAddContext) => void
      readonly renderHeader?: (
        context: DataListGroupRenderContext<TData>
      ) => ReactNode
    }
  | {
      readonly mode: "resolved"
      readonly groups: readonly DataListGroup<TData>[]
      readonly collapsible?: boolean
      readonly onAdd?: (context: DataListAddContext) => void
      readonly renderHeader?: (
        context: DataListGroupRenderContext<TData>
      ) => ReactNode
    }

export interface DataListGroupRenderContext<TData> {
  readonly group: DataListResolvedGroup<TData>
  readonly collapsed: boolean
}

export interface DataListResolvedGroup<TData> {
  readonly key: string
  readonly label: ReactNode
  readonly textLabel: string
  readonly items: readonly DataListItem<TData>[]
  readonly count: number
  readonly totalCount?: number
  readonly aggregate?: ReactNode
  readonly disabled?: boolean
}

export interface DataListAddContext {
  readonly groupKey?: string
  readonly parentId?: string
}

export interface DataListSortDescriptor {
  readonly propertyId: string
  readonly direction: "ascending" | "descending"
}

export interface DataListServerFilter {
  readonly id: string
  readonly propertyId?: string
  readonly operator?: string
  readonly value?: unknown
}

export interface DataListServerOperationState {
  readonly query: string
  readonly filters: readonly DataListServerFilter[]
  readonly sort: readonly DataListSortDescriptor[]
}

export interface DataListServerOperationRequest extends DataListServerOperationState {
  readonly reason: "search" | "filters" | "sort" | "refresh"
  /** Monotonically increasing within one DataList instance. */
  readonly requestId: string
}

export type DataListServerPagination =
  | {
      readonly mode: "page"
      /** Zero-based page index. */
      readonly pageIndex: number
      readonly pageSize: number
      readonly pageCount?: number
      readonly hasPreviousPage?: boolean
      readonly hasNextPage?: boolean
      readonly pending?: boolean
      readonly onPageChange: (pageIndex: number) => void
    }
  | {
      readonly mode: "infinite"
      readonly hasNextPage: boolean
      readonly fetchingNextPage?: boolean
      readonly loadMoreError?: Error | string
      readonly autoLoad?: boolean
      readonly loadMoreThreshold?: number
      readonly onLoadMore: () => void | Promise<void>
    }

export interface DataListFilter<TData> {
  readonly id: string
  readonly propertyId?: string
  readonly predicate: (
    item: DataListItem<TData>,
    value: unknown | undefined
  ) => boolean
}

export type DataListSearch =
  | {
      readonly mode: "local"
      readonly defaultQuery?: string
      readonly onQueryChange?: (query: string) => void
      readonly placeholder?: string
    }
  | {
      readonly mode: "controlled"
      readonly query: string
      readonly onQueryChange: (query: string) => void
      readonly placeholder?: string
    }

export type DataListOperations<TData> =
  | {
      readonly mode: "client"
      readonly search?: DataListSearch
      readonly getSearchText?: (item: DataListItem<TData>) => string
      readonly filters?: readonly DataListFilter<TData>[]
      readonly sort?: readonly DataListSortDescriptor[]
      readonly locale?: string
    }
  | {
      readonly mode: "server"
      readonly search?: DataListSearch
      readonly filters?: readonly DataListServerFilter[]
      readonly sort?: readonly DataListSortDescriptor[]
      readonly totalCount?: number
      readonly matchingCount?: number
      readonly pending?: boolean
      readonly error?: Error | string
      readonly manualOrderAllowed?: boolean
      readonly pagination?: DataListServerPagination
      readonly onOperationsChange?: (
        operations: DataListServerOperationRequest
      ) => void
    }

export type DataListHierarchy =
  | { readonly mode: "disabled" }
  | { readonly mode: "flattened"; readonly maxDepth?: number }
  | {
      readonly mode: "nested"
      readonly maxDepth?: number
      readonly defaultExpanded?: boolean
      readonly allowReparent?: boolean
    }

export type DataListSelectionDescriptor =
  | { readonly kind: "explicit"; readonly ids: readonly string[] }
  | {
      readonly kind: "all-matching"
      readonly excludedIds: readonly string[]
      readonly matchingCount?: number
    }

export interface DataListSelectionChange {
  readonly selection: DataListSelectionDescriptor
  readonly reason:
    | "replace"
    | "toggle"
    | "range"
    | "visible"
    | "all-matching"
    | "clear"
    | "reconcile"
}

export type DataListSelection =
  | { readonly mode: "none" }
  | {
      readonly mode: "single" | "multiple"
      readonly value?: DataListSelectionDescriptor
      readonly defaultValue?: DataListSelectionDescriptor
      readonly allowAllMatching?: boolean
      readonly onChange?: (change: DataListSelectionChange) => void
    }

export interface DataListPreferences {
  readonly density?: DataListDensity
  readonly visiblePropertyIds?: readonly string[]
  readonly propertyOrder?: readonly string[]
}

export type DataListStatus =
  | { readonly state: "ready" }
  | {
      readonly state: "loading"
      readonly phase?: "initial" | "refresh"
      readonly message?: string
    }
  | {
      readonly state: "error"
      readonly phase?: "initial" | "refresh"
      readonly error: Error | string
      readonly onRetry?: () => void | Promise<void>
    }
  | { readonly state: "no-access"; readonly message?: string }

export interface DataListEditCommand {
  readonly type: "edit"
  readonly itemId: string
  readonly propertyId: string
  readonly previousValue: unknown
  readonly proposedValue: unknown
  readonly mutationId: string
}

export interface DataListReorderCommand {
  readonly type: "reorder"
  readonly itemIds: readonly string[]
  readonly beforeId?: string
  readonly afterId?: string
  readonly destinationGroupKey?: string
  readonly destinationParentId?: string
  readonly mutationId: string
}

export interface DataListDeleteCommand {
  readonly type: "delete"
  readonly selection: DataListSelectionDescriptor
  readonly mutationId: string
}

export interface DataListDuplicateCommand {
  readonly type: "duplicate"
  readonly selection: DataListSelectionDescriptor
  readonly mutationId: string
}

export interface DataListRestoreCommand {
  readonly type: "restore"
  readonly itemIds: readonly string[]
  readonly mutationId: string
}

export type DataListCommand =
  | DataListEditCommand
  | DataListReorderCommand
  | DataListDeleteCommand
  | DataListDuplicateCommand
  | DataListRestoreCommand

export type DataListMutationResult =
  | { readonly status: "accepted" }
  | { readonly status: "await-authoritative" }
  | { readonly status: "rejected"; readonly error: unknown }

export type DataListMutationHandler<TCommand extends DataListCommand> = (
  command: TCommand
) => void | DataListMutationResult | Promise<void | DataListMutationResult>

export type DataListMutationSettlement =
  | { readonly mutationId: string; readonly status: "accepted" }
  | {
      readonly mutationId: string
      readonly status: "rejected"
      readonly error: unknown
    }

export interface DataListCommandSettledContext {
  readonly command: DataListCommand
  readonly status: "accepted" | "rejected"
  readonly source: "handler" | "authoritative" | "external"
  readonly error?: unknown
}

export interface DataListCommandRejectedContext {
  readonly command: DataListCommand
  readonly error: unknown
}

export interface DataListRowActionContext<TData> {
  readonly item: DataListItem<TData>
  readonly state: DataListItemState
}

export interface DataListBulkActionContext<TData> {
  readonly selection: DataListSelectionDescriptor
  readonly selectedItems: readonly DataListItem<TData>[]
  readonly clearSelection: () => void
}

export interface DataListErrorContext {
  readonly code:
    | "duplicate-item-id"
    | "duplicate-property-id"
    | "missing-parent"
    | "hierarchy-cycle"
    | "hierarchy-depth"
    | "invalid-property"
    | "renderer"
    | "operation"
  readonly message: string
  readonly itemId?: string
  readonly propertyId?: string
  readonly cause?: unknown
}

export interface DataListEnvironment {
  readonly createMutationId?: () => string
  readonly scheduleAnimationFrame?: (callback: FrameRequestCallback) => number
  readonly cancelAnimationFrame?: (id: number) => void
}

export interface DataListVirtualizationOptions {
  readonly enabled?: boolean
  readonly threshold?: number
  readonly overscan?: number
  readonly estimateRowHeight?: number
  readonly maxHeight?: number | string
  readonly initialHeight?: number
}

export interface DataListRenderControlsContext {
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly resultCount: number
  readonly loadedCount: number
  readonly requestServerOperations?: (
    next: Partial<DataListServerOperationState>,
    reason: "filters" | "sort" | "refresh"
  ) => void
}

export interface DataListConfig<TData> {
  readonly items: readonly DataListItem<TData>[]
  readonly properties?: readonly DataListAnyProperty<TData>[]
  readonly renderTitle: (
    context: DataListTitleRenderContext<TData>
  ) => ReactNode
  readonly getItemLabel?: (item: DataListItem<TData>) => string
  readonly renderIcon?: (
    context: DataListTitleRenderContext<TData>
  ) => ReactNode
  readonly titleEditor?: DataListEditor<TData, string> & {
    readonly accessor: (data: TData) => string
  }
  readonly grouping?: DataListGrouping<TData>
  readonly hierarchy?: DataListHierarchy
  readonly operations?: DataListOperations<TData>
  readonly selection?: DataListSelection
  readonly preferences?: DataListPreferences
  readonly status?: DataListStatus
  readonly semanticMode?: DataListSemanticMode
  readonly clickBehavior?: "select" | "activate" | "select-and-activate"
  readonly readOnly?: boolean
  readonly virtualization?: boolean | DataListVirtualizationOptions
  readonly renderControls?: (
    context: DataListRenderControlsContext
  ) => ReactNode
  readonly renderRowActions?: (
    context: DataListRowActionContext<TData>
  ) => ReactNode
  readonly renderBulkActions?: (
    context: DataListBulkActionContext<TData>
  ) => ReactNode
  readonly renderEmpty?: (filtered: boolean) => ReactNode
  readonly renderLoading?: () => ReactNode
  readonly renderError?: (error: Error | string) => ReactNode
  readonly renderNoAccess?: () => ReactNode
  readonly onActivate?: (item: DataListItem<TData>) => void
  readonly onContextMenu?: (
    item: DataListItem<TData>,
    event: MouseEvent
  ) => void
  readonly onEdit?: DataListMutationHandler<DataListEditCommand>
  readonly onReorder?: DataListMutationHandler<DataListReorderCommand>
  readonly onDelete?: DataListMutationHandler<DataListDeleteCommand>
  readonly onDuplicate?: DataListMutationHandler<DataListDuplicateCommand>
  readonly onRestore?: DataListMutationHandler<DataListRestoreCommand>
  readonly onUndoCommand?: (command: DataListCommand) => void | Promise<void>
  readonly onRedoCommand?: (command: DataListCommand) => void | Promise<void>
  /** External settlement is useful when the server canonicalizes an optimistic value. */
  readonly mutationSettlements?: readonly DataListMutationSettlement[]
  readonly onCommandSettled?: (context: DataListCommandSettledContext) => void
  readonly onCommandRejected?: (context: DataListCommandRejectedContext) => void
  readonly onPreferencesChange?: (preferences: DataListPreferences) => void
  readonly onError?: (context: DataListErrorContext) => void
  readonly environment?: DataListEnvironment
}

export type DataListDisplayEntry<TData> =
  | {
      readonly kind: "group"
      readonly key: string
      readonly group: DataListResolvedGroup<TData>
    }
  | {
      readonly kind: "item"
      readonly key: string
      readonly item: DataListItem<TData>
      readonly groupKey?: string
      readonly depth: number
      readonly hasChildren: boolean
      readonly positionInSet: number
      readonly setSize: number
    }

export interface DataListModel<TData> {
  readonly entries: readonly DataListDisplayEntry<TData>[]
  readonly itemEntries: readonly Extract<
    DataListDisplayEntry<TData>,
    { readonly kind: "item" }
  >[]
  readonly itemsById: ReadonlyMap<string, DataListItem<TData>>
  readonly propertiesById: ReadonlyMap<string, DataListAnyProperty<TData>>
  readonly visibleProperties: readonly DataListAnyProperty<TData>[]
  readonly valuesByItemId: ReadonlyMap<string, ReadonlyMap<string, unknown>>
  readonly groups: readonly DataListResolvedGroup<TData>[]
  readonly matchIds: readonly string[]
  readonly totalCount: number
  readonly resultCount: number
  readonly loadedCount: number
  readonly filtered: boolean
  readonly diagnostics: readonly DataListErrorContext[]
}
