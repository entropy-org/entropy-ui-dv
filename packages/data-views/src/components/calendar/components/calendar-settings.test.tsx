import type { ReactElement, ReactNode } from "react"
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../ui/select.js", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string | null) => void
    children?: ReactNode
  }) => (
    <>
      <select
        data-testid={`mock-select-${value}`}
        value={value}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
      >
        {children}
      </select>
      <button
        type="button"
        data-testid={`mock-select-null-${value}`}
        onClick={() => onValueChange?.(null)}
      />
    </>
  ),
  SelectContent: ({ children }: { children?: ReactNode }) => children,
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children?: ReactNode
  }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

vi.mock("../../ui/sheet.js", () => ({
  Sheet: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ render }: { render: ReactElement }) => render,
  SheetContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
}))

vi.mock("../../ui/switch.js", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    "aria-label": ariaLabel,
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    "aria-label"?: string
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
    >
      {String(checked)}
    </button>
  ),
}))

vi.mock("../../ui/checkbox.js", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
    />
  ),
}))

import { CalendarSettings } from "./calendar-settings.js"
import { CalendarViewSelect } from "./calendar-view-select.js"
import {
  createAllDayItem,
  createTestPreferences,
} from "../test/fixtures.js"
import { renderCalendar } from "../test/render-calendar.js"

describe("CalendarSettings controlled intents", () => {
  it("emits every controlled display preference", () => {
    const onPreferencesChange = vi.fn()
    renderCalendar(<CalendarSettings />, undefined, {
      onPreferencesChange,
      preferences: createTestPreferences({
        weekStartsOn: 1,
        density: "compact",
        maxVisibleLanes: 4,
        overflowBehavior: "popover",
        timeFormat: "12h",
        timeZone: "America/Los_Angeles",
      }),
    })

    fireEvent.click(screen.getByLabelText("Show weekends"))
    fireEvent.change(screen.getByTestId("mock-select-1"), {
      target: { value: "0" },
    })
    fireEvent.change(screen.getByTestId("mock-select-compact"), {
      target: { value: "comfortable" },
    })
    fireEvent.change(screen.getByTestId("mock-select-4"), {
      target: { value: "3" },
    })
    fireEvent.change(screen.getByTestId("mock-select-popover"), {
      target: { value: "expand-week" },
    })
    fireEvent.change(screen.getByTestId("mock-select-12h"), {
      target: { value: "24h" },
    })
    fireEvent.change(screen.getByTestId("mock-select-America/Los_Angeles"), {
      target: { value: "UTC" },
    })
    for (const value of [
      "1",
      "compact",
      "4",
      "popover",
      "12h",
      "America/Los_Angeles",
    ]) {
      fireEvent.click(screen.getByTestId(`mock-select-null-${value}`))
    }

    expect(onPreferencesChange.mock.calls.map((call) => call[1].type)).toEqual([
      "weekends",
      "week-start",
      "density",
      "max-visible-lanes",
      "overflow-behavior",
      "time-format",
      "time-zone",
    ])
  })

  it("emits visible-calendar additions and removals", () => {
    const onPreferencesChange = vi.fn()
    const items = [
      createAllDayItem({ id: "work", calendarId: "work" }),
      createAllDayItem({ id: "personal", calendarId: "personal" }),
    ]
    const first = renderCalendar(<CalendarSettings />, undefined, {
      items,
      onPreferencesChange,
    })
    fireEvent.click(screen.getByLabelText("work"))
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibleCalendarIds: ["personal"] }),
      { type: "visible-calendars", value: ["personal"] }
    )
    first.renderResult.unmount()

    renderCalendar(<CalendarSettings />, undefined, {
      items,
      preferences: createTestPreferences({ visibleCalendarIds: ["work"] }),
      onPreferencesChange,
    })
    fireEvent.click(screen.getByLabelText("personal"))
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibleCalendarIds: ["work", "personal"] }),
      { type: "visible-calendars", value: ["work", "personal"] }
    )
  })

  it("emits view changes from the dedicated selector", () => {
    const onPreferencesChange = vi.fn()
    renderCalendar(<CalendarViewSelect />, undefined, { onPreferencesChange })
    fireEvent.change(screen.getByTestId("mock-select-month"), {
      target: { value: "week" },
    })
    fireEvent.click(screen.getByTestId("mock-select-null-month"))
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ viewMode: "week" }),
      { type: "view-mode", value: "week" }
    )
  })

  it("emits agenda display preferences", () => {
    const onPreferencesChange = vi.fn()
    renderCalendar(<CalendarSettings />, undefined, {
      preferences: createTestPreferences({ viewMode: "agenda" }),
      onPreferencesChange,
    })
    fireEvent.change(screen.getByTestId("mock-select-15"), { target: { value: "30" } })
    fireEvent.change(screen.getByTestId("mock-select-64"), { target: { value: "80" } })
    fireEvent.click(screen.getByLabelText("Show agenda all-day section"))
    expect(onPreferencesChange.mock.calls.map((call) => call[1].type)).toContain("agenda-snap")
    expect(onPreferencesChange.mock.calls.map((call) => call[1].type)).toContain("agenda-hour-height")
    expect(onPreferencesChange.mock.calls.map((call) => call[1].type)).toContain("agenda-all-day-section")
  })
})
