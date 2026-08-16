/**
 * Timeline — root component.
 *
 * CSS Grid layout: controls bar on top, optional sidebar + scrollable viewport below.
 * Must be wrapped in a `<TimelineProvider>`.
 *
 * Interaction support:
 * - Shift+wheel → horizontal scroll (useShiftScroll)
 * - Keyboard shortcuts (useKeyboardShortcuts)
 * - Ghost bar: tracks hovered column, shows ghost bar on hover
 *
 * Structure support:
 * - Sidebar: optional left panel with resizable divider, scroll-synced
 * - Sub-item modes: disabled/flattened/nested via useDisplayRows
 * - Hierarchy toggles change row visibility without changing item dates
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { useViewportColumns } from "../hooks/use-viewport-columns.js"
import { useVirtualRows } from "../hooks/use-virtual-rows.js"
import { useDisplayRows } from "../hooks/use-display-rows.js"
import { useShiftScroll } from "../hooks/use-shift-scroll.js"
import { useAutoScroll } from "../hooks/use-auto-scroll.js"
import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts.js"
import { useDependencyEditor } from "../hooks/use-dependency-editor.js"
import { TimelineContext } from "../context/timeline-context.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { TimelineHeader } from "./timeline-header.js"
import { TimelineGrid } from "./timeline-grid.js"
import { TimelineRow } from "./timeline-row.js"
import { TimelineBar } from "./timeline-bar.js"
import { TimelineTodayMarker } from "./timeline-today-marker.js"
import { TimelineControls } from "./timeline-controls.js"
import { TimelineGhostBar } from "./timeline-ghost-bar.js"
import { TimelineSidebar } from "./timeline-sidebar.js"
import { TimelineSidebarItem } from "./timeline-sidebar-item.js"
import { TimelineDependencyLayer } from "./timeline-dependency-layer.js"
import { TimelineHierarchyLayer } from "./timeline-hierarchy-layer.js"
import { TimelineOffscreenIndicator } from "./timeline-offscreen-indicator.js"
import { TimelineEmptyState } from "./timeline-empty-state.js"
import { TimelineSearchEmptyState } from "./timeline-search-empty-state.js"
import { TimelineDataState } from "./timeline-data-state.js"
import { useContext } from "react"
import { pxToDate } from "../utils/position-utils.js"
import { addOneColumnUnit } from "../utils/date-utils.js"
import { snapToGrid } from "../utils/snap-utils.js"
import { cn } from "../../../lib/utils.js"
import type { DisplayRow } from "../hooks/use-display-rows.js"
import { itemMatchesSearch } from "../utils/search-utils.js"
import type { DataViewChrome } from "../../../shared/chrome.js"
import { resolveDataViewHeader } from "../../../shared/chrome.js"

export type TimelineProps = React.HTMLAttributes<HTMLDivElement> & {
  chrome?: DataViewChrome
  /** @deprecated Use `chrome={{ mode: "embedded" }}`. */
  showHeader?: boolean
}

const HEADER_HEIGHT = 60

interface TimelineRowBarProps {
  row: DisplayRow
  origin: Date
  onDependencyStart?: ReturnType<typeof useDependencyEditor>["startDependency"]
}

/**
 * Memoized row-to-bar adapter. A hierarchy toggle changes visibility only;
 * the bar always uses the parent item's own dates and interactions.
 */
const TimelineRowBar = React.memo(function TimelineRowBar({
  row,
  origin,
  onDependencyStart,
}: TimelineRowBarProps) {
  const subItemMode = useTimelineStore((s) => s.rowSubItemMode)
  const toggleGroup = useTimelineStore((s) => s.actions.toggleRowGroup)
  const handleToggle = useCallback(
    () => toggleGroup(row.item.id),
    [row.item.id, toggleGroup]
  )
  const hierarchy = useMemo(
    () =>
      subItemMode !== "nested"
        ? ({ type: "none" } as const)
        : row.isParent
          ? ({
              type: "parent",
              isExpanded: row.isExpanded,
              onToggle: handleToggle,
            } as const)
          : ({ type: "none" } as const),
    [handleToggle, row.isExpanded, row.isParent, subItemMode]
  )

  return (
    <TimelineBar
      item={row.item}
      origin={origin}
      hierarchy={hierarchy}
      onDependencyStart={onDependencyStart}
    />
  )
})

interface TimelineSidebarRowProps {
  row: DisplayRow
  rowHeight: number
  rowIndex: number
}

const TimelineSidebarRow = React.memo(function TimelineSidebarRow({
  row,
  rowHeight,
  rowIndex,
}: TimelineSidebarRowProps) {
  const sidebarSubItemMode = useTimelineStore((s) => s.sidebarSubItemMode)
  const toggleSidebarGroup = useTimelineStore(
    (s) => s.actions.toggleSidebarGroup
  )
  const handleToggle = useCallback(
    () => toggleSidebarGroup(row.item.id),
    [row.item.id, toggleSidebarGroup]
  )
  const hierarchy = useMemo(
    () =>
      sidebarSubItemMode === "nested" && row.isParent
        ? ({
            type: "parent",
            isExpanded: row.isExpanded,
            onToggle: handleToggle,
          } as const)
        : ({ type: "none" } as const),
    [handleToggle, row.isExpanded, row.isParent, sidebarSubItemMode]
  )

  return (
    <TimelineSidebarItem
      item={row.item}
      rowHeight={rowHeight}
      depth={row.depth}
      hierarchy={hierarchy}
      rowIndex={rowIndex}
      showTreeIndicator={sidebarSubItemMode === "nested" && row.depth > 0}
    />
  )
})

/**
 * Root Timeline component.
 * Must be wrapped in a `<TimelineProvider>`.
 */
export const Timeline = React.memo(
  React.forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
    { className, showHeader = true, chrome, ...props },
    ref
  ) {
    const store = useContext(TimelineContext)
    if (!store)
      throw new Error("Timeline must be used within a TimelineProvider")
    const shouldShowHeader = resolveDataViewHeader(chrome, showHeader)
    const {
      dataState,
      dataVersion,
      getSearchText,
      loadMoreThresholdPx = 480,
      onLoadMore,
      onVisibleRangeChange,
    } = useTimelineConfig()

    // Narrow selectors to avoid unnecessary re-renders
    const scrollLeft = useTimelineStore((s) => s.scrollLeft)
    const scrollTop = useTimelineStore((s) => s.scrollTop)
    const rowHeight = useTimelineStore((s) => s.rowHeight)
    const viewportHeight = useTimelineStore((s) => s.viewportHeight)
    const viewportWidth = useTimelineStore((s) => s.viewportWidth)
    const viewportMode = useTimelineStore((s) => s.viewportMode)
    const snapEnabled = useTimelineStore((s) => s.snapToGrid)
    const readOnly = useTimelineStore((s) => s.readOnly)
    const dragState = useTimelineStore((s) => s.dragState)
    const rangeHighlight = useTimelineStore((s) => s.rangeHighlight)
    const sidebarVisible = useTimelineStore((s) => s.sidebarVisible)
    const sidebarWidth = useTimelineStore((s) => s.sidebarWidth)
    const sidebarResizing = useTimelineStore((s) => s.sidebarResizing)
    const dependenciesEnabled = useTimelineStore((s) => s.dependenciesEnabled)
    const itemCount = useTimelineStore((s) => s.items.size)
    const searchQuery = useTimelineStore((s) => s.searchQuery)
    const setSearchQuery = useTimelineStore((s) => s.actions.setSearchQuery)
    const scrollToItem = useTimelineStore((s) => s.actions.scrollToItem)
    const setViewportDimensions = useTimelineStore(
      (s) => s.actions.setViewportDimensions
    )
    const scrollTo = useTimelineStore((s) => s.actions.scrollTo)
    const clearRangeHighlight = useTimelineStore(
      (s) => s.actions.clearRangeHighlight
    )
    const clearActiveDependencyPort = useTimelineStore(
      (s) => s.actions.clearActiveDependencyPort
    )

    // Display rows — ordered by sub-item mode
    const displayRows = useDisplayRows("rows")
    const sidebarRows = useDisplayRows("sidebar")
    const firstMatchingItemId = useMemo(
      () =>
        searchQuery.trim()
          ? displayRows.find((row) =>
              itemMatchesSearch(row.item, searchQuery, getSearchText)
            )?.item.id
          : undefined,
      [displayRows, getSearchText, searchQuery]
    )

    useEffect(() => {
      if (firstMatchingItemId) scrollToItem(firstMatchingItemId)
    }, [firstMatchingItemId, scrollToItem])

    const { origin, columns, columnStartIndex, totalWidth, columnWidth } =
      useViewportColumns()
    const viewportRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const previousViewportMode = useRef(viewportMode)
    const dependencyEditor = useDependencyEditor({
      enabled: dependenciesEnabled && !readOnly,
      gridRef,
    })
    const visibleRange = useMemo(
      () => ({
        start: pxToDate(scrollLeft, origin, viewportMode),
        end: pxToDate(scrollLeft + viewportWidth, origin, viewportMode),
        viewportMode,
      }),
      [origin, scrollLeft, viewportMode, viewportWidth]
    )
    const previousRangeMetaRef = useRef({
      dataVersion,
      origin: origin.getTime(),
      viewportMode,
      viewportWidth,
    })
    useEffect(() => {
      if (!onVisibleRangeChange || viewportWidth <= 0) return
      const previous = previousRangeMetaRef.current
      const reason =
        previous.viewportMode !== viewportMode
          ? "zoom"
          : previous.viewportWidth !== viewportWidth
            ? "resize"
            : previous.dataVersion !== dataVersion ||
                previous.origin !== origin.getTime()
              ? "data"
              : "scroll"
      previousRangeMetaRef.current = {
        dataVersion,
        origin: origin.getTime(),
        viewportMode,
        viewportWidth,
      }
      const timeout = window.setTimeout(
        () => onVisibleRangeChange(visibleRange, { reason }),
        reason === "scroll" ? 80 : 0
      )
      return () => window.clearTimeout(timeout)
    }, [
      dataVersion,
      onVisibleRangeChange,
      origin,
      viewportMode,
      viewportWidth,
      visibleRange,
    ])

    const loadLatchRef = useRef({ previous: false, next: false })
    useEffect(() => {
      if (!onLoadMore || dataState?.status !== "ready") return
      const nearPrevious = scrollLeft <= loadMoreThresholdPx
      const nearNext =
        scrollLeft + viewportWidth >= totalWidth - loadMoreThresholdPx

      if (
        nearPrevious &&
        dataState.hasPreviousPage &&
        !dataState.isFetchingPreviousPage &&
        !loadLatchRef.current.previous
      ) {
        loadLatchRef.current.previous = true
        onLoadMore({ direction: "previous", visibleRange })
      } else if (!nearPrevious || !dataState.hasPreviousPage) {
        loadLatchRef.current.previous = false
      }

      if (
        nearNext &&
        dataState.hasNextPage &&
        !dataState.isFetchingNextPage &&
        !loadLatchRef.current.next
      ) {
        loadLatchRef.current.next = true
        onLoadMore({ direction: "next", visibleRange })
      } else if (!nearNext || !dataState.hasNextPage) {
        loadLatchRef.current.next = false
      }
    }, [
      dataState,
      loadMoreThresholdPx,
      onLoadMore,
      scrollLeft,
      totalWidth,
      viewportWidth,
      visibleRange,
    ])

    // Guard flag: prevents store→DOM→store scroll loop
    const isScrollingFromStore = useRef(false)

    // ── Keyboard Shortcuts ──────────────────────────────────────────────────
    useKeyboardShortcuts()

    // ── Shift+Scroll → Horizontal scroll ───────────────────────────────────
    const handleShiftScroll = useShiftScroll(viewportRef)

    // ── Auto-scroll during drag ─────────────────────────────────────────────
    const handleAutoScroll = useCallback(
      (nextScrollLeft: number) => scrollTo(nextScrollLeft),
      [scrollTo]
    )
    const autoScroll = useAutoScroll(viewportRef, handleAutoScroll)

    // Window-level listener: pointer capture on the bar blocks viewport
    // pointermove, so we listen on window to keep clientX updated.
    useEffect(() => {
      if (!dragState && dependencyEditor.state.type === "idle") return

      const onPointerMove = (e: PointerEvent) => {
        autoScroll.start(e.clientX)
      }
      window.addEventListener("pointermove", onPointerMove)
      return () => window.removeEventListener("pointermove", onPointerMove)
    }, [autoScroll, dependencyEditor.state.type, dragState])

    // Store → DOM: when store scroll changes (e.g. scrollToToday), move the viewport
    useEffect(() => {
      const el = viewportRef.current
      if (!el) return
      const modeChanged = previousViewportMode.current !== viewportMode
      previousViewportMode.current = viewportMode
      if (
        !modeChanged &&
        el.scrollLeft === scrollLeft &&
        el.scrollTop === scrollTop
      ) {
        return
      }
      isScrollingFromStore.current = true
      el.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: modeChanged ? "smooth" : "auto",
      })
      // Reset flag on next frame after browser processes the scroll
      requestAnimationFrame(() => {
        isScrollingFromStore.current = false
      })
    }, [scrollLeft, scrollTop, viewportMode])

    // DOM → Store: user-initiated scroll updates store
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrollingFromStore.current) return
        const { scrollLeft: sl, scrollTop: st } = e.currentTarget
        scrollTo(sl, st)
      },
      [scrollTo]
    )

    const handleViewportPointerUp = useCallback(() => {
      autoScroll.stop()
    }, [autoScroll])

    const handleViewportPointerDown = useCallback(() => {
      clearActiveDependencyPort()
    }, [clearActiveDependencyPort])

    // Track viewport dimensions for scrollToDate/scrollToItem math
    useEffect(() => {
      const el = viewportRef.current
      if (!el) return
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setViewportDimensions(
            entry.contentRect.width,
            entry.contentRect.height
          )
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    }, [setViewportDimensions])

    // ── Ghost Bar State ──────────────────────────────────────────────────────
    // Track which grid cell is being hovered (for ghost bar)
    const [ghostBar, setGhostBar] = useState<{
      startDate: Date
      endDate: Date
      rowIndex: number
      relativeX: number
    } | null>(null)

    const handleGridMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement
        if (
          dependencyEditor.state.type === "linking" ||
          target.closest("[data-timeline-bar='true']") ||
          target.closest("[data-timeline-dependency='true']")
        ) {
          setGhostBar(null)
          return
        }

        const grid = e.currentTarget
        const rect = grid.getBoundingClientRect()
        const relativeX = e.clientX - rect.left
        const relativeY = e.clientY - rect.top
        const rowIndex = Math.max(0, Math.floor(relativeY / rowHeight))

        // Existing row — no ghost bar
        if (rowIndex < displayRows.length) {
          setGhostBar(null)
          clearRangeHighlight()
          return
        }

        // Empty space below all items — show ghost bar
        if (store.getState().dragState || readOnly) {
          setGhostBar(null)
          return
        }

        clearRangeHighlight()

        const rawStart = pxToDate(relativeX, origin, viewportMode)
        const startDate = snapEnabled
          ? snapToGrid(rawStart, viewportMode)
          : rawStart
        const endDate = addOneColumnUnit(startDate, viewportMode)

        setGhostBar({
          startDate,
          endDate,
          rowIndex: displayRows.length,
          relativeX,
        })
      },
      [
        clearRangeHighlight,
        dependencyEditor.state.type,
        displayRows,
        origin,
        readOnly,
        rowHeight,
        snapEnabled,
        store,
        viewportMode,
      ]
    )

    const handleGridMouseLeave = useCallback(() => {
      setGhostBar(null)
      if (!store.getState().dragState) clearRangeHighlight()
    }, [clearRangeHighlight, store])

    const contentHeight = Math.max(
      displayRows.length * rowHeight,
      Math.max(0, viewportHeight - HEADER_HEIGHT)
    )
    const virtualRange = useVirtualRows(
      displayRows.length,
      HEADER_HEIGHT,
      viewportRef
    )
    const sidebarVirtualRange = useVirtualRows(
      sidebarRows.length,
      HEADER_HEIGHT,
      viewportRef
    )
    const virtualRows = useMemo(
      () =>
        virtualRange.endIndex < virtualRange.startIndex
          ? []
          : displayRows.slice(
              virtualRange.startIndex,
              virtualRange.endIndex + 1
            ),
      [displayRows, virtualRange.endIndex, virtualRange.startIndex]
    )
    const virtualSidebarRows = useMemo(
      () =>
        sidebarVirtualRange.endIndex < sidebarVirtualRange.startIndex
          ? []
          : sidebarRows.slice(
              sidebarVirtualRange.startIndex,
              sidebarVirtualRange.endIndex + 1
            ),
      [
        sidebarRows,
        sidebarVirtualRange.endIndex,
        sidebarVirtualRange.startIndex,
      ]
    )

    return (
      <div
        ref={ref}
        className={cn(
          "edv-root relative isolate flex h-full flex-col overflow-hidden bg-background text-foreground select-none",
          className
        )}
        data-testid="timeline-root"
        data-edv-root=""
        data-edv-part="timeline"
        data-edv-chrome={chrome?.mode ?? "standalone"}
        role="region"
        aria-label="Timeline"
        aria-busy={
          dataState?.status === "loading" ||
          (dataState?.status === "ready" && dataState.isFetching) ||
          undefined
        }
        data-read-only={readOnly || undefined}
        data-row-count={displayRows.length}
        data-data-version={dataVersion}
        {...props}
      >
        {/* Controls: mode switcher + Today button */}
        {shouldShowHeader ? (
          <div className="z-40 shrink-0 border-b border-border/80 bg-background/95 px-3 py-2 shadow-[0_1px_0_rgb(0_0_0/0.025)] backdrop-blur-xl">
            <TimelineControls />
          </div>
        ) : null}

        {/* Main area: optional sidebar + scrollable viewport */}
        {dataState?.status === "loading" && itemCount === 0 ? (
          <TimelineDataState type="loading" message={dataState.message} />
        ) : dataState?.status === "error" &&
          itemCount === 0 &&
          !dataState.hasStaleData ? (
          <TimelineDataState
            type="error"
            error={dataState.error}
            message={dataState.message}
          />
        ) : itemCount === 0 ? (
          <TimelineEmptyState />
        ) : searchQuery.trim() && displayRows.length === 0 ? (
          <TimelineSearchEmptyState
            query={searchQuery.trim()}
            onClear={() => setSearchQuery("")}
          />
        ) : (
          <div className="flex flex-1 overflow-hidden bg-muted/5">
            {(dataState?.status === "error" ||
              (dataState?.status === "ready" && dataState.isFetching)) && (
              <div
                className={cn(
                  "absolute top-[53px] right-3 z-50 rounded-full border bg-background/95 px-2.5 py-1 text-[11px] shadow-sm",
                  dataState.status === "error"
                    ? "border-destructive/30 text-destructive"
                    : "text-muted-foreground"
                )}
                role="status"
                aria-live="polite"
              >
                {dataState.status === "error"
                  ? (dataState.message ??
                    "Refresh failed — showing cached data")
                  : "Refreshing…"}
              </div>
            )}
            {/* Sidebar remains mounted so show/hide can animate smoothly. */}
            <div
              data-testid="timeline-sidebar-shell"
              className={cn(
                "relative z-20 h-full flex-shrink-0 overflow-hidden",
                !sidebarResizing &&
                  "transition-[width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                sidebarVisible
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              )}
              style={{ width: sidebarVisible ? sidebarWidth : 0 }}
              aria-hidden={!sidebarVisible}
              inert={!sidebarVisible}
            >
              <TimelineSidebar
                scrollTop={scrollTop}
                headerHeight={HEADER_HEIGHT}
                itemCount={sidebarRows.length}
                className={cn(
                  "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  !sidebarVisible && "-translate-x-1"
                )}
              >
                <div style={{ height: sidebarVirtualRange.topSpacerHeight }} />
                {virtualSidebarRows.map((row, virtualIndex) => {
                  const rowIndex = sidebarVirtualRange.startIndex + virtualIndex
                  return (
                    <TimelineSidebarRow
                      key={row.item.id}
                      row={row}
                      rowHeight={rowHeight}
                      rowIndex={rowIndex}
                    />
                  )
                })}
                <div
                  style={{ height: sidebarVirtualRange.bottomSpacerHeight }}
                />
              </TimelineSidebar>
            </div>

            {/* Scrollable viewport wrapper */}
            <div className="relative flex flex-1 overflow-hidden">
              {/* Scrollable viewport */}
              <div
                ref={viewportRef}
                className={cn(
                  "flex-1 [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_28%,transparent)_transparent] [scrollbar-gutter:stable] overflow-auto overscroll-contain bg-background",
                  dragState && "cursor-grabbing touch-none",
                  dependencyEditor.state.type === "linking" &&
                    "cursor-crosshair touch-none"
                )}
                onScroll={handleScroll}
                onWheel={handleShiftScroll}
                onPointerDown={handleViewportPointerDown}
                onPointerUp={handleViewportPointerUp}
                onPointerCancel={handleViewportPointerUp}
                data-testid="timeline-viewport"
                aria-label="Timeline grid"
              >
                {/* Content area sized to total column width + content height */}
                <div
                  className="relative"
                  style={{
                    width: totalWidth,
                    minHeight: contentHeight + HEADER_HEIGHT,
                  }}
                >
                  <TimelineHeader
                    columns={columns}
                    columnWidth={columnWidth}
                    mode={viewportMode}
                    origin={origin}
                    rangeHighlight={rangeHighlight}
                    totalWidth={totalWidth}
                    columnStartIndex={columnStartIndex}
                  />

                  {/* Grid sits below the header */}
                  <div
                    className="absolute w-full"
                    style={{ top: HEADER_HEIGHT, left: 0 }}
                  >
                    <TimelineGrid
                      ref={gridRef}
                      columns={columns}
                      columnWidth={columnWidth}
                      mode={viewportMode}
                      totalWidth={totalWidth}
                      contentHeight={contentHeight}
                      columnStartIndex={columnStartIndex}
                      onMouseMove={handleGridMouseMove}
                      onMouseLeave={handleGridMouseLeave}
                    >
                      <TimelineTodayMarker
                        origin={origin}
                        height={contentHeight}
                      />

                      {/* Dependency layer */}
                      <TimelineDependencyLayer
                        origin={origin}
                        displayRows={displayRows}
                        contentHeight={contentHeight}
                        contentWidth={totalWidth}
                        editorState={dependencyEditor.state}
                        draftPathRef={dependencyEditor.draftPathRef}
                        draftEndpointRef={dependencyEditor.draftEndpointRef}
                      />

                      <TimelineHierarchyLayer
                        origin={origin}
                        displayRows={displayRows}
                        contentHeight={contentHeight}
                        contentWidth={totalWidth}
                      />

                      {/* Ghost bar — shown on hover (when not readOnly) */}
                      {ghostBar && !dragState && (
                        <div
                          className="pointer-events-none absolute z-10"
                          style={{
                            top: ghostBar.rowIndex * rowHeight,
                            left: 0,
                            right: 0,
                            height: rowHeight,
                          }}
                        >
                          <div className="pointer-events-auto relative h-full w-full">
                            <TimelineGhostBar
                              rowIndex={ghostBar.rowIndex}
                              startDate={ghostBar.startDate}
                              endDate={ghostBar.endDate}
                              relativeX={ghostBar.relativeX}
                              totalWidth={totalWidth}
                            />
                          </div>
                        </div>
                      )}

                      {virtualRows.map((row, virtualIndex) => {
                        const index = virtualRange.startIndex + virtualIndex
                        return (
                          <TimelineRow
                            key={row.item.id}
                            index={index}
                            rowHeight={rowHeight}
                            itemId={row.item.id}
                          >
                            <TimelineRowBar
                              row={row}
                              origin={origin}
                              onDependencyStart={
                                dependencyEditor.canCreate
                                  ? dependencyEditor.startDependency
                                  : undefined
                              }
                            />
                          </TimelineRow>
                        )
                      })}
                    </TimelineGrid>
                  </div>
                </div>
              </div>

              <TimelineOffscreenIndicator
                displayRows={displayRows}
                headerHeight={HEADER_HEIGHT}
                origin={origin}
              />
              {dataState?.status === "ready" &&
                (dataState.isFetchingPreviousPage ||
                  dataState.isFetchingNextPage) && (
                  <div
                    className="pointer-events-none absolute right-3 bottom-3 z-40 rounded-full border bg-background/95 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm"
                    role="status"
                  >
                    Loading more…
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    )
  })
)
