import type { DataListState } from "./types.js"

export const selectListActions = (state: DataListState) => state.actions
export const selectFocusedId = (state: DataListState) => state.focusedId
export const selectSelection = (state: DataListState) => state.selection
export const selectCollapsedGroups = (state: DataListState) =>
  state.collapsedGroups
export const selectCollapsedItems = (state: DataListState) =>
  state.collapsedItems
export const selectEdit = (state: DataListState) => state.edit
export const selectDrag = (state: DataListState) => state.drag
export const selectPendingCommands = (state: DataListState) =>
  state.pendingCommands
export const selectSearchQuery = (state: DataListState) => state.searchQuery
export const selectAnnouncement = (state: DataListState) => state.announcement
export const selectAnnouncementSequence = (state: DataListState) =>
  state.announcementSequence
export const selectViewportWidth = (state: DataListState) => state.viewportWidth
