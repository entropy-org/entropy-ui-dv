/**
 * Tests for TimelineDependencyLayer component.
 */
import { act, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TimelineDependencyLayer } from "./timeline-dependency-layer.js"
import { renderTimeline } from "../test/render-timeline.js"
import {
  createTestItem,
  createTestDependencies,
} from "../test/fixtures.js"
import type { DisplayRow } from "../hooks/use-display-rows.js"
import { dateToPx } from "../utils/position-utils.js"

const origin = new Date("2026-07-01T00:00:00Z")

const items = [
  createTestItem({
    id: "item-1",
    startDate: new Date("2026-07-02"),
    endDate: new Date("2026-07-09"),
  }),
  createTestItem({
    id: "item-2",
    startDate: new Date("2026-07-10"),
    endDate: new Date("2026-07-17"),
  }),
  createTestItem({
    id: "item-3",
    startDate: new Date("2026-07-02"),
    endDate: new Date("2026-07-09"),
  }),
]

const displayRows: DisplayRow[] = [
  {
    item: items[0],
    depth: 0,
    isParent: false,
    isExpanded: false,
  },
  {
    item: items[1],
    depth: 0,
    isParent: false,
    isExpanded: false,
  },
  {
    item: items[2],
    depth: 0,
    isParent: false,
    isExpanded: false,
  },
]

describe("TimelineDependencyLayer", () => {
  it("renders dependency paths when enabled", () => {
    const dependenciesList = createTestDependencies()
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={1000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 1000,
      },
      {
        dependenciesList,
      }
    )

    // Should find the SVG and two paths
    const svg = renderResult.container.querySelector(
      "[data-testid='timeline-dependency-layer']"
    )
    expect(svg).toBeTruthy()

    const path1 = renderResult.container.querySelector(
      "[data-testid='dependency-path-dep-1']"
    )
    const path2 = renderResult.container.querySelector(
      "[data-testid='dependency-path-dep-2']"
    )
    expect(path1).toBeTruthy()
    expect(path2).toBeTruthy()
    expect(path1).toHaveAttribute("stroke-width", "1.75")
    expect(path1).not.toHaveAttribute("stroke-dasharray")
    expect(path1).toHaveAttribute("stroke-linecap", "round")
    expect(path1).toHaveClass("text-amber-500/65")
    expect(path1?.getAttribute("marker-end")).toMatch(/^url\(#timeline-arrow-/)

    const hitArea = renderResult.getByTestId("dependency-hit-area-dep-1")
    expect(hitArea).toHaveAttribute("stroke", "transparent")
    expect(hitArea).toHaveAttribute("stroke-width", "10")

    const markerPath = svg?.querySelector("marker path")
    expect(markerPath).toHaveAttribute("fill", "none")
    expect(markerPath).toHaveAttribute("stroke", "context-stroke")
    expect(markerPath).toHaveAttribute("stroke-width", "1.75")
    expect(markerPath).toHaveAttribute("d", "M 1.1 1.15 L 5.85 3.5 L 1.1 5.85")
    expect(markerPath?.closest("marker")).toHaveAttribute(
      "markerUnits",
      "userSpaceOnUse"
    )
  })

  it("updates connected paths during a live resize", async () => {
    const dependenciesList = createTestDependencies()
    const { renderResult, store } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={5000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 5000,
      },
      {
        dependenciesList,
      }
    )
    const path = renderResult.getByTestId("dependency-path-dep-1")
    const initialPath = path.getAttribute("d")

    act(() => {
      store.getState().actions.setRangeHighlight({
        type: "resize",
        itemId: "item-1",
        startDate: items[0].startDate,
        endDate: new Date("2026-07-12"),
        activeEdge: "end",
      })
    })

    await waitFor(() => {
      expect(path.getAttribute("d")).not.toBe(initialPath)
      expect(path.closest("g")).toHaveAttribute("data-live", "true")
    })
  })

  it("updates every connected path during a selected-item move", async () => {
    const dependenciesList = createTestDependencies()
    const { renderResult, store } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={5000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 5000,
      },
      {
        dependenciesList,
      }
    )
    const firstPath = renderResult.getByTestId("dependency-path-dep-1")
    const secondPath = renderResult.getByTestId("dependency-path-dep-2")
    const initialFirstPath = firstPath.getAttribute("d")
    const initialSecondPath = secondPath.getAttribute("d")

    act(() => {
      store.getState().actions.startDrag({
        type: "move",
        itemIds: ["item-1", "item-2"],
        originX: 100,
        currentX: 100,
        originScrollLeft: 0,
      })
      store.getState().actions.setRangeHighlight({
        type: "drag",
        itemId: "item-1",
        startDate: new Date("2026-07-04"),
        endDate: new Date("2026-07-11"),
      })
    })

    await waitFor(() => {
      expect(firstPath.getAttribute("d")).not.toBe(initialFirstPath)
      expect(secondPath.getAttribute("d")).not.toBe(initialSecondPath)
      expect(firstPath.closest("g")).toHaveAttribute("data-live", "true")
      expect(secondPath.closest("g")).toHaveAttribute("data-live", "true")
    })
  })

  it("keeps duplicate relationships visually distinct", () => {
    const dependenciesList = [
      {
        id: "dep-a",
        fromItemId: "item-1",
        toItemId: "item-2",
        type: "finish-to-start" as const,
      },
      {
        id: "dep-b",
        fromItemId: "item-1",
        toItemId: "item-2",
        type: "finish-to-start" as const,
      },
    ]
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={5000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 5000,
      },
      {
        dependenciesList,
      }
    )

    const firstPath = renderResult.getByTestId("dependency-path-dep-a")
    const secondPath = renderResult.getByTestId("dependency-path-dep-b")

    expect(firstPath.getAttribute("d")).not.toBe(secondPath.getAttribute("d"))
  })

  it("removes a dependency from its forgiving hit target", () => {
    const dependenciesList = createTestDependencies()
    const onDependencyRemove = vi.fn()
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={5000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 5000,
      },
      {
        dependenciesList,
        onDependencyRemove,
      }
    )

    fireEvent.click(
      renderResult.getByTestId(`dependency-remove-${dependenciesList[0].id}`)
    )

    expect(onDependencyRemove).toHaveBeenCalledWith(dependenciesList[0])
  })

  it("keeps the destination removal control hidden until link hover or focus", () => {
    const dependenciesList = createTestDependencies()
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={5000}
      />,
      {
        items,
        dependencies: true,
        viewportWidth: 5000,
      },
      {
        dependenciesList,
        onDependencyRemove: vi.fn(),
      }
    )

    const removeControl = renderResult.getByTestId(
      `dependency-remove-${dependenciesList[0].id}`
    )
    expect(removeControl).toHaveClass("opacity-0", "group-hover:opacity-100")
    expect(removeControl.querySelectorAll("circle")[1]).toHaveAttribute(
      "cx",
      "0"
    )
    expect(removeControl.querySelectorAll("circle")[1]).toHaveAttribute(
      "cy",
      "0"
    )
  })

  it("does not render when dependenciesEnabled is false in store", () => {
    const dependenciesList = createTestDependencies()
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={1000}
      />,
      {
        items,
        dependencies: false,
        viewportWidth: 1000,
      },
      {
        dependenciesList,
      }
    )

    const svg = renderResult.container.querySelector(
      "[data-testid='timeline-dependency-layer']"
    )
    expect(svg).toBeNull()
  })

  it("virtualizes: does not render paths where both endpoints are offscreen", () => {
    const dependenciesList = createTestDependencies()
    const { renderResult } = renderTimeline(
      <TimelineDependencyLayer
        origin={origin}
        displayRows={displayRows}
        contentHeight={300}
        contentWidth={1000}
      />,
      {
        items,
        dependencies: true,
        viewportMode: "week",
        viewportWidth: 100, // Very narrow viewport
        scrollLeft: dateToPx(new Date("2026-07-25"), origin, "week"),
      },
      {
        dependenciesList,
      }
    )

    const svg = renderResult.container.querySelector(
      "[data-testid='timeline-dependency-layer']"
    )
    expect(svg).toBeNull() // SVG itself is null because paths.length is 0 after virtualization
  })
})
