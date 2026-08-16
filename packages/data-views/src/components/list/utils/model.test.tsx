import { describe, expect, it, vi } from "vitest"
import { buildDataListModel } from "./model.js"
import {
  createListConfig,
  createListItems,
} from "../test/fixtures.js"

const transient = {
  query: "",
  collapsedGroups: new Set<string>(),
  toggledItems: new Set<string>(),
}

describe("buildDataListModel", () => {
  it("normalizes duplicate IDs without mutating caller data", () => {
    const items = createListItems(2)
    const input = [...items, items[0]]
    const snapshot = [...input]
    const model = buildDataListModel({
      config: createListConfig({ items: input }),
      ...transient,
    })

    expect(model.itemEntries).toHaveLength(2)
    expect(model.diagnostics[0]?.code).toBe("duplicate-item-id")
    expect(input).toEqual(snapshot)
  })

  it("applies search, filter, and stable multi-property sort in client mode", () => {
    const items = createListItems(6)
    const model = buildDataListModel({
      config: createListConfig({
        items,
        operations: {
          mode: "client",
          getSearchText: (item) => `${item.data.title} ${item.data.status}`,
          filters: [
            {
              id: "not-done",
              predicate: (item) => item.data.status !== "Done",
            },
          ],
          sort: [{ propertyId: "score", direction: "ascending" }],
        },
      }),
      ...transient,
      query: "record",
    })

    expect(model.itemEntries.map((entry) => entry.item.data.score)).toEqual([
      2, 3, 5, 6,
    ])
    expect(model.matchIds).toHaveLength(6)
  })

  it("does not reapply client operations to server-resolved order", () => {
    const items = createListItems(3)
    const model = buildDataListModel({
      config: createListConfig({
        items,
        operations: {
          mode: "server",
          sort: [{ propertyId: "score", direction: "ascending" }],
          filters: [{ id: "remote-filter" }],
          totalCount: 100,
          matchingCount: 80,
        },
      }),
      ...transient,
      query: "ignored locally",
    })

    expect(model.itemEntries.map((entry) => entry.item.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
    ])
    expect(model.totalCount).toBe(100)
    expect(model.resultCount).toBe(80)
    expect(model.loadedCount).toBe(3)
  })

  it("builds isolated synthetic group entries and honors collapse", () => {
    const config = createListConfig({
      grouping: {
        mode: "derived",
        getKey: (item) => item.data.status,
        collapsible: true,
      },
    })
    const model = buildDataListModel({
      config,
      ...transient,
      collapsedGroups: new Set(["Todo"]),
    })

    expect(model.entries[0]?.key).toBe("group:Todo")
    expect(
      model.entries.some(
        (entry) => entry.kind === "item" && entry.groupKey === "Todo"
      )
    ).toBe(false)
    expect(model.groups.map((group) => group.count)).toEqual([2, 1, 1])
  })

  it("flattens nested hierarchy, hides collapsed descendants, and reports cycles", () => {
    const [parent, child, cyclic] = createListItems(3)
    const onError = vi.fn()
    const model = buildDataListModel({
      config: createListConfig({
        items: [
          parent,
          { ...child, parentId: parent.id },
          { ...cyclic, parentId: cyclic.id },
        ],
        hierarchy: { mode: "nested" },
        onError,
      }),
      ...transient,
      toggledItems: new Set([parent.id]),
    })

    expect(model.itemEntries.some((entry) => entry.item.id === child.id)).toBe(
      false
    )
    expect(
      model.diagnostics.some((item) => item.code === "hierarchy-cycle")
    ).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })
})
