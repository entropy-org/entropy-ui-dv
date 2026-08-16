import "@testing-library/jest-dom/vitest"
import { useRef, useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DataList } from "./data-list.js"
import { DataListProvider } from "../context/data-list-provider.js"
import { toPublicSelection } from "../store/create-store.js"
import {
  createListConfig,
  createListItems,
  type TestRecord,
} from "../test/fixtures.js"
import { renderDataList } from "../test/render-data-list.js"
import type {
  DataListConfig,
  DataListMutationSettlement,
} from "../types.js"

describe("DataList", () => {
  it("renders the compact list surface, forwards refs, and applies class overrides", () => {
    function Example() {
      const rootRef = useRef<HTMLDivElement>(null)
      return (
        <DataListProvider config={createListConfig()}>
          <DataList ref={rootRef} className="custom-list" />
        </DataListProvider>
      )
    }
    render(<Example />)

    expect(screen.getByTestId("data-list")).toHaveClass("custom-list")
    expect(screen.getByRole("grid", { name: "Database list" })).toBeVisible()
    expect(screen.getAllByRole("row")).toHaveLength(4)
    expect(screen.getAllByText("Doing")).toHaveLength(1)
  })

  it("can hide its built-in header without hiding records", () => {
    renderDataList(<DataList showHeader={false} />, createListConfig())

    expect(
      screen.queryByRole("textbox", { name: "Search list" })
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(4)
  })

  it("supports replace, toggle, range, and clear selection", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({ selection: { mode: "multiple", onChange } })
    )
    const rows = screen.getAllByRole("row")

    await user.click(rows[0])
    await user.keyboard("{Control>}")
    await user.click(rows[2])
    await user.keyboard("{/Control}")
    await user.keyboard("{Shift>}")
    await user.click(rows[3])
    await user.keyboard("{/Shift}")

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: "range" })
    )
    expect(screen.getByText("3 selected")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: "clear" })
    )
  })

  it("can activate rows without selecting them", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const { store } = renderDataList(
      <DataList />,
      createListConfig({
        selection: { mode: "none" },
        clickBehavior: "activate",
        onActivate,
      })
    )

    const row = screen.getByRole("listitem", { name: "Record 1" })
    await user.click(row)

    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1" })
    )
    expect(toPublicSelection(store.getState().selection)).toEqual({
      kind: "explicit",
      ids: [],
    })
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
    expect(row).toHaveClass("cursor-pointer", "select-none")
    expect(row).not.toHaveAttribute("data-selected")
    expect(row).not.toHaveClass("bg-accent/70", "ring-1")
  })

  it("supports root-scoped keyboard navigation and activation", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const { store } = renderDataList(
      <DataList />,
      createListConfig({ onActivate })
    )
    const rows = screen.getAllByRole("row")
    await user.click(rows[0])
    rows[0].focus()
    await user.keyboard("{ArrowDown}{Enter}")

    expect(store.getState().focusedId).toBe("item-2")
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-2" })
    )
  })

  it("searches locally and distinguishes filtered empty state", async () => {
    const user = userEvent.setup()
    const { store } = renderDataList(<DataList />, createListConfig())
    const search = screen.getByRole("textbox", { name: "Search list" })
    await user.type(search, "Record 3")
    expect(store.getState().searchQuery).toBe("Record 3")
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(1))
    expect(screen.getByRole("row", { name: "Record 3" })).toBeVisible()
    await user.clear(search)
    await user.type(search, "missing record")
    expect(screen.getByText("No records match the current view.")).toBeVisible()
  })

  it("collapses derived groups and restores a deterministic focus target", async () => {
    const user = userEvent.setup()
    const { store } = renderDataList(
      <DataList />,
      createListConfig({
        grouping: {
          mode: "derived",
          getKey: (item) => item.data.status,
          collapsible: true,
        },
      })
    )
    await user.click(screen.getByRole("button", { name: "Collapse Todo" }))

    expect(
      screen.queryByRole("row", { name: "Record 1" })
    ).not.toBeInTheDocument()
    expect(store.getState().focusedId).toBe("item-2")
    expect(screen.getByRole("button", { name: "Expand Todo" })).toBeVisible()
  })

  it("represents select-all as all-matching when configured", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        selection: { mode: "multiple", allowAllMatching: true, onChange },
      })
    )
    const first = screen.getByRole("row", { name: "Record 1" })
    first.focus()
    await user.keyboard("{Control>}a{/Control}")

    expect(onChange).toHaveBeenCalledWith({
      reason: "all-matching",
      selection: {
        kind: "all-matching",
        excludedIds: [],
        matchingCount: 4,
      },
    })
    expect(screen.getByText("4 selected")).toBeVisible()
  })

  it("rerenders only the affected memoized row for one-row selection", async () => {
    const user = userEvent.setup()
    const renderTitle = vi.fn(
      ({ item }: { item: { data: TestRecord } }) => item.data.title
    )
    renderDataList(<DataList />, createListConfig({ renderTitle }))
    const baseline = renderTitle.mock.calls.length
    await user.click(screen.getByRole("row", { name: "Record 1" }))

    expect(renderTitle.mock.calls.length - baseline).toBe(1)
  })

  it("validates and commits a controlled title edit without mutating input", async () => {
    const user = userEvent.setup()
    const initialItems = createListItems(2)
    const original = structuredClone(initialItems)
    const onEdit = vi.fn()

    function ControlledExample() {
      const [items, setItems] = useState(initialItems)
      const config: DataListConfig<TestRecord> = createListConfig({
        items,
        onEdit: async (command) => {
          onEdit(command)
          setItems((current) =>
            current.map((item) =>
              item.id === command.itemId
                ? {
                    ...item,
                    data: {
                      ...item.data,
                      title: String(command.proposedValue),
                    },
                  }
                : item
            )
          )
        },
      })
      return (
        <DataListProvider config={config}>
          <DataList />
        </DataListProvider>
      )
    }

    render(<ControlledExample />)
    await user.dblClick(screen.getByText("Record 1"))
    const editor = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(editor)
    await user.keyboard("{Enter}")
    expect(screen.getAllByText("Required.")).toHaveLength(2)
    await user.type(editor, "Renamed")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(screen.getByText("Renamed")).toBeVisible())
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "edit",
        itemId: "item-1",
        propertyId: "__title__",
        proposedValue: "Renamed",
      })
    )
    expect(initialItems).toEqual(original)
  })

  it("rolls back a rejected command and announces the failure", async () => {
    const user = userEvent.setup()
    const onCommandRejected = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        onEdit: () => Promise.reject(new Error("offline")),
        onCommandRejected,
      })
    )
    await user.dblClick(screen.getByText("Record 1"))
    const editor = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(editor)
    await user.type(editor, "Rejected")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(onCommandRejected).toHaveBeenCalledOnce())
    expect(screen.getByText("Record 1")).toBeVisible()
    expect(screen.queryByText("Rejected")).not.toBeInTheDocument()
  })

  it("emits equivalent neighbor commands for keyboard reorder", async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    renderDataList(<DataList />, createListConfig({ onReorder }))
    const first = screen.getByRole("row", { name: "Record 1" })
    first.focus()
    await user.keyboard(" {ArrowDown} ")

    expect(onReorder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reorder",
        itemIds: ["item-1"],
        afterId: "item-2",
      })
    )
  })

  it("keeps read-only navigation and activation while removing mutation affordances", async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const onEdit = vi.fn()
    const onReorder = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({ readOnly: true, onActivate, onEdit, onReorder })
    )
    const first = screen.getByRole("row", { name: "Record 1" })
    first.focus()
    await user.keyboard("{Enter}{F2}")

    expect(onActivate).toHaveBeenCalledOnce()
    expect(onEdit).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: /Reorder Record/ })
    ).not.toBeInTheDocument()
  })

  it("contains a failing renderer to one row", () => {
    const onError = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        renderTitle: ({ item }) => {
          if (item.id === "item-2") throw new Error("bad renderer")
          return item.data.title
        },
        onError,
      })
    )

    expect(screen.getByText("Record 1")).toBeVisible()
    expect(screen.getByText("Unable to render")).toBeVisible()
    expect(screen.getByText("Record 3")).toBeVisible()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "renderer", itemId: "item-2" })
    )
  })

  it("isolates focus and selection across providers with overlapping IDs", async () => {
    const user = userEvent.setup()
    render(
      <>
        <DataListProvider config={createListConfig()}>
          <DataList aria-label="First list" />
        </DataListProvider>
        <DataListProvider config={createListConfig()}>
          <DataList aria-label="Second list" />
        </DataListProvider>
      </>
    )
    const firstList = screen.getByRole("grid", { name: "First list" })
    const secondList = screen.getByRole("grid", { name: "Second list" })
    await user.click(firstList.querySelector("[data-list-row-id='item-1']")!)

    expect(
      firstList.querySelector("[data-list-row-id='item-1']")
    ).toHaveAttribute("data-selected", "true")
    expect(
      secondList.querySelector("[data-list-row-id='item-1']")
    ).not.toHaveAttribute("data-selected")
  })

  it("keeps mounted DOM bounded for large data", async () => {
    renderDataList(
      <DataList />,
      createListConfig({
        items: createListItems(50_000),
        virtualization: {
          enabled: true,
          threshold: 1,
          initialHeight: 240,
          maxHeight: 240,
          overscan: 4,
        },
      })
    )
    await act(async () => undefined)
    const mountedRows = screen.queryAllByRole("row")
    expect(mountedRows.length).toBeGreaterThan(0)
    expect(mountedRows.length).toBeLessThan(30)
  })

  it("keeps controlled selection authoritative until the owner accepts a change", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { store } = renderDataList(
      <DataList />,
      createListConfig({
        selection: {
          mode: "multiple",
          value: { kind: "explicit", ids: ["item-1"] },
          onChange,
        },
      })
    )

    await user.click(screen.getByRole("row", { name: "Record 2" }))

    expect(onChange).toHaveBeenCalledWith({
      reason: "replace",
      selection: { kind: "explicit", ids: ["item-2"] },
    })
    expect(toPublicSelection(store.getState().selection)).toEqual({
      kind: "explicit",
      ids: ["item-1"],
    })
    expect(screen.getByRole("row", { name: "Record 1" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("retains unloaded explicit selection in server mode", async () => {
    const { store } = renderDataList(
      <DataList />,
      createListConfig({
        operations: {
          mode: "server",
          matchingCount: 100,
          totalCount: 200,
        },
        selection: {
          mode: "multiple",
          defaultValue: { kind: "explicit", ids: ["remote-item"] },
        },
      })
    )

    await waitFor(() =>
      expect(toPublicSelection(store.getState().selection)).toEqual({
        kind: "explicit",
        ids: ["remote-item"],
      })
    )
    expect(screen.getByText("1 selected")).toBeVisible()
  })

  it("emits ordered server search, filter, and sort requests", async () => {
    const user = userEvent.setup()
    const onOperationsChange = vi.fn()
    const onQueryChange = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        operations: {
          mode: "server",
          search: { mode: "controlled", query: "", onQueryChange },
          filters: [{ id: "open", operator: "equals", value: true }],
          sort: [{ propertyId: "score", direction: "ascending" }],
          onOperationsChange,
        },
        renderControls: ({ requestServerOperations }) => (
          <button
            type="button"
            onClick={() =>
              requestServerOperations?.(
                {
                  filters: [{ id: "closed", operator: "equals", value: false }],
                  sort: [{ propertyId: "score", direction: "descending" }],
                },
                "filters"
              )
            }
          >
            Apply server view
          </button>
        ),
      })
    )

    await user.type(screen.getByRole("textbox", { name: "Search list" }), "r")
    await user.click(screen.getByRole("button", { name: "Apply server view" }))

    expect(onQueryChange).toHaveBeenCalledWith("r")
    expect(onOperationsChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: "r",
        reason: "search",
        requestId: "list-operation-1",
      })
    )
    expect(onOperationsChange).toHaveBeenNthCalledWith(2, {
      query: "",
      filters: [{ id: "closed", operator: "equals", value: false }],
      sort: [{ propertyId: "score", direction: "descending" }],
      reason: "filters",
      requestId: "list-operation-2",
    })
  })

  it("supports controlled page and infinite-loading requests", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    const onLoadMore = vi.fn()
    const page = renderDataList(
      <DataList />,
      createListConfig({
        operations: {
          mode: "server",
          matchingCount: 20,
          totalCount: 20,
          pagination: {
            mode: "page",
            pageIndex: 0,
            pageSize: 4,
            pageCount: 5,
            onPageChange,
          },
        },
      })
    )
    fireEvent.wheel(screen.getByTestId("data-list"), { deltaY: 120 })
    expect(onPageChange).not.toHaveBeenCalled()
    fireEvent.wheel(screen.getByTestId("data-list"), {
      deltaY: 120,
      shiftKey: true,
    })
    expect(onPageChange).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole("button", { name: /Next/ }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
    page.renderResult.unmount()

    renderDataList(
      <DataList />,
      createListConfig({
        operations: {
          mode: "server",
          matchingCount: 20,
          totalCount: 20,
          pagination: {
            mode: "infinite",
            hasNextPage: true,
            onLoadMore,
          },
        },
      })
    )
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it("keeps cached rows visible during refresh errors and exposes retry", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        status: {
          state: "error",
          phase: "refresh",
          error: "Refresh failed",
          onRetry,
        },
      })
    )

    expect(screen.getAllByRole("row")).toHaveLength(4)
    expect(screen.getByRole("alert")).toHaveTextContent("Refresh failed")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("ignores stale authoritative churn and settles once the edit appears", async () => {
    const user = userEvent.setup()
    const initialItems = createListItems(2)
    const onCommandRejected = vi.fn()
    const onCommandSettled = vi.fn()
    let replaceItems: (
      items: ReturnType<typeof createListItems>
    ) => void = () => undefined

    function QueryBackedExample() {
      const [items, setItems] = useState(initialItems)
      replaceItems = setItems
      const config = createListConfig({
        items,
        onEdit: () => ({ status: "await-authoritative" }),
        onCommandRejected,
        onCommandSettled,
      })
      return (
        <DataListProvider config={config}>
          <DataList />
        </DataListProvider>
      )
    }

    render(<QueryBackedExample />)
    await user.dblClick(screen.getByText("Record 1"))
    const editor = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(editor)
    await user.type(editor, "Canonical")
    await user.keyboard("{Enter}")
    expect(screen.getByText("Canonical")).toBeVisible()

    act(() => replaceItems([...initialItems]))
    expect(onCommandRejected).not.toHaveBeenCalled()
    expect(screen.getByText("Canonical")).toBeVisible()

    act(() =>
      replaceItems(
        initialItems.map((item) =>
          item.id === "item-1"
            ? { ...item, data: { ...item.data, title: "Canonical" } }
            : item
        )
      )
    )
    await waitFor(() =>
      expect(onCommandSettled).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          source: "authoritative",
        })
      )
    )
  })

  it("does not settle from an optimistic Query cache write before transport succeeds", async () => {
    const user = userEvent.setup()
    const initialItems = createListItems(2)
    const onCommandSettled = vi.fn()
    let resolveMutation: () => void = () => undefined
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve
    })

    function OptimisticQueryExample() {
      const [items, setItems] = useState(initialItems)
      const config = createListConfig({
        items,
        onEdit: (command) => {
          setItems((current) =>
            current.map((item) =>
              item.id === command.itemId
                ? {
                    ...item,
                    data: {
                      ...item.data,
                      title: String(command.proposedValue),
                    },
                  }
                : item
            )
          )
          return mutation
        },
        onCommandSettled,
      })
      return (
        <DataListProvider config={config}>
          <DataList />
        </DataListProvider>
      )
    }

    render(<OptimisticQueryExample />)
    await user.dblClick(screen.getByText("Record 1"))
    const editor = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(editor)
    await user.type(editor, "Optimistic")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(screen.getByText("Optimistic")).toBeVisible())
    expect(onCommandSettled).not.toHaveBeenCalled()

    act(() => {
      resolveMutation()
    })
    await waitFor(() =>
      expect(onCommandSettled).toHaveBeenCalledWith(
        expect.objectContaining({ status: "accepted", source: "handler" })
      )
    )
  })

  it("supports explicit external rejection for canonical reconciliation", async () => {
    const user = userEvent.setup()
    const onCommandSettled = vi.fn()
    let rejectMutation: (settlement: DataListMutationSettlement) => void = () =>
      undefined

    function ExternallySettledExample() {
      const [settlements, setSettlements] = useState<
        readonly DataListMutationSettlement[]
      >([])
      rejectMutation = (settlement) => setSettlements([settlement])
      const config = createListConfig({
        onEdit: (command) => {
          queueMicrotask(() =>
            rejectMutation({
              mutationId: command.mutationId,
              status: "rejected",
              error: new Error("conflict"),
            })
          )
          return { status: "await-authoritative" }
        },
        mutationSettlements: settlements,
        onCommandSettled,
      })
      return (
        <DataListProvider config={config}>
          <DataList />
        </DataListProvider>
      )
    }

    render(<ExternallySettledExample />)
    await user.dblClick(screen.getByText("Record 1"))
    const editor = screen.getByRole("textbox", { name: "Edit title" })
    await user.clear(editor)
    await user.type(editor, "Rejected externally")
    await user.keyboard("{Enter}")

    await waitFor(() => expect(screen.getByText("Record 1")).toBeVisible())
    expect(onCommandSettled).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", source: "external" })
    )
  })

  it("contains controls renderer failures without losing rows", async () => {
    const onError = vi.fn()
    renderDataList(
      <DataList />,
      createListConfig({
        renderControls: () => {
          throw new Error("controls failed")
        },
        onError,
      })
    )

    expect(screen.getAllByRole("row")).toHaveLength(4)
    expect(screen.getByText("Unable to render")).toBeVisible()
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "renderer" })
      )
    )
  })
})
