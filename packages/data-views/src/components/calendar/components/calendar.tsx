import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react"
import { useCalendarConfig } from "../context/calendar-config-context.js"
import { useCalendarModel } from "../hooks/use-calendar-model.js"
import { useCalendarKeyboard } from "../hooks/use-calendar-keyboard.js"
import { useCalendarNavigationActions } from "../hooks/use-calendar-navigation.js"
import { useCalendarPointerInteractions } from "../hooks/use-calendar-pointer-interactions.js"
import { useCalendarStore } from "../hooks/use-calendar-store.js"
import {
  selectActions,
  selectAnnouncement,
  selectAnnouncementSequence,
  selectFocusedDate,
  selectInteraction,
  selectSearchQuery,
} from "../store/selectors.js"
import { compareCalendarDates } from "../utils/date-engine.js"
import { CalendarControls } from "./calendar-controls.js"
import { CalendarDateView } from "./calendar-date-view.js"
import { CalendarEmptyState } from "./calendar-empty-state.js"
import { CalendarWeekdayHeader } from "./calendar-weekday-header.js"
import { CalendarRenderErrorBoundary } from "./calendar-render-error-boundary.js"
import { CalendarDataState } from "./calendar-data-state.js"
import { CalendarAgendaView } from "./agenda/calendar-agenda-view.js"
import { CalendarAgendaSidebar } from "./agenda/calendar-agenda-sidebar.js"
import { TooltipProvider } from "../../ui/tooltip.js"
import { cn } from "../../../lib/utils.js"
import { useShiftWheel } from "../../../hooks/use-shift-wheel.js"
import { resolveCalendarDataPresentation } from "../utils/data-integration.js"
import type { DataViewChrome } from "../../../shared/chrome.js"
import { resolveDataViewHeader } from "../../../shared/chrome.js"

export type CalendarProps = React.ComponentProps<"div"> & {
  readonly chrome?: DataViewChrome
  /** @deprecated Use `chrome={{ mode: "embedded" }}`. */
  readonly showHeader?: boolean
}

export const Calendar = React.memo(
  React.forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
    {
      className,
      onKeyDown,
      onFocusCapture,
      onBlurCapture,
      role = "region",
      "aria-label": ariaLabel = "Calendar",
      "aria-describedby": ariaDescribedBy,
      showHeader = true,
      chrome,
      ...props
    },
    forwardedRef
  ) {
    const config = useCalendarConfig()
    const shouldShowHeader = resolveDataViewHeader(chrome, showHeader)
    const { onVisibleRangeChange } = config
    const model = useCalendarModel()
    const dataPresentation = resolveCalendarDataPresentation(
      model.visibleRange,
      config.dataState
    )
    const navigation = useCalendarNavigationActions()
    const actions = useCalendarStore(selectActions)
    const searchQuery = useCalendarStore(selectSearchQuery)
    const focusedDate = useCalendarStore(selectFocusedDate)
    const interaction = useCalendarStore(selectInteraction)
    const announcement = useCalendarStore(selectAnnouncement)
    const announcementSequence = useCalendarStore(selectAnnouncementSequence)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const gridRef = useRef<HTMLDivElement | null>(null)
    const focusOwnedRef = useRef(false)
    const previousRangeKeyRef = useRef(model.visibleRange.key)
    const preserveInteractionOnRangeChangeRef = useRef(false)
    const visibleRangeCallbackRef = useRef(onVisibleRangeChange)
    visibleRangeCallbackRef.current = onVisibleRangeChange
    const {
      key: visibleRangeKey,
      startDate: visibleRangeStart,
      endDate: visibleRangeEnd,
      timeZone: visibleRangeTimeZone,
      viewMode: visibleRangeViewMode,
    } = model.visibleRange
    const instructionsId = useId()
    const pointer = useCalendarPointerInteractions(
      gridRef,
      model.grid,
      model.items
    )
    const handleCalendarKeyDown = useCalendarKeyboard(model, rootRef)

    useShiftWheel(rootRef, (delta) => {
      const root = rootRef.current
      if (!root) return

      const maximumScrollLeft = Math.max(0, root.scrollWidth - root.clientWidth)
      const nextScrollLeft = Math.min(
        maximumScrollLeft,
        Math.max(0, root.scrollLeft + delta)
      )
      if (nextScrollLeft !== root.scrollLeft) {
        root.scrollLeft = nextScrollLeft
        return
      }

      preserveInteractionOnRangeChangeRef.current = interaction.type !== "idle"
      if (delta < 0) navigation.previous()
      else navigation.next()
    })

    useEffect(() => {
      const element = rootRef.current
      if (!element) return
      const observer = new ResizeObserver(([entry]) => {
        actions.setViewportDimensions(
          entry.contentRect.width,
          entry.contentRect.height
        )
      })
      observer.observe(element)
      return () => observer.disconnect()
    }, [actions])

    useEffect(() => {
      if (config.selection?.mode === "none") actions.clearSelection()
    }, [actions, config.selection?.mode])

    useEffect(() => {
      if (
        dataPresentation.blocksContent ||
        !searchQuery ||
        model.normalized.items.length === 0
      )
        return
      const firstDate = model.normalized.items[0].dateSpan.startDate
      const outside =
        compareCalendarDates(firstDate, model.grid.startDate) < 0 ||
        compareCalendarDates(firstDate, model.grid.endDate) > 0
      if (outside) navigation.toDate(firstDate)
      actions.setFocusedDate(firstDate)
    }, [
      actions,
      dataPresentation.blocksContent,
      model.grid.endDate,
      model.grid.startDate,
      model.normalized.items,
      navigation,
      searchQuery,
    ])

    useEffect(() => {
      actions.announce(`Showing ${model.title}.`)
    }, [actions, model.title])

    useEffect(() => {
      visibleRangeCallbackRef.current?.({
        key: visibleRangeKey,
        startDate: visibleRangeStart,
        endDate: visibleRangeEnd,
        timeZone: visibleRangeTimeZone,
        viewMode: visibleRangeViewMode,
      })
    }, [
      visibleRangeEnd,
      visibleRangeKey,
      visibleRangeStart,
      visibleRangeTimeZone,
      visibleRangeViewMode,
    ])

    useEffect(() => {
      if (previousRangeKeyRef.current === model.visibleRange.key) return
      previousRangeKeyRef.current = model.visibleRange.key
      if (preserveInteractionOnRangeChangeRef.current) {
        preserveInteractionOnRangeChangeRef.current = false
        return
      }
      if (actions.cancelInteraction()) {
        actions.announce(
          "Calendar interaction cancelled because the visible range changed."
        )
      }
    }, [actions, model.visibleRange.key])

    useLayoutEffect(() => {
      const root = rootRef.current
      if (
        !root ||
        !focusOwnedRef.current ||
        root.contains(document.activeElement)
      ) {
        return
      }
      const fallbackDate = focusedDate ?? model.grid.anchorDate
      root
        .querySelector<HTMLElement>(`[data-calendar-date="${fallbackDate}"]`)
        ?.focus({ preventScroll: true })
    }, [focusedDate, model.grid.anchorDate, model.items])

    const setRefs = useCallback(
      (element: HTMLDivElement | null) => {
        rootRef.current = element
        if (typeof forwardedRef === "function") forwardedRef(element)
        else if (forwardedRef) forwardedRef.current = element
      },
      [forwardedRef]
    )

    const empty = model.items.length === 0
    return (
      <TooltipProvider>
        <div
          ref={setRefs}
          tabIndex={0}
          className={cn(
            "edv-root relative isolate h-full min-h-[520px] min-w-0 overflow-x-auto overflow-y-hidden bg-background text-foreground outline-none motion-reduce:scroll-auto forced-colors:border forced-colors:border-[CanvasText]",
            className
          )}
          role={role}
          aria-label={ariaLabel}
          aria-describedby={[ariaDescribedBy, instructionsId]
            .filter(Boolean)
            .join(" ")}
          data-testid="calendar"
          data-edv-root=""
          data-edv-part="calendar"
          data-edv-chrome={chrome?.mode ?? "standalone"}
          aria-busy={dataPresentation.busy}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (!event.defaultPrevented) handleCalendarKeyDown(event)
          }}
          onFocusCapture={(event) => {
            focusOwnedRef.current = true
            onFocusCapture?.(event)
          }}
          onBlurCapture={(event) => {
            const next = event.relatedTarget
            if (next instanceof Node && !event.currentTarget.contains(next)) {
              focusOwnedRef.current = false
            }
            onBlurCapture?.(event)
          }}
          {...props}
        >
          <span id={instructionsId} className="sr-only">
            Use arrow keys to move between dates. Press Enter to create an item.
            {config.selection?.mode !== "none"
              ? " Use Alt with left or right arrow to move selected items."
              : null}
          </span>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            <span key={announcementSequence}>{announcement}</span>
          </span>
          <div className="flex h-full min-h-[520px] min-w-[960px]">
            <CalendarRenderErrorBoundary
              resetKey={`${config.preferences.viewMode}:${model.grid.startDate}:${model.grid.endDate}`}
              renderFallback={config.renderErrorState}
              onError={config.onRenderError}
            >
              {config.preferences.viewMode === "agenda" &&
              config.agenda?.sidebar &&
              config.agenda.sidebar.type !== "hidden" ? (
                <CalendarAgendaSidebar config={config.agenda.sidebar} />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col">
                {shouldShowHeader ? (
                  <CalendarControls
                    itemCount={
                      dataPresentation.blocksContent ? 0 : model.items.length
                    }
                    title={model.title}
                  />
                ) : null}
                {config.renderDataState &&
                (dataPresentation.status !== "ready" ||
                  dataPresentation.partial) ? (
                  config.renderDataState(
                    dataPresentation,
                    config.onDataRetry ?? (() => undefined)
                  )
                ) : (
                  <CalendarDataState
                    state={dataPresentation}
                    onRetry={config.onDataRetry}
                  />
                )}
                {dataPresentation.blocksContent ? null : config.preferences
                    .viewMode === "agenda" ? (
                  <CalendarAgendaView items={model.items} today={model.today} />
                ) : empty ? (
                  <CalendarEmptyState searchQuery={searchQuery || undefined} />
                ) : (
                  <>
                    {config.preferences.viewMode === "month" ? (
                      <CalendarWeekdayHeader row={model.grid.rows[0]} />
                    ) : null}
                    <CalendarDateView
                      ref={gridRef}
                      mode={config.preferences.viewMode}
                      model={model}
                      pointer={pointer}
                    />
                  </>
                )}
              </div>
            </CalendarRenderErrorBoundary>
          </div>
        </div>
      </TooltipProvider>
    )
  })
)
