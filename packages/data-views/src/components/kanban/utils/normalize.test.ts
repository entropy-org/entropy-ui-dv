import { describe, expect, it } from "vitest"
import type { KanbanCard, KanbanGroup } from "../types.js"
import { normalizeKanbanData } from "./normalize.js"

describe("normalizeKanbanData", () => {
  it("sorts accepted inputs without mutating caller arrays", () => {
    const groups: KanbanGroup[] = [{ id: "b", rank: "b", data: null }, { id: "a", rank: "a", data: null }]
    const cards: KanbanCard[] = [{ id: "2", groupId: "a", rank: "b", data: null }, { id: "1", groupId: "a", rank: "a", data: null }]
    const result = normalizeKanbanData(cards, groups)
    expect(result.orderedGroupIds).toEqual(["a", "b"])
    expect(result.acceptedCards.map(({ id }) => id)).toEqual(["1", "2"])
    expect(groups[0]?.id).toBe("b")
    expect(cards[0]?.id).toBe("2")
  })

  it("reports deterministic identity, rank, placement, lane, and WIP issues", () => {
    const groups: KanbanGroup[] = [
      { id: "", rank: "a", data: null },
      { id: "good", rank: "", data: null },
      { id: "dup-a", rank: "same", data: null },
      { id: "dup-b", rank: "same", data: null },
      { id: "bad-wip", rank: "z", data: null, wipLimit: { type: "hard", maximum: -1 } },
    ]
    const cards: KanbanCard[] = [{ id: "orphan", groupId: "missing", rank: "a", data: null }]
    const result = normalizeKanbanData(cards, groups)
    expect(result.issues.map(({ type }) => type)).toEqual(["empty-id", "empty-rank", "invalid-wip-limit", "duplicate-rank", "missing-group"])
  })

  it("requires exactly one lane representation", () => {
    const group = { id: "g", rank: "a", data: null }
    const lane = { id: "l", rank: "a", data: null }
    expect(normalizeKanbanData([{ id: "c", groupId: "g", rank: "a", data: null }], [group], [lane]).issues[0]?.type).toBe("missing-swimlane")
    expect(normalizeKanbanData([{ id: "c", groupId: "g", swimlaneId: "l", rank: "a", data: null }], [group]).issues[0]?.type).toBe("unexpected-swimlane")
  })
})
