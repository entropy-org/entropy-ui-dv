import { createStore } from "zustand/vanilla"
import { DATA_LIST_MAX_HISTORY } from "../constants.js"
import type { DataListSelectionDescriptor } from "../types.js"
import type {
  DataListInternalSelection,
  DataListState,
} from "./types.js"

export interface CreateDataListStoreOptions {
  readonly selection?: DataListSelectionDescriptor
  readonly searchQuery?: string
}

function toInternalSelection(
  selection?: DataListSelectionDescriptor
): DataListInternalSelection {
  if (selection?.kind === "all-matching") {
    return {
      kind: "all-matching",
      excludedIds: new Set(selection.excludedIds),
      matchingCount: selection.matchingCount,
    }
  }
  return { kind: "explicit", ids: new Set(selection?.ids ?? []) }
}

export function toPublicSelection(
  selection: DataListInternalSelection
): DataListSelectionDescriptor {
  if (selection.kind === "all-matching") {
    return {
      kind: "all-matching",
      excludedIds: [...selection.excludedIds],
      matchingCount: selection.matchingCount,
    }
  }
  return { kind: "explicit", ids: [...selection.ids] }
}

export function createDataListStore(options: CreateDataListStoreOptions = {}) {
  const initialSelection = toInternalSelection(options.selection)

  return createStore<DataListState>()((set, get) => {
    const initialState = {
      focusedId: null,
      rangeAnchorId: null,
      selection: initialSelection,
      collapsedGroups: new Set<string>(),
      collapsedItems: new Set<string>(),
      edit: { status: "idle" } as const,
      drag: { mode: "idle" } as const,
      pendingCommands: new Map(),
      undoStack: [],
      redoStack: [],
      searchQuery: options.searchQuery ?? "",
      viewportWidth: 0,
      viewportHeight: 0,
      scrollTop: 0,
      announcement: "",
      announcementSequence: 0,
      openRowId: null,
    }

    return {
      ...initialState,
      actions: {
        setFocusedId: (focusedId) => set({ focusedId }),
        setSelection: (selection, anchorId) =>
          set({
            selection,
            ...(anchorId === undefined ? {} : { rangeAnchorId: anchorId }),
          }),
        syncControlledSelection: (selection) =>
          set({ selection: toInternalSelection(selection) }),
        reconcileItems: (
          validIds,
          visibleIds,
          preserveMissingSelection = false
        ) => {
          const state = get()
          const nextSelection = preserveMissingSelection
            ? state.selection
            : state.selection.kind === "explicit"
              ? {
                  kind: "explicit" as const,
                  ids: new Set(
                    [...state.selection.ids].filter((id) => validIds.has(id))
                  ),
                }
              : {
                  ...state.selection,
                  excludedIds: new Set(
                    [...state.selection.excludedIds].filter((id) =>
                      validIds.has(id)
                    )
                  ),
                }
          const focusedId =
            state.focusedId && visibleIds.includes(state.focusedId)
              ? state.focusedId
              : (visibleIds[0] ?? null)
          const edit =
            state.edit.status !== "idle" && !validIds.has(state.edit.itemId)
              ? ({ status: "idle" } as const)
              : state.edit
          set({
            selection: nextSelection,
            focusedId,
            rangeAnchorId:
              state.rangeAnchorId && validIds.has(state.rangeAnchorId)
                ? state.rangeAnchorId
                : null,
            edit,
            openRowId:
              state.openRowId && validIds.has(state.openRowId)
                ? state.openRowId
                : null,
          })
        },
        toggleGroup: (key) => {
          const next = new Set(get().collapsedGroups)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          set({ collapsedGroups: next })
        },
        setGroupCollapsed: (key, collapsed) => {
          const next = new Set(get().collapsedGroups)
          if (collapsed) next.add(key)
          else next.delete(key)
          set({ collapsedGroups: next })
        },
        toggleItem: (id) => {
          const next = new Set(get().collapsedItems)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          set({ collapsedItems: next })
        },
        beginEdit: (itemId, propertyId, previousValue) =>
          set({
            edit: {
              status: "draft",
              itemId,
              propertyId,
              previousValue,
              value: previousValue,
            },
          }),
        setEditValue: (value) => {
          const edit = get().edit
          if (edit.status !== "draft") return
          set({ edit: { ...edit, value, error: undefined } })
        },
        setEditError: (message) => {
          const edit = get().edit
          if (edit.status === "draft") {
            set({ edit: { ...edit, error: message } })
          } else if (edit.status === "validating") {
            set({ edit: { ...edit, status: "draft", error: message } })
          }
        },
        setEditValidating: () => {
          const edit = get().edit
          if (edit.status !== "draft") return
          set({
            edit: {
              status: "validating",
              itemId: edit.itemId,
              propertyId: edit.propertyId,
              previousValue: edit.previousValue,
              value: edit.value,
            },
          })
        },
        cancelEdit: () => set({ edit: { status: "idle" } }),
        setDrag: (drag) => set({ drag }),
        addPendingCommand: (command, createdAt = Date.now()) => {
          const next = new Map(get().pendingCommands)
          next.set(command.mutationId, {
            command,
            createdAt,
            confirmation: "authoritative",
          })
          set({ pendingCommands: next })
        },
        setPendingConfirmation: (mutationId, confirmation) => {
          const current = get().pendingCommands.get(mutationId)
          if (!current || current.confirmation === confirmation) return
          const next = new Map(get().pendingCommands)
          next.set(mutationId, { ...current, confirmation })
          set({ pendingCommands: next })
        },
        settleCommand: (mutationId, accepted) => {
          const state = get()
          const next = new Map(state.pendingCommands)
          next.delete(mutationId)
          if (accepted) {
            set({ pendingCommands: next })
            return
          }
          const rejectedIndex = state.undoStack.findIndex(
            (command) => command.mutationId === mutationId
          )
          set({
            pendingCommands: next,
            undoStack:
              rejectedIndex < 0
                ? state.undoStack
                : state.undoStack.slice(0, rejectedIndex),
            redoStack: [],
          })
        },
        pushHistory: (command) => {
          const next = [...get().undoStack, command]
          set({
            undoStack: next.slice(-DATA_LIST_MAX_HISTORY),
            redoStack: [],
          })
        },
        takeUndo: () => {
          const state = get()
          const command = state.undoStack.at(-1)
          if (!command) return undefined
          set({
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, command].slice(
              -DATA_LIST_MAX_HISTORY
            ),
          })
          return command
        },
        takeRedo: () => {
          const state = get()
          const command = state.redoStack.at(-1)
          if (!command) return undefined
          set({
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [...state.undoStack, command].slice(
              -DATA_LIST_MAX_HISTORY
            ),
          })
          return command
        },
        setSearchQuery: (searchQuery) => set({ searchQuery, scrollTop: 0 }),
        setViewport: (viewportWidth, viewportHeight) =>
          set({ viewportWidth, viewportHeight }),
        setScrollTop: (scrollTop) => set({ scrollTop }),
        announce: (announcement) =>
          set((state) => ({
            announcement,
            announcementSequence: state.announcementSequence + 1,
          })),
        setOpenRowId: (openRowId) => set({ openRowId }),
        reset: () => set(initialState),
      },
    }
  })
}

export type DataListStore = ReturnType<typeof createDataListStore>
