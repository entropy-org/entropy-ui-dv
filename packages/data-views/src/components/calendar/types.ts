import type { ReactNode } from "react"

/** Supported desktop calendar surfaces. */
export type CalendarViewMode = "month" | "week" | "agenda"

/** Canonical date-only value in `YYYY-MM-DD` form. */
export type CalendarDate = string

export type CalendarTimeFormat = "12h" | "24h"
export type CalendarDensity = "compact" | "comfortable"
export type CalendarOverflowBehavior = "popover" | "expand-week"
export type CalendarWeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type CalendarAgendaDayCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type CalendarAgendaSnapMinutes = 5 | 10 | 15 | 30 | 60

/** Stable descriptor used as a TanStack Query key segment. */
export interface CalendarQueryRange {
  readonly key: string
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
  readonly timeZone: string
  readonly viewMode: CalendarViewMode
}

export type CalendarDataStatus =
  | {
      readonly status: "loading"
      readonly rangeKey: string
    }
  | {
      readonly status: "ready"
      readonly rangeKey: string
      readonly coverage?: "complete" | "partial"
      readonly updatedAt?: number
    }
  | {
      readonly status: "refreshing"
      readonly rangeKey: string
      readonly coverage?: "complete" | "partial"
      readonly updatedAt?: number
    }
  | {
      readonly status: "error"
      readonly rangeKey: string
      readonly error: unknown
      readonly hasUsableData: boolean
    }

export interface CalendarDataPresentation {
  readonly status: "ready" | "loading" | "refreshing" | "error" | "stale"
  readonly busy: boolean
  readonly blocksContent: boolean
  readonly partial: boolean
  readonly error?: unknown
}

/** Static capability flags. Omitted flags default to allowed. */
export interface CalendarPermissions {
  readonly view?: boolean
  readonly create?: boolean
  readonly update?: boolean
  readonly delete?: boolean
  readonly duplicate?: boolean
  readonly convert?: boolean
}

/** Identity attached to a consumer-expanded recurring occurrence. */
export type CalendarOccurrenceIdentity =
  | {
      readonly type: "all-day"
      readonly seriesId: string
      readonly occurrenceId: string
      readonly originalStartDate: CalendarDate
      readonly exception: "generated" | "modified"
    }
  | {
      readonly type: "timed"
      readonly seriesId: string
      readonly occurrenceId: string
      readonly originalStart: Date
      readonly exception: "generated" | "modified"
    }

export type CalendarAgendaSpan =
  | { readonly type: "day" }
  | { readonly type: "week" }
  | { readonly type: "custom"; readonly dayCount: CalendarAgendaDayCount }

export interface CalendarAgendaPreferences {
  readonly span: CalendarAgendaSpan
  readonly snapMinutes: CalendarAgendaSnapMinutes
  readonly hourHeight: number
  readonly workingHours: {
    readonly startMinutes: number
    readonly endMinutes: number
  }
  readonly initialScrollMinutes: number
  readonly showAllDaySection: boolean
}

export interface CalendarSource {
  readonly id: string
  readonly label: string
  readonly color?: string
  readonly disabled?: boolean
  readonly permissions?: CalendarPermissions
  readonly data?: unknown
}

export interface CalendarSourceRenderState {
  readonly visible: boolean
  readonly disabled: boolean
}

export type CalendarAgendaSidebarConfig =
  | { readonly type: "hidden" }
  | {
      readonly type: "default"
      readonly defaultWidth?: number
      readonly resizable?: boolean
      readonly showMiniMonth?: boolean
      readonly calendars: readonly CalendarSource[]
      readonly renderCalendarSource?: (
        source: CalendarSource,
        state: CalendarSourceRenderState
      ) => ReactNode
    }
  | {
      readonly type: "custom"
      readonly defaultWidth?: number
      readonly resizable?: boolean
      readonly render: (context: {
        readonly anchorDate: CalendarDate
        readonly navigateToDate: (date: CalendarDate) => void
        readonly close: () => void
      }) => ReactNode
    }

export interface CalendarAgendaRenderState extends CalendarItemRenderState {
  readonly segmentDate: CalendarDate
  readonly continuedBefore: boolean
  readonly continuedAfter: boolean
}

interface CalendarItemBase {
  readonly id: string
  readonly calendarId?: string
  readonly permissions?: CalendarPermissions
  readonly occurrence?: CalendarOccurrenceIdentity
  readonly data: unknown
}

/** Date-only item with an inclusive end date. */
export interface AllDayCalendarItem extends CalendarItemBase {
  readonly kind: "all-day"
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
}

/** Instant-based item with a half-open `[start, end)` range. */
export interface TimedCalendarItem extends CalendarItemBase {
  readonly kind: "timed"
  readonly start: Date
  readonly end: Date
}

export type CalendarItem = AllDayCalendarItem | TimedCalendarItem

export type CalendarRange =
  | {
      readonly kind: "all-day"
      readonly startDate: CalendarDate
      readonly endDate: CalendarDate
    }
  | {
      readonly kind: "timed"
      readonly start: Date
      readonly end: Date
    }

/** Inclusive date-only span used by layout and clipping algorithms. */
export interface CalendarDateSpan {
  readonly startDate: CalendarDate
  readonly endDate: CalendarDate
}

export interface CalendarItemRangeChange {
  readonly itemId: string
  readonly previousRange: CalendarRange
  readonly nextRange: CalendarRange
}

interface CalendarMutationCommandBase {
  readonly clientMutationId: string
}

/** Reversible scheduling intent emitted to the consumer's data layer. */
export type CalendarMutationCommand =
  | (CalendarMutationCommandBase & {
      readonly type: "move"
      readonly changes: readonly CalendarItemRangeChange[]
    })
  | (CalendarMutationCommandBase & {
      readonly type: "resize"
      readonly itemId: string
      readonly edge: "start" | "end"
      readonly previousRange: CalendarRange
      readonly nextRange: CalendarRange
    })
  | (CalendarMutationCommandBase & {
      readonly type: "delete"
      readonly itemIds: readonly string[]
    })
  | (CalendarMutationCommandBase & {
      readonly type: "restore"
      readonly itemIds: readonly string[]
    })

/** Server-owned UI preferences supplied as one controlled value. */
export interface CalendarPreferences {
  viewMode: CalendarViewMode
  weekStartsOn: CalendarWeekStartsOn
  showWeekends: boolean
  density: CalendarDensity
  maxVisibleLanes: number
  overflowBehavior: CalendarOverflowBehavior
  visibleCalendarIds: readonly string[]
  timeZone: string
  timeFormat: CalendarTimeFormat
  agenda: CalendarAgendaPreferences
}

export type CalendarPreferencesChange =
  | { readonly type: "view-mode"; readonly value: CalendarViewMode }
  | { readonly type: "week-start"; readonly value: CalendarWeekStartsOn }
  | { readonly type: "weekends"; readonly value: boolean }
  | { readonly type: "density"; readonly value: CalendarDensity }
  | { readonly type: "max-visible-lanes"; readonly value: number }
  | {
      readonly type: "overflow-behavior"
      readonly value: CalendarOverflowBehavior
    }
  | {
      readonly type: "visible-calendars"
      readonly value: readonly string[]
    }
  | { readonly type: "time-zone"; readonly value: string }
  | { readonly type: "time-format"; readonly value: CalendarTimeFormat }
  | {
      readonly type: "agenda-span"
      readonly value: CalendarAgendaSpan
    }
  | {
      readonly type: "agenda-snap"
      readonly value: CalendarAgendaSnapMinutes
    }
  | { readonly type: "agenda-hour-height"; readonly value: number }
  | {
      readonly type: "agenda-working-hours"
      readonly value: CalendarAgendaPreferences["workingHours"]
    }
  | { readonly type: "agenda-initial-scroll"; readonly value: number }
  | { readonly type: "agenda-all-day-section"; readonly value: boolean }

export type CalendarInvalidItemReason =
  | "duplicate-id"
  | "empty-id"
  | "invalid-kind"
  | "invalid-start"
  | "invalid-end"
  | "reversed-range"
  | "zero-duration"
  | "span-too-long"
  | "invalid-occurrence"
  | "invalid-source-id"

export interface CalendarInvalidItem {
  readonly item: CalendarItem
  readonly itemIndex: number
  readonly reason: CalendarInvalidItemReason
  readonly message: string
}

export type CalendarItemInteractionState =
  | { readonly type: "idle" }
  | { readonly type: "moving" }
  | { readonly type: "resizing"; readonly edge: "start" | "end" }

export interface CalendarItemRenderState {
  readonly isSelected: boolean
  readonly isHovered: boolean
  readonly interaction: CalendarItemInteractionState
}

export interface CalendarCreateContext {
  readonly viewMode: CalendarViewMode
  readonly source: "pointer" | "keyboard"
}

export type CalendarMutationIntent =
  | {
      readonly type: "command"
      readonly command: CalendarMutationCommand
    }
  | {
      readonly type: "create"
      readonly clientMutationId: string
      readonly range: CalendarRange
      readonly context: CalendarCreateContext
    }
  | {
      readonly type: "update"
      readonly clientMutationId: string
      readonly previousItem: CalendarItem
      readonly nextItem: CalendarItem
    }
  | {
      readonly type: "duplicate"
      readonly clientMutationId: string
      readonly items: readonly CalendarItem[]
    }
  | {
      readonly type: "convert"
      readonly clientMutationId: string
      readonly item: CalendarItem
      readonly range: CalendarRange
    }

export type CalendarMutationOutcome =
  | { readonly status: "accepted" }
  | { readonly status: "rejected"; readonly message?: string }

export interface CalendarMutationRejection {
  readonly clientMutationId: string
  readonly reason: "consumer-rejected" | "authoritative-conflict"
  readonly message?: string
}

export type CalendarSelectionConfig =
  { readonly mode: "none" } | { readonly mode: "multiple" }

export interface CalendarConfig {
  readonly items: readonly CalendarItem[]
  readonly preferences: CalendarPreferences
  /** Optional controlled anchor date. */
  readonly anchorDate?: CalendarDate
  /** `visible-range` prevents absence in a range query from confirming deletes. */
  readonly dataMode?: "complete" | "visible-range"
  readonly dataState?: CalendarDataStatus
  readonly sources?: readonly CalendarSource[]
  readonly permissions?: CalendarPermissions
  readonly initialAnchorDate?: CalendarDate
  readonly locale?: string
  readonly readOnly?: boolean
  /** Controls item selection without disabling opening, dragging, or editing. */
  readonly selection?: CalendarSelectionConfig
  readonly now?: () => Date
  /** Safety boundary for consumer-provided spans. Defaults to ten years. */
  readonly maxSpanDays?: number

  readonly renderItem: (
    item: CalendarItem,
    state: CalendarItemRenderState
  ) => ReactNode
  readonly renderTooltip?: (item: CalendarItem) => ReactNode
  readonly renderEmptyState?: () => ReactNode
  readonly renderOverflowItem?: (
    item: CalendarItem,
    state: CalendarItemRenderState
  ) => ReactNode
  readonly renderHeaderAction?: () => ReactNode
  readonly getSearchText?: (item: CalendarItem) => string
  /** Accessible event name. Falls back to search text, then the item ID. */
  readonly getItemAriaLabel?: (item: CalendarItem) => string
  /** Optional recovery UI for errors thrown by consumer render functions. */
  readonly renderErrorState?: (error: Error, reset: () => void) => ReactNode
  readonly renderDataState?: (
    state: CalendarDataPresentation,
    retry: () => void
  ) => ReactNode
  readonly agenda?: {
    readonly sidebar?: CalendarAgendaSidebarConfig
    readonly defaultTimedDurationMinutes?: number
    readonly minimumTimedDurationMinutes?: number
    readonly minimumDayWidth?: number
    readonly renderTimedItem?: (
      item: TimedCalendarItem,
      state: CalendarAgendaRenderState
    ) => ReactNode
    readonly renderAllDayItem?: (
      item: CalendarItem,
      state: CalendarAgendaRenderState
    ) => ReactNode
    readonly renderDayHeader?: (
      date: CalendarDate,
      isToday: boolean
    ) => ReactNode
    readonly renderTimeLabel?: (minutes: number) => ReactNode
    readonly renderSlotBackground?: (
      date: CalendarDate,
      startMinutes: number
    ) => ReactNode
  }

  readonly onItemMutation?: (
    command: CalendarMutationCommand
  ) => void | Promise<void>
  /** Preferred unified mutation boundary for query-cache optimistic updates. */
  readonly onMutationIntent?: (
    intent: CalendarMutationIntent
  ) => void | CalendarMutationOutcome | Promise<void | CalendarMutationOutcome>
  readonly onItemCreate?: (
    range: CalendarRange,
    context: CalendarCreateContext
  ) => void
  readonly onItemClick?: (item: CalendarItem) => void
  readonly onItemDoubleClick?: (item: CalendarItem) => void
  readonly onItemDuplicate?: (items: readonly CalendarItem[]) => void
  readonly onItemConvert?: (
    item: CalendarItem,
    range: CalendarRange
  ) => void | Promise<void>
  readonly onPreferencesChange?: (
    preferences: CalendarPreferences,
    change: CalendarPreferencesChange
  ) => void
  readonly onAnchorDateChange?: (date: CalendarDate) => void
  readonly onVisibleRangeChange?: (range: CalendarQueryRange) => void
  readonly onDataRetry?: () => void
  readonly onInvalidItem?: (issue: CalendarInvalidItem) => void
  readonly onMutationRejected?: (rejection: CalendarMutationRejection) => void
  readonly onRenderError?: (error: Error) => void
}

export interface PointerOrigin {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly date: CalendarDate
}

export type CalendarInteraction =
  | { readonly type: "idle" }
  | {
      readonly type: "moving"
      readonly itemIds: readonly string[]
      readonly origin: PointerOrigin
      readonly preview: readonly CalendarItemRangeChange[]
    }
  | {
      readonly type: "resizing"
      readonly itemId: string
      readonly edge: "start" | "end"
      readonly origin: PointerOrigin
      readonly preview: CalendarRange
    }
  | {
      readonly type: "creating"
      readonly origin: PointerOrigin
      readonly preview: CalendarRange
    }

export type ActiveCalendarInteraction = Exclude<
  CalendarInteraction,
  { readonly type: "idle" }
>

export type CalendarOverflowState =
  | { readonly type: "closed" }
  | {
      readonly type: "open"
      readonly date: CalendarDate
      readonly triggerId: string
    }

export interface CalendarViewportSlice {
  anchorDate: CalendarDate
  focusedDate: CalendarDate | null
  viewportWidth: number
  viewportHeight: number
}

export interface CalendarHistorySlice {
  undoStack: CalendarHistoryEntry[]
  redoStack: CalendarHistoryEntry[]
  pendingCommands: CalendarPendingCommand[]
}

export interface CalendarSelectionSlice {
  selectedIds: Set<string>
  selectionAnchorId: string | null
}

export interface CalendarInteractionSlice {
  interaction: CalendarInteraction
}

export interface CalendarUISlice {
  searchQuery: string
  settingsOpen: boolean
  overflow: CalendarOverflowState
  hoveredItemId: string | null
  announcement: string
  announcementSequence: number
}

export type CalendarCommandExpectation =
  | {
      readonly type: "range"
      readonly itemId: string
      readonly range: CalendarRange
    }
  | { readonly type: "present"; readonly itemId: string }
  | { readonly type: "absent"; readonly itemId: string }

/** One original user transaction retained in the bounded undo journal. */
export interface CalendarHistoryEntry {
  readonly transactionId: string
  readonly command: CalendarMutationCommand
}

export type CalendarPendingOperation = "record" | "undo" | "redo"

/**
 * A command currently waiting for controlled items to confirm its result.
 * Expectations contain only IDs and scheduling ranges, never item snapshots.
 */
export interface CalendarPendingCommand {
  readonly transactionId: string
  readonly operation: CalendarPendingOperation
  readonly command: CalendarMutationCommand
  readonly previous: readonly CalendarCommandExpectation[]
  readonly expected: readonly CalendarCommandExpectation[]
}

export interface CalendarViewportActions {
  setAnchorDate: (date: CalendarDate) => CalendarDate
  navigateByPeriod: (
    direction: "previous" | "next",
    viewMode: CalendarViewMode
  ) => CalendarDate
  goToToday: (date: CalendarDate) => CalendarDate
  setFocusedDate: (date: CalendarDate | null) => void
  moveFocusedDate: (days: number) => CalendarDate
  moveFocusToWeekBoundary: (
    edge: "start" | "end",
    weekStartsOn: CalendarWeekStartsOn
  ) => CalendarDate
  setViewportDimensions: (width: number, height: number) => void
}

export interface CalendarSelectionActions {
  replaceSelection: (
    itemIds: readonly string[],
    anchorId?: string | null
  ) => void
  toggleSelection: (itemId: string) => void
  selectRange: (itemId: string, orderedItemIds: readonly string[]) => void
  selectVisible: (orderedItemIds: readonly string[]) => void
  pruneSelection: (itemIds: ReadonlySet<string>) => void
  clearSelection: () => void
  reconcileItemIds: (itemIds: ReadonlySet<string>) => void
  deleteSelection: (clientMutationId: string) => CalendarMutationCommand | null
}

export interface CalendarInteractionActions {
  startMoving: (
    interaction: Extract<CalendarInteraction, { readonly type: "moving" }>
  ) => boolean
  updateMovePreview: (preview: readonly CalendarItemRangeChange[]) => boolean
  startResizing: (
    interaction: Extract<CalendarInteraction, { readonly type: "resizing" }>
  ) => boolean
  updateResizePreview: (preview: CalendarRange) => boolean
  startCreating: (
    interaction: Extract<CalendarInteraction, { readonly type: "creating" }>
  ) => boolean
  updateCreatePreview: (preview: CalendarRange) => boolean
  finishInteraction: () => ActiveCalendarInteraction | null
  cancelInteraction: () => boolean
}

export interface CalendarHistoryActions {
  recordCommand: (command: CalendarMutationCommand) => boolean
  confirmCommand: (clientMutationId: string) => boolean
  rejectCommand: (
    clientMutationId: string,
    reason?: CalendarMutationRejection["reason"],
    message?: string
  ) => CalendarMutationRejection | null
  reconcileAuthoritativeItems: (
    items: readonly CalendarItem[],
    authoritativeIdsAreComplete?: boolean
  ) => readonly CalendarMutationRejection[]
  takeUndoCommand: (clientMutationId: string) => CalendarMutationCommand | null
  takeRedoCommand: (clientMutationId: string) => CalendarMutationCommand | null
  clearHistory: () => void
}

export interface CalendarUIActions {
  setSearchQuery: (query: string) => void
  setSettingsOpen: (open: boolean) => void
  openOverflow: (date: CalendarDate, triggerId: string) => void
  closeOverflow: () => void
  setHoveredItem: (itemId: string | null) => void
  announce: (message: string) => void
}

export type CalendarActions = CalendarViewportActions &
  CalendarSelectionActions &
  CalendarInteractionActions &
  CalendarHistoryActions &
  CalendarUIActions

export type CalendarState = CalendarViewportSlice &
  CalendarHistorySlice &
  CalendarSelectionSlice &
  CalendarInteractionSlice &
  CalendarUISlice & {
    actions: CalendarActions
  }
