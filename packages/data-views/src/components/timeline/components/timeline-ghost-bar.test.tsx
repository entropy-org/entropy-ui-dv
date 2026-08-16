/**
 * Tests for TimelineGhostBar component.
 *
 * - Hover over the grid shows a ghost bar at the snapped position
 * - Click fires `onItemAdd` with correct dates and row index
 * - Does not render in readOnly mode
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent } from "@testing-library/react"
import { TimelineGhostBar } from "./timeline-ghost-bar.js"
import { renderTimeline } from "../test/render-timeline.js"
import { createTestItems } from "../test/fixtures.js"

const TOTAL_WIDTH = 1000

describe("TimelineGhostBar", () => {
  it("renders a ghost bar element", () => {
    const items = createTestItems(2)
    const { renderResult } = renderTimeline(
      <TimelineGhostBar
        rowIndex={0}
        startDate={new Date("2026-07-14")}
        endDate={new Date("2026-07-21")}
        relativeX={200}
        totalWidth={TOTAL_WIDTH}
      />,
      { items }
    )
    const ghost = renderResult.getByTestId("timeline-ghost-bar")
    expect(ghost).toHaveClass("bg-muted/15", "opacity-65")
    expect(ghost).not.toHaveClass("bg-primary/12")
  })

  it("fires onItemAdd with correct dates and rowIndex when clicked", () => {
    const onItemAdd = vi.fn()
    const startDate = new Date("2026-07-14")
    const endDate = new Date("2026-07-21")
    const rowIndex = 2

    const { renderResult } = renderTimeline(
      <TimelineGhostBar
        rowIndex={rowIndex}
        startDate={startDate}
        endDate={endDate}
        relativeX={200}
        totalWidth={TOTAL_WIDTH}
      />,
      {},
      { onItemAdd }
    )

    const ghost = renderResult.container.querySelector(
      "[data-testid='timeline-ghost-bar']"
    )
    fireEvent.click(ghost!)

    expect(onItemAdd).toHaveBeenCalledWith(startDate, endDate, rowIndex)
  })

  it("does not render when readOnly is true", () => {
    const { renderResult } = renderTimeline(
      <TimelineGhostBar
        rowIndex={0}
        startDate={new Date("2026-07-14")}
        endDate={new Date("2026-07-21")}
        relativeX={200}
        totalWidth={TOTAL_WIDTH}
      />,
      { readOnly: true }
    )
    expect(
      renderResult.container.querySelector("[data-testid='timeline-ghost-bar']")
    ).toBeNull()
  })

  it("centers the bar on relativeX with min width", () => {
    const startDate = new Date("2026-07-14")
    const endDate = new Date("2026-07-15")
    const relativeX = 400
    const { renderResult } = renderTimeline(
      <TimelineGhostBar
        rowIndex={0}
        startDate={startDate}
        endDate={endDate}
        relativeX={relativeX}
        totalWidth={TOTAL_WIDTH}
      />
    )

    const ghost = renderResult.getByTestId("timeline-ghost-bar")
    expect(ghost.style.width).toBe("32px")
    expect(Number.parseFloat(ghost.style.left)).toBe(relativeX - 16)
  })
})
