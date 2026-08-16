import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { TimelineHeader } from "./timeline-header.js"
import { renderTimeline } from "../test/render-timeline.js"
import { generateColumnDates } from "../utils/date-utils.js"
import { getColumnWidth } from "../utils/viewport-config.js"

function renderHeader(
  mode: "hours" | "day" | "month" | "quarter" | "year",
  start: Date,
  end: Date,
  rangeHighlight?: React.ComponentProps<typeof TimelineHeader>["rangeHighlight"]
) {
  const columns = generateColumnDates(start, end, mode)
  const columnWidth = getColumnWidth(mode)

  return renderTimeline(
    <TimelineHeader
      columns={columns}
      columnWidth={columnWidth}
      mode={mode}
      origin={start}
      rangeHighlight={rangeHighlight}
      totalWidth={columns.length * columnWidth}
    />
  )
}

describe("TimelineHeader", () => {
  it("renders half-hour labels over quarter-hour interaction columns", () => {
    renderHeader("hours", new Date(2026, 6, 14, 10), new Date(2026, 6, 14, 11))

    expect(
      screen
        .getAllByTestId("header-secondary-cell")
        .map((cell) => cell.textContent)
    ).toEqual(["10am", "10:30am"])
  })

  it("renders month groups and individual days at close zoom levels", () => {
    renderHeader("day", new Date(2026, 6, 1), new Date(2026, 6, 5))

    expect(screen.getByText("July 2026")).toBeInTheDocument()
    expect(
      screen
        .getAllByTestId("header-secondary-cell")
        .map((cell) => cell.textContent)
    ).toEqual(["1", "2", "3", "4"])
  })

  it("marks weekend header cells in month view", () => {
    const { renderResult } = renderHeader(
      "month",
      new Date(2026, 6, 3),
      new Date(2026, 6, 7)
    )

    expect(
      renderResult.container.querySelectorAll("[data-weekend='true']")
    ).toHaveLength(2)
  })

  it("samples about four day labels per month at quarter scale", () => {
    renderHeader("quarter", new Date(2026, 6, 1), new Date(2026, 7, 1))

    expect(
      screen
        .getAllByTestId("header-secondary-cell")
        .map((cell) => cell.textContent)
    ).toEqual(["1", "9", "17", "25"])
  })

  it("samples four day labels per month at year scale", () => {
    renderHeader("year", new Date(2026, 6, 1), new Date(2026, 7, 1))

    expect(screen.getByText("Jul 2026")).toBeInTheDocument()
    expect(
      screen
        .getAllByTestId("header-secondary-cell")
        .map((cell) => cell.textContent)
    ).toEqual(["1", "9", "17", "25"])
  })

  it("projects a live range and both endpoint dates onto the header", () => {
    const start = new Date(2026, 6, 1)
    renderHeader("day", start, new Date(2026, 6, 7), {
      type: "resize",
      itemId: "item-1",
      startDate: new Date(2026, 6, 2),
      endDate: new Date(2026, 6, 4),
      activeEdge: "end",
    })

    expect(screen.getByTestId("header-range-highlight")).toHaveStyle({
      left: `${getColumnWidth("day")}px`,
      width: `${2 * getColumnWidth("day")}px`,
    })
    expect(screen.getByTestId("timeline-today-header-marker")).toHaveClass(
      "z-10"
    )
    expect(screen.getByTestId("header-range-highlight")).toHaveClass("z-20")
    expect(screen.getByTestId("header-range-start")).toHaveTextContent("2 Jul")
    expect(screen.getByTestId("header-range-end")).toHaveTextContent("4 Jul")
  })

  it("includes quarter-hour times in hour-view range labels", () => {
    const start = new Date(2026, 6, 14, 10)
    renderHeader("hours", start, new Date(2026, 6, 14, 11), {
      type: "drag",
      itemId: "item-1",
      startDate: new Date(2026, 6, 14, 10, 15),
      endDate: new Date(2026, 6, 14, 10, 45),
    })

    expect(screen.getByTestId("header-range-start")).toHaveTextContent(
      "14 Jul · 10:15 AM"
    )
    expect(screen.getByTestId("header-range-end")).toHaveTextContent(
      "14 Jul · 10:45 AM"
    )
  })
})
