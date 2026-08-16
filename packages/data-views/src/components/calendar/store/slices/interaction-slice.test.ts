import { describe, expect, it } from "vitest"
import { createCalendarStore } from "../create-store.js"
import {
  createMoveCommand,
  TEST_ANCHOR_DATE,
} from "../../test/fixtures.js"

const origin = {
  pointerId: 1,
  clientX: 10,
  clientY: 20,
  date: TEST_ANCHOR_DATE,
} as const

function createStore() {
  return createCalendarStore({ initialAnchorDate: TEST_ANCHOR_DATE })
}

describe("calendar interaction slice", () => {
  it("guards moving transitions and preserves no-op preview references", () => {
    const store = createStore()
    const { actions } = store.getState()
    const preview = createMoveCommand("preview", "a").changes

    expect(
      actions.startMoving({
        type: "moving",
        itemIds: ["a"],
        origin,
        preview: [],
      })
    ).toBe(false)
    expect(
      actions.startMoving({
        type: "moving",
        itemIds: ["a"],
        origin,
        preview,
      })
    ).toBe(true)
    expect(
      actions.startCreating({
        type: "creating",
        origin,
        preview: preview[0].nextRange,
      })
    ).toBe(false)

    const before = store.getState()
    expect(actions.updateMovePreview(preview)).toBe(true)
    expect(store.getState()).toBe(before)
    const changedPreview = createMoveCommand("changed", "a").changes.map(
      (change) => ({
        ...change,
        nextRange: {
          kind: "all-day" as const,
          startDate: "2026-07-29",
          endDate: "2026-07-29",
        },
      })
    )
    expect(actions.updateMovePreview(changedPreview)).toBe(true)
    expect(store.getState().interaction).toMatchObject({
      preview: changedPreview,
    })
    expect(actions.updateCreatePreview(preview[0].nextRange)).toBe(false)
  })

  it("updates resize and create previews only within their active variant", () => {
    const store = createStore()
    const { actions } = store.getState()
    const firstRange = {
      kind: "all-day" as const,
      startDate: "2026-07-27",
      endDate: "2026-07-28",
    }
    const nextRange = { ...firstRange, endDate: "2026-07-30" }

    expect(
      actions.startResizing({
        type: "resizing",
        itemId: "",
        edge: "end",
        origin,
        preview: firstRange,
      })
    ).toBe(false)

    expect(
      actions.startResizing({
        type: "resizing",
        itemId: "a",
        edge: "end",
        origin,
        preview: firstRange,
      })
    ).toBe(true)
    expect(actions.updateResizePreview(nextRange)).toBe(true)
    expect(store.getState().interaction).toMatchObject({ preview: nextRange })
    expect(
      actions.updateResizePreview({
        kind: "timed",
        start: new Date("2026-07-27T16:00:00Z"),
        end: new Date("2026-07-27T17:00:00Z"),
      })
    ).toBe(false)

    expect(actions.finishInteraction()?.type).toBe("resizing")
    expect(
      actions.startCreating({
        type: "creating",
        origin,
        preview: firstRange,
      })
    ).toBe(true)
    expect(actions.updateCreatePreview(nextRange)).toBe(true)
    expect(actions.finishInteraction()?.type).toBe("creating")
  })

  it("cancels active interactions and ignores idle cancellation", () => {
    const store = createStore()
    const { actions } = store.getState()
    expect(actions.cancelInteraction()).toBe(false)
    expect(actions.finishInteraction()).toBeNull()

    actions.startCreating({
      type: "creating",
      origin,
      preview: {
        kind: "all-day",
        startDate: TEST_ANCHOR_DATE,
        endDate: TEST_ANCHOR_DATE,
      },
    })
    expect(actions.cancelInteraction()).toBe(true)
    expect(store.getState().interaction).toEqual({ type: "idle" })
  })
})
