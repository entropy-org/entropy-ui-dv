import { describe, it, expect } from "vitest"
import { renderTimelineHook } from "../test/render-timeline.js"
import { useBarPosition } from "./use-bar-position.js"
import { getColumnWidth } from "../utils/viewport-config.js"

describe("useBarPosition", () => {
  it("computes position correctly", () => {
    const origin = new Date("2026-07-01T00:00:00Z")
    const startDate = new Date("2026-07-03T00:00:00Z")
    const endDate = new Date("2026-07-05T00:00:00Z")

    const { result } = renderTimelineHook(
      () => useBarPosition(startDate, endDate, origin),
      { viewportMode: "day" }
    )

    const dayWidth = getColumnWidth("day")
    expect(result.current.left).toBe(2 * dayWidth)
    expect(result.current.width).toBe(2 * dayWidth)
  })
})
