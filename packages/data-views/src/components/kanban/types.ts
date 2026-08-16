import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import type { DataViewChrome } from "../../shared/chrome.js"

export interface KanbanCard {
  readonly id: string
  readonly groupId: string
  readonly swimlaneId?: string
  readonly rank: string
  readonly data: unknown
}

export type KanbanWipLimit =
  | { readonly type: "warning"; readonly maximum: number }
  | { readonly type: "hard"; readonly maximum: number }

export interface KanbanGroup {
  readonly id: string
  readonly rank: string
  readonly data: unknown
  readonly wipLimit?: KanbanWipLimit
}

export interface KanbanSwimlane {
  readonly id: string
  readonly rank: string
  readonly data: unknown
}

export type KanbanDensity = "compact" | "comfortable"

export interface KanbanPreferences {
  readonly density: KanbanDensity
  readonly columnWidth: number
  readonly collapsedGroupIds: readonly string[]
  readonly collapsedSwimlaneIds: readonly string[]
  readonly showWipLimits: boolean
}

export type KanbanPreferenceChange =
  | { readonly type: "density"; readonly value: KanbanDensity }
  | { readonly type: "column-width"; readonly value: number }
  | {
      readonly type: "group-collapsed"
      readonly groupId: string
      readonly collapsed: boolean
    }
  | {
      readonly type: "swimlane-collapsed"
      readonly swimlaneId: string
      readonly collapsed: boolean
    }
  | { readonly type: "wip-visibility"; readonly value: boolean }

export type KanbanInvalidItem =
  | {
      readonly type: "empty-id"
      readonly entity: "card" | "group" | "swimlane"
      readonly index: number
      readonly item: unknown
      readonly message: string
    }
  | {
      readonly type: "duplicate-id"
      readonly entity: "card" | "group" | "swimlane"
      readonly id: string
      readonly index: number
      readonly item: unknown
      readonly message: string
    }
  | {
      readonly type: "empty-rank"
      readonly entity: "card" | "group" | "swimlane"
      readonly id: string
      readonly index: number
      readonly item: unknown
      readonly message: string
    }
  | {
      readonly type: "duplicate-rank"
      readonly entity: "card" | "group" | "swimlane"
      readonly id: string
      readonly rank: string
      readonly scope: string
      readonly item: unknown
      readonly message: string
    }
  | {
      readonly type: "missing-group"
      readonly cardId: string
      readonly groupId: string
      readonly item: KanbanCard
      readonly message: string
    }
  | {
      readonly type: "missing-swimlane"
      readonly cardId: string
      readonly item: KanbanCard
      readonly message: string
    }
  | {
      readonly type: "orphaned-swimlane"
      readonly cardId: string
      readonly swimlaneId: string
      readonly item: KanbanCard
      readonly message: string
    }
  | {
      readonly type: "unexpected-swimlane"
      readonly cardId: string
      readonly swimlaneId: string
      readonly item: KanbanCard
      readonly message: string
    }
  | {
      readonly type: "invalid-wip-limit"
      readonly groupId: string
      readonly item: KanbanGroup
      readonly message: string
    }

export interface KanbanLocation {
  readonly groupId: string
  readonly swimlaneId?: string
  readonly rank: string
}

export interface KanbanNeighbors {
  readonly beforeId: string | null
  readonly afterId: string | null
}

interface KanbanRecordCommandBase {
  readonly clientMutationId: string
}

export type KanbanCommand =
  | (KanbanRecordCommandBase & {
      readonly type: "move-cards"
      readonly cardIds: readonly string[]
      readonly sources: Readonly<Record<string, KanbanLocation>>
      readonly destination: {
        readonly groupId: string
        readonly swimlaneId?: string
      }
      readonly neighbors: KanbanNeighbors
    })
  | (KanbanRecordCommandBase & {
      readonly type: "reorder-groups"
      readonly groupId: string
      readonly sourceRank: string
      readonly neighbors: KanbanNeighbors
    })
  | (KanbanRecordCommandBase & {
      readonly type: "delete-cards"
      readonly cardIds: readonly string[]
      readonly sources: Readonly<Record<string, KanbanLocation>>
    })
  | (KanbanRecordCommandBase & {
      readonly type: "restore-cards"
      readonly cardIds: readonly string[]
      readonly destinations: Readonly<Record<string, KanbanLocation>>
    })
  | (KanbanRecordCommandBase & {
      readonly type: "duplicate-cards"
      readonly sourceCardIds: readonly string[]
      readonly destination: {
        readonly groupId: string
        readonly swimlaneId?: string
      }
      readonly neighbors: KanbanNeighbors
    })

export type KanbanServerRejectionCode =
  | "conflict"
  | "not-found"
  | "permission"
  | "validation"
  | "wip-limit"
  | "unknown"

export type KanbanCommandResult =
  | {
      readonly status: "accepted"
      /**
       * The first authoritative data version which contains this mutation. When
       * supplied, the board will not confirm an optimistic cache projection as
       * authoritative until `dataVersion` reaches this value.
       */
      readonly dataVersion?: number
    }
  | {
      readonly status: "rejected"
      readonly code: KanbanServerRejectionCode
      readonly message: string
      readonly error?: unknown
    }

export type KanbanCommandSettlement =
  | { readonly status: "confirmed"; readonly command: KanbanCommand }
  | {
      readonly status: "rejected"
      readonly command: KanbanCommand
      readonly error: unknown
    }
  | {
      readonly status: "conflict"
      readonly command: KanbanCommand
      readonly reason: string
    }
  | { readonly status: "superseded"; readonly command: KanbanCommand }
  | { readonly status: "timed-out"; readonly command: KanbanCommand }

export type KanbanMutationRejection =
  | {
      readonly type: "consumer-rejected"
      readonly command: KanbanCommand
      readonly error: unknown
    }
  | {
      readonly type: "server-rejected"
      readonly command: KanbanCommand
      readonly code: KanbanServerRejectionCode
      readonly message: string
      readonly error?: unknown
    }
  | {
      readonly type: "authoritative-conflict"
      readonly command: KanbanCommand
      readonly reason: string
    }
  | {
      readonly type: "entity-removed"
      readonly command: KanbanCommand
      readonly entityId: string
    }
  | {
      readonly type: "timed-out"
      readonly command: KanbanCommand
      readonly timeoutMs: number
    }

export type KanbanInteraction =
  | { readonly type: "idle" }
  | {
      readonly type: "card-drag"
      readonly input: "pointer" | "keyboard"
      readonly cardIds: readonly string[]
      readonly sourceGroupId: string
      readonly sourceSwimlaneId?: string
      readonly destinationGroupId: string
      readonly destinationSwimlaneId?: string
      readonly destinationIndex: number
      readonly blockedReason: string | null
    }
  | {
      readonly type: "group-drag"
      readonly input: "pointer" | "keyboard"
      readonly groupId: string
      readonly destinationIndex: number
    }

interface KanbanPendingOperationBase {
  readonly command: KanbanCommand
  readonly affectedCardIds: readonly string[]
  readonly createdAt: number
  readonly sequence: number
  readonly issuedDataVersion?: number
}

export type KanbanPendingOperation =
  | (KanbanPendingOperationBase & { readonly status: "submitting" })
  | (KanbanPendingOperationBase & {
      readonly status: "awaiting-data"
      readonly acceptedDataVersion?: number
    })

export interface KanbanHistoryEntry {
  readonly command: KanbanCommand
  readonly inverse: KanbanCommand | null
}

export interface KanbanCardRenderState {
  readonly selected: boolean
  readonly focused: boolean
  readonly dragging: boolean
  readonly previewing: boolean
  readonly pending: boolean
  readonly readOnly: boolean
  readonly wipWarning: boolean
}

export interface KanbanGroupRenderState {
  readonly collapsed: boolean
  readonly cardCount: number
  readonly visibleCardCount: number
  readonly wip: KanbanWipEvaluation
  readonly readOnly: boolean
}

export interface KanbanSwimlaneRenderState {
  readonly collapsed: boolean
  readonly cardCount: number
  readonly visibleCardCount: number
  readonly readOnly: boolean
}

export type KanbanWipEvaluation =
  | { readonly status: "none"; readonly count: number; readonly maximum: null }
  | {
      readonly status: "below-limit"
      readonly count: number
      readonly maximum: number
    }
  | {
      readonly status: "warning"
      readonly count: number
      readonly maximum: number
    }
  | {
      readonly status: "hard-blocked"
      readonly count: number
      readonly maximum: number
    }

export interface KanbanAddContext {
  readonly groupId: string
  readonly swimlaneId?: string
  readonly source: "pointer" | "keyboard"
}

export type KanbanDataState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly isRefetching?: boolean }
  | {
      readonly status: "partial"
      readonly isRefetching?: boolean
      readonly message?: string
    }
  | {
      readonly status: "error"
      readonly error: unknown
      /** Whether `cards`, `groups`, and `swimlanes` still contain usable stale data. */
      readonly hasData: boolean
      readonly isRefetching?: boolean
    }

export interface KanbanIntersectionContext {
  readonly groupId: string
  readonly swimlaneId?: string
}

export type KanbanPageState =
  | { readonly status: "complete"; readonly totalCount?: number }
  | {
      readonly status: "idle"
      readonly hasNextPage: true
      readonly totalCount?: number
    }
  | {
      readonly status: "loading"
      readonly hasNextPage: true
      readonly totalCount?: number
    }
  | {
      readonly status: "error"
      readonly hasNextPage: true
      readonly error: unknown
      readonly totalCount?: number
    }

export type KanbanSearchBehavior =
  | { readonly mode: "local" }
  | {
      readonly mode: "server"
      readonly onQueryChange: (query: string) => void
      readonly isPending?: boolean
      readonly resultCount?: number
    }
  | {
      readonly mode: "hybrid"
      readonly onQueryChange: (query: string) => void
      readonly isPending?: boolean
      readonly resultCount?: number
    }

export type KanbanSelectionConfig =
  { readonly mode: "none" } | { readonly mode: "multiple" }

export interface KanbanPagination {
  /** Zero-based page index. */
  readonly pageIndex: number
  readonly pageSize: number
  readonly pageCount: number
  readonly totalCount?: number
  readonly hasPreviousPage?: boolean
  readonly hasNextPage?: boolean
  readonly pending?: boolean
  readonly onPageChange: (pageIndex: number) => void
}

export interface KanbanConfig {
  readonly cards: readonly KanbanCard[]
  readonly groups: readonly KanbanGroup[]
  readonly swimlanes?: readonly KanbanSwimlane[]
  readonly preferences?: Partial<KanbanPreferences>
  readonly readOnly?: boolean
  /** Controls card selection without disabling opening, dragging, or editing. */
  readonly selection?: KanbanSelectionConfig
  readonly pagination?: KanbanPagination
  /** @deprecated Prefer the discriminated `dataState` contract. */
  readonly loading?: boolean
  readonly dataState?: KanbanDataState
  /**
   * A monotonically increasing version for authoritative snapshots. It lets
   * the board distinguish an optimistic Query cache projection from the data
   * version acknowledged by the server.
   */
  readonly dataVersion?: number
  readonly pendingTimeoutMs?: number
  readonly historyLimit?: number
  readonly overscan?: number
  readonly search?: KanbanSearchBehavior
  readonly getSearchText?: (card: KanbanCard) => string
  readonly filterCard?: (card: KanbanCard) => boolean
  /** Supplies the server-authoritative group count when only part of a board is loaded. */
  readonly getGroupCardCount?: (
    group: KanbanGroup,
    loadedCount: number
  ) => number
  readonly getPageState?: (
    context: KanbanIntersectionContext
  ) => KanbanPageState
  readonly getCardLabel?: (card: KanbanCard) => string
  readonly getGroupLabel?: (group: KanbanGroup) => string
  readonly getSwimlaneLabel?: (swimlane: KanbanSwimlane) => string
  readonly renderCard: (
    card: KanbanCard,
    state: KanbanCardRenderState
  ) => ReactNode
  readonly renderGroupHeader?: (
    group: KanbanGroup,
    state: KanbanGroupRenderState
  ) => ReactNode
  readonly renderSwimlaneHeader?: (
    swimlane: KanbanSwimlane,
    state: KanbanSwimlaneRenderState
  ) => ReactNode
  readonly renderEmptyState?: () => ReactNode
  readonly renderSearchEmptyState?: (
    query: string,
    clear: () => void
  ) => ReactNode
  readonly renderLoading?: () => ReactNode
  readonly renderDataError?: (
    error: unknown,
    retry: (() => void) | undefined
  ) => ReactNode
  readonly renderPageError?: (
    context: KanbanIntersectionContext,
    error: unknown,
    retry: () => void
  ) => ReactNode
  readonly renderDragOverlay?: (cards: readonly KanbanCard[]) => ReactNode
  readonly renderHeaderAction?: () => ReactNode
  readonly renderBulkAction?: (selectedIds: readonly string[]) => ReactNode
  readonly renderErrorState?: (error: Error, reset: () => void) => ReactNode
  readonly onCommand?: (
    command: KanbanCommand
  ) => void | KanbanCommandResult | Promise<void | KanbanCommandResult>
  readonly onMutationRejected?: (rejection: KanbanMutationRejection) => void
  readonly onCommandSettled?: (settlement: KanbanCommandSettlement) => void
  readonly onRetryData?: () => void
  readonly onLoadMore?: (
    context: KanbanIntersectionContext & { readonly requestId: string }
  ) => void | Promise<void>
  readonly onPreferencesChange?: (
    preferences: KanbanPreferences,
    change: KanbanPreferenceChange
  ) => void
  readonly onInvalidItem?: (issue: KanbanInvalidItem) => void
  readonly onRenderError?: (error: Error) => void
  readonly onCardClick?: (card: KanbanCard) => void
  readonly onCardDoubleClick?: (card: KanbanCard) => void
  readonly onCardOpen?: (card: KanbanCard) => void
  readonly onAddCard?: (context: KanbanAddContext) => void
  readonly createMutationId?: () => string
}

export interface KanbanViewportState {
  readonly width: number
  readonly height: number
  readonly scrollLeft: number
  readonly columnScrollTop: Readonly<Record<string, number>>
  readonly pendingFocus: {
    readonly type: "card" | "group"
    readonly id: string
  } | null
}

export interface KanbanState {
  readonly viewport: KanbanViewportState
  readonly selectedIds: ReadonlySet<string>
  readonly selectionAnchorId: string | null
  readonly focusedCardId: string | null
  readonly interaction: KanbanInteraction
  readonly pending: readonly KanbanPendingOperation[]
  readonly undoStack: readonly KanbanHistoryEntry[]
  readonly redoStack: readonly KanbanHistoryEntry[]
  readonly searchQuery: string
  readonly settingsOpen: boolean
  readonly hoveredCardId: string | null
  readonly announcement: { readonly sequence: number; readonly message: string }
  readonly actions: KanbanActions
}

export interface KanbanActions {
  readonly setViewportDimensions: (width: number, height: number) => void
  readonly setBoardScrollLeft: (scrollLeft: number) => void
  readonly setColumnScrollTop: (columnKey: string, scrollTop: number) => void
  readonly requestFocus: (target: KanbanViewportState["pendingFocus"]) => void
  readonly select: (
    id: string,
    mode: "replace" | "toggle" | "range",
    visibleOrder?: readonly string[]
  ) => void
  readonly selectVisible: (visibleOrder: readonly string[]) => void
  readonly clearSelection: () => void
  readonly reconcileCardIds: (
    validIds: ReadonlySet<string>,
    visibleOrder: readonly string[]
  ) => void
  readonly setFocusedCardId: (id: string | null) => void
  readonly setInteraction: (interaction: KanbanInteraction) => void
  readonly setSearchQuery: (query: string) => void
  readonly setSettingsOpen: (open: boolean) => void
  readonly setHoveredCardId: (id: string | null) => void
  readonly announce: (message: string) => void
  readonly enqueueCommand: (
    operation: KanbanPendingOperation,
    history: KanbanHistoryEntry | null
  ) => void
  readonly markCommandAccepted: (
    clientMutationId: string,
    acceptedDataVersion?: number
  ) => void
  readonly settleCommand: (
    clientMutationId: string,
    outcome: "confirmed" | "rejected" | "conflict" | "superseded" | "timed-out"
  ) => void
  readonly popUndo: () => KanbanHistoryEntry | null
  readonly popRedo: () => KanbanHistoryEntry | null
  readonly clearHistory: () => void
}

export interface KanbanProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  readonly style?: CSSProperties
  readonly chrome?: DataViewChrome
  /** @deprecated Use `chrome={{ mode: "embedded" }}`. */
  readonly showHeader?: boolean
}
