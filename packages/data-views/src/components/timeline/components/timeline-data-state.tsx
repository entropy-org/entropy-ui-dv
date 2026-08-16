import React from "react"
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "../../ui/button.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { TimelineRendererBoundary } from "./timeline-renderer-boundary.js"
import { cn } from "../../../lib/utils.js"

type TimelineDataStateProps = React.HTMLAttributes<HTMLDivElement> & {
  type: "loading" | "error"
  error?: unknown
  message?: string
}

export const TimelineDataState = React.memo(
  React.forwardRef<HTMLDivElement, TimelineDataStateProps>(
    function TimelineDataState(
      { type, error, message, className, ...props },
      ref
    ) {
      const { onRetry, renderErrorState, renderLoadingState } =
        useTimelineConfig()
      const customRenderer =
        type === "loading"
          ? renderLoadingState
          : renderErrorState
            ? () => renderErrorState(error, onRetry)
            : undefined

      return (
        <div
          ref={ref}
          role={type === "error" ? "alert" : "status"}
          aria-live="polite"
          data-testid={`timeline-${type}-state`}
          className={cn(
            "flex min-h-72 flex-1 items-center justify-center bg-muted/5 p-8",
            className
          )}
          {...props}
        >
          {customRenderer ? (
            <TimelineRendererBoundary surface={type}>
              {customRenderer}
            </TimelineRendererBoundary>
          ) : (
            <div className="flex max-w-sm flex-col items-center text-center">
              {type === "loading" ? (
                <LoaderCircle className="mb-3 size-6 animate-spin text-primary" />
              ) : (
                <AlertCircle className="mb-3 size-6 text-destructive" />
              )}
              <p className="text-sm font-semibold">
                {type === "loading"
                  ? "Loading timeline"
                  : "Unable to load timeline"}
              </p>
              {message && (
                <p className="mt-1 text-xs text-muted-foreground">{message}</p>
              )}
              {type === "error" && onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={onRetry}
                >
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              )}
            </div>
          )}
        </div>
      )
    }
  )
)
