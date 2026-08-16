/**
 * TimelineSidebarItem — a single row in the sidebar panel.
 *
 * Renders the consumer-provided `renderSidebarItem` function.
 * Supports nesting depth indentation while group controls remain on the grid.
 */
import React from "react"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useMultiSelect } from "../hooks/use-multi-select.js"
import type { TimelineItem } from "../types.js"
import { cn } from "../../../lib/utils.js"
import { ChevronRight, CornerDownRight } from "lucide-react"
import { TimelineRendererBoundary } from "./timeline-renderer-boundary.js"

type TimelineSidebarItemHierarchy =
  | { type: "none" }
  | {
      type: "parent"
      isExpanded: boolean
      onToggle: () => void
    }

type TimelineSidebarItemProps = {
  /** The item to render */
  item: TimelineItem
  /** Row height in pixels */
  rowHeight: number
  /** Nesting depth (0 = top-level) */
  depth: number
  /** Independent sidebar hierarchy behavior. */
  hierarchy?: TimelineSidebarItemHierarchy
  /** One-based row position for assistive technologies */
  rowIndex?: number
  /** Show the compact file-tree elbow for a nested child. */
  showTreeIndicator?: boolean
}

/**
 * Sidebar row: renders consumer content with hierarchy indentation.
 */
export const TimelineSidebarItem = React.memo(
  React.forwardRef<HTMLDivElement, TimelineSidebarItemProps>(
    function TimelineSidebarItem(
      {
        item,
        rowHeight,
        depth,
        hierarchy = { type: "none" },
        rowIndex,
        showTreeIndicator = false,
      },
      ref
    ) {
      const { getItemAriaLabel, getItemPermissions, renderSidebarItem } =
        useTimelineConfig()
      const { handleClick } = useMultiSelect()
      const permissions = getItemPermissions?.(item) ?? {}

      const indentPx = depth * 20
      const isExpanded =
        hierarchy.type === "parent" ? hierarchy.isExpanded : false

      const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (permissions.select === false) return
        handleClick(item.id, e.shiftKey, e.ctrlKey || e.metaKey)
      }

      return (
        <div
          ref={ref}
          data-testid={`sidebar-item-${item.id}`}
          data-row-index={rowIndex === undefined ? undefined : rowIndex + 1}
          role="group"
          aria-label={getItemAriaLabel?.(item) ?? item.id}
          aria-disabled={permissions.select === false}
          tabIndex={permissions.select === false ? -1 : 0}
          onClick={handleRowClick}
          onKeyDown={(e) => {
            if (
              permissions.select !== false &&
              (e.key === "Enter" || e.key === " ")
            ) {
              e.preventDefault()
              handleClick(item.id, false, false)
            }
          }}
          className={cn(
            "group/sidebar-row mx-1 flex cursor-pointer items-center gap-1 overflow-hidden rounded-md px-2 text-sm transition-[background-color,opacity,transform] duration-150 ease-out hover:bg-muted/35 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1",
            depth > 0 && "text-muted-foreground"
          )}
          style={{ height: rowHeight, paddingLeft: indentPx + 8 }}
        >
          {hierarchy.type === "parent" && (
            <button
              type="button"
              data-testid={`sidebar-toggle-${item.id}`}
              className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
              aria-expanded={hierarchy.isExpanded}
              aria-label={
                hierarchy.isExpanded ? "Collapse sub-items" : "Expand sub-items"
              }
              onClick={(e) => {
                e.stopPropagation()
                hierarchy.onToggle()
              }}
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none",
                  hierarchy.isExpanded && "rotate-90"
                )}
              />
            </button>
          )}

          {showTreeIndicator && (
            <CornerDownRight
              aria-hidden="true"
              data-testid={`sidebar-tree-indicator-${item.id}`}
              strokeWidth={1.5}
              className="size-3.5 shrink-0 text-muted-foreground/55"
            />
          )}

          {/* Consumer-rendered content */}
          <div className="flex-1 truncate">
            <TimelineRendererBoundary
              surface="sidebar"
              item={item}
              fallback={(item.data as { title?: string })?.title ?? item.id}
            >
              {renderSidebarItem
                ? () => renderSidebarItem(item, { isExpanded })
                : ((item.data as { title?: string })?.title ?? item.id)}
            </TimelineRendererBoundary>
          </div>
        </div>
      )
    }
  )
)
