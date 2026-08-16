import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { TimelineEmptyState } from "./timeline-empty-state.js"
import { renderTimeline } from "../test/render-timeline.js"

describe("TimelineEmptyState", () => {
  it("renders the consumer-provided empty state", () => {
    const renderEmptyState = vi.fn(() => (
      <div data-testid="custom-empty-state">Plan your first milestone</div>
    ))

    renderTimeline(<TimelineEmptyState />, {}, { renderEmptyState })

    expect(screen.getByTestId("custom-empty-state")).toHaveTextContent(
      "Plan your first milestone"
    )
    expect(renderEmptyState).toHaveBeenCalledTimes(1)
  })

  it("falls back to a polished default empty state", () => {
    renderTimeline(<TimelineEmptyState />)

    expect(screen.getByTestId("timeline-empty-state")).toBeInTheDocument()
    expect(screen.getByText("No work scheduled yet")).toBeInTheDocument()
  })
})
