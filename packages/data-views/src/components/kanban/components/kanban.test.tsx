import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Kanban } from "./kanban.js"
import { KanbanProvider } from "../context/kanban-provider.js"
import {
  createTestKanbanConfig,
  testCards,
  testLanes,
} from "../test/fixtures.js"

function renderBoard(
  overrides: Parameters<typeof createTestKanbanConfig>[0] = {}
) {
  const config = createTestKanbanConfig(overrides)
  return render(
    <KanbanProvider config={config}>
      <Kanban />
    </KanbanProvider>
  )
}

describe("Kanban", () => {
  it("renders groups, cards, counts, empty intersections, and forwards root attributes", () => {
    render(
      <KanbanProvider config={createTestKanbanConfig()}>
        <Kanban className="consumer-class" data-consumer="yes" />
      </KanbanProvider>
    )
    expect(screen.getByTestId("kanban")).toHaveClass("consumer-class")
    expect(screen.getByTestId("kanban")).toHaveAttribute("data-consumer", "yes")
    expect(screen.getByText("To do")).toBeInTheDocument()
    expect(screen.getByText("First task")).toBeInTheDocument()
    expect(screen.getAllByText("No cards")).toHaveLength(1)
  })

  it("can hide its built-in header without hiding cards", () => {
    render(
      <KanbanProvider config={createTestKanbanConfig()}>
        <Kanban showHeader={false} />
      </KanbanProvider>
    )

    expect(
      screen.queryByRole("textbox", { name: "Search Kanban cards" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("First task")).toBeInTheDocument()
  })

  it("scrolls the native board viewport with Shift+wheel", () => {
    renderBoard()
    const root = screen.getByTestId("kanban")
    const board = root.querySelector<HTMLElement>("[data-kanban-part='board']")!
    Object.defineProperties(board, {
      clientWidth: { configurable: true, value: 600 },
      scrollWidth: { configurable: true, value: 1400 },
    })

    fireEvent.wheel(screen.getByText("First task"), { deltaY: 120 })
    expect(board.scrollLeft).toBe(0)

    fireEvent.wheel(screen.getByText("First task"), {
      deltaY: 120,
      shiftKey: true,
    })
    expect(board.scrollLeft).toBe(120)
  })

  it("supports replace, toggle, range, select-visible, delete, and duplicate", () => {
    const onCommand = vi.fn()
    renderBoard({
      onCommand,
      createMutationId: vi
        .fn()
        .mockReturnValueOnce("delete")
        .mockReturnValueOnce("inverse")
        .mockReturnValueOnce("duplicate"),
    })
    const first = screen.getByRole("group", { name: "First task" })
    const second = screen.getByRole("group", { name: "Second task" })
    fireEvent.click(first)
    fireEvent.click(second, { ctrlKey: true })
    expect(screen.getByText("2 selected")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId("kanban"), { key: "Delete" })
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delete-cards", cardIds: ["one", "two"] })
    )
    fireEvent.keyDown(screen.getByTestId("kanban"), { key: "a", ctrlKey: true })
    expect(screen.getByText("3 selected")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId("kanban"), { key: "d", ctrlKey: true })
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "duplicate-cards",
        sourceCardIds: ["one", "two", "three"],
      })
    )
  })

  it("can open cards without selecting them", () => {
    const onCardClick = vi.fn()
    renderBoard({ selection: { mode: "none" }, onCardClick })
    const first = screen.getByRole("group", { name: "First task" })

    fireEvent.click(first, { ctrlKey: true })
    fireEvent.keyDown(screen.getByTestId("kanban"), {
      key: "a",
      ctrlKey: true,
    })

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "one" })
    )
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
    expect(screen.getByText("3 cards")).toBeInTheDocument()
    expect(first).toHaveClass("cursor-pointer", "select-none")
    expect(first).not.toHaveAttribute("data-selected")
  })

  it("supports keyboard pickup, destination movement, drop, and cancellation", () => {
    const onCommand = vi.fn()
    renderBoard({ onCommand })
    const first = screen.getByRole("group", { name: "First task" })
    fireEvent.click(first)
    const board = screen.getByTestId("kanban")
    fireEvent.keyDown(board, { key: " " })
    expect(screen.getByText(/picked up/i)).toBeInTheDocument()
    fireEvent.keyDown(board, { key: "ArrowRight" })
    fireEvent.keyDown(board, { key: " " })
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move-cards",
        cardIds: ["one"],
        destination: { groupId: "doing" },
      })
    )
    fireEvent.keyDown(board, { key: " " })
    fireEvent.keyDown(board, { key: "Escape" })
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
  })

  it("uses server-authoritative WIP counts for partially loaded groups", () => {
    const onCommand = vi.fn()
    renderBoard({
      onCommand,
      getGroupCardCount: (group, loaded) => (group.id === "doing" ? 2 : loaded),
    })
    fireEvent.click(screen.getByRole("group", { name: "First task" }))
    const board = screen.getByTestId("kanban")
    fireEvent.keyDown(board, { key: " " })
    fireEvent.keyDown(board, { key: "ArrowRight" })
    fireEvent.keyDown(board, { key: " " })
    expect(onCommand).not.toHaveBeenCalled()
    expect(screen.getByText(/hard WIP limit of 2/i)).toBeInTheDocument()
  })

  it("supports keyboard open, add, and controlled collapse shortcuts", () => {
    const onCardOpen = vi.fn()
    const onAddCard = vi.fn()
    const onPreferencesChange = vi.fn()
    renderBoard({ onCardOpen, onAddCard, onPreferencesChange })
    fireEvent.click(screen.getByRole("group", { name: "First task" }))
    const board = screen.getByTestId("kanban")
    fireEvent.keyDown(board, { key: "Enter" })
    fireEvent.keyDown(board, { key: "n" })
    fireEvent.keyDown(board, { key: "c" })
    expect(onCardOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "one" })
    )
    expect(onAddCard).toHaveBeenCalledWith({
      groupId: "todo",
      source: "keyboard",
    })
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ collapsedGroupIds: ["todo"] }),
      expect.objectContaining({ type: "group-collapsed" })
    )
  })

  it("searches normalized consumer text and navigates results", () => {
    renderBoard()
    const input = screen.getByRole("textbox", { name: "Search Kanban cards" })
    fireEvent.change(input, { target: { value: "third" } })
    expect(
      screen.getByRole("group", { name: "Third task" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "First task" })
    ).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "missing" } })
    expect(screen.getByText("No matching cards")).toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear search" }).at(-1)!
    )
    expect(
      screen.getByRole("group", { name: "First task" })
    ).toBeInTheDocument()
  })

  it("renders controlled swimlanes and collapse preferences", () => {
    const onPreferencesChange = vi.fn()
    const laneCards = testCards.map((card, index) => ({
      ...card,
      swimlaneId: index === 2 ? "low" : "high",
    }))
    renderBoard({
      cards: laneCards,
      swimlanes: testLanes,
      onPreferencesChange,
      getSwimlaneLabel: (lane) => (lane.data as { title: string }).title,
    })
    expect(screen.getByText("High priority")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse High priority" })
    )
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ collapsedSwimlaneIds: ["high"] }),
      expect.objectContaining({
        type: "swimlane-collapsed",
        swimlaneId: "high",
      })
    )
  })

  it("blocks mutation affordances and commands in read-only mode", () => {
    const onCommand = vi.fn()
    renderBoard({ readOnly: true, onCommand })
    expect(
      screen.queryByRole("button", { name: /Reorder/ })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("group", { name: "First task" }))
    fireEvent.keyDown(screen.getByTestId("kanban"), { key: "Delete" })
    expect(onCommand).not.toHaveBeenCalled()
  })

  it("contains renderer errors to one board instance", () => {
    const onRenderError = vi.fn()
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    render(
      <>
        <KanbanProvider
          config={createTestKanbanConfig({
            onRenderError,
            renderCard: () => {
              throw new Error("renderer")
            },
          })}
        >
          <Kanban />
        </KanbanProvider>
        <KanbanProvider
          config={createTestKanbanConfig({
            cards: [{ ...testCards[0]!, id: "safe" }],
          })}
        >
          <Kanban />
        </KanbanProvider>
      </>
    )
    expect(
      screen.getByText("Kanban board could not be displayed")
    ).toBeInTheDocument()
    expect(screen.getByText("First task")).toBeInTheDocument()
    expect(onRenderError).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })

  it("renders loading and board-empty states distinctly", () => {
    const { unmount } = renderBoard({ loading: true })
    expect(
      screen.getByRole("status", { name: "Loading Kanban board" })
    ).toBeInTheDocument()
    unmount()
    renderBoard({ cards: [], groups: [] })
    expect(screen.getByText("No cards yet")).toBeInTheDocument()
  })

  it("hands search to the server without hiding the currently loaded page", () => {
    const onQueryChange = vi.fn()
    renderBoard({ search: { mode: "server", onQueryChange, resultCount: 12 } })
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search Kanban cards" }),
      { target: { value: "not loaded locally" } }
    )
    expect(onQueryChange).toHaveBeenCalledWith("not loaded locally")
    expect(
      screen.getByRole("group", { name: "First task" })
    ).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("loads another intersection page with an idempotency key", async () => {
    let resolve!: () => void
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    const onLoadMore = vi.fn(() => pending)
    renderBoard({
      getPageState: ({ groupId }) =>
        groupId === "todo"
          ? { status: "idle", hasNextPage: true, totalCount: 20 }
          : { status: "complete" },
      onLoadMore,
    })
    const button = screen.getByRole("button", { name: "Load more cards" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(onLoadMore).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "todo",
        requestId: expect.stringMatching(/^kanban-/),
      })
    )
    expect(
      screen.getByRole("button", { name: "Loading more cards" })
    ).toBeDisabled()
    await act(async () => {
      resolve()
      await pending
    })
  })

  it("distinguishes stale-data errors, fatal errors, partial data, and retry", () => {
    const onRetryData = vi.fn()
    const renderResult = renderBoard({
      dataState: { status: "partial", message: "Showing 20 of 80 cards." },
      onRetryData,
    })
    expect(screen.getByText("Showing 20 of 80 cards.")).toBeInTheDocument()
    renderResult.rerender(
      <KanbanProvider
        config={createTestKanbanConfig({
          dataState: {
            status: "error",
            error: new Error("offline"),
            hasData: true,
          },
          onRetryData,
        })}
      >
        <Kanban />
      </KanbanProvider>
    )
    expect(
      screen.getByText("Kanban data could not be refreshed.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetryData).toHaveBeenCalledTimes(1)
    renderResult.rerender(
      <KanbanProvider
        config={createTestKanbanConfig({
          dataState: {
            status: "error",
            error: new Error("offline"),
            hasData: false,
          },
          onRetryData,
        })}
      >
        <Kanban />
      </KanbanProvider>
    )
    expect(
      screen.getByText("Kanban data could not be loaded")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "First task" })
    ).not.toBeInTheDocument()
  })

  it("contains search and filter callback errors", () => {
    const onRenderError = vi.fn()
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    renderBoard({
      filterCard: () => {
        throw new Error("filter")
      },
      onRenderError,
    })
    expect(
      screen.getByText("Kanban board could not be displayed")
    ).toBeInTheDocument()
    expect(onRenderError).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
