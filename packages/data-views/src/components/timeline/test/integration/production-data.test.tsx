import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Timeline } from "../../components/timeline.js"
import { TimelineProvider } from "../../context/timeline-provider.js"
import { createTestItems } from "../fixtures.js"
import { renderTimeline } from "../render-timeline.js"

afterEach(() => vi.useRealTimers())

describe("Timeline production data integration", () => {
  it("renders explicit initial loading and error states", () => {
    const { rerender } = render(
      <TimelineProvider
        config={{
          items: [],
          dataState: { status: "loading", message: "Loading project" },
          renderBar: () => null,
        }}
      >
        <Timeline />
      </TimelineProvider>
    )
    expect(screen.getByTestId("timeline-loading-state")).toHaveTextContent(
      "Loading project"
    )

    rerender(
      <TimelineProvider
        config={{
          items: [],
          dataState: {
            status: "error",
            error: new Error("offline"),
            message: "No connection",
          },
          renderBar: () => null,
        }}
      >
        <Timeline />
      </TimelineProvider>
    )
    expect(screen.getByTestId("timeline-error-state")).toHaveTextContent(
      "No connection"
    )
  })

  it("reports a debounced visible range and requests the previous page once", () => {
    vi.useFakeTimers()
    const onVisibleRangeChange = vi.fn()
    const onLoadMore = vi.fn()
    renderTimeline(
      <Timeline />,
      {
        items: createTestItems(3),
        viewportMode: "day",
        viewportWidth: 320,
        viewportHeight: 240,
      },
      {
        dataState: { status: "ready", hasPreviousPage: true },
        onLoadMore,
        onVisibleRangeChange,
      }
    )

    act(() => vi.advanceTimersByTime(100))

    expect(onVisibleRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: expect.any(Date),
        end: expect.any(Date),
        viewportMode: "day",
      }),
      expect.objectContaining({ reason: expect.any(String) })
    )
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(onLoadMore).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "previous" })
    )
  })

  it("contains renderer failures and applies record visibility permissions", () => {
    const items = createTestItems(2)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <TimelineProvider
        config={{
          items,
          viewportMode: "day",
          getItemPermissions: (item) => ({ view: item.id !== "item-2" }),
          renderBar: () => {
            throw new Error("renderer failed")
          },
        }}
      >
        <Timeline className="h-96" />
      </TimelineProvider>
    )

    expect(screen.getByText("Unable to render item")).toBeInTheDocument()
    expect(screen.queryByTestId("timeline-bar-item-2")).not.toBeInTheDocument()
    expect(screen.getByTestId("timeline-root")).not.toHaveAttribute(
      "data-read-only"
    )
    consoleError.mockRestore()
  })
})
