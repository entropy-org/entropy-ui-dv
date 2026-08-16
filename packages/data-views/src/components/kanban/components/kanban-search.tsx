import React from "react"
import { ChevronDown, ChevronUp, LoaderCircle, Search, X } from "lucide-react"
import { Button } from "../../ui/button.js"
import { Input } from "../../ui/input.js"
import { cn } from "../../../lib/utils.js"

interface Props extends Omit<React.ComponentProps<"div">, "onChange"> {
  readonly value: string
  readonly resultCount: number
  readonly onChange: (value: string) => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly pending?: boolean
}

export const KanbanSearch = React.memo(React.forwardRef<HTMLDivElement, Props>(function KanbanSearch(
  { value, resultCount, onChange, onPrevious, onNext, pending = false, className, ...props }, ref
) {
  return <div ref={ref} role="search" aria-busy={pending} className={cn("flex items-center gap-1", className)} {...props}>
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search cards…" aria-label="Search Kanban cards" className="h-8 w-48 pl-8 pr-8 text-xs" data-kanban-search />
      {pending ? <LoaderCircle className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Searching" /> : value ? <button type="button" onClick={() => onChange("")} className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted" aria-label="Clear search"><X className="size-3" aria-hidden="true" /></button> : null}
    </div>
    {value ? <>
      <span className="min-w-8 text-center text-[10px] tabular-nums text-muted-foreground" aria-live="polite">{resultCount}</span>
      <Button variant="ghost" size="icon-sm" onClick={onPrevious} disabled={resultCount === 0} aria-label="Previous search result"><ChevronUp aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" onClick={onNext} disabled={resultCount === 0} aria-label="Next search result"><ChevronDown aria-hidden="true" /></Button>
    </> : null}
  </div>
}))
