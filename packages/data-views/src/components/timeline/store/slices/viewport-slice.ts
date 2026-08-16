/**
 * Viewport slice — manages zoom level, scroll position, and viewport dimensions.
 */
import type { StateCreator } from "zustand"
import type {
  TimelineState,
  ViewportMode,
} from "../../types.js"
import { DEFAULT_VIEWPORT_MODE } from "../../constants.js"
import {
  dateToPx,
  getBarPosition,
} from "../../utils/position-utils.js"

/** Create the viewport slice */
export const createViewportSlice: StateCreator<
  TimelineState,
  [],
  [],
  Pick<
    TimelineState,
    | "viewportMode"
    | "timelineOrigin"
    | "timelineEnd"
    | "scrollLeft"
    | "scrollTop"
    | "viewportWidth"
    | "viewportHeight"
    | "actions"
  >
> = (set, get) => ({
  viewportMode: DEFAULT_VIEWPORT_MODE,
  timelineOrigin: new Date(),
  timelineEnd: new Date(),
  scrollLeft: 0,
  scrollTop: 0,
  viewportWidth: 0,
  viewportHeight: 0,

  // Actions are merged at the store factory level — we return a partial here
  // that will be spread into the combined `actions` object.
  actions: {
    setViewportMode: (mode: ViewportMode) =>
      set(() => ({ viewportMode: mode })),

    scrollTo: (x: number, y?: number) => {
      set(() => ({
        scrollLeft: x,
        ...(y !== undefined ? { scrollTop: y } : {}),
      }))
    },

    scrollToDate: (date: Date) => {
      const { viewportMode, viewportWidth } = get()
      const px = dateToPx(date, get().timelineOrigin, viewportMode)
      // Center the date in the viewport
      const scrollLeft = Math.max(0, px - viewportWidth / 2)
      set({ scrollLeft })
    },

    scrollToToday: () => {
      get().actions.scrollToDate(new Date())
    },

    scrollToItem: (itemId: string) => {
      const { items, viewportMode, viewportWidth } = get()
      const item = items.get(itemId)
      if (!item) return

      const pos = getBarPosition(
        item.startDate,
        item.endDate,
        get().timelineOrigin,
        viewportMode
      )
      // Center the bar in the viewport
      const barCenter = pos.left + pos.width / 2
      const scrollLeft = Math.max(0, barCenter - viewportWidth / 2)
      set({ scrollLeft })
    },

    setTimelineRange: (origin: Date, end: Date, nextScrollLeft?: number) =>
      set({
        timelineOrigin: origin,
        timelineEnd: end,
        ...(nextScrollLeft === undefined ? {} : { scrollLeft: nextScrollLeft }),
      }),

    setViewportDimensions: (width: number, height: number) => {
      set({ viewportWidth: width, viewportHeight: height })
    },
  } as TimelineState["actions"],
})

export function getTimelineOrigin(state: { timelineOrigin: Date }): Date {
  return state.timelineOrigin
}
