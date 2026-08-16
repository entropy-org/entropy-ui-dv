import React, { useLayoutEffect, useRef, useState } from "react"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { AlertTriangle, LoaderCircle, Plus, RefreshCw } from "lucide-react"
import { Button } from "../../ui/button.js"
import { KANBAN_VIRTUALIZATION_THRESHOLD } from "../constants.js"
import type { KanbanCard, KanbanCardRenderState, KanbanPageState } from "../types.js"
import { KanbanCardSurface } from "./kanban-card.js"
import { cn } from "../../../lib/utils.js"

interface Props extends Omit<React.ComponentProps<"div">, "children"> {
  readonly groupId: string
  readonly swimlaneId?: string
  readonly cards: readonly KanbanCard[]
  readonly density: "compact" | "comfortable"
  readonly overscan: number
  readonly collapsed: boolean
  readonly readOnly: boolean
  readonly selectedIds: ReadonlySet<string>
  readonly focusedCardId: string | null
  readonly draggingIds: ReadonlySet<string>
  readonly pendingIds: ReadonlySet<string>
  readonly wipWarning: boolean
  readonly getLabel: (card: KanbanCard) => string
  readonly renderCard: (card: KanbanCard, state: KanbanCardRenderState) => React.ReactNode
  readonly onActivate: (card: KanbanCard, event: React.MouseEvent<HTMLElement>) => void
  readonly onOpen: (card: KanbanCard) => void
  readonly onAdd?: () => void
  readonly getPageState?: () => KanbanPageState
  readonly onLoadMore?: () => void | Promise<void>
  readonly renderPageError?: (error: unknown, retry: () => void) => React.ReactNode
}

export const KanbanIntersection = React.memo(React.forwardRef<HTMLDivElement, Props>(function KanbanIntersection(
  { groupId, swimlaneId, cards, density, overscan, collapsed, readOnly, selectedIds, focusedCardId, draggingIds, pendingIds, wipWarning, getLabel, renderCard, onActivate, onOpen, onAdd, getPageState, onLoadMore, renderPageError, className, ...props }, forwardedRef
) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [requesting, setRequesting] = useState(false)
  const pageState = getPageState?.()
  const pinnedIndexes = React.useMemo(() => {
    const indexes = new Set<number>()
    for (const [index, card] of cards.entries()) {
      if (card.id === focusedCardId || draggingIds.has(card.id)) indexes.add(index)
    }
    return indexes
  }, [cards, draggingIds, focusedCardId])
  const droppable = useDroppable({
    id: `intersection:${groupId}:${swimlaneId ?? ""}`,
    disabled: readOnly || collapsed,
    data: { type: "intersection", groupId, swimlaneId, index: cards.length },
  })
  const virtualized = cards.length >= KANBAN_VIRTUALIZATION_THRESHOLD
  const virtualizer = useVirtualizer({
    count: virtualized ? cards.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => density === "compact" ? 66 : 86,
    overscan,
    getItemKey: (index) => cards[index]?.id ?? index,
    rangeExtractor: (range) => [...new Set([...defaultRangeExtractor(range), ...pinnedIndexes])].toSorted((left, right) => left - right),
  })
  useLayoutEffect(() => {
    if (!virtualized || !focusedCardId) return
    const index = cards.findIndex(({ id }) => id === focusedCardId)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" })
  }, [cards, focusedCardId, virtualized, virtualizer])
  const setRefs = (element: HTMLDivElement | null) => {
    droppable.setNodeRef(element)
    if (typeof forwardedRef === "function") forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }
  const renderSurface = (card: KanbanCard, index: number) => {
    const state: KanbanCardRenderState = {
      selected: selectedIds.has(card.id), focused: focusedCardId === card.id,
      dragging: draggingIds.has(card.id), previewing: false, pending: pendingIds.has(card.id),
      readOnly, wipWarning,
    }
    return <KanbanCardSurface key={card.id} card={card} index={index} setSize={pageState?.totalCount ?? cards.length} density={density} renderState={state} label={getLabel(card)} disabled={readOnly} onActivate={(event) => onActivate(card, event)} onOpen={() => onOpen(card)} render={renderCard} />
  }
  const loadMore = async () => {
    if (!onLoadMore || requesting || pageState?.status === "loading") return
    setRequesting(true)
    try { await onLoadMore() } catch { /* Errors are represented by the controlled page state. */ } finally { setRequesting(false) }
  }
  const loadingMore = requesting || pageState?.status === "loading"
  if (collapsed) return null
  return (
    <div ref={setRefs} role="group" aria-label={`Cards in ${groupId}`} className={cn("min-h-20 flex-1 bg-muted/[0.08]", droppable.isOver && "bg-primary/[0.035] ring-1 ring-inset ring-primary/30", className)} data-kanban-intersection={`${groupId}:${swimlaneId ?? ""}`} {...props}>
      <div ref={scrollRef} className="h-full max-h-[min(62vh,720px)] min-h-20 overflow-y-auto p-2">
        <SortableContext items={cards.map(({ id }) => `card:${id}`)} strategy={verticalListSortingStrategy}>
          {virtualized ? <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const card = cards[item.index]
              return card ? <div key={card.id} ref={virtualizer.measureElement} data-index={item.index} className="absolute left-0 top-0 w-full pb-2" style={{ transform: `translateY(${item.start}px)` }}>{renderSurface(card, item.index)}</div> : null
            })}
          </div> : <div className="space-y-2">{cards.map(renderSurface)}</div>}
        </SortableContext>
        {cards.length === 0 && !loadingMore ? <div className="flex min-h-16 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">No cards</div> : null}
        {pageState?.status === "error" && onLoadMore ? (renderPageError?.(pageState.error, loadMore) ?? <div role="alert" className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.035] p-2 text-[11px] text-destructive"><AlertTriangle className="size-3.5" aria-hidden="true" /><span className="min-w-0 flex-1">More cards could not be loaded.</span><Button type="button" variant="ghost" size="sm" onClick={loadMore}><RefreshCw aria-hidden="true" /> Retry</Button></div>) : null}
        {(pageState?.status === "idle" || pageState?.status === "loading") && onLoadMore ? <Button type="button" variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" disabled={loadingMore} onClick={loadMore}>{loadingMore ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{loadingMore ? "Loading more cards" : "Load more cards"}</Button> : null}
        {onAdd ? <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground" onClick={onAdd}><Plus aria-hidden="true" /> Add card</Button> : null}
      </div>
    </div>
  )
}))
