import { createStore } from "zustand/vanilla"
import { KANBAN_DEFAULT_HISTORY_LIMIT } from "../constants.js"
import type {
  KanbanHistoryEntry,
  KanbanState,
} from "../types.js"

export interface CreateKanbanStoreOptions {
  readonly historyLimit?: number
  readonly initialSelectedIds?: readonly string[]
  readonly initialSearchQuery?: string
}

export function createKanbanStore(options: CreateKanbanStoreOptions = {}) {
  const historyLimit = Math.max(1, options.historyLimit ?? KANBAN_DEFAULT_HISTORY_LIMIT)
  return createStore<KanbanState>()((set, get) => ({
    viewport: { width: 0, height: 0, scrollLeft: 0, columnScrollTop: {}, pendingFocus: null },
    selectedIds: new Set(options.initialSelectedIds ?? []),
    selectionAnchorId: options.initialSelectedIds?.at(-1) ?? null,
    focusedCardId: null,
    interaction: { type: "idle" },
    pending: [],
    undoStack: [],
    redoStack: [],
    searchQuery: options.initialSearchQuery ?? "",
    settingsOpen: false,
    hoveredCardId: null,
    announcement: { sequence: 0, message: "" },
    actions: {
      setViewportDimensions: (width, height) => set((state) => ({ viewport: { ...state.viewport, width, height } })),
      setBoardScrollLeft: (scrollLeft) => set((state) => ({ viewport: { ...state.viewport, scrollLeft } })),
      setColumnScrollTop: (columnKey, scrollTop) => set((state) => ({
        viewport: { ...state.viewport, columnScrollTop: { ...state.viewport.columnScrollTop, [columnKey]: scrollTop } },
      })),
      requestFocus: (pendingFocus) => set((state) => ({ viewport: { ...state.viewport, pendingFocus } })),
      select: (id, mode, visibleOrder = []) => set((state) => {
        if (mode === "replace") return { selectedIds: new Set([id]), selectionAnchorId: id, focusedCardId: id }
        if (mode === "toggle") {
          const next = new Set(state.selectedIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedIds: next, selectionAnchorId: next.size === 0 ? null : id, focusedCardId: id }
        }
        const anchor = state.selectionAnchorId && visibleOrder.includes(state.selectionAnchorId) ? state.selectionAnchorId : id
        const anchorIndex = visibleOrder.indexOf(anchor)
        const targetIndex = visibleOrder.indexOf(id)
        if (anchorIndex < 0 || targetIndex < 0) return { selectedIds: new Set([id]), selectionAnchorId: id, focusedCardId: id }
        const start = Math.min(anchorIndex, targetIndex)
        const end = Math.max(anchorIndex, targetIndex)
        return { selectedIds: new Set(visibleOrder.slice(start, end + 1)), selectionAnchorId: anchor, focusedCardId: id }
      }),
      selectVisible: (visibleOrder) => set({ selectedIds: new Set(visibleOrder), selectionAnchorId: visibleOrder[0] ?? null }),
      clearSelection: () => set({ selectedIds: new Set(), selectionAnchorId: null }),
      reconcileCardIds: (validIds, visibleOrder) => set((state) => {
        const selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)))
        const anchor = state.selectionAnchorId && validIds.has(state.selectionAnchorId) ? state.selectionAnchorId : selectedIds.values().next().value ?? null
        const focused = state.focusedCardId && validIds.has(state.focusedCardId)
          ? state.focusedCardId
          : visibleOrder.find((id) => validIds.has(id)) ?? null
        const interaction = state.interaction.type !== "idle" && state.interaction.type === "card-drag" && state.interaction.cardIds.some((id) => !validIds.has(id))
          ? { type: "idle" as const }
          : state.interaction
        return { selectedIds, selectionAnchorId: anchor, focusedCardId: focused, interaction }
      }),
      setFocusedCardId: (focusedCardId) => set({ focusedCardId }),
      setInteraction: (interaction) => set({ interaction }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setHoveredCardId: (hoveredCardId) => set({ hoveredCardId }),
      announce: (message) => set((state) => ({ announcement: { sequence: state.announcement.sequence + 1, message } })),
      enqueueCommand: (operation, history) => set((state) => ({
        pending: [...state.pending, operation],
        ...(history ? {
          undoStack: [...state.undoStack, history].slice(-historyLimit),
          redoStack: [] as readonly KanbanHistoryEntry[],
        } : {}),
      })),
      markCommandAccepted: (clientMutationId, acceptedDataVersion) => set((state) => ({
        pending: state.pending.map((operation) => operation.command.clientMutationId === clientMutationId
          ? {
              ...operation,
              status: "awaiting-data" as const,
              ...(acceptedDataVersion === undefined ? {} : { acceptedDataVersion }),
            }
          : operation),
      })),
      settleCommand: (clientMutationId, outcome) => set((state) => {
        const operation = state.pending.find(({ command }) => command.clientMutationId === clientMutationId)
        if (!operation) return state
        const pending = state.pending.filter(({ command }) => command.clientMutationId !== clientMutationId)
        if (outcome === "confirmed") return { pending }
        return {
          pending,
          undoStack: state.undoStack.filter(({ command }) => command.clientMutationId !== clientMutationId),
          ...(outcome === "conflict" ? { redoStack: [] as readonly KanbanHistoryEntry[] } : {}),
        }
      }),
      popUndo: () => {
        const entry = get().undoStack.at(-1) ?? null
        if (entry) set((state) => ({ undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, entry].slice(-historyLimit) }))
        return entry
      },
      popRedo: () => {
        const entry = get().redoStack.at(-1) ?? null
        if (entry) set((state) => ({ redoStack: state.redoStack.slice(0, -1), undoStack: [...state.undoStack, entry].slice(-historyLimit) }))
        return entry
      },
      clearHistory: () => set({ undoStack: [], redoStack: [], pending: [] }),
    },
  }))
}

export type KanbanStore = ReturnType<typeof createKanbanStore>
