import type {
  ActiveCalendarInteraction,
  CalendarInteractionActions,
  CalendarInteractionSlice,
  CalendarItemRangeChange,
} from "../../types.js"
import type {
  CalendarStoreGet,
  CalendarStoreSet,
  CalendarStoreSlice,
} from "../slice-types.js"
import { calendarRangesEqual } from "../../utils/date-range.js"

function moveChangesEqual(
  first: readonly CalendarItemRangeChange[],
  second: readonly CalendarItemRangeChange[]
): boolean {
  return (
    first.length === second.length &&
    first.every((change, index) => {
      const other = second[index]
      return (
        other !== undefined &&
        change.itemId === other.itemId &&
        calendarRangesEqual(change.previousRange, other.previousRange) &&
        calendarRangesEqual(change.nextRange, other.nextRange)
      )
    })
  )
}

function isValidMove(
  itemIds: readonly string[],
  preview: readonly CalendarItemRangeChange[]
): boolean {
  if (itemIds.length === 0 || preview.length !== itemIds.length) return false
  const ids = new Set(itemIds)
  if (ids.size !== itemIds.length) return false
  return (
    preview.every(
      (change) =>
        ids.has(change.itemId) &&
        change.previousRange.kind === change.nextRange.kind
    ) && new Set(preview.map((change) => change.itemId)).size === ids.size
  )
}

export function createInteractionSlice(
  set: CalendarStoreSet,
  get: CalendarStoreGet
): CalendarStoreSlice<CalendarInteractionSlice, CalendarInteractionActions> {
  return {
    state: { interaction: { type: "idle" } },
    actions: {
      startMoving: (interaction) => {
        if (
          get().interaction.type !== "idle" ||
          !isValidMove(interaction.itemIds, interaction.preview)
        ) {
          return false
        }
        set({ interaction })
        return true
      },
      updateMovePreview: (preview) => {
        const interaction = get().interaction
        if (
          interaction.type !== "moving" ||
          !isValidMove(interaction.itemIds, preview)
        ) {
          return false
        }
        if (!moveChangesEqual(interaction.preview, preview)) {
          set({ interaction: { ...interaction, preview } })
        }
        return true
      },
      startResizing: (interaction) => {
        if (get().interaction.type !== "idle" || interaction.itemId === "") {
          return false
        }
        set({ interaction })
        return true
      },
      updateResizePreview: (preview) => {
        const interaction = get().interaction
        if (
          interaction.type !== "resizing" ||
          interaction.preview.kind !== preview.kind
        ) {
          return false
        }
        if (!calendarRangesEqual(interaction.preview, preview)) {
          set({ interaction: { ...interaction, preview } })
        }
        return true
      },
      startCreating: (interaction) => {
        if (get().interaction.type !== "idle") return false
        set({ interaction })
        return true
      },
      updateCreatePreview: (preview) => {
        const interaction = get().interaction
        if (
          interaction.type !== "creating" ||
          interaction.preview.kind !== preview.kind
        ) {
          return false
        }
        if (!calendarRangesEqual(interaction.preview, preview)) {
          set({ interaction: { ...interaction, preview } })
        }
        return true
      },
      finishInteraction: () => {
        const interaction = get().interaction
        if (interaction.type === "idle") return null
        set({ interaction: { type: "idle" } })
        return interaction as ActiveCalendarInteraction
      },
      cancelInteraction: () => {
        if (get().interaction.type === "idle") return false
        set({ interaction: { type: "idle" } })
        return true
      },
    },
  }
}
