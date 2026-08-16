import type {
  CalendarInteraction,
  CalendarMutationCommand,
  CalendarSelectionActions,
  CalendarSelectionSlice,
} from "../../types.js"
import type {
  CalendarStoreGet,
  CalendarStoreSet,
  CalendarStoreSlice,
} from "../slice-types.js"

export interface CreateSelectionSliceOptions {
  readonly initialSelectedIds?: readonly string[]
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function setsEqual(first: ReadonlySet<string>, second: ReadonlySet<string>) {
  if (first.size !== second.size) return false
  return [...first].every((id) => second.has(id))
}

export function createSelectionSlice(
  options: CreateSelectionSliceOptions,
  set: CalendarStoreSet,
  get: CalendarStoreGet
): CalendarStoreSlice<CalendarSelectionSlice, CalendarSelectionActions> {
  return {
    state: {
      selectedIds: new Set(uniqueIds(options.initialSelectedIds ?? [])),
      selectionAnchorId: null,
    },
    actions: {
      replaceSelection: (itemIds, anchorId) => {
        const ids = uniqueIds(itemIds)
        const selectedIds = new Set(ids)
        const requestedAnchorId =
          anchorId === undefined ? (ids.at(-1) ?? null) : anchorId
        const selectionAnchorId =
          requestedAnchorId !== null && selectedIds.has(requestedAnchorId)
            ? requestedAnchorId
            : null
        const state = get()
        if (
          setsEqual(state.selectedIds, selectedIds) &&
          state.selectionAnchorId === selectionAnchorId
        ) {
          return
        }
        set({ selectedIds, selectionAnchorId })
      },
      toggleSelection: (itemId) => {
        const state = get()
        const selectedIds = new Set(state.selectedIds)
        if (selectedIds.has(itemId)) selectedIds.delete(itemId)
        else selectedIds.add(itemId)
        set({ selectedIds, selectionAnchorId: itemId })
      },
      selectRange: (itemId, orderedItemIds) => {
        const orderedIds = uniqueIds(orderedItemIds)
        const targetIndex = orderedIds.indexOf(itemId)
        if (targetIndex === -1) return

        const state = get()
        const anchorIndex = state.selectionAnchorId
          ? orderedIds.indexOf(state.selectionAnchorId)
          : -1
        if (anchorIndex === -1) {
          set({
            selectedIds: new Set([itemId]),
            selectionAnchorId: itemId,
          })
          return
        }

        const start = Math.min(anchorIndex, targetIndex)
        const end = Math.max(anchorIndex, targetIndex)
        const selectedIds = new Set(orderedIds.slice(start, end + 1))
        if (!setsEqual(state.selectedIds, selectedIds)) {
          set({ selectedIds })
        }
      },
      selectVisible: (orderedItemIds) => {
        const ids = uniqueIds(orderedItemIds)
        const selectedIds = new Set(ids)
        const selectionAnchorId = ids[0] ?? null
        const state = get()
        if (
          !setsEqual(state.selectedIds, selectedIds) ||
          state.selectionAnchorId !== selectionAnchorId
        ) {
          set({ selectedIds, selectionAnchorId })
        }
      },
      pruneSelection: (itemIds) => {
        const state = get()
        const selectedIds = new Set(
          [...state.selectedIds].filter((id) => itemIds.has(id))
        )
        const selectionAnchorId =
          state.selectionAnchorId && itemIds.has(state.selectionAnchorId)
            ? state.selectionAnchorId
            : null
        if (
          !setsEqual(state.selectedIds, selectedIds) ||
          state.selectionAnchorId !== selectionAnchorId
        ) {
          set({ selectedIds, selectionAnchorId })
        }
      },
      clearSelection: () => {
        const state = get()
        if (state.selectedIds.size > 0 || state.selectionAnchorId !== null) {
          set({
            selectedIds: new Set<string>(),
            selectionAnchorId: null,
          })
        }
      },
      reconcileItemIds: (itemIds) => {
        const state = get()
        const selectedIds = new Set(
          [...state.selectedIds].filter((id) => itemIds.has(id))
        )
        const selectionAnchorId =
          state.selectionAnchorId && itemIds.has(state.selectionAnchorId)
            ? state.selectionAnchorId
            : null

        let interaction: CalendarInteraction = state.interaction
        if (
          (interaction.type === "moving" &&
            interaction.itemIds.some((id) => !itemIds.has(id))) ||
          (interaction.type === "resizing" && !itemIds.has(interaction.itemId))
        ) {
          interaction = { type: "idle" }
        }

        if (
          !setsEqual(state.selectedIds, selectedIds) ||
          state.selectionAnchorId !== selectionAnchorId ||
          state.interaction !== interaction
        ) {
          set({ selectedIds, selectionAnchorId, interaction })
        }
      },
      deleteSelection: (clientMutationId) => {
        const state = get()
        if (state.selectedIds.size === 0) return null
        const command: CalendarMutationCommand = {
          type: "delete",
          clientMutationId,
          itemIds: [...state.selectedIds],
        }
        if (!state.actions.recordCommand(command)) return null
        set({ selectedIds: new Set<string>(), selectionAnchorId: null })
        return command
      },
    },
  }
}
