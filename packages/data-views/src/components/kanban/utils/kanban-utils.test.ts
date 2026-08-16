import { describe, expect, it } from "vitest"
import { resolveKanbanPreferences } from "../constants.js"
import { createKanbanHistoryEntry } from "./commands.js"
import { getKanbanNeighbors } from "./neighbors.js"
import { normalizeKanbanSearchText } from "./search.js"
import { evaluateKanbanWip, evaluateMoveWip } from "./wip.js"
import { reconcileKanbanCommand } from "./reconciliation.js"
import { normalizeKanbanData } from "./normalize.js"
import type { KanbanCard, KanbanCommand, KanbanGroup } from "../types.js"

describe("Kanban utilities", () => {
  it("normalizes locale search and clamps preferences", () => {
    expect(normalizeKanbanSearchText("  RÉSUMÉ   Review ")).toBe("resume review")
    expect(resolveKanbanPreferences({ columnWidth: 1 }).columnWidth).toBe(240)
    expect(resolveKanbanPreferences({ columnWidth: 999 }).columnWidth).toBe(520)
  })

  it("resolves neighbors after excluding the moved selection", () => {
    expect(getKanbanNeighbors(["a", "b", "c"], 1, new Set(["b"]))).toEqual({ beforeId: "a", afterId: "c" })
    expect(getKanbanNeighbors([], 0)).toEqual({ beforeId: null, afterId: null })
  })

  it("evaluates warning and hard WIP atomically without double counting a reorder", () => {
    const warning: KanbanGroup = { id: "g", rank: "a", data: null, wipLimit: { type: "warning", maximum: 1 } }
    const hard: KanbanGroup = { ...warning, wipLimit: { type: "hard", maximum: 1 } }
    expect(evaluateKanbanWip(warning, 2).status).toBe("warning")
    expect(evaluateKanbanWip(hard, 2).status).toBe("hard-blocked")
    const cards: KanbanCard[] = [{ id: "a", groupId: "g", rank: "a", data: null }]
    expect(evaluateMoveWip(cards, hard, new Set(["a"])).status).toBe("below-limit")
    const over = [...cards, { id: "b", groupId: "g", rank: "b", data: null }]
    expect(evaluateMoveWip(over, hard, new Set(["a"])).status).toBe("warning")
  })

  it("creates snapshot-free delete inverses", () => {
    const command: KanbanCommand = { type: "delete-cards", clientMutationId: "m1", cardIds: ["c"], sources: { c: { groupId: "g", rank: "a" } } }
    const entry = createKanbanHistoryEntry(command, () => "inverse")
    expect(entry.inverse).toEqual({ type: "restore-cards", clientMutationId: "inverse", cardIds: ["c"], destinations: command.sources })
    expect(JSON.stringify(entry)).not.toContain("data")
  })

  it("confirms authoritative placement and ordering, not only destination membership", () => {
    const groups: KanbanGroup[] = [{ id: "a", rank: "a", data: null }, { id: "b", rank: "b", data: null }]
    const command: KanbanCommand = {
      type: "move-cards",
      clientMutationId: "move",
      cardIds: ["moving"],
      sources: { moving: { groupId: "a", rank: "a" } },
      destination: { groupId: "b" },
      neighbors: { beforeId: null, afterId: "existing" },
    }
    const wrongOrder = normalizeKanbanData([
      { id: "existing", groupId: "b", rank: "a", data: null },
      { id: "moving", groupId: "b", rank: "b", data: null },
    ], groups)
    const rightOrder = normalizeKanbanData([
      { id: "moving", groupId: "b", rank: "a", data: null },
      { id: "existing", groupId: "b", rank: "b", data: null },
    ], groups)
    expect(reconcileKanbanCommand(command, wrongOrder).status).toBe("pending")
    expect(reconcileKanbanCommand(command, rightOrder).status).toBe("confirmed")
  })
})
