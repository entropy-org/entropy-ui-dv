import React from "react"
import { AlertCircle, Inbox, LockKeyhole, LoaderCircle } from "lucide-react"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

export interface DataListStateSurfaceProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly state: "loading" | "empty" | "filtered-empty" | "error" | "no-access"
  readonly message?: React.ReactNode
  readonly onRetry?: () => void
}

export const DataListStateSurface = React.forwardRef<
  HTMLDivElement,
  DataListStateSurfaceProps
>(function DataListStateSurface(
  { state, message, onRetry, className, ...props },
  ref
) {
  const icon =
    state === "loading" ? (
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
    ) : state === "no-access" ? (
      <LockKeyhole className="size-4" />
    ) : state === "error" ? (
      <AlertCircle className="size-4 text-destructive" />
    ) : (
      <Inbox className="size-4" />
    )
  const fallback =
    state === "loading"
      ? "Loading records…"
      : state === "filtered-empty"
        ? "No records match the current view."
        : state === "no-access"
          ? "You do not have access to this view."
          : state === "error"
            ? "The list could not be loaded."
            : "No records yet."
  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-2 border-y border-border/60 px-6 py-10 text-center text-sm text-muted-foreground",
        className
      )}
      role={state === "error" ? "alert" : "status"}
      data-list-part="state"
      data-state={state}
      {...props}
    >
      {icon}
      <div>{message ?? fallback}</div>
      {state === "error" && onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
})
