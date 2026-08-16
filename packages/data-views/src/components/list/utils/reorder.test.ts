import { describe, expect, it } from "vitest"
import { buildDataListModel } from "./model.js"
import {
  isManualReorderEnabled,
  resolveReorderCommand,
} from "./reorder.js"
import { createListConfig } from "../test/fixtures.js"

describe("list reorder utilities", () => {
  const model = buildDataListModel({
    config: createListConfig(),
    query: "",
    collapsedGroups: new Set(),
    toggledItems: new Set(),
  })

  it("emits neighbor-based destinations and preserves moved order", () => {
    expect(
      resolveReorderCommand(
        model.itemEntries,
        ["item-1", "item-2"],
        { targetId: "item-4", position: "after" },
        "move-1"
      )
    ).toMatchObject({
      itemIds: ["item-1", "item-2"],
      afterId: "item-4",
      beforeId: undefined,
    })
  })

  it("does not emit no-op moves", () => {
    expect(
      resolveReorderCommand(
        model.itemEntries,
        ["item-1"],
        { targetId: "item-2", position: "before" },
        "move-2"
      )
    ).toBeNull()
  })

  it("disables manual order for read-only, filters, sort, and search", () => {
    const baseline = {
      readOnly: false,
      hasHandler: true,
      operationsMode: "client" as const,
      hasSort: false,
      hasFilters: false,
      query: "",
      serverAllowed: false,
    }
    expect(isManualReorderEnabled(baseline)).toBe(true)
    expect(isManualReorderEnabled({ ...baseline, readOnly: true })).toBe(false)
    expect(isManualReorderEnabled({ ...baseline, hasSort: true })).toBe(false)
    expect(isManualReorderEnabled({ ...baseline, hasFilters: true })).toBe(
      false
    )
    expect(isManualReorderEnabled({ ...baseline, query: "x" })).toBe(false)
  })
})
