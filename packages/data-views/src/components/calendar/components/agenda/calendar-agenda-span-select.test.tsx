import type { ReactNode } from "react"
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../../ui/select.js", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string | null) => void; children: ReactNode }) => (
    <select aria-label="Mock agenda span" value={value} onChange={(event) => onValueChange(event.currentTarget.value)}>{children}</select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

import { CalendarAgendaSpanSelect } from "./calendar-agenda-span-select.js"
import { createTestPreferences } from "../../test/fixtures.js"
import { renderCalendar } from "../../test/render-calendar.js"

describe("CalendarAgendaSpanSelect", () => {
  it("serializes and emits day, week, and every custom span", () => {
    const onPreferencesChange = vi.fn()
    const first = renderCalendar(<CalendarAgendaSpanSelect />, undefined, {
      preferences: createTestPreferences({
        agenda: { ...createTestPreferences().agenda, span: { type: "day" } },
      }),
      onPreferencesChange,
    })
    const select = screen.getByLabelText("Mock agenda span")
    fireEvent.change(select, { target: { value: "week" } })
    fireEvent.change(select, { target: { value: "custom-2" } })
    fireEvent.change(select, { target: { value: "custom-9" } })
    expect(onPreferencesChange.mock.calls.map((call) => call[1])).toEqual([
      { type: "agenda-span", value: { type: "week" } },
      { type: "agenda-span", value: { type: "custom", dayCount: 2 } },
      { type: "agenda-span", value: { type: "custom", dayCount: 9 } },
    ])
    first.renderResult.unmount()

    renderCalendar(<CalendarAgendaSpanSelect />, undefined, {
      preferences: createTestPreferences({
        agenda: { ...createTestPreferences().agenda, span: { type: "custom", dayCount: 5 } },
      }),
    })
    expect(screen.getByLabelText("Mock agenda span")).toHaveValue("custom-5")
  })
})
