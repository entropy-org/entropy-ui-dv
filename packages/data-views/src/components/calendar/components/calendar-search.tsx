import React, { useCallback } from "react"
import { Search, X } from "lucide-react"
import { Button } from "../../ui/button.js"
import { Input } from "../../ui/input.js"
import { cn } from "../../../lib/utils.js"

export type CalendarSearchProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "type" | "value"
> & {
  readonly value: string
  readonly onValueChange: (value: string) => void
}

export const CalendarSearch = React.memo(
  React.forwardRef<HTMLInputElement, CalendarSearchProps>(
    function CalendarSearch(
      { className, value, onValueChange, onKeyDown, ...props },
      ref
    ) {
      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && event.key === "Escape" && value) {
            event.stopPropagation()
            onValueChange("")
          }
        },
        [onKeyDown, onValueChange, value]
      )

      return (
        <div
          role="search"
          className={cn("relative h-8 w-44 shrink-0 md:w-52", className)}
          data-testid="calendar-search"
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={ref}
            type="search"
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search calendar"
            placeholder="Search…"
            autoComplete="off"
            className="h-8 rounded-lg border-border/80 bg-background pr-8 pl-8 text-xs shadow-xs focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden"
            data-testid="calendar-search-input"
            {...props}
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onValueChange("")}
              aria-label="Clear calendar search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full text-muted-foreground"
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      )
    }
  )
)
