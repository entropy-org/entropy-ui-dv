import type {
  CalendarCommandExpectation,
  CalendarMutationCommand,
  CalendarState,
} from "../types.js"

export const selectAnchorDate = (state: CalendarState) => state.anchorDate
export const selectFocusedDate = (state: CalendarState) => state.focusedDate
export const selectInteraction = (state: CalendarState) => state.interaction
export const selectSearchQuery = (state: CalendarState) => state.searchQuery
export const selectOverflow = (state: CalendarState) => state.overflow
export const selectSettingsOpen = (state: CalendarState) => state.settingsOpen
export const selectAnnouncement = (state: CalendarState) => state.announcement
export const selectAnnouncementSequence = (state: CalendarState) =>
  state.announcementSequence
export const selectSelectedCount = (state: CalendarState) =>
  state.selectedIds.size
export const selectSelectedIds = (state: CalendarState) => [
  ...state.selectedIds,
]
export const selectViewportDimensions = (state: CalendarState) => ({
  width: state.viewportWidth,
  height: state.viewportHeight,
})
export const selectPendingCommands = (state: CalendarState) =>
  state.pendingCommands
export const selectCanUndo = (state: CalendarState) =>
  state.undoStack.length > 0 && state.pendingCommands.length === 0
export const selectCanRedo = (state: CalendarState) =>
  state.redoStack.length > 0 && state.pendingCommands.length === 0
export const selectActions = (state: CalendarState) => state.actions

export const selectIsSelected = (itemId: string) => (state: CalendarState) =>
  state.selectedIds.has(itemId)

export const selectIsHovered = (itemId: string) => (state: CalendarState) =>
  state.hoveredItemId === itemId

export const selectIsCommandPending =
  (clientMutationId: string) => (state: CalendarState) =>
    state.pendingCommands.some(
      (pending) => pending.command.clientMutationId === clientMutationId
    )

export const selectPendingItemExpectation =
  (itemId: string) =>
  (state: CalendarState): CalendarCommandExpectation | undefined => {
    for (let index = state.pendingCommands.length - 1; index >= 0; index -= 1) {
      const expectation = state.pendingCommands[index].expected.find(
        (candidate) => candidate.itemId === itemId
      )
      if (expectation) return expectation
    }
    return undefined
  }

export const selectLatestUndoCommand = (
  state: CalendarState
): CalendarMutationCommand | undefined => state.undoStack.at(-1)?.command
