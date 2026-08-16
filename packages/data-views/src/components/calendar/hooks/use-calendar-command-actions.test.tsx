import { act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCalendarCommandActions } from "./use-calendar-command-actions.js"
import { createMoveCommand } from "../test/fixtures.js"
import { renderCalendarHook } from "../test/render-calendar.js"

describe("useCalendarCommandActions", () => {
  it("commits, deletes, undoes, and redoes through one consumer bridge", () => {
    const onItemMutation = vi.fn()
    const { result, store } = renderCalendarHook(
      useCalendarCommandActions,
      undefined,
      { onItemMutation }
    )

    act(() =>
      expect(result.current.commit(createMoveCommand("move"))).toBe(true)
    )
    expect(onItemMutation).toHaveBeenLastCalledWith(createMoveCommand("move"))
    act(() => store.getState().actions.confirmCommand("move"))

    act(() => store.getState().actions.replaceSelection(["all-day-1"]))
    let deletion = null
    act(() => {
      deletion = result.current.deleteSelected()
    })
    expect(deletion).toEqual(expect.objectContaining({ type: "delete" }))
    const deleteId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(deleteId))

    let undo = null
    act(() => {
      undo = result.current.undo()
    })
    expect(undo).toEqual(expect.objectContaining({ type: "restore" }))
    const undoId = onItemMutation.mock.calls.at(-1)?.[0].clientMutationId
    act(() => store.getState().actions.confirmCommand(undoId))

    let redo = null
    act(() => {
      redo = result.current.redo()
    })
    expect(redo).toEqual(expect.objectContaining({ type: "delete" }))
    expect(result.current.nextMutationId("custom")).toContain("custom")
  })

  it("rejects synchronous and asynchronous consumer failures", async () => {
    const onMutationRejected = vi.fn()
    const synchronous = renderCalendarHook(
      useCalendarCommandActions,
      undefined,
      {
        onItemMutation: () => {
          throw new Error("sync failure")
        },
        onMutationRejected,
      }
    )
    act(() => synchronous.result.current.commit(createMoveCommand("sync")))
    expect(onMutationRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMutationId: "sync",
        message: "sync failure",
      })
    )

    const asynchronous = renderCalendarHook(
      useCalendarCommandActions,
      undefined,
      {
        onItemMutation: () => Promise.reject("nope"),
        onMutationRejected,
      }
    )
    act(() => asynchronous.result.current.commit(createMoveCommand("async")))
    await waitFor(() =>
      expect(onMutationRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          clientMutationId: "async",
          message: "Consumer rejected mutation.",
        })
      )
    )
  })

  it("blocks all mutations in read-only or callback-free calendars", () => {
    const readOnly = renderCalendarHook(useCalendarCommandActions, undefined, {
      readOnly: true,
      onItemMutation: vi.fn(),
    })
    act(() => readOnly.store.getState().actions.replaceSelection(["all-day-1"]))
    expect(readOnly.result.current.commit(createMoveCommand())).toBe(false)
    expect(readOnly.result.current.deleteSelected()).toBeNull()
    expect(readOnly.result.current.undo()).toBeNull()
    expect(readOnly.result.current.redo()).toBeNull()

    const callbackFree = renderCalendarHook(useCalendarCommandActions)
    expect(callbackFree.result.current.commit(createMoveCommand())).toBe(false)
  })

  it("uses the unified intent boundary and settles explicit outcomes without races", async () => {
    const intents: unknown[] = []
    const bridge = renderCalendarHook(useCalendarCommandActions, undefined, {
      onMutationIntent: async (intent) => {
        intents.push(intent)
        return { status: "accepted" }
      },
    })

    act(() =>
      expect(bridge.result.current.commit(createMoveCommand("accepted"))).toBe(
        true
      )
    )
    await waitFor(() =>
      expect(bridge.store.getState().pendingCommands).toEqual([])
    )

    const item = bridge.config.items[0]
    act(() => {
      expect(
        bridge.result.current.create(
          { kind: "all-day", startDate: "2026-07-28", endDate: "2026-07-28" },
          { viewMode: "month", source: "keyboard" }
        )
      ).toBe(true)
      expect(
        bridge.result.current.update(item, {
          ...item,
          data: { title: "Changed" },
        })
      ).toBe(true)
      expect(bridge.result.current.duplicate([item])).toBe(true)
      expect(
        bridge.result.current.convert(item, {
          kind: "timed",
          start: new Date("2026-07-27T16:00:00Z"),
          end: new Date("2026-07-27T17:00:00Z"),
        })
      ).toBe(true)
    })

    expect(intents).toHaveLength(5)
    expect(intents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "command" }),
        expect.objectContaining({ type: "create" }),
        expect.objectContaining({ type: "update" }),
        expect.objectContaining({ type: "duplicate" }),
        expect.objectContaining({ type: "convert" }),
      ])
    )
  })
})
