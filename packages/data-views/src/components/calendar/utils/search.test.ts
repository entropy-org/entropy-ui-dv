import { describe, expect, it } from "vitest"
import { createAllDayItem } from "../test/fixtures.js"
import {
  filterCalendarItems,
  getDefaultCalendarSearchText,
  itemMatchesCalendarSearch,
} from "./search.js"

describe("calendar search utilities", () => {
  it("matches every normalized token across id, calendar, and nested data", () => {
    const item = createAllDayItem({
      id: "launch-42",
      calendarId: "engineering",
      data: { title: "Product Launch", owner: { name: "Ada" } },
    })
    expect(itemMatchesCalendarSearch(item, " PRODUCT ada ")).toBe(true)
    expect(itemMatchesCalendarSearch(item, "engineering 42")).toBe(true)
    expect(itemMatchesCalendarSearch(item, "finance")).toBe(false)
  })

  it("supports consumer search text and empty queries", () => {
    const item = createAllDayItem({ id: "private" })
    expect(itemMatchesCalendarSearch(item, "alias", () => "Public Alias")).toBe(
      true
    )
    expect(itemMatchesCalendarSearch(item, "   ")).toBe(true)
  })

  it("safely handles circular data and filters without mutating input", () => {
    const circular: { title: string; self?: unknown } = { title: "Circular" }
    circular.self = circular
    const first = createAllDayItem({ id: "one", data: circular })
    const second = createAllDayItem({ id: "two", data: { title: "Other" } })
    const items = [first, second]
    expect(getDefaultCalendarSearchText(first)).toContain("Circular")
    expect(filterCalendarItems(items, "circular")).toEqual([first])
    expect(items).toEqual([first, second])
  })
})
