import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderTimeline } from "../test/render-timeline.js"
import { TimelineTodayMarker } from "./timeline-today-marker.js"
import { TimelineTodayHeaderMarker } from "./timeline-today-header-marker.js"
import { getColumnWidth } from "../utils/viewport-config.js"

describe("TimelineTodayMarker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 14, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("draws a centered current-day guide outside hour view", () => {
    const origin = new Date("2026-07-10T00:00:00")
    const { renderResult } = renderTimeline(
      <TimelineTodayMarker origin={origin} height={100} />,
      { viewportMode: "day" }
    )

    const marker = renderResult.getByTestId("timeline-today-marker")
    expect(marker.style.left).toBe(`${4.5 * getColumnWidth("day")}px`)
    expect(marker.style.height).toBe("100px")
  })

  it("draws the guide at the exact current time in hour view", () => {
    const origin = new Date("2026-07-14T08:00:00")
    const { renderResult } = renderTimeline(
      <TimelineTodayMarker origin={origin} height={100} />,
      { viewportMode: "hours" }
    )

    const marker = renderResult.getByTestId("timeline-today-marker")
    expect(marker.style.left).toBe(`${16 * getColumnWidth("hours")}px`)
  })

  it("circles today's date in broader header views", () => {
    const origin = new Date("2026-07-10T00:00:00")
    const { renderResult } = renderTimeline(
      <TimelineTodayHeaderMarker
        columnWidth={getColumnWidth("day")}
        mode="day"
        origin={origin}
      />
    )

    const marker = renderResult.getByTestId("timeline-today-header-marker")
    expect(marker.style.left).toBe(`${4.5 * getColumnWidth("day")}px`)
    expect(marker).toHaveTextContent("14")
  })

  it("shows the exact current time in the hour header marker", () => {
    const origin = new Date("2026-07-14T08:00:00")
    const { renderResult } = renderTimeline(
      <TimelineTodayHeaderMarker
        columnWidth={getColumnWidth("hours")}
        mode="hours"
        origin={origin}
      />
    )

    const marker = renderResult.getByTestId("timeline-today-header-marker")
    expect(marker.style.left).toBe(`${16 * getColumnWidth("hours")}px`)
    expect(marker).toHaveTextContent("12:00pm")
  })
})
