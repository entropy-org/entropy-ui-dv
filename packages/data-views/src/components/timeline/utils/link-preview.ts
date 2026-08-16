import type {
  DragState,
  TimelineItem,
  TimelineRangeHighlight,
  ViewportMode,
} from "../types.js"
import {
  dateToPx,
  getBarPosition,
} from "./position-utils.js"

export type TimelineLinkPreview =
  | { type: "none" }
  | {
      type: "drag"
      itemIds: ReadonlySet<string>
      offsetPx: number
    }
  | {
      type: "resize"
      itemId: string
      startDate: Date
      endDate: Date
    }

export function createTimelineLinkPreview(
  items: ReadonlyMap<string, TimelineItem>,
  rangeHighlight: TimelineRangeHighlight | null,
  dragState: DragState | null,
  origin: Date,
  viewportMode: ViewportMode
): TimelineLinkPreview {
  if (rangeHighlight?.type === "resize") {
    return {
      type: "resize",
      itemId: rangeHighlight.itemId,
      startDate: rangeHighlight.startDate,
      endDate: rangeHighlight.endDate,
    }
  }

  if (rangeHighlight?.type !== "drag") return { type: "none" }

  const activeItem = items.get(rangeHighlight.itemId)
  if (!activeItem) return { type: "none" }

  return {
    type: "drag",
    itemIds: new Set(
      dragState?.type === "move" ? dragState.itemIds : [rangeHighlight.itemId]
    ),
    offsetPx:
      dateToPx(rangeHighlight.startDate, origin, viewportMode) -
      dateToPx(activeItem.startDate, origin, viewportMode),
  }
}

export function getTimelineLinkPosition(
  preview: TimelineLinkPreview,
  itemId: string,
  item: TimelineItem,
  origin: Date,
  viewportMode: ViewportMode
) {
  if (preview.type === "resize" && preview.itemId === itemId) {
    return getBarPosition(
      preview.startDate,
      preview.endDate,
      origin,
      viewportMode
    )
  }

  const position = getBarPosition(
    item.startDate,
    item.endDate,
    origin,
    viewportMode
  )

  return preview.type === "drag" && preview.itemIds.has(itemId)
    ? { ...position, left: position.left + preview.offsetPx }
    : position
}

export function isTimelineLinkItemLive(
  preview: TimelineLinkPreview,
  itemId: string
): boolean {
  return preview.type === "resize"
    ? preview.itemId === itemId
    : preview.type === "drag" && preview.itemIds.has(itemId)
}
