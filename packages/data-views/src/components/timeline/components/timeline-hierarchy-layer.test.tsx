import { act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TimelineHierarchyLayer } from "./timeline-hierarchy-layer.js"
import { computeDisplayRows } from "../hooks/use-display-rows.js"
import { createNestedTestItems } from "../test/fixtures.js"
import { renderTimeline } from "../test/render-timeline.js"

const origin = new Date("2026-07-01T00:00:00Z")
const items = createNestedTestItems()
const itemMap = new Map(items.map((item) => [item.id, item]))
const itemOrder = items.map((item) => item.id)
const expandedRows = computeDisplayRows(
  itemMap,
  itemOrder,
  "nested",
  new Set(["parent-1"])
)

function renderHierarchyLayer() {
  return renderTimeline(
    <TimelineHierarchyLayer
      origin={origin}
      displayRows={expandedRows}
      contentHeight={400}
      contentWidth={5000}
    />,
    {
      items,
      subItems: "nested",
      viewportMode: "week",
      viewportWidth: 5000,
    }
  )
}

describe("TimelineHierarchyLayer", () => {
  it("draws compact file-tree arrows instead of full parent connections", () => {
    const { renderResult } = renderHierarchyLayer()
    const firstIndicator = renderResult.getByTestId(
      "hierarchy-indicator-parent-1-child-1a"
    )
    const secondIndicator = renderResult.getByTestId(
      "hierarchy-indicator-parent-1-child-1b"
    )

    expect(firstIndicator.querySelectorAll("path")).toHaveLength(2)
    expect(firstIndicator).toHaveClass("text-muted-foreground/45")
    expect(firstIndicator).not.toHaveAttribute("marker-end")
    expect(renderResult.container.querySelector("marker")).toBeNull()
    expect(firstIndicator.getAttribute("transform")).not.toBe(
      secondIndicator.getAttribute("transform")
    )
  })

  it("does not draw hierarchy indicators outside nested mode", () => {
    const flattenedRows = computeDisplayRows(
      itemMap,
      itemOrder,
      "flattened",
      new Set()
    )
    const { renderResult } = renderTimeline(
      <TimelineHierarchyLayer
        origin={origin}
        displayRows={flattenedRows}
        contentHeight={400}
        contentWidth={5000}
      />,
      {
        items,
        subItems: "flattened",
        viewportWidth: 5000,
      }
    )

    expect(
      renderResult.queryByTestId("timeline-hierarchy-layer")
    ).not.toBeInTheDocument()
  })

  it("keeps a child indicator attached during a live drag", () => {
    const { renderResult, store } = renderHierarchyLayer()
    const indicator = renderResult.getByTestId(
      "hierarchy-indicator-parent-1-child-1a"
    )
    const initialTransform = indicator.getAttribute("transform")

    act(() => {
      store.getState().actions.startDrag({
        type: "move",
        itemIds: ["child-1a"],
        originX: 100,
        currentX: 100,
        originScrollLeft: 0,
      })
      store.getState().actions.setRangeHighlight({
        type: "drag",
        itemId: "child-1a",
        startDate: new Date("2026-07-16"),
        endDate: new Date("2026-07-23"),
      })
    })

    expect(indicator.getAttribute("transform")).not.toBe(initialTransform)
    expect(indicator).toHaveAttribute("data-live", "true")
    expect(indicator).toHaveClass("text-foreground/65")
  })

  it("keeps a child indicator attached during a live left resize", () => {
    const { renderResult, store } = renderHierarchyLayer()
    const indicator = renderResult.getByTestId(
      "hierarchy-indicator-parent-1-child-1b"
    )
    const initialTransform = indicator.getAttribute("transform")

    act(() => {
      store.getState().actions.setRangeHighlight({
        type: "resize",
        itemId: "child-1b",
        startDate: new Date("2026-07-19"),
        endDate: new Date("2026-07-28"),
        activeEdge: "start",
      })
    })

    expect(indicator.getAttribute("transform")).not.toBe(initialTransform)
    expect(indicator).toHaveAttribute("data-live", "true")
  })
})
