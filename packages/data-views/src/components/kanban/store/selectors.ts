import type { KanbanState } from "../types.js"

export const selectKanbanActions = (state: KanbanState) => state.actions
export const selectKanbanSelection = (state: KanbanState) => state.selectedIds
export const selectKanbanSelectedCount = (state: KanbanState) => state.selectedIds.size
export const selectKanbanFocusedCardId = (state: KanbanState) => state.focusedCardId
export const selectKanbanInteraction = (state: KanbanState) => state.interaction
export const selectKanbanSearchQuery = (state: KanbanState) => state.searchQuery
export const selectKanbanSettingsOpen = (state: KanbanState) => state.settingsOpen
export const selectKanbanPending = (state: KanbanState) => state.pending
export const selectKanbanCanUndo = (state: KanbanState) => state.undoStack.some(({ inverse }) => inverse !== null)
export const selectKanbanCanRedo = (state: KanbanState) => state.redoStack.length > 0
export const selectKanbanAnnouncement = (state: KanbanState) => state.announcement
export const selectKanbanViewport = (state: KanbanState) => state.viewport
