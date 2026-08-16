import { describe, expect, it } from "vitest"
import { createCalendarStore } from "../create-store.js"
import { TEST_ANCHOR_DATE } from "../../test/fixtures.js"

describe("calendar UI slice", () => {
  it("manages transient search, settings, and overflow state", () => {
    const store = createCalendarStore({
      initialAnchorDate: TEST_ANCHOR_DATE,
      initialSearchQuery: "launch",
    })
    const { actions } = store.getState()

    expect(store.getState().searchQuery).toBe("launch")
    actions.setSearchQuery("review")
    actions.setSettingsOpen(true)
    actions.openOverflow("2026-07-28", "more-2026-07-28")
    expect(store.getState()).toMatchObject({
      searchQuery: "review",
      settingsOpen: true,
      overflow: {
        type: "open",
        date: "2026-07-28",
        triggerId: "more-2026-07-28",
      },
    })

    actions.closeOverflow()
    expect(store.getState().overflow).toEqual({ type: "closed" })
  })

  it("preserves state references for equivalent UI actions", () => {
    const store = createCalendarStore({ initialAnchorDate: TEST_ANCHOR_DATE })
    const { actions } = store.getState()
    const before = store.getState()
    actions.setSearchQuery("")
    actions.setSettingsOpen(false)
    actions.closeOverflow()
    expect(store.getState()).toBe(before)

    actions.openOverflow("2026-07-28", "more")
    const open = store.getState()
    actions.openOverflow("2026-07-28", "more")
    expect(store.getState()).toBe(open)
  })
})
