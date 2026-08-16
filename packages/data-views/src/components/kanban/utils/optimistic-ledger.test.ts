import { describe, expect, it } from "vitest"
import { createKanbanOptimisticLedger } from "./optimistic-ledger.js"

interface RecordState {
  readonly value: string
  readonly count: number
}

describe("createKanbanOptimisticLedger", () => {
  it("rolls back an older failure without erasing a newer accepted mutation", () => {
    const ledger = createKanbanOptimisticLedger<RecordState>()
    const initial = { value: "initial", count: 0 }
    expect(
      ledger.begin(initial, {
        clientMutationId: "older",
        apply: (data) => ({ ...data, value: "older" }),
      }).value
    ).toBe("older")
    expect(
      ledger.begin(initial, {
        clientMutationId: "newer",
        apply: (data) => ({ ...data, value: "newer", count: data.count + 1 }),
      }).value
    ).toBe("newer")

    expect(ledger.confirm("newer")?.value).toBe("newer")
    expect(ledger.rollback("older")).toEqual({ value: "newer", count: 1 })
  })

  it("deduplicates mutation IDs and rebases live data under unresolved layers", () => {
    const ledger = createKanbanOptimisticLedger<RecordState>()
    const mutation = {
      clientMutationId: "same",
      apply: (data: RecordState) => ({ ...data, count: data.count + 1 }),
    }
    expect(ledger.begin({ value: "a", count: 0 }, mutation).count).toBe(1)
    expect(ledger.begin({ value: "a", count: 1 }, mutation).count).toBe(1)
    expect(ledger.pendingIds()).toEqual(["same"])
    expect(ledger.rebase({ value: "live", count: 4 })).toEqual({
      value: "live",
      count: 5,
    })
  })

  it("uses the latest cache value as the next snapshot after the ledger settles", () => {
    const ledger = createKanbanOptimisticLedger<RecordState>()
    ledger.begin(
      { value: "first", count: 0 },
      { clientMutationId: "one", apply: (data) => ({ ...data, count: 1 }) }
    )
    ledger.confirm("one")
    expect(
      ledger.begin(
        { value: "fresh", count: 8 },
        {
          clientMutationId: "two",
          apply: (data) => ({ ...data, count: data.count + 1 }),
        }
      )
    ).toEqual({ value: "fresh", count: 9 })
  })
})
