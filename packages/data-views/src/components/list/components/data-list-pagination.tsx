import React from "react"
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react"
import { Button } from "../../ui/button.js"
import type { DataListServerPagination } from "../types.js"
import { cn } from "../../../lib/utils.js"

export interface DataListPaginationProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly pagination: DataListServerPagination
  readonly loadedCount: number
  readonly matchingCount: number
  readonly onLoadMore: () => void
  readonly onPageChange: (pageIndex: number) => void
}

export const DataListPagination = React.forwardRef<
  HTMLDivElement,
  DataListPaginationProps
>(function DataListPagination(
  {
    pagination,
    loadedCount,
    matchingCount,
    onLoadMore,
    onPageChange,
    className,
    ...props
  },
  ref
) {
  if (pagination.mode === "page") {
    const hasPrevious = pagination.hasPreviousPage ?? pagination.pageIndex > 0
    const hasNext =
      pagination.hasNextPage ??
      (pagination.pageCount === undefined ||
        pagination.pageIndex + 1 < pagination.pageCount)
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-10 items-center justify-between gap-3 border-t border-border/60 px-2 py-1.5",
          className
        )}
        data-list-part="pagination"
        {...props}
      >
        <span className="text-xs text-muted-foreground">
          Page {pagination.pageIndex + 1}
          {pagination.pageCount === undefined
            ? null
            : ` of ${pagination.pageCount}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!hasPrevious || pagination.pending}
            onClick={() => onPageChange(pagination.pageIndex - 1)}
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!hasNext || pagination.pending}
            onClick={() => onPageChange(pagination.pageIndex + 1)}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-10 items-center justify-center gap-3 border-t border-border/60 px-2 py-1.5",
        className
      )}
      data-list-part="pagination"
      {...props}
    >
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {loadedCount} loaded
        {matchingCount > loadedCount ? ` of ${matchingCount}` : ""}
      </span>
      {pagination.loadMoreError ? (
        <span className="text-xs text-destructive" role="alert">
          {String(pagination.loadMoreError)}
        </span>
      ) : null}
      {pagination.hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={pagination.fetchingNextPage}
          onClick={onLoadMore}
        >
          {pagination.fetchingNextPage ? (
            <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : null}
          {pagination.loadMoreError ? "Retry" : "Load more"}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">
          All records loaded
        </span>
      )}
    </div>
  )
})
