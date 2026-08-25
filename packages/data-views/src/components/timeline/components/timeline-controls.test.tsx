import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { renderTimeline } from "../test/render-timeline.js"
import { TimelineControls } from "./timeline-controls.js"

describe("TimelineControls", () => {
  it("lists all modes and calls onViewportModeChange", async () => {
    const user = userEvent.setup()
    const onViewportModeChange = vi.fn()

    renderTimeline(<TimelineControls />, {}, { onViewportModeChange })

    const trigger = screen.getByTestId("timeline-mode-select")
    await user.click(trigger)

    expect(screen.getByTestId("timeline-mode-hours")).toHaveTextContent("Hours")
    expect(screen.getByTestId("timeline-mode-day")).toHaveTextContent("Day")
    expect(screen.getByTestId("timeline-mode-week")).toHaveTextContent("Week")
    expect(screen.getByTestId("timeline-mode-bi-week")).toHaveTextContent(
      "Bi-week"
    )
    expect(screen.getByTestId("timeline-mode-month")).toHaveTextContent("Month")
    expect(screen.getByTestId("timeline-mode-quarter")).toHaveTextContent(
      "Quarter"
    )
    expect(screen.getByTestId("timeline-mode-year")).toHaveTextContent("Year")

    await user.click(screen.getByTestId("timeline-mode-day"))

    expect(onViewportModeChange).toHaveBeenCalledWith("day")
    expect(
      screen.queryByTestId("timeline-settings-trigger")
    ).not.toBeInTheDocument()
  })

  it("keeps the required timeline header focused on navigation", () => {
    renderTimeline(<TimelineControls />)

    expect(screen.getByTestId("timeline-controls")).toBeVisible()
    expect(screen.getByText("Timeline")).toBeVisible()
    expect(screen.getByTestId("timeline-today-btn")).toBeVisible()
    expect(screen.getByTestId("timeline-mode-select")).toBeVisible()
  })
})
