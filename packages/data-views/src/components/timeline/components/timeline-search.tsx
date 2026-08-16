import React, { useCallback } from "react"
import { Search, X } from "lucide-react"
import { Input } from "../../ui/input.js"
import { Button } from "../../ui/button.js"
import { cn } from "../../../lib/utils.js"

type TimelineSearchProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "type" | "value"
> & {
  value: string
  onValueChange: (value: string) => void
  onClear: () => void
}

/** Compact, fixed-width timeline search field. */
export const TimelineSearch = React.memo(
  React.forwardRef<HTMLInputElement, TimelineSearchProps>(
    function TimelineSearch(
      { className, value, onValueChange, onClear, onKeyDown, ...props },
      ref
    ) {
      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && event.key === "Escape" && value) {
            event.stopPropagation()
            onClear()
          }
        },
        [onClear, onKeyDown, value]
      )

      return (
        <div
          role="search"
          className={cn("relative h-8 w-44 shrink-0 md:w-52", className)}
          data-testid="timeline-search"
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
            aria-label="Search timeline"
            placeholder="Search…"
            autoComplete="off"
            className="h-8 rounded-lg border-border/80 bg-background pr-8 pl-8 text-xs shadow-xs transition-colors placeholder:text-muted-foreground/80 focus-visible:border-border/80 focus-visible:bg-background focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden"
            data-testid="timeline-search-input"
            {...props}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClear}
              aria-label="Clear timeline search"
              title="Clear search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
              data-testid="timeline-search-clear"
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      )
    }
  )
)
