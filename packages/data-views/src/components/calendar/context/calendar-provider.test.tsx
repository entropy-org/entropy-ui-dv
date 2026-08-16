import { act, render, renderHook, screen } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import { CalendarProvider } from "./calendar-provider.js"
import { useCalendarConfig } from "./calendar-config-context.js"
import { useCalendarStoreApi } from "./calendar-context.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import type { CalendarStore } from "../store/create-store.js"
import {
  createAllDayItem,
  createMoveCommand,
  createTestConfig,
  createTestPreferences,
} from "../test/fixtures.js"
import type { CalendarConfig } from "../types.js"
import { getCalendarVisibleRange } from "../utils/data-integration.js"

function StoreProbe({ onStore }: { onStore: (store: CalendarStore) => void }) {
  const store = useCalendarStoreApi()
  const config = useCalendarConfig()
  const selectedCount = useCalendarStore((state) => state.selectedIds.size)

  useEffect(() => {
    onStore(store)
  }, [onStore, store])

  return (
    <div>
      <span data-testid="item-count">{config.items.length}</span>
      <span data-testid="selected-count">{selectedCount}</span>
      <span data-testid="view-mode">{config.preferences.viewMode}</span>
    </div>
  )
}

describe("CalendarProvider", () => {
  it("requires provider context for store and config hooks", () => {
    expect(() =>
      renderHook(() => useCalendarStore((state) => state.anchorDate))
    ).toThrow("useCalendarStoreApi must be used within a <CalendarProvider>")

    expect(() => renderHook(() => useCalendarConfig())).toThrow(
      "useCalendarConfig must be used within a <CalendarProvider>"
    )
  })

  it("keeps one store instance while controlled config changes", () => {
    const stores: CalendarStore[] = []
    const onStore = (store: CalendarStore) => stores.push(store)
    const firstConfig = createTestConfig()
    const { rerender } = render(
      <CalendarProvider config={firstConfig}>
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    const secondConfig = createTestConfig({
      items: [createAllDayItem({ id: "replacement" })],
      preferences: createTestPreferences({ viewMode: "week" }),
    })
    rerender(
      <CalendarProvider config={secondConfig}>
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    expect(new Set(stores).size).toBe(1)
    expect(screen.getByTestId("item-count")).toHaveTextContent("1")
    expect(screen.getByTestId("view-mode")).toHaveTextContent("week")
    expect(stores[0].getState().undoStack).toEqual([])
  })

  it("prunes selection when authoritative items disappear", () => {
    let store!: CalendarStore
    const onStore = (nextStore: CalendarStore) => {
      store = nextStore
    }
    const firstConfig = createTestConfig()
    const { rerender } = render(
      <CalendarProvider config={firstConfig}>
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    act(() => {
      store.getState().actions.replaceSelection(["all-day-1"], "all-day-1")
    })
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")

    rerender(
      <CalendarProvider
        config={createTestConfig({
          items: [createAllDayItem({ id: "replacement" })],
        })}
      >
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
  })

  it("does not turn controlled item or preference changes into history", () => {
    let store!: CalendarStore
    const onStore = (nextStore: CalendarStore) => {
      store = nextStore
    }
    const { rerender } = render(
      <CalendarProvider config={createTestConfig()}>
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    rerender(
      <CalendarProvider
        config={createTestConfig({
          items: [createAllDayItem({ id: "server-item" })],
          preferences: createTestPreferences({
            density: "comfortable",
            viewMode: "week",
          }),
        })}
      >
        <StoreProbe onStore={onStore} />
      </CalendarProvider>
    )

    expect(store.getState().undoStack).toEqual([])
    expect(store.getState().pendingCommands).toEqual([])
  })

  it("reports invalid and duplicate items without storing them", () => {
    const onInvalidItem = vi.fn()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const duplicate = createAllDayItem({ id: "duplicate" })
    let store!: CalendarStore

    render(
      <CalendarProvider
        config={createTestConfig({
          items: [
            duplicate,
            createAllDayItem({
              id: "duplicate",
              startDate: "2026-02-30",
            }),
          ],
          onInvalidItem,
        })}
      >
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </CalendarProvider>
    )

    expect(onInvalidItem).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(store.getState()).not.toHaveProperty("items")
    warn.mockRestore()
  })

  it("derives the initial anchor from the injected clock and time zone", () => {
    let store!: CalendarStore
    const config: CalendarConfig = createTestConfig({
      initialAnchorDate: undefined,
      now: () => new Date("2026-07-27T01:00:00.000Z"),
      preferences: createTestPreferences({
        timeZone: "America/Los_Angeles",
      }),
    })

    render(
      <CalendarProvider config={config}>
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </CalendarProvider>
    )

    expect(store.getState().anchorDate).toBe("2026-07-26")
  })

  it("warns and falls back to today for an invalid initial anchor", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    let store!: CalendarStore

    render(
      <CalendarProvider
        config={createTestConfig({
          initialAnchorDate: "July 27",
          now: () => new Date("2026-07-27T16:00:00.000Z"),
          preferences: createTestPreferences({ timeZone: "UTC" }),
        })}
      >
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </CalendarProvider>
    )

    expect(store.getState().anchorDate).toBe("2026-07-27")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('initialAnchorDate "July 27" is invalid')
    )
    warn.mockRestore()
  })

  it("isolates two provider instances", () => {
    const stores = new Map<string, CalendarStore>()
    const capture = (key: string) => (store: CalendarStore) => {
      stores.set(key, store)
    }

    render(
      <>
        <CalendarProvider config={createTestConfig()}>
          <StoreProbe onStore={capture("first")} />
        </CalendarProvider>
        <CalendarProvider config={createTestConfig()}>
          <StoreProbe onStore={capture("second")} />
        </CalendarProvider>
      </>
    )

    act(() => {
      stores.get("first")?.getState().actions.recordCommand(createMoveCommand())
      stores
        .get("first")
        ?.getState()
        .actions.replaceSelection(["all-day-1"], "all-day-1")
    })

    expect(stores.get("first")?.getState().undoStack).toHaveLength(1)
    expect(stores.get("first")?.getState().selectedIds.size).toBe(1)
    expect(stores.get("second")?.getState().undoStack).toEqual([])
    expect(stores.get("second")?.getState().selectedIds.size).toBe(0)
  })

  it("confirms pending commands from normalized authoritative ranges", () => {
    let store!: CalendarStore
    const capture = (nextStore: CalendarStore) => {
      store = nextStore
    }
    const { rerender } = render(
      <CalendarProvider config={createTestConfig()}>
        <StoreProbe onStore={capture} />
      </CalendarProvider>
    )

    act(() => {
      store.getState().actions.recordCommand(createMoveCommand())
    })
    expect(store.getState().pendingCommands).toHaveLength(1)

    rerender(
      <CalendarProvider
        config={createTestConfig({
          items: [
            createAllDayItem({
              id: "all-day-1",
              startDate: "2026-07-28",
              endDate: "2026-07-28",
            }),
          ],
        })}
      >
        <StoreProbe onStore={capture} />
      </CalendarProvider>
    )

    expect(store.getState().pendingCommands).toEqual([])
    expect(store.getState().undoStack).toHaveLength(1)
  })

  it("reports authoritative command conflicts and invalidates history", () => {
    let store!: CalendarStore
    const onMutationRejected = vi.fn()
    const capture = (nextStore: CalendarStore) => {
      store = nextStore
    }
    const { rerender } = render(
      <CalendarProvider config={createTestConfig({ onMutationRejected })}>
        <StoreProbe onStore={capture} />
      </CalendarProvider>
    )

    act(() => {
      store.getState().actions.recordCommand(createMoveCommand())
    })
    rerender(
      <CalendarProvider
        config={createTestConfig({
          items: [
            createAllDayItem({
              id: "all-day-1",
              startDate: "2026-07-30",
              endDate: "2026-07-30",
            }),
          ],
          onMutationRejected,
        })}
      >
        <StoreProbe onStore={capture} />
      </CalendarProvider>
    )

    expect(onMutationRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMutationId: "move-1",
        reason: "authoritative-conflict",
      })
    )
    expect(store.getState().undoStack).toEqual([])
  })

  it("does not treat absence in a visible-range query as an authoritative delete", () => {
    let store!: CalendarStore
    const preferences = createTestPreferences()
    const range = getCalendarVisibleRange("2026-07-27", preferences)
    const config = createTestConfig({
      preferences,
      dataMode: "visible-range",
      dataState: { status: "ready", rangeKey: range.key },
    })
    const { rerender } = render(
      <CalendarProvider config={config}>
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )

    act(() => {
      store.getState().actions.recordCommand({
        type: "delete",
        clientMutationId: "delete-visible",
        itemIds: ["all-day-1"],
      })
    })
    rerender(
      <CalendarProvider config={{ ...config, items: [] }}>
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )

    expect(store.getState().pendingCommands).toHaveLength(1)
  })

  it("ignores stale out-of-order range payloads during reconciliation", () => {
    let store!: CalendarStore
    const preferences = createTestPreferences()
    const range = getCalendarVisibleRange("2026-07-27", preferences)
    const config = createTestConfig({
      preferences,
      dataMode: "visible-range",
      dataState: { status: "ready", rangeKey: range.key },
    })
    const { rerender } = render(
      <CalendarProvider config={config}>
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )
    act(() => store.getState().actions.recordCommand(createMoveCommand("race")))

    rerender(
      <CalendarProvider
        config={{
          ...config,
          items: [
            createAllDayItem({
              id: "all-day-1",
              startDate: "2026-07-30",
              endDate: "2026-07-30",
            }),
          ],
          dataState: { status: "ready", rangeKey: "stale-request" },
        }}
      >
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )

    expect(store.getState().pendingCommands).toHaveLength(1)
    expect(store.getState().undoStack).toHaveLength(1)
  })

  it("cancels a gesture when a live update changes an affected range", () => {
    let store!: CalendarStore
    const config = createTestConfig()
    const { rerender } = render(
      <CalendarProvider config={config}>
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )
    const move = createMoveCommand("gesture")
    act(() => {
      store.getState().actions.startMoving({
        type: "moving",
        itemIds: ["all-day-1"],
        origin: {
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          date: "2026-07-27",
        },
        preview: move.changes,
      })
    })

    rerender(
      <CalendarProvider
        config={{
          ...config,
          items: config.items.map((item) =>
            item.id === "all-day-1"
              ? createAllDayItem({
                  id: item.id,
                  startDate: "2026-07-29",
                  endDate: "2026-07-29",
                })
              : item
          ),
        }}
      >
        <StoreProbe
          onStore={(value) => {
            store = value
          }}
        />
      </CalendarProvider>
    )

    expect(store.getState().interaction.type).toBe("idle")
    expect(store.getState().announcement).toContain("changed remotely")
  })
})
