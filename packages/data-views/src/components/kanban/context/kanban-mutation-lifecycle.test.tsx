import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { KanbanProvider } from "./kanban-provider.js"
import { useKanbanStoreApi } from "./kanban-context.js"
import { useKanbanCommandActions } from "../hooks/use-kanban-command-actions.js"
import type { KanbanCommandResult } from "../types.js"
import type { KanbanStore } from "../store/create-store.js"
import {
  createTestKanbanConfig,
  testCards,
} from "../test/fixtures.js"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function Harness({
  onStore,
}: {
  readonly onStore: (store: KanbanStore) => void
}) {
  const commands = useKanbanCommandActions()
  onStore(useKanbanStoreApi())
  return (
    <>
      <button
        type="button"
        onClick={() => commands.moveCards(["one"], "doing", undefined, 0)}
      >
        Move doing
      </button>
      <button
        type="button"
        onClick={() => commands.moveCards(["one"], "done", undefined, 0)}
      >
        Move done
      </button>
    </>
  )
}

describe("Kanban mutation lifecycle", () => {
  it("does not confirm an optimistic controlled update before the server promise accepts", async () => {
    const request = deferred<void | KanbanCommandResult>()
    const onCommandSettled = vi.fn()
    const onCommand = vi.fn(() => request.promise)
    let store!: KanbanStore
    const renderResult = render(
      <KanbanProvider
        config={createTestKanbanConfig({
          dataVersion: 1,
          onCommand,
          onCommandSettled,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Move doing" }))
    expect(store.getState().pending[0]?.status).toBe("submitting")

    const optimisticCards = testCards.map((card) =>
      card.id === "one" ? { ...card, groupId: "doing", rank: "0" } : card
    )
    renderResult.rerender(
      <KanbanProvider
        config={createTestKanbanConfig({
          cards: optimisticCards,
          dataVersion: 1,
          onCommand,
          onCommandSettled,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )
    expect(store.getState().pending[0]?.status).toBe("submitting")

    await act(async () => {
      request.resolve({ status: "accepted" })
      await request.promise
    })
    expect(store.getState().pending).toHaveLength(0)
    expect(onCommandSettled).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" })
    )
  })

  it("supersedes an older rejected response and confirms the latest versioned intent", async () => {
    const doing = deferred<void | KanbanCommandResult>()
    const done = deferred<void | KanbanCommandResult>()
    const onMutationRejected = vi.fn()
    const onCommandSettled = vi.fn()
    const onCommand = vi.fn(
      (command: {
        readonly type: string
        readonly destination?: { readonly groupId: string }
      }) =>
        command.destination?.groupId === "done" ? done.promise : doing.promise
    )
    const createMutationId = vi
      .fn()
      .mockReturnValueOnce("doing")
      .mockReturnValueOnce("doing-inverse")
      .mockReturnValueOnce("done")
      .mockReturnValueOnce("done-inverse")
    let store!: KanbanStore
    const renderResult = render(
      <KanbanProvider
        config={createTestKanbanConfig({
          dataVersion: 1,
          onCommand,
          onCommandSettled,
          onMutationRejected,
          createMutationId,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Move doing" }))
    fireEvent.click(screen.getByRole("button", { name: "Move done" }))
    expect(store.getState().pending).toHaveLength(2)

    await act(async () => {
      done.resolve({ status: "accepted", dataVersion: 3 })
      await done.promise
    })
    expect(
      store
        .getState()
        .pending.find(({ command }) => command.clientMutationId === "done")
        ?.status
    ).toBe("awaiting-data")

    await act(async () => {
      doing.resolve({
        status: "rejected",
        code: "conflict",
        message: "Stale move",
      })
      await doing.promise
    })
    expect(onMutationRejected).not.toHaveBeenCalled()
    expect(onCommandSettled).toHaveBeenCalledWith(
      expect.objectContaining({ status: "superseded" })
    )

    const authoritativeCards = testCards.map((card) =>
      card.id === "one" ? { ...card, groupId: "done", rank: "a" } : card
    )
    renderResult.rerender(
      <KanbanProvider
        config={createTestKanbanConfig({
          cards: authoritativeCards,
          dataVersion: 3,
          onCommand,
          onCommandSettled,
          onMutationRejected,
          createMutationId,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )
    expect(store.getState().pending).toHaveLength(0)
    expect(onCommandSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
        command: expect.objectContaining({ clientMutationId: "done" }),
      })
    )
  })

  it("reports structured server rejection without leaving pending state", () => {
    const onMutationRejected = vi.fn()
    let store!: KanbanStore
    render(
      <KanbanProvider
        config={createTestKanbanConfig({
          onCommand: () => ({
            status: "rejected",
            code: "wip-limit",
            message: "Column is full",
          }),
          onMutationRejected,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Move doing" }))
    expect(store.getState().pending).toHaveLength(0)
    expect(onMutationRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "server-rejected",
        code: "wip-limit",
        message: "Column is full",
      })
    )
  })

  it("expires a stuck request without allowing its late promise to mutate board state", async () => {
    vi.useFakeTimers()
    const request = deferred<void | KanbanCommandResult>()
    const onMutationRejected = vi.fn()
    const onCommandSettled = vi.fn()
    let store!: KanbanStore
    render(
      <KanbanProvider
        config={createTestKanbanConfig({
          onCommand: () => request.promise,
          pendingTimeoutMs: 100,
          onMutationRejected,
          onCommandSettled,
        })}
      >
        <Harness
          onStore={(value) => {
            store = value
          }}
        />
      </KanbanProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Move doing" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(store.getState().pending).toHaveLength(0)
    expect(onMutationRejected).toHaveBeenCalledWith(
      expect.objectContaining({ type: "timed-out", timeoutMs: 100 })
    )

    await act(async () => {
      request.resolve({ status: "accepted" })
      await request.promise
    })
    expect(onCommandSettled).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
