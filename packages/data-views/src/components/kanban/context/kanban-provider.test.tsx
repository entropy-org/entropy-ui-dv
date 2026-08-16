import { StrictMode } from "react"
import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { KanbanProvider } from "./kanban-provider.js"
import { useKanbanStoreApi } from "./kanban-context.js"
import type { KanbanStore } from "../store/create-store.js"
import { createTestKanbanConfig } from "../test/fixtures.js"

function Capture({ onStore }: { readonly onStore: (store: KanbanStore) => void }) {
  onStore(useKanbanStoreApi())
  return null
}

describe("KanbanProvider", () => {
  it("keeps one store across config rerenders", () => {
    const stores: KanbanStore[] = []
    const { rerender } = render(<KanbanProvider config={createTestKanbanConfig()}><Capture onStore={(store) => stores.push(store)} /></KanbanProvider>)
    rerender(<KanbanProvider config={createTestKanbanConfig({ readOnly: true })}><Capture onStore={(store) => stores.push(store)} /></KanbanProvider>)
    expect(stores.at(-1)).toBe(stores[0])
  })

  it("deduplicates invalid reports under Strict Mode", () => {
    const onInvalidItem = vi.fn()
    render(<StrictMode><KanbanProvider config={createTestKanbanConfig({ groups: [], onInvalidItem })}><span /></KanbanProvider></StrictMode>)
    expect(onInvalidItem).toHaveBeenCalledTimes(3)
  })

  it("isolates overlapping selections", () => {
    let first!: KanbanStore
    let second!: KanbanStore
    render(<><KanbanProvider config={createTestKanbanConfig()}><Capture onStore={(store) => { first = store }} /></KanbanProvider><KanbanProvider config={createTestKanbanConfig()}><Capture onStore={(store) => { second = store }} /></KanbanProvider></>)
    act(() => first.getState().actions.select("one", "replace"))
    expect(second.getState().selectedIds).toEqual(new Set())
  })
})
