/**
 * Tests for use-multi-select hook.
 *
 * click → replace selection
 * shift+click → range selection
 * cmd/ctrl+click → toggle selection
 */
import { describe, it, expect, beforeEach } from "vitest"
import { createTimelineStore } from "../store/create-store.js"
import { createTestItems } from "../test/fixtures.js"

// We test the store actions directly because useMultiSelect is a thin wrapper
// that translates modifier keys → store `select` mode. We also test the hook
// itself via a minimal renderHook scenario.

describe("multi-select: store select action", () => {
  let store: ReturnType<typeof createTimelineStore>
  const items = createTestItems(5) // item-1 … item-5

  beforeEach(() => {
    store = createTimelineStore({ items })
  })

  it("replace: click with no modifiers selects only the clicked item", () => {
    store.getState().actions.select("item-2", "replace")
    store.getState().actions.select("item-3", "replace")
    expect(store.getState().selectedIds).toEqual(new Set(["item-3"]))
  })

  it("toggle: cmd+click adds an unselected item", () => {
    store.getState().actions.select("item-1", "replace")
    store.getState().actions.select("item-3", "toggle")
    expect(store.getState().selectedIds).toEqual(new Set(["item-1", "item-3"]))
  })

  it("toggle: cmd+click removes an already-selected item", () => {
    store.getState().actions.select("item-1", "replace")
    store.getState().actions.select("item-3", "toggle")
    store.getState().actions.select("item-3", "toggle")
    expect(store.getState().selectedIds).toEqual(new Set(["item-1"]))
  })

  it("range: shift+click selects from last selected to clicked", () => {
    // Anchor at item-2, then range to item-4
    store.getState().actions.select("item-2", "replace")
    store.getState().actions.select("item-4", "range")
    expect(store.getState().selectedIds).toEqual(
      new Set(["item-2", "item-3", "item-4"])
    )
  })

  it("range: shift+click backwards (above anchor)", () => {
    store.getState().actions.select("item-4", "replace")
    store.getState().actions.select("item-2", "range")
    expect(store.getState().selectedIds).toEqual(
      new Set(["item-2", "item-3", "item-4"])
    )
  })

  it("range: with no anchor defaults to single select", () => {
    store.getState().actions.select("item-3", "range")
    expect(store.getState().selectedIds).toEqual(new Set(["item-3"]))
  })

  it("selectAll selects every item", () => {
    store.getState().actions.selectAll()
    expect(store.getState().selectedIds.size).toBe(5)
  })

  it("clearSelection empties the set", () => {
    store.getState().actions.selectAll()
    store.getState().actions.clearSelection()
    expect(store.getState().selectedIds.size).toBe(0)
  })
})

import { renderHook } from "@testing-library/react"
import { act } from "@testing-library/react"
import { useMultiSelect } from "./use-multi-select.js"
import React from "react"
import { TimelineContext } from "../context/timeline-context.js"

describe("useMultiSelect hook", () => {
  it("returns a handleClick that calls select with correct mode based on modifiers", () => {
    const store = createTimelineStore({ items: createTestItems(3) })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TimelineContext.Provider, { value: store }, children)

    const { result } = renderHook(() => useMultiSelect(), { wrapper })

    // Plain click → replace
    act(() => result.current.handleClick("item-1", false, false))
    expect(store.getState().selectedIds).toEqual(new Set(["item-1"]))

    // Ctrl+click → toggle (adds item-2)
    act(() => result.current.handleClick("item-2", false, true))
    expect(store.getState().selectedIds).toEqual(new Set(["item-1", "item-2"]))

    // Shift+click → range (item-1 already selected, extend to item-3)
    act(() => result.current.handleClick("item-3", true, false))
    expect(store.getState().selectedIds).toEqual(
      new Set(["item-1", "item-2", "item-3"])
    )
  })
})
