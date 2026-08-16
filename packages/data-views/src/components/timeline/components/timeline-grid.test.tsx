import { describe, it, expect } from "vitest"
import { renderTimeline } from "../test/render-timeline.js"
import { TimelineGrid } from "./timeline-grid.js"
import { generateColumnDates } from "../utils/date-utils.js"
import { getColumnWidth } from "../utils/viewport-config.js"

describe("TimelineGrid", () => {
  it("renders column guides at the supplied content height without row lanes", () => {
    const origin = new Date("2026-07-01T00:00:00Z")
    const end = new Date("2026-07-05T00:00:00Z") // 4 days
    const columns = generateColumnDates(origin, end, "day")
    const columnWidth = getColumnWidth("day")

    const { renderResult } = renderTimeline(
      <TimelineGrid
        columns={columns}
        columnWidth={columnWidth}
        mode="day"
        totalWidth={columns.length * columnWidth}
        contentHeight={320}
      />
    )

    const gridLines = renderResult.getAllByTestId("grid-column-line")
    expect(gridLines.length).toBe(columns.length) // one right-border per column

    expect(renderResult.queryAllByTestId("grid-row-background")).toHaveLength(0)
    expect(renderResult.getByTestId("timeline-grid")).toHaveStyle({
      height: "320px",
    })
  })

  it("renders only month-boundary guides at quarter scale", () => {
    const origin = new Date(2026, 6, 1)
    const end = new Date(2026, 7, 1)
    const columns = generateColumnDates(origin, end, "quarter")
    const columnWidth = getColumnWidth("quarter")

    const { renderResult } = renderTimeline(
      <TimelineGrid
        columns={columns}
        columnWidth={columnWidth}
        mode="quarter"
        totalWidth={columns.length * columnWidth}
        contentHeight={320}
      />
    )

    expect(columns).toHaveLength(31)
    expect(renderResult.getAllByTestId("grid-column-line")).toHaveLength(1)
  })

  it("renders two guides per hour with stronger hour boundaries", () => {
    const origin = new Date(2026, 6, 14, 10)
    const end = new Date(2026, 6, 14, 11)
    const columns = generateColumnDates(origin, end, "hours")
    const columnWidth = getColumnWidth("hours")

    const { renderResult } = renderTimeline(
      <TimelineGrid
        columns={columns}
        columnWidth={columnWidth}
        mode="hours"
        totalWidth={columns.length * columnWidth}
        contentHeight={320}
      />
    )

    expect(renderResult.getAllByTestId("grid-column-line")).toHaveLength(2)
    expect(
      renderResult.container.querySelectorAll("[data-hour-boundary='true']")
    ).toHaveLength(1)
  })

  it("omits vertical guides in month mode", () => {
    const origin = new Date(2026, 6, 1)
    const end = new Date(2026, 7, 1)
    const columns = generateColumnDates(origin, end, "month")
    const columnWidth = getColumnWidth("month")

    const { renderResult } = renderTimeline(
      <TimelineGrid
        columns={columns}
        columnWidth={columnWidth}
        mode="month"
        totalWidth={columns.length * columnWidth}
        contentHeight={320}
      />
    )

    expect(renderResult.queryAllByTestId("grid-column-line")).toHaveLength(0)
    expect(renderResult.getAllByTestId("grid-weekend-shading")).toHaveLength(8)
  })
})
