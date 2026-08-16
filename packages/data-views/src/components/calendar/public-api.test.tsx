import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  CALENDAR_VIEW_MODES,
  CalendarProvider,
  createDefaultCalendarPreferences,
  type CalendarConfig,
  type CalendarItem,
  type CalendarMutationCommand,
} from "./index.js"

describe("calendar public API", () => {
  it("supports a consumer-style typed configuration", () => {
    const item = {
      id: "launch",
      kind: "all-day",
      startDate: "2026-07-27",
      endDate: "2026-07-31",
      data: { title: "Launch" },
    } satisfies CalendarItem

    const command = {
      type: "delete",
      clientMutationId: "delete-launch",
      itemIds: [item.id],
    } satisfies CalendarMutationCommand

    const config = {
      items: [item],
      preferences: createDefaultCalendarPreferences("UTC"),
      initialAnchorDate: "2026-07-27",
      renderItem: (candidate) => candidate.id,
      onItemMutation: () => undefined,
    } satisfies CalendarConfig

    render(
      <CalendarProvider config={config}>
        <div data-testid="consumer">Configured</div>
      </CalendarProvider>
    )

    expect(command.type).toBe("delete")
    expect(CALENDAR_VIEW_MODES).toEqual(["month", "week", "agenda"])
    expect(screen.getByTestId("consumer")).toHaveTextContent("Configured")
  })
})
