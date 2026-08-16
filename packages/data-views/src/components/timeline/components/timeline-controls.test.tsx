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

    await user.click(screen.getByTestId("timeline-settings-trigger"))
    expect(screen.getByTestId("timeline-settings-panel")).toBeInTheDocument()
    expect(
      screen.getByTestId("timeline-settings-mode-select")
    ).toBeInTheDocument()
  })

  it("controls visibility and hierarchy settings from the header panel", async () => {
    const user = userEvent.setup()
    const onSidebarVisibleChange = vi.fn()
    const onDependenciesEnabledChange = vi.fn()
    const onRowSubItemModeChange = vi.fn()
    const onSidebarSubItemModeChange = vi.fn()
    const { store } = renderTimeline(
      <TimelineControls />,
      {
        sidebar: true,
        dependencies: true,
        rowSubItems: "nested",
        sidebarSubItems: "nested",
      },
      {
        onSidebarVisibleChange,
        onDependenciesEnabledChange,
        onRowSubItemModeChange,
        onSidebarSubItemModeChange,
      }
    )

    await user.click(screen.getByTestId("timeline-settings-trigger"))
    await user.click(screen.getByTestId("timeline-settings-sidebar"))
    await user.click(screen.getByTestId("timeline-settings-dependencies"))
    await user.click(screen.getByTestId("timeline-settings-grid-mode-disabled"))
    await user.click(
      screen.getByTestId("timeline-settings-sidebar-mode-flattened")
    )

    expect(store.getState().sidebarVisible).toBe(false)
    expect(store.getState().dependenciesEnabled).toBe(false)
    expect(store.getState().rowSubItemMode).toBe("disabled")
    expect(store.getState().sidebarSubItemMode).toBe("flattened")
    expect(onSidebarVisibleChange).toHaveBeenCalledWith(false)
    expect(onDependenciesEnabledChange).toHaveBeenCalledWith(false)
    expect(onRowSubItemModeChange).toHaveBeenCalledWith("disabled")
    expect(onSidebarSubItemModeChange).toHaveBeenCalledWith("flattened")
  })
})
