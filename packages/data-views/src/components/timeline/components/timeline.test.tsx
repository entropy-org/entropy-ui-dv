import { describe, it, expect, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { renderTimeline } from "../test/render-timeline.js"
import { Timeline } from "./timeline.js"
import {
  createNestedTestItems,
  createTestItems,
} from "../test/fixtures.js"
import {
  dateRangeToPxWidth,
  dateToPx,
  getBarPosition,
} from "../utils/position-utils.js"

describe("Timeline (Root)", () => {
  it("renders header, grid, and rows for given items", () => {
    const items = createTestItems(2, new Date("2026-07-14"))

    renderTimeline(<Timeline />, { items, viewportMode: "week" })

    expect(screen.getByTestId("timeline-root")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-header")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-grid")).toBeInTheDocument()

    // We generated 2 items, so there should be 2 rows
    expect(screen.getByTestId("timeline-row-0")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-row-1")).toBeInTheDocument()
  })

  it("does not re-render bars when only the viewport scroll position changes", () => {
    const items = createTestItems(4, new Date("2026-07-14"))
    const renderBar = vi.fn((item) => <div>{item.id}</div>)
    const { store } = renderTimeline(
      <Timeline />,
      {
        items,
        viewportMode: "day",
        viewportWidth: 240,
        viewportHeight: 240,
      },
      { renderBar }
    )
    const initialRenderCount = renderBar.mock.calls.length
    const initialScrollLeft = store.getState().scrollLeft

    act(() => {
      store.getState().actions.scrollTo(initialScrollLeft + 120, 40)
    })

    expect(renderBar).toHaveBeenCalledTimes(initialRenderCount)
  })

  it("mounts only the buffered row window for a measured viewport", () => {
    const items = createTestItems(30, new Date("2026-07-14"))

    renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
      viewportWidth: 320,
      viewportHeight: 200,
      scrollTop: 400,
    })

    expect(screen.queryByTestId("timeline-row-0")).not.toBeInTheDocument()
    expect(screen.getByTestId("timeline-row-5")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-row-18")).toBeInTheDocument()
    expect(screen.queryByTestId("timeline-row-19")).not.toBeInTheDocument()
  })

  it("hides the add ghost on rows that already have an item", () => {
    const items = createTestItems(1, new Date("2026-07-14"))
    renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
      viewportWidth: 320,
      viewportHeight: 240,
    })
    const grid = screen.getByTestId("timeline-grid")

    fireEvent.mouseMove(grid, {
      clientX: 10,
      clientY: 20,
    })
    expect(screen.queryByTestId("timeline-ghost-bar")).not.toBeInTheDocument()
  })

  it("highlights only the hovered bar, not empty space on its row", () => {
    const items = [
      {
        id: "item-1",
        startDate: new Date(2026, 6, 14),
        endDate: new Date(2026, 6, 21),
        data: { title: "Task 1" },
      },
    ]
    const { store } = renderTimeline(<Timeline />, {
      items,
      viewportMode: "month",
      viewportWidth: 800,
      viewportHeight: 240,
      readOnly: true,
    })
    const grid = screen.getByTestId("timeline-grid")
    const bar = screen.getByTestId("timeline-bar-item-1")
    const origin = store.getState().timelineOrigin

    fireEvent.mouseEnter(bar)

    expect(store.getState().rangeHighlight).toMatchObject({
      type: "row",
      itemId: "item-1",
      startDate: items[0].startDate,
      endDate: items[0].endDate,
    })
    expect(screen.getByTestId("header-range-start")).toHaveTextContent("14 Jul")
    expect(screen.getByTestId("header-range-end")).toHaveTextContent("21 Jul")

    fireEvent.mouseLeave(bar)
    expect(store.getState().rangeHighlight).toBeNull()

    fireEvent.mouseMove(grid, {
      clientX: dateToPx(items[0].endDate, origin, "month") + 80,
      clientY: 20,
    })
    expect(store.getState().rangeHighlight).toBeNull()
    expect(
      screen.queryByTestId("header-range-highlight")
    ).not.toBeInTheDocument()
  })

  it("expands grid rows and sidebar items independently", () => {
    const items = createNestedTestItems()
    renderTimeline(<Timeline />, {
      items,
      subItems: "nested",
      sidebar: true,
      viewportMode: "day",
      viewportWidth: 5000,
      viewportHeight: 400,
    })

    expect(
      screen.queryByTestId("timeline-bar-child-1a")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("sidebar-toggle-parent-1")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(
      screen.queryByTestId("sidebar-item-child-1a")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("timeline-parent-toggle-parent-1"))

    expect(screen.getByTestId("timeline-bar-child-1a")).toBeInTheDocument()
    expect(
      screen.getByTestId("hierarchy-indicator-parent-1-child-1a")
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("timeline-parent-toggle-parent-1")
    ).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.queryByTestId("sidebar-item-child-1a")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("sidebar-toggle-parent-1"))

    expect(screen.getByTestId("sidebar-item-child-1a")).toBeInTheDocument()
    expect(screen.getByTestId("sidebar-toggle-parent-1")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("keeps a parent's position independent from hierarchy visibility", () => {
    const nestedItems = createNestedTestItems()
    const items = nestedItems.map((item) =>
      item.id === "parent-1"
        ? {
            ...item,
            startDate: new Date(2026, 6, 10),
            endDate: new Date(2026, 6, 12),
          }
        : item
    )
    const childDates = items
      .filter((item) => item.parentId === "parent-1")
      .map((item) => ({
        id: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
      }))
    const { store } = renderTimeline(<Timeline />, {
      items,
      subItems: "nested",
      viewportMode: "day",
      viewportWidth: 5000,
      viewportHeight: 400,
    })
    const origin = store.getState().timelineOrigin

    expect(screen.getByTestId("timeline-bar-parent-1")).toHaveStyle({
      left: `${dateToPx(items[0].startDate, origin, "day")}px`,
      width: `${dateRangeToPxWidth(
        items[0].startDate,
        items[0].endDate,
        "day"
      )}px`,
    })

    fireEvent.click(screen.getByTestId("timeline-parent-toggle-parent-1"))
    expect(screen.getByTestId("timeline-bar-parent-1")).toHaveStyle({
      left: `${dateToPx(items[0].startDate, origin, "day")}px`,
    })

    const movedRange = {
      startDate: new Date(2026, 6, 16),
      endDate: new Date(2026, 6, 20),
    }
    act(() => {
      store.getState().actions.updateItem("parent-1", movedRange)
    })

    expect(screen.getByTestId("timeline-bar-parent-1")).toHaveStyle({
      left: `${dateToPx(movedRange.startDate, origin, "day")}px`,
      width: `${dateRangeToPxWidth(
        movedRange.startDate,
        movedRange.endDate,
        "day"
      )}px`,
    })

    fireEvent.click(screen.getByTestId("timeline-parent-toggle-parent-1"))
    expect(screen.getByTestId("timeline-bar-parent-1")).toHaveStyle({
      left: `${dateToPx(movedRange.startDate, origin, "day")}px`,
    })
    for (const child of childDates) {
      expect(store.getState().items.get(child.id)).toMatchObject(child)
    }
  })

  it("filters rows from the search bar and clears the result", async () => {
    const user = userEvent.setup()
    const items = createTestItems(3, new Date("2026-07-14"))

    renderTimeline(<Timeline />, {
      items,
      sidebar: true,
      viewportMode: "day",
      viewportWidth: 5000,
      viewportHeight: 400,
    })

    const input = screen.getByRole("searchbox", {
      name: "Search timeline",
    })
    const searchControl = screen.getByTestId("timeline-search")

    expect(input).toHaveAttribute("placeholder", "Search…")
    expect(input).toHaveClass("focus-visible:ring-0")
    expect(searchControl).toHaveClass("w-44")

    await user.click(input)
    expect(searchControl).toHaveClass("w-44")
    await user.type(input, "Task 2")

    expect(screen.queryByTestId("timeline-bar-item-1")).not.toBeInTheDocument()
    expect(screen.getByTestId("timeline-bar-item-2")).toBeInTheDocument()
    expect(screen.queryByTestId("timeline-bar-item-3")).not.toBeInTheDocument()
    expect(screen.getByTestId("sidebar-item-item-2")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Clear timeline search" })
    )

    expect(input).toHaveValue("")
    expect(screen.getByTestId("timeline-bar-item-1")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-bar-item-3")).toBeInTheDocument()
  })

  it("scrolls to the first match in real time when results share a prefix", async () => {
    const user = userEvent.setup()
    const items = [
      {
        id: "alpha-first",
        startDate: new Date("2026-08-10"),
        endDate: new Date("2026-08-12"),
        data: { title: "Alpha planning" },
      },
      {
        id: "alpha-second",
        startDate: new Date("2026-08-24"),
        endDate: new Date("2026-08-26"),
        data: { title: "Alpha review" },
      },
    ]
    const { store } = renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
      viewportWidth: 320,
      viewportHeight: 300,
    })
    const origin = store.getState().timelineOrigin
    const firstPosition = getBarPosition(
      items[0].startDate,
      items[0].endDate,
      origin,
      "day"
    )
    const expectedScrollLeft = Math.max(
      0,
      firstPosition.left + firstPosition.width / 2 - 160
    )

    await user.type(
      screen.getByRole("searchbox", { name: "Search timeline" }),
      "Alpha"
    )

    await waitFor(() => {
      expect(store.getState().scrollLeft).toBe(expectedScrollLeft)
    })
  })

  it("shows a recoverable empty state when no rows match", async () => {
    const user = userEvent.setup()
    const items = createTestItems(2, new Date("2026-07-14"))

    renderTimeline(<Timeline />, {
      items,
      viewportMode: "day",
      viewportWidth: 5000,
      viewportHeight: 400,
    })

    await user.type(
      screen.getByRole("searchbox", { name: "Search timeline" }),
      "not-a-row"
    )

    expect(screen.getByTestId("timeline-search-empty-state")).toHaveTextContent(
      "No matching rows"
    )

    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(screen.getByTestId("timeline-bar-item-1")).toBeInTheDocument()
  })

  it("creates a dependency and tints a backward draft red", async () => {
    const items = createTestItems(2, new Date("2026-07-14"))
    const onDependencyAdd = vi.fn()
    const originalElementsFromPoint = document.elementsFromPoint

    renderTimeline(
      <Timeline />,
      {
        items,
        dependencies: true,
        viewportMode: "day",
        viewportWidth: 2000,
        viewportHeight: 300,
      },
      {
        dependenciesList: [],
        onDependencyAdd,
      }
    )

    const targetRow = screen.getByTestId("timeline-row-1")
    let elementsAtPointer: Element[] = []
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => elementsAtPointer),
    })

    fireEvent.pointerDown(screen.getByTestId("dependency-port-item-1"), {
      clientX: 120,
      clientY: 24,
      pointerId: 1,
    })
    expect(screen.getByTestId("dependency-draft")).toBeInTheDocument()

    fireEvent.pointerMove(window, {
      clientX: -20,
      clientY: 72,
      pointerId: 1,
    })
    await waitFor(() => {
      expect(
        screen.getByTestId("dependency-draft").querySelector("path")
      ).toHaveAttribute("data-backward")
    })

    elementsAtPointer = [targetRow]
    fireEvent.pointerUp(window, {
      clientX: 240,
      clientY: 72,
      pointerId: 1,
    })

    expect(onDependencyAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        fromItemId: "item-1",
        toItemId: "item-2",
        type: "finish-to-start",
      })
    )

    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: originalElementsFromPoint,
    })
  })
})
