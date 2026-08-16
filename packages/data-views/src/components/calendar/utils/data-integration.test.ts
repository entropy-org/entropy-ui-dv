import { describe, expect, it } from "vitest"
import {
  createTestConfig,
  createTestPreferences,
} from "../test/fixtures.js"
import {
  canCreateCalendarItem,
  canExecuteCalendarCommand,
  canMutateCalendarItem,
  canViewCalendarItem,
  applyCalendarCommandOptimistically,
  getCalendarVisibleRange,
  getConfiguredCalendarSources,
  normalizeCalendarSources,
  resolveCalendarDataPresentation,
} from "./data-integration.js"
import {
  createAllDayItem,
  createMoveCommand,
  createTimedItem,
} from "../test/fixtures.js"

describe("calendar production data integration", () => {
  it("creates stable range keys across month, week, agenda, zone, and weekend churn", () => {
    const month = getCalendarVisibleRange("2026-07-27", createTestPreferences())
    const same = getCalendarVisibleRange("2026-07-28", createTestPreferences())
    const agenda = getCalendarVisibleRange(
      "2026-07-31",
      createTestPreferences({
        viewMode: "agenda",
        showWeekends: false,
        agenda: {
          ...createTestPreferences().agenda,
          span: { type: "custom", dayCount: 3 },
        },
      })
    )

    expect(month.key).toBe(same.key)
    expect(agenda).toMatchObject({
      startDate: "2026-07-31",
      endDate: "2026-08-04",
      timeZone: "America/Los_Angeles",
      viewMode: "agenda",
    })
    expect(agenda.key).not.toBe(month.key)
  })

  it("blocks stale/out-of-order data while keeping partial refreshes usable", () => {
    const range = getCalendarVisibleRange("2026-07-27", createTestPreferences())
    expect(
      resolveCalendarDataPresentation(range, {
        status: "ready",
        rangeKey: "an-older-request",
      })
    ).toMatchObject({ status: "stale", busy: true, blocksContent: true })
    expect(
      resolveCalendarDataPresentation(range, {
        status: "refreshing",
        rangeKey: range.key,
        coverage: "partial",
      })
    ).toEqual({
      status: "refreshing",
      busy: true,
      blocksContent: false,
      partial: true,
    })
    expect(
      resolveCalendarDataPresentation(range, {
        status: "error",
        rangeKey: range.key,
        error: new Error("offline"),
        hasUsableData: true,
      })
    ).toMatchObject({ status: "error", blocksContent: false, partial: true })
    expect(resolveCalendarDataPresentation(range, undefined)).toEqual({
      status: "ready",
      busy: false,
      blocksContent: false,
      partial: false,
    })
    expect(
      resolveCalendarDataPresentation(range, {
        status: "ready",
        rangeKey: range.key,
        coverage: "complete",
      })
    ).toMatchObject({ status: "ready", busy: false, partial: false })
  })

  it("combines global, source, and item permissions atomically", () => {
    const item = createAllDayItem({
      id: "private",
      calendarId: "work",
      permissions: { duplicate: false },
    })
    const config = createTestConfig({
      items: [item],
      sources: [{ id: "work", label: "Work", permissions: { update: false } }],
      onMutationIntent: () => ({ status: "accepted" }),
    })

    expect(canViewCalendarItem(item, config.permissions, config.sources)).toBe(
      true
    )
    expect(canCreateCalendarItem(config)).toBe(true)
    expect(canMutateCalendarItem(config, item, "update")).toBe(false)
    expect(canMutateCalendarItem(config, item, "duplicate")).toBe(false)
    expect(
      canExecuteCalendarCommand(config, createMoveCommand("move", item.id))
    ).toBe(false)
    expect(canViewCalendarItem(item, { view: false }, config.sources)).toBe(
      false
    )
    expect(
      canViewCalendarItem(
        { ...item, permissions: { view: false } },
        undefined,
        config.sources
      )
    ).toBe(false)
    expect(
      canViewCalendarItem(item, undefined, [
        { id: "work", label: "Work", permissions: { view: false } },
      ])
    ).toBe(false)
    expect(canViewCalendarItem(createAllDayItem({ id: "uncategorized" }))).toBe(
      true
    )
    expect(canCreateCalendarItem({ ...config, readOnly: true })).toBe(false)
    expect(
      canCreateCalendarItem({ ...config, permissions: { create: false } })
    ).toBe(false)
    expect(
      canMutateCalendarItem(
        { ...config, permissions: { delete: false } },
        item,
        "delete"
      )
    ).toBe(false)
    expect(
      canExecuteCalendarCommand(
        { ...config, readOnly: true },
        createMoveCommand()
      )
    ).toBe(false)
    expect(
      canExecuteCalendarCommand(config, {
        type: "restore",
        clientMutationId: "restore",
        itemIds: ["missing"],
      })
    ).toBe(true)
  })

  it("keeps only the first non-empty source ID", () => {
    expect(
      normalizeCalendarSources([
        { id: "work", label: "Work" },
        { id: "work", label: "Duplicate" },
        { id: "", label: "Empty" },
      ])
    ).toEqual({
      sources: [{ id: "work", label: "Work" }],
      invalidIds: ["work", ""],
    })
  })

  it("applies range/delete/restore commands without mutating query snapshots", () => {
    const item = createAllDayItem({ id: "event" })
    const moved = applyCalendarCommandOptimistically(
      [item],
      createMoveCommand("move", "event")
    )
    expect(moved[0]).toMatchObject({ startDate: "2026-07-28" })
    expect(item.startDate).toBe("2026-07-27")
    expect(
      applyCalendarCommandOptimistically(moved, {
        type: "delete",
        clientMutationId: "delete",
        itemIds: ["event"],
      })
    ).toEqual([])
    expect(
      applyCalendarCommandOptimistically(
        [],
        {
          type: "restore",
          clientMutationId: "restore",
          itemIds: ["event"],
        },
        [item]
      )
    ).toEqual([item])

    const timed = createTimedItem({ id: "timed" })
    const resized = applyCalendarCommandOptimistically([item, timed], {
      type: "resize",
      clientMutationId: "resize",
      itemId: "timed",
      edge: "end",
      previousRange: { kind: "timed", start: timed.start, end: timed.end },
      nextRange: {
        kind: "timed",
        start: timed.start,
        end: new Date("2026-07-27T18:00:00Z"),
      },
    })
    expect((resized[1] as typeof timed).end.toISOString()).toBe(
      "2026-07-27T18:00:00.000Z"
    )
    expect(
      applyCalendarCommandOptimistically([item], {
        type: "resize",
        clientMutationId: "wrong-kind",
        itemId: "event",
        edge: "end",
        previousRange: {
          kind: "all-day",
          startDate: item.startDate,
          endDate: item.endDate,
        },
        nextRange: { kind: "timed", start: timed.start, end: timed.end },
      })
    ).toEqual([item])
    expect(
      applyCalendarCommandOptimistically(
        [item],
        {
          type: "restore",
          clientMutationId: "restore-existing",
          itemIds: ["event"],
        },
        [item]
      )
    ).toEqual([item])
  })

  it("resolves sources from explicit config before the optional sidebar", () => {
    const explicit = [{ id: "explicit", label: "Explicit" }] as const
    const sidebar = [{ id: "sidebar", label: "Sidebar" }] as const
    expect(
      getConfiguredCalendarSources({
        sources: explicit,
        agenda: { sidebar: { type: "default", calendars: sidebar } },
      })
    ).toBe(explicit)
    expect(
      getConfiguredCalendarSources({
        agenda: { sidebar: { type: "default", calendars: sidebar } },
      })
    ).toBe(sidebar)
    expect(
      getConfiguredCalendarSources({
        agenda: { sidebar: { type: "hidden" } },
      })
    ).toEqual([])
  })
})
