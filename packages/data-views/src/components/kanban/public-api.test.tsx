import { describe, expect, it } from "vitest"
import { Kanban, KanbanProvider, createKanbanOptimisticLedger, resolveKanbanPreferences, type KanbanCommand, type KanbanConfig } from "./index.js"

describe("Kanban public API", () => {
  it("supports controlled consumer composition", () => {
    const config: KanbanConfig = {
      cards: [], groups: [], renderCard: (card) => card.id,
      onCommand: (command: KanbanCommand) => { switch (command.type) { case "move-cards": case "reorder-groups": case "delete-cards": case "restore-cards": case "duplicate-cards": break } },
    }
    const element = <KanbanProvider config={config}><Kanban aria-label="Project board" /></KanbanProvider>
    expect(element).toBeTruthy()
    expect(resolveKanbanPreferences().density).toBe("comfortable")
  })

  it("exports the consumer-owned optimistic cache ledger", () => {
    const ledger = createKanbanOptimisticLedger<{ readonly count: number }>()
    expect(ledger.begin({ count: 0 }, { clientMutationId: "one", apply: ({ count }) => ({ count: count + 1 }) })).toEqual({ count: 1 })
  })
})
