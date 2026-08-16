import type { ReactNode } from "react"
import type {
  TimelineDependency,
  TimelineItem,
  ViewportMode,
} from "./types.js"
import type { TimelineValidationIssue } from "./utils/data-validation.js"

/** Stable revision supplied by the server or query cache. */
export type TimelineDataVersion = string | number

/** Query state is deliberately supplied by the caller; Timeline never fetches. */
export type TimelineDataState =
  | {
      status: "loading"
      message?: string
    }
  | {
      status: "ready"
      isFetching?: boolean
      isFetchingPreviousPage?: boolean
      isFetchingNextPage?: boolean
      hasPreviousPage?: boolean
      hasNextPage?: boolean
    }
  | {
      status: "error"
      error: unknown
      message?: string
      /** Allows stale data to stay usable while a background refetch failed. */
      hasStaleData?: boolean
    }

export interface TimelineVisibleRange {
  start: Date
  end: Date
  viewportMode: ViewportMode
}

export interface TimelineRangeChangeMeta {
  reason: "mount" | "scroll" | "zoom" | "resize" | "data"
}

export interface TimelineLoadMoreRequest {
  direction: "previous" | "next"
  visibleRange: TimelineVisibleRange
}

/** Per-record authorization. Omitted fields default to true. */
export interface TimelineItemPermissions {
  view?: boolean
  select?: boolean
  move?: boolean
  resize?: boolean
  update?: boolean
  delete?: boolean
  changeParent?: boolean
  dependencies?: boolean
}

export type TimelineMutationKind =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "resize"
  | "bulk"
  | "dependency-add"
  | "dependency-remove"
  | "hierarchy"

interface TimelineMutationBase {
  operationId: string
  issuedAt: number
  baseDataVersion?: TimelineDataVersion
}

export type TimelineMutationIntent =
  | (TimelineMutationBase & {
      type: "create"
      item?: TimelineItem
      requestedRange: { startDate: Date; endDate: Date; rowIndex: number }
    })
  | (TimelineMutationBase & {
      type: "update"
      itemId: string
      changes: Partial<Omit<TimelineItem, "id">>
      previousItem: TimelineItem
    })
  | (TimelineMutationBase & {
      type: "delete"
      itemIds: string[]
      previousItems: TimelineItem[]
    })
  | (TimelineMutationBase & {
      type: "move"
      changes: Array<{
        itemId: string
        startDate: Date
        endDate: Date
        previousItem: TimelineItem
      }>
    })
  | (TimelineMutationBase & {
      type: "resize"
      itemId: string
      edge: "start" | "end"
      startDate: Date
      endDate: Date
      previousItem: TimelineItem
    })
  | (TimelineMutationBase & {
      type: "bulk"
      itemIds: string[]
      action: "duplicate" | "custom"
      payload?: unknown
      previousItems: TimelineItem[]
    })
  | (TimelineMutationBase & {
      type: "dependency-add"
      dependency: TimelineDependency
    })
  | (TimelineMutationBase & {
      type: "dependency-remove"
      dependency: TimelineDependency
    })
  | (TimelineMutationBase & {
      type: "hierarchy"
      itemId: string
      parentId?: string
      previousParentId?: string
      previousItem: TimelineItem
    })

/** Intent before operation metadata is assigned by Timeline. */
export type TimelineMutationDraft = TimelineMutationIntent extends infer Intent
  ? Intent extends TimelineMutationIntent
    ? Omit<Intent, keyof TimelineMutationBase>
    : never
  : never

export type TimelineMutationOutcome =
  | {
      status: "accepted"
      operationId?: string
      dataVersion?: TimelineDataVersion
      /** Canonical server records, when the mutation response includes them. */
      items?: TimelineItem[]
      dependencies?: TimelineDependency[]
    }
  | {
      status: "rejected"
      operationId?: string
      reason: string
      code?: string
      dataVersion?: TimelineDataVersion
      /** Latest records returned by a conflict response. */
      items?: TimelineItem[]
      dependencies?: TimelineDependency[]
    }

export type TimelineMutationHandler = (
  intent: TimelineMutationIntent
) => void | TimelineMutationOutcome | Promise<void | TimelineMutationOutcome>

export interface TimelineMutationResultMeta {
  intent: TimelineMutationIntent
  outcome: TimelineMutationOutcome
  /** False means a newer operation superseded this response. */
  isLatestForAffectedItems: boolean
}

export type TimelineRendererErrorInfo = {
  surface: "bar" | "sidebar" | "empty" | "loading" | "error"
  item?: TimelineItem
  error: unknown
}

export type TimelineProductionConfig = {
  dataState?: TimelineDataState
  dataVersion?: TimelineDataVersion
  optimisticUpdates?: boolean
  getItemVersion?: (item: TimelineItem) => TimelineDataVersion | undefined
  getItemPermissions?: (item: TimelineItem) => TimelineItemPermissions
  getItemAriaLabel?: (item: TimelineItem) => string
  onMutation?: TimelineMutationHandler
  onMutationResult?: (meta: TimelineMutationResultMeta) => void
  onVisibleRangeChange?: (
    range: TimelineVisibleRange,
    meta: TimelineRangeChangeMeta
  ) => void
  onLoadMore?: (request: TimelineLoadMoreRequest) => void
  onRetry?: () => void
  onDataValidationError?: (issues: TimelineValidationIssue[]) => void
  onInteractionCancel?: (details: {
    itemIds: string[]
    reason: "escape" | "pointer-cancel" | "permission-change" | "live-update"
  }) => void
  loadMoreThresholdPx?: number
  renderLoadingState?: () => ReactNode
  renderErrorState?: (error: unknown, retry?: () => void) => ReactNode
  renderRendererError?: (info: TimelineRendererErrorInfo) => ReactNode
}
