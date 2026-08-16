import { describe, expect, it, vi } from "vitest"
import { createTimelineStore } from "../store/create-store.js"
import type {
  TimelineConfig,
  TimelineItem,
} from "../types.js"
import type { TimelineMutationOutcome } from "../production-types.js"
import { TimelineMutationCoordinator } from "./mutation-coordinator.js"

function item(
  id: string,
  start = "2026-08-01",
  end = "2026-08-03",
  title = id
): TimelineItem {
  return {
    id,
    startDate: new Date(start),
    endDate: new Date(end),
    data: { title },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function setup(
  items: TimelineItem[],
  overrides: Partial<TimelineConfig> = {}
) {
  const store = createTimelineStore({ items })
  const config: TimelineConfig = {
    items,
    renderBar: () => null,
    ...overrides,
  }
  const coordinator = new TimelineMutationCoordinator(store, config)
  return { config, coordinator, store }
}

describe("TimelineMutationCoordinator", () => {
  it("rebases an optimistic move over query-result churn and rolls back to the latest server record", async () => {
    const pending = deferred<TimelineMutationOutcome>()
    const original = item("a")
    const { coordinator, store } = setup([original], {
      onMutation: () => pending.promise,
    })

    const move = coordinator.dispatch({
      type: "move",
      changes: [
        {
          itemId: "a",
          startDate: new Date("2026-08-05"),
          endDate: new Date("2026-08-07"),
          previousItem: original,
        },
      ],
    })
    expect(store.getState().items.get("a")?.startDate).toEqual(
      new Date("2026-08-05")
    )

    coordinator.syncExternalItems([
      item("a", "2026-08-01", "2026-08-03", "Live server title"),
    ])
    expect(store.getState().items.get("a")).toMatchObject({
      startDate: new Date("2026-08-05"),
      data: { title: "Live server title" },
    })

    pending.resolve({ status: "rejected", reason: "Version conflict" })
    await move
    expect(store.getState().items.get("a")).toMatchObject({
      startDate: new Date("2026-08-01"),
      data: { title: "Live server title" },
    })
  })

  it("does not let an older response overwrite a newer canonical response", async () => {
    const responses = [
      deferred<TimelineMutationOutcome>(),
      deferred<TimelineMutationOutcome>(),
    ]
    const onMutationResult = vi.fn()
    let call = 0
    const original = item("a")
    const { coordinator, store } = setup([original], {
      onMutation: () => responses[call++].promise,
      onMutationResult,
    })

    const first = coordinator.dispatch({
      type: "move",
      changes: [
        {
          itemId: "a",
          startDate: new Date("2026-08-04"),
          endDate: new Date("2026-08-06"),
          previousItem: original,
        },
      ],
    })
    const second = coordinator.dispatch({
      type: "move",
      changes: [
        {
          itemId: "a",
          startDate: new Date("2026-08-08"),
          endDate: new Date("2026-08-10"),
          previousItem: original,
        },
      ],
    })

    const canonical = item("a", "2026-08-08", "2026-08-10", "Canonical")
    responses[1].resolve({ status: "accepted", items: [canonical] })
    await second
    responses[0].resolve({ status: "rejected", reason: "Stale response" })
    await first

    expect(store.getState().items.get("a")).toEqual(canonical)
    expect(onMutationResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLatestForAffectedItems: false })
    )
  })

  it("rejects forbidden mutations without calling the backend handler", async () => {
    const onMutation = vi.fn()
    const original = item("a")
    const { coordinator, store } = setup([original], {
      getItemPermissions: () => ({ move: false }),
      onMutation,
    })

    const outcome = await coordinator.dispatch({
      type: "move",
      changes: [
        {
          itemId: "a",
          startDate: new Date("2026-08-05"),
          endDate: new Date("2026-08-07"),
          previousItem: original,
        },
      ],
    })

    expect(outcome).toMatchObject({ status: "rejected", code: "forbidden" })
    expect(onMutation).not.toHaveBeenCalled()
    expect(store.getState().items.get("a")).toEqual(original)
  })
})
