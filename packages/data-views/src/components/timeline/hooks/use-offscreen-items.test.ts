/**
 * Tests for use-offscreen-items — offscreen item bucketing logic.
 */
import { describe, it, expect } from "vitest"
import { computeOffscreenItems } from "./use-offscreen-items.js"
import type { TimelineItem } from "../types.js"
import { dateToPx } from "../utils/position-utils.js"

const origin = new Date("2026-07-01")
const mode = "day" as const

function makeItem(id: string, startStr: string, endStr: string): TimelineItem {
  return {
    id,
    startDate: new Date(startStr),
    endDate: new Date(endStr),
    data: { title: id },
  }
}

function toMap(items: TimelineItem[]): Map<string, TimelineItem> {
  return new Map(items.map((i) => [i.id, i]))
}

describe("computeOffscreenItems", () => {
  it("counts items entirely to the left of viewport", () => {
    const items = toMap([
      makeItem("a", "2026-07-02", "2026-07-04"), // left of viewport
      makeItem("b", "2026-07-10", "2026-07-15"), // in viewport
    ])

    // Viewport starts at px corresponding to 2026-07-08
    const scrollLeft = dateToPx(new Date("2026-07-08"), origin, mode)
    const viewportWidth =
      dateToPx(new Date("2026-07-20"), origin, mode) - scrollLeft

    const result = computeOffscreenItems(
      items,
      origin,
      mode,
      scrollLeft,
      viewportWidth
    )

    expect(result.leftCount).toBe(1)
    expect(result.rightCount).toBe(0)
    expect(result.nearestLeft?.id).toBe("a")
    expect(result.nearestRight).toBeNull()
  })

  it("counts items entirely to the right of viewport", () => {
    const items = toMap([
      makeItem("a", "2026-07-10", "2026-07-15"), // in viewport
      makeItem("b", "2026-07-25", "2026-07-28"), // right of viewport
    ])

    const scrollLeft = dateToPx(new Date("2026-07-08"), origin, mode)
    const viewportEnd = dateToPx(new Date("2026-07-20"), origin, mode)
    const viewportWidth = viewportEnd - scrollLeft

    const result = computeOffscreenItems(
      items,
      origin,
      mode,
      scrollLeft,
      viewportWidth
    )

    expect(result.rightCount).toBe(1)
    expect(result.leftCount).toBe(0)
    expect(result.nearestRight?.id).toBe("b")
    expect(result.nearestLeft).toBeNull()
  })

  it("returns the nearest item on each side", () => {
    const items = toMap([
      makeItem("far-left", "2026-07-02", "2026-07-03"),
      makeItem("near-left", "2026-07-05", "2026-07-07"),
      makeItem("visible", "2026-07-10", "2026-07-15"),
      makeItem("near-right", "2026-07-22", "2026-07-24"),
      makeItem("far-right", "2026-07-28", "2026-07-30"),
    ])

    const scrollLeft = dateToPx(new Date("2026-07-08"), origin, mode)
    const viewportEnd = dateToPx(new Date("2026-07-20"), origin, mode)
    const viewportWidth = viewportEnd - scrollLeft

    const result = computeOffscreenItems(
      items,
      origin,
      mode,
      scrollLeft,
      viewportWidth
    )

    expect(result.leftCount).toBe(2)
    expect(result.rightCount).toBe(2)
    expect(result.nearestLeft?.id).toBe("near-left")
    expect(result.nearestRight?.id).toBe("near-right")
  })

  it("handles empty items map", () => {
    const result = computeOffscreenItems(new Map(), origin, mode, 100, 500)

    expect(result.leftCount).toBe(0)
    expect(result.rightCount).toBe(0)
    expect(result.nearestLeft).toBeNull()
    expect(result.nearestRight).toBeNull()
  })

  it("does not count partially visible items as offscreen", () => {
    const items = toMap([
      // Bar spans from before viewport to inside viewport
      makeItem("overlap", "2026-07-06", "2026-07-12"),
    ])

    const scrollLeft = dateToPx(new Date("2026-07-08"), origin, mode)
    const viewportEnd = dateToPx(new Date("2026-07-20"), origin, mode)
    const viewportWidth = viewportEnd - scrollLeft

    const result = computeOffscreenItems(
      items,
      origin,
      mode,
      scrollLeft,
      viewportWidth
    )

    // Bar's right edge (2026-07-12) is inside viewport, so NOT offscreen
    expect(result.leftCount).toBe(0)
    expect(result.rightCount).toBe(0)
  })
})
