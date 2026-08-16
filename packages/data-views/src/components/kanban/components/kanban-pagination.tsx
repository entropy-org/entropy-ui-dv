import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { KanbanPagination as KanbanPaginationConfig } from "../types.js"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

interface KanbanPaginationProps extends React.ComponentPropsWithoutRef<"nav"> {
  readonly pagination: KanbanPaginationConfig
}

export const KanbanPagination = React.memo(
  React.forwardRef<HTMLElement, KanbanPaginationProps>(
    function KanbanPagination({ pagination, className, ...props }, ref) {
      const hasPrevious = pagination.hasPreviousPage ?? pagination.pageIndex > 0
      const hasNext =
        pagination.hasNextPage ??
        pagination.pageIndex + 1 < pagination.pageCount
      const first =
        pagination.totalCount === 0
          ? 0
          : pagination.pageIndex * pagination.pageSize + 1
      const last =
        pagination.totalCount === undefined
          ? undefined
          : Math.min(
              (pagination.pageIndex + 1) * pagination.pageSize,
              pagination.totalCount
            )

      return (
        <nav
          ref={ref}
          aria-label="Board pagination"
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 border-t border-border/70 px-3 py-2",
            className
          )}
          data-kanban-part="pagination"
          {...props}
        >
          <span className="text-xs text-muted-foreground tabular-nums">
            {last === undefined
              ? `Page ${pagination.pageIndex + 1} of ${pagination.pageCount}`
              : `${first}–${last} of ${pagination.totalCount}`}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!hasPrevious || pagination.pending}
              onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
              aria-label="Previous board page"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
              {pagination.pageIndex + 1} / {pagination.pageCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!hasNext || pagination.pending}
              onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
              aria-label="Next board page"
            >
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )
    }
  )
)

KanbanPagination.displayName = "KanbanPagination"
