import { describe, expect, it } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import { TimelineOffscreenIndicator } from "./timeline-offscreen-indicator.js"
import { computeDisplayRows } from "../hooks/use-display-rows.js"
import { renderTimeline } from "../test/render-timeline.js"
import { createTestItems } from "../test/fixtures.js"
import { dateToPx } from "../utils/position-utils.js"

const origin = new Date("2026-07-01T00:00:00Z")

function rowsFor(items: ReturnType<typeof createTestItems>) {
  return computeDisplayRows(
    new Map(items.map((item) => [item.id, item])),
    items.map((item) => item.id),
    "disabled",
    new Set()
  )
}

describe("TimelineOffscreenIndicator", () => {
  it("renders nothing when every item is visible", () => {
    const items = createTestItems(2, new Date("2026-07-10"))
    const viewportWidth = dateToPx(items[1].endDate, origin, "day") + 1
    const { renderResult } = renderTimeline(
      <TimelineOffscreenIndicator
        displayRows={rowsFor(items)}
        headerHeight={60}
        origin={origin}
      />,
      {
        items,
        viewportMode: "day",
        viewportWidth,
        viewportHeight: 300,
      }
    )

    expect(
      renderResult.queryAllByTestId(/^timeline-offscreen-(left|right)-/)
    ).toHaveLength(0)
  })

  it("renders a compact indicator with item info on every offscreen row", () => {
    const items = createTestItems(2, new Date("2026-07-14"))
    const scrollLeft = dateToPx(new Date("2026-07-26"), origin, "day")
    const { renderResult } = renderTimeline(
      <TimelineOffscreenIndicator
        displayRows={rowsFor(items)}
        headerHeight={60}
        origin={origin}
      />,
      {
        items,
        viewportMode: "day",
        viewportWidth: 400,
        viewportHeight: 300,
        scrollLeft,
      }
    )

    const indicators = renderResult.queryAllByTestId(
      /^timeline-offscreen-left-/
    )
    expect(indicators).toHaveLength(2)
    expect(indicators[0].querySelector("button")).toHaveTextContent("")
    expect(indicators[0]).toHaveTextContent("Task 1")
    expect(indicators[1]).toHaveTextContent("Task 2")
    expect(indicators[0]).toHaveClass("h-12", "w-14")
  })

  it("scrolls the selected row item into view", () => {
    const items = createTestItems(2, new Date("2026-07-14"))
    const scrollLeft = dateToPx(new Date("2026-07-26"), origin, "day")
    const { renderResult, store } = renderTimeline(
      <TimelineOffscreenIndicator
        displayRows={rowsFor(items)}
        headerHeight={60}
        origin={origin}
      />,
      {
        items,
        viewportMode: "day",
        viewportWidth: 400,
        viewportHeight: 300,
        scrollLeft,
      }
    )

    fireEvent.click(
      renderResult
        .getByTestId("timeline-offscreen-left-item-1")
        .querySelector("button")!
    )

    expect(store.getState().scrollLeft).toBeLessThan(scrollLeft)
  })

  it("centers the precise start time from either the arrow or its content", () => {
    const item = {
      ...createTestItems(1, new Date(2026, 6, 14, 10, 15))[0],
      startDate: new Date(2026, 6, 14, 10, 15),
      endDate: new Date(2026, 6, 14, 10, 45),
    }
    const hourOrigin = new Date(2026, 6, 14)
    const scrollLeft = dateToPx(new Date(2026, 6, 14, 16), hourOrigin, "hours")
    const { renderResult, store } = renderTimeline(
      <TimelineOffscreenIndicator
        displayRows={rowsFor([item])}
        headerHeight={60}
        origin={hourOrigin}
      />,
      {
        items: [item],
        viewportMode: "hours",
        viewportWidth: 400,
        viewportHeight: 300,
        scrollLeft,
      }
    )
    const expected = Math.max(
      0,
      dateToPx(item.startDate, store.getState().timelineOrigin, "hours") -
        store.getState().viewportWidth / 2
    )
    const indicator = renderResult.getByTestId(
      `timeline-offscreen-left-${item.id}`
    )

    fireEvent.click(indicator.querySelector("button")!)
    expect(store.getState().scrollLeft).toBeCloseTo(expected, 5)

    act(() => store.getState().actions.scrollTo(scrollLeft))
    fireEvent.click(
      renderResult.getByTestId(`timeline-offscreen-content-${item.id}`)
    )
    expect(store.getState().scrollLeft).toBeCloseTo(expected, 5)
  })
})
