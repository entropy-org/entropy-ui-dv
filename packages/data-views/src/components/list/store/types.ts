import type {
  DataListCommand,
  DataListSelectionDescriptor,
} from "../types.js"

export type DataListInternalSelection =
  | { readonly kind: "explicit"; readonly ids: ReadonlySet<string> }
  | {
      readonly kind: "all-matching"
      readonly excludedIds: ReadonlySet<string>
      readonly matchingCount?: number
    }

export type DataListEditState =
  | { readonly status: "idle" }
  | {
      readonly status: "draft"
      readonly itemId: string
      readonly propertyId: string
      readonly previousValue: unknown
      readonly value: unknown
      readonly error?: string
    }
  | {
      readonly status: "validating"
      readonly itemId: string
      readonly propertyId: string
      readonly previousValue: unknown
      readonly value: unknown
    }

export type DataListDragState =
  | { readonly mode: "idle" }
  | {
      readonly mode: "pointer"
      readonly phase: "pending" | "active"
      readonly itemIds: readonly string[]
      readonly originX: number
      readonly originY: number
      readonly currentX: number
      readonly currentY: number
      readonly targetId?: string
      readonly position?: "before" | "after"
    }
  | {
      readonly mode: "keyboard"
      readonly itemIds: readonly string[]
      readonly targetId: string
      readonly position: "before" | "after"
    }

export interface DataListPendingCommand {
  readonly command: DataListCommand
  readonly createdAt: number
  readonly confirmation: "authoritative" | "handler"
}

export interface DataListState {
  readonly focusedId: string | null
  readonly rangeAnchorId: string | null
  readonly selection: DataListInternalSelection
  readonly collapsedGroups: ReadonlySet<string>
  readonly collapsedItems: ReadonlySet<string>
  readonly edit: DataListEditState
  readonly drag: DataListDragState
  readonly pendingCommands: ReadonlyMap<string, DataListPendingCommand>
  readonly undoStack: readonly DataListCommand[]
  readonly redoStack: readonly DataListCommand[]
  readonly searchQuery: string
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly scrollTop: number
  readonly announcement: string
  readonly announcementSequence: number
  readonly openRowId: string | null
  readonly actions: {
    readonly setFocusedId: (id: string | null) => void
    readonly setSelection: (
      selection: DataListInternalSelection,
      anchorId?: string | null
    ) => void
    readonly syncControlledSelection: (
      selection: DataListSelectionDescriptor
    ) => void
    readonly reconcileItems: (
      validIds: ReadonlySet<string>,
      visibleIds: readonly string[],
      preserveMissingSelection?: boolean
    ) => void
    readonly toggleGroup: (key: string) => void
    readonly setGroupCollapsed: (key: string, collapsed: boolean) => void
    readonly toggleItem: (id: string) => void
    readonly beginEdit: (
      itemId: string,
      propertyId: string,
      previousValue: unknown
    ) => void
    readonly setEditValue: (value: unknown) => void
    readonly setEditError: (message?: string) => void
    readonly setEditValidating: () => void
    readonly cancelEdit: () => void
    readonly setDrag: (drag: DataListDragState) => void
    readonly addPendingCommand: (
      command: DataListCommand,
      createdAt?: number
    ) => void
    readonly setPendingConfirmation: (
      mutationId: string,
      confirmation: DataListPendingCommand["confirmation"]
    ) => void
    readonly settleCommand: (mutationId: string, accepted: boolean) => void
    readonly pushHistory: (command: DataListCommand) => void
    readonly takeUndo: () => DataListCommand | undefined
    readonly takeRedo: () => DataListCommand | undefined
    readonly setSearchQuery: (query: string) => void
    readonly setViewport: (width: number, height: number) => void
    readonly setScrollTop: (scrollTop: number) => void
    readonly announce: (message: string) => void
    readonly setOpenRowId: (id: string | null) => void
    readonly reset: () => void
  }
}
