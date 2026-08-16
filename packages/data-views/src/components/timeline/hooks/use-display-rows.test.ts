/**
 * Tests for use-display-rows — sub-item row ordering logic.
 *
 * Tests the pure `computeDisplayRows` function for all three modes:
 * disabled, flattened, and nested (collapsed / expanded).
 */
import { describe, it, expect } from "vitest"
import { computeDisplayRows } from "./use-display-rows.js"
import {
  createNestedTestItems,
  createTestItems,
} from "../test/fixtures.js"
import type { TimelineItem } from "../types.js"

/** Build a Map + order from an item array */
function toStore(items: TimelineItem[]) {
  const map = new Map<string, TimelineItem>()
  const order: string[] = []
  for (const item of items) {
    map.set(item.id, item)
    order.push(item.id)
  }
  return { map, order }
}

describe("computeDisplayRows", () => {
  describe("disabled mode", () => {
    it("shows only top-level items, ignoring children", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "disabled", new Set())

      // parent-1, standalone-1 are top-level; child-1a, child-1b have parentId
      expect(rows).toHaveLength(2)
      expect(rows[0].item.id).toBe("parent-1")
      expect(rows[1].item.id).toBe("standalone-1")
    })

    it("all rows are depth 0 with isParent=false", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "disabled", new Set())

      for (const row of rows) {
        expect(row.depth).toBe(0)
        expect(row.isParent).toBe(false)
      }
    })

    it("works with items that have no children", () => {
      const items = createTestItems(3)
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "disabled", new Set())

      expect(rows).toHaveLength(3)
      for (const row of rows) {
        expect(row.depth).toBe(0)
      }
    })
  })

  describe("flattened mode", () => {
    it("renders children immediately after their parent", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "flattened", new Set())

      // Expected: parent-1, child-1a, child-1b, standalone-1
      expect(rows).toHaveLength(4)
      expect(rows[0].item.id).toBe("parent-1")
      expect(rows[1].item.id).toBe("child-1a")
      expect(rows[2].item.id).toBe("child-1b")
      expect(rows[3].item.id).toBe("standalone-1")
    })

    it("parent rows have depth=0 and isParent=true", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "flattened", new Set())

      expect(rows[0].depth).toBe(0)
      expect(rows[0].isParent).toBe(true)
      expect(rows[0].isExpanded).toBe(true)
    })

    it("child rows have depth=1", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "flattened", new Set())

      expect(rows[1].depth).toBe(1)
      expect(rows[2].depth).toBe(1)
    })

    it("non-parent items have isParent=false", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "flattened", new Set())

      expect(rows[3].isParent).toBe(false)
      expect(rows[3].depth).toBe(0)
    })
  })

  describe("nested mode — collapsed", () => {
    it("collapsed parent does not show children", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(map, order, "nested", new Set())

      // parent-1 collapsed, standalone-1 = 2 rows
      expect(rows).toHaveLength(2)
      expect(rows[0].item.id).toBe("parent-1")
      expect(rows[1].item.id).toBe("standalone-1")
    })

    it("keeps the collapsed parent's own dates independent of its children", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const parent = map.get("parent-1")!
      map.set("parent-1", {
        ...parent,
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-12"),
      })
      const rows = computeDisplayRows(map, order, "nested", new Set())

      const parentRow = rows[0]
      expect(parentRow.isParent).toBe(true)
      expect(parentRow.isExpanded).toBe(false)
      // child-1a: 2026-07-14 → 2026-07-21, child-1b: 2026-07-21 → 2026-07-28
      expect(parentRow.item.startDate).toEqual(new Date("2026-07-10"))
      expect(parentRow.item.endDate).toEqual(new Date("2026-07-12"))
    })
  })

  describe("nested mode — expanded", () => {
    it("expanded parent shows children", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const expanded = new Set(["parent-1"])
      const rows = computeDisplayRows(map, order, "nested", expanded)

      // parent-1, child-1a, child-1b, standalone-1
      expect(rows).toHaveLength(4)
      expect(rows[0].item.id).toBe("parent-1")
      expect(rows[1].item.id).toBe("child-1a")
      expect(rows[2].item.id).toBe("child-1b")
      expect(rows[3].item.id).toBe("standalone-1")
    })

    it("marks an expanded parent as expanded", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const expanded = new Set(["parent-1"])
      const rows = computeDisplayRows(map, order, "nested", expanded)

      expect(rows[0].isExpanded).toBe(true)
    })

    it("children of expanded parent have depth=1", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const expanded = new Set(["parent-1"])
      const rows = computeDisplayRows(map, order, "nested", expanded)

      expect(rows[1].depth).toBe(1)
      expect(rows[2].depth).toBe(1)
    })
  })

  describe("edge cases", () => {
    it("empty items returns empty rows", () => {
      const rows = computeDisplayRows(new Map(), [], "flattened", new Set())
      expect(rows).toHaveLength(0)
    })

    it("orphaned children (parent not in items) are not shown", () => {
      // Child refers to a parentId that isn't in itemOrder
      const orphan: TimelineItem = {
        id: "orphan",
        startDate: new Date("2026-07-14"),
        endDate: new Date("2026-07-21"),
        parentId: "nonexistent",
        data: { title: "Orphan" },
      }
      const { map, order } = toStore([orphan])
      const rows = computeDisplayRows(map, order, "flattened", new Set())

      // Orphan has parentId so it's skipped in the top-level loop
      expect(rows).toHaveLength(0)
    })
  })

  describe("search", () => {
    it("matches case-insensitively across item data", () => {
      const items = createTestItems(3)
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(
        map,
        order,
        "flattened",
        new Set(),
        "TASK 2"
      )

      expect(rows.map((row) => row.item.id)).toEqual(["item-2"])
    })

    it("reveals matching children and keeps their parent as context", () => {
      const items = createNestedTestItems()
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(
        map,
        order,
        "nested",
        new Set(),
        "Child 1A"
      )

      expect(rows.map((row) => row.item.id)).toEqual(["parent-1", "child-1a"])
      expect(rows[0].isExpanded).toBe(true)
      expect(rows[1].depth).toBe(1)
    })

    it("supports a consumer-provided search text getter", () => {
      const items = createTestItems(2)
      const { map, order } = toStore(items)
      const rows = computeDisplayRows(
        map,
        order,
        "flattened",
        new Set(),
        "owner:mei",
        (item) => (item.id === "item-2" ? "owner:mei" : "owner:alex")
      )

      expect(rows.map((row) => row.item.id)).toEqual(["item-2"])
    })
  })
})
