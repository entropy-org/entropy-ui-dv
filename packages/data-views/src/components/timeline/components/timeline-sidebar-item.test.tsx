/**
 * Tests for TimelineSidebarItem component.
 *
 * Verifies:
 * - Calls renderSidebarItem with correct isExpanded
 * - Indentation at correct depth
 * - Hierarchy controls stay out of the sidebar
 */
import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { TimelineSidebarItem } from "./timeline-sidebar-item.js"
import { renderTimeline } from "../test/render-timeline.js"
import { createTestItem } from "../test/fixtures.js"
import type { TimelineItem } from "../types.js"

const testItem = createTestItem({
  id: "test-1",
  data: { title: "Test Item" },
})

describe("TimelineSidebarItem", () => {
  it("renders the item using renderSidebarItem", () => {
    const renderSidebarItem = vi.fn((item: TimelineItem) => (
      <span data-testid="custom-render">
        {(item.data as { title: string }).title}
      </span>
    ))

    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={0}
        hierarchy={{ type: "none" }}
      />,
      {},
      { renderSidebarItem }
    )

    expect(screen.getByTestId("custom-render")).toHaveTextContent("Test Item")
    expect(renderSidebarItem).toHaveBeenCalledWith(testItem, {
      isExpanded: false,
    })
  })

  it("passes isExpanded=true to renderSidebarItem when expanded", () => {
    const renderSidebarItem = vi.fn(
      (_item: TimelineItem, state: { isExpanded: boolean }) => (
        <span>{state.isExpanded ? "Expanded" : "Collapsed"}</span>
      )
    )

    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={0}
        hierarchy={{
          type: "parent",
          isExpanded: true,
          onToggle: vi.fn(),
        }}
      />,
      { subItems: "nested" },
      { renderSidebarItem }
    )

    expect(renderSidebarItem).toHaveBeenCalledWith(testItem, {
      isExpanded: true,
    })
  })

  it("renders at correct row height", () => {
    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={44}
        depth={0}
        hierarchy={{ type: "none" }}
      />
    )

    const el = screen.getByTestId(`sidebar-item-${testItem.id}`)
    expect(el.style.height).toBe("44px")
  })

  it("applies indentation based on depth", () => {
    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={2}
        hierarchy={{ type: "none" }}
      />
    )

    const el = screen.getByTestId(`sidebar-item-${testItem.id}`)
    // depth 2 * 20px + 8px base = 48px
    expect(el.style.paddingLeft).toBe("48px")
  })

  it("shows a compact file-tree indicator for nested children", () => {
    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={1}
        hierarchy={{ type: "none" }}
        showTreeIndicator
      />
    )

    expect(
      screen.getByTestId(`sidebar-tree-indicator-${testItem.id}`)
    ).toBeInTheDocument()
  })

  it("renders an independent parent control in nested sidebar mode", () => {
    const onToggle = vi.fn()
    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={0}
        hierarchy={{
          type: "parent",
          isExpanded: false,
          onToggle,
        }}
      />,
      { subItems: "nested" }
    )

    screen.getByTestId(`sidebar-toggle-${testItem.id}`).click()
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it("falls back to item title when no renderSidebarItem provided", () => {
    renderTimeline(
      <TimelineSidebarItem
        item={testItem}
        rowHeight={40}
        depth={0}
        hierarchy={{ type: "none" }}
      />
    )

    const el = screen.getByTestId(`sidebar-item-${testItem.id}`)
    expect(el).toHaveTextContent("Test Item")
  })
})
