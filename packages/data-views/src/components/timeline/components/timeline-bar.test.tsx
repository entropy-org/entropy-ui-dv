import { describe, it, expect, vi } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import { renderTimeline } from "../test/render-timeline.js"
import { TimelineBar } from "./timeline-bar.js"
import { createTestItem } from "../test/fixtures.js"

describe("TimelineBar", () => {
  it("renders bar with custom renderBar fn", () => {
    const item = createTestItem({ id: "test-1" })
    item.data = { title: "Custom Title" }

    const renderBar = vi
      .fn()
      .mockImplementation((i) => (
        <div data-testid="custom-bar">{i.data.title}</div>
      ))

    const { renderResult } = renderTimeline(
      <TimelineBar item={item} origin={new Date("2026-07-01")} />,
      {}, // store config
      { renderBar } // config context overrides
    )

    expect(renderBar).toHaveBeenCalled()
    expect(renderResult.getByTestId("custom-bar")).toHaveTextContent(
      "Custom Title"
    )
    expect(renderResult.getByTestId("timeline-bar-test-1")).not.toHaveClass(
      "duration-300"
    )
    expect(renderResult.getByTestId("timeline-bar-test-1")).toHaveAttribute(
      "draggable",
      "false"
    )
  })

  it("uses a restrained inset outline for selection", () => {
    const item = createTestItem({ id: "selected-item" })
    const { renderResult, store } = renderTimeline(
      <TimelineBar item={item} origin={new Date("2026-07-01")} />,
      { items: [item] }
    )

    act(() => store.getState().actions.select("selected-item", "replace"))

    expect(renderResult.getByTestId("timeline-bar-selected-item")).toHaveClass(
      "ring-1",
      "ring-foreground/20",
      "ring-inset"
    )
  })

  it("does not apply drag presentation while resizing", () => {
    const item = createTestItem({ id: "resizing-item" })
    const renderBar = vi.fn(
      (_item, state: { isDragging: boolean; isSelected: boolean }) => (
        <div
          data-testid="resize-presentation"
          className={state.isDragging ? "scale-[1.01]" : ""}
        />
      )
    )
    const { renderResult } = renderTimeline(
      <TimelineBar item={item} origin={new Date("2026-07-01")} />,
      { items: [item], viewportMode: "hours" },
      { renderBar }
    )

    fireEvent.pointerDown(
      renderResult.getByTestId("resize-handle-right-resizing-item"),
      { clientX: 800, pointerId: 1 }
    )

    expect(renderResult.getByTestId("resize-presentation")).not.toHaveClass(
      "scale-[1.01]"
    )
    expect(renderBar.mock.lastCall?.[1]).toMatchObject({
      isDragging: false,
    })
  })

  it("renders a clickable expand control on a parent bar", () => {
    const item = createTestItem({ id: "parent-item" })
    const onToggle = vi.fn()
    const { renderResult } = renderTimeline(
      <TimelineBar
        item={item}
        origin={new Date("2026-07-01")}
        hierarchy={{
          type: "parent",
          isExpanded: false,
          onToggle,
        }}
      />,
      { items: [item] }
    )

    const toggle = renderResult.getByTestId(
      "timeline-parent-toggle-parent-item"
    )
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle.closest("[data-timeline-bar='true']")).toBe(
      renderResult.getByTestId("timeline-bar-parent-item")
    )
    expect(
      renderResult.container.querySelector("[data-timeline-bar-content]")
    ).toHaveClass("[&>*]:!pl-6")
    expect(toggle).not.toHaveClass("border", "bg-background/85")

    fireEvent.click(toggle)

    expect(onToggle).toHaveBeenCalledOnce()
  })
})
