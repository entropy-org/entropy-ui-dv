/**
 * TimelineDependencyLayer — SVG overlay rendering dependency arrows.
 *
 * Renders an SVG absolutely positioned over the grid. For each dependency,
 * computes a smooth curve from source bar edge to target bar edge.
 * Virtualized: only renders paths where at least one endpoint is visible.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type RefObject,
} from "react"
import { useTimelineStore } from "../hooks/use-timeline-store.js"
import { useTimelineConfig } from "../context/timeline-config-context.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"
import { TimelineContext } from "../context/timeline-context.js"
import {
  computeDependencyCurvePath,
  computeDependencyRouteOptions,
  type BarRect,
} from "../utils/dependency-path.js"
import {
  createTimelineLinkPreview,
  getTimelineLinkPosition,
  isTimelineLinkItemLive,
} from "../utils/link-preview.js"
import type { TimelineDependency } from "../types.js"
import type { DisplayRow } from "../hooks/use-display-rows.js"
import type { DependencyEditorState } from "../hooks/use-dependency-editor.js"

interface TimelineDependencyLayerProps {
  /** Timeline origin date */
  origin: Date
  /** Display rows (for computing bar Y positions) */
  displayRows: DisplayRow[]
  /** Total content height */
  contentHeight: number
  /** Total content width */
  contentWidth: number
  /** Live dependency-creation state. */
  editorState?: DependencyEditorState
  /** Imperative path target for animation-frame pointer updates. */
  draftPathRef?: RefObject<SVGPathElement | null>
  /** Imperative endpoint target for animation-frame pointer updates. */
  draftEndpointRef?: RefObject<SVGCircleElement | null>
}

/**
 * SVG dependency arrow overlay.
 *
 * Renders smooth connector paths between dependent items.
 * Paths are virtualized: only drawn when at least one endpoint is within
 * the current scroll viewport.
 */
export const TimelineDependencyLayer = React.memo(
  React.forwardRef<SVGSVGElement, TimelineDependencyLayerProps>(
    function TimelineDependencyLayer(
      {
        origin,
        displayRows,
        contentHeight,
        contentWidth,
        editorState = { type: "idle" },
        draftPathRef,
        draftEndpointRef,
      },
      ref
    ) {
      const store = useContext(TimelineContext)
      if (!store) {
        throw new Error(
          "TimelineDependencyLayer must be used within a TimelineProvider"
        )
      }
      const dependenciesEnabled = useTimelineStore((s) => s.dependenciesEnabled)
      const viewportMode = useTimelineStore((s) => s.viewportMode)
      const rowHeight = useTimelineStore((s) => s.rowHeight)
      const scrollLeft = useTimelineStore((s) => s.scrollLeft)
      const viewportWidth = useTimelineStore((s) => s.viewportWidth)
      const items = useTimelineStore((s) => s.items)
      const readOnly = useTimelineStore((s) => s.readOnly)
      const {
        dependenciesList,
        getItemPermissions,
        onDependencyRemove,
        onMutation,
      } = useTimelineConfig()
      const mutations = useOptionalTimelineMutations()
      const markerId = `timeline-arrow-${useId().replaceAll(":", "")}`
      const pathRefs = useRef(new Map<string, SVGPathElement>())
      const hitAreaRefs = useRef(new Map<string, SVGPathElement>())
      const groupRefs = useRef(new Map<string, SVGGElement>())
      const removeControlRefs = useRef(new Map<string, SVGGElement>())

      // Build a lookup: item ID → row index
      const rowIndexMap = useMemo(() => {
        const map = new Map<string, number>()
        displayRows.forEach((row, index) => {
          map.set(row.item.id, index)
        })
        return map
      }, [displayRows])

      const dependencyRoutes = useMemo(
        () => computeDependencyRouteOptions(dependenciesList ?? []),
        [dependenciesList]
      )
      // Compute bar rects and paths for visible dependencies
      const paths = useMemo(() => {
        if (!dependenciesEnabled || !dependenciesList?.length) return []

        const viewportLeft = scrollLeft
        const viewportRight = scrollLeft + viewportWidth

        return dependenciesList
          .map((dep) => {
            const fromItem = items.get(dep.fromItemId)
            const toItem = items.get(dep.toItemId)
            if (!fromItem || !toItem) return null

            const fromRowIdx = rowIndexMap.get(dep.fromItemId)
            const toRowIdx = rowIndexMap.get(dep.toItemId)
            if (fromRowIdx === undefined || toRowIdx === undefined) return null

            const fromPos = getTimelineLinkPosition(
              { type: "none" },
              dep.fromItemId,
              fromItem,
              origin,
              viewportMode
            )
            const toPos = getTimelineLinkPosition(
              { type: "none" },
              dep.toItemId,
              toItem,
              origin,
              viewportMode
            )

            // Virtualization: skip if both endpoints are entirely offscreen
            const fromRight = fromPos.left + fromPos.width
            const toRight = toPos.left + toPos.width
            const anyVisible =
              (fromPos.left <= viewportRight && fromRight >= viewportLeft) ||
              (toPos.left <= viewportRight && toRight >= viewportLeft)

            if (!anyVisible) return null

            const sourceRect: BarRect = {
              left: fromPos.left,
              top: fromRowIdx * rowHeight,
              width: fromPos.width,
              height: rowHeight,
            }
            const targetRect: BarRect = {
              left: toPos.left,
              top: toRowIdx * rowHeight,
              width: toPos.width,
              height: rowHeight,
            }

            const route = dependencyRoutes.get(dep.id)
            const d = computeDependencyCurvePath(sourceRect, targetRect, route)
            return {
              dep,
              d,
              targetPoint: {
                x: targetRect.left,
                y:
                  targetRect.top +
                  targetRect.height / 2 +
                  (route?.targetPortOffsetY ?? 0),
              },
            }
          })
          .filter(Boolean) as Array<{
          dep: TimelineDependency
          d: string
          targetPoint: { x: number; y: number }
        }>
      }, [
        dependenciesEnabled,
        dependenciesList,
        dependencyRoutes,
        items,
        origin,
        rowHeight,
        rowIndexMap,
        scrollLeft,
        viewportMode,
        viewportWidth,
      ])

      const updateLivePaths = useCallback(() => {
        const state = store.getState()
        const linkPreview = createTimelineLinkPreview(
          state.items,
          state.rangeHighlight,
          state.dragState,
          origin,
          state.viewportMode
        )

        for (const dependency of dependenciesList ?? []) {
          const path = pathRefs.current.get(dependency.id)
          const hitArea = hitAreaRefs.current.get(dependency.id)
          const group = groupRefs.current.get(dependency.id)
          const removeControl = removeControlRefs.current.get(dependency.id)
          if (!path && !hitArea && !group && !removeControl) continue

          const fromItem = state.items.get(dependency.fromItemId)
          const toItem = state.items.get(dependency.toItemId)
          const fromRowIndex = rowIndexMap.get(dependency.fromItemId)
          const toRowIndex = rowIndexMap.get(dependency.toItemId)
          if (
            !fromItem ||
            !toItem ||
            fromRowIndex === undefined ||
            toRowIndex === undefined
          ) {
            continue
          }

          const fromPosition = getTimelineLinkPosition(
            linkPreview,
            dependency.fromItemId,
            fromItem,
            origin,
            state.viewportMode
          )
          const toPosition = getTimelineLinkPosition(
            linkPreview,
            dependency.toItemId,
            toItem,
            origin,
            state.viewportMode
          )
          const route = dependencyRoutes.get(dependency.id)
          const nextPath = computeDependencyCurvePath(
            {
              left: fromPosition.left,
              top: fromRowIndex * state.rowHeight,
              width: fromPosition.width,
              height: state.rowHeight,
            },
            {
              left: toPosition.left,
              top: toRowIndex * state.rowHeight,
              width: toPosition.width,
              height: state.rowHeight,
            },
            route
          )
          const isLive =
            isTimelineLinkItemLive(linkPreview, dependency.fromItemId) ||
            isTimelineLinkItemLive(linkPreview, dependency.toItemId)

          path?.setAttribute("d", nextPath)
          hitArea?.setAttribute("d", nextPath)
          removeControl?.setAttribute(
            "transform",
            `translate(${toPosition.left} ${
              toRowIndex * state.rowHeight +
              state.rowHeight / 2 +
              (route?.targetPortOffsetY ?? 0)
            })`
          )
          if (group) {
            if (isLive) group.dataset.live = "true"
            else delete group.dataset.live
          }
        }
      }, [dependenciesList, dependencyRoutes, origin, rowIndexMap, store])

      useEffect(() => {
        if (!dependenciesEnabled) return
        let frameId: number | null = null
        const scheduleUpdate = () => {
          if (frameId !== null) return
          frameId = requestAnimationFrame(() => {
            frameId = null
            updateLivePaths()
          })
        }
        const unsubscribe = store.subscribe((state, previousState) => {
          if (
            state.rangeHighlight === previousState.rangeHighlight &&
            state.dragState === previousState.dragState
          ) {
            return
          }
          scheduleUpdate()
        })

        return () => {
          unsubscribe()
          if (frameId !== null) cancelAnimationFrame(frameId)
        }
      }, [dependenciesEnabled, store, updateLivePaths])

      const removeDependency = useCallback(
        (dependency: TimelineDependency) => {
          if (mutations && onMutation) {
            void mutations.dispatch({ type: "dependency-remove", dependency })
          } else {
            onDependencyRemove?.(dependency)
          }
        },
        [mutations, onDependencyRemove, onMutation]
      )
      const canRemoveDependency = useCallback(
        (dep: TimelineDependency) => {
          const from = items.get(dep.fromItemId)
          const to = items.get(dep.toItemId)
          return (
            !readOnly &&
            Boolean(onDependencyRemove || onMutation) &&
            (!from || getItemPermissions?.(from).dependencies !== false) &&
            (!to || getItemPermissions?.(to).dependencies !== false)
          )
        },
        [getItemPermissions, items, onDependencyRemove, onMutation, readOnly]
      )

      if (
        !dependenciesEnabled ||
        (paths.length === 0 && editorState.type === "idle")
      ) {
        return null
      }

      return (
        <svg
          ref={ref}
          data-testid="timeline-dependency-layer"
          className="pointer-events-none absolute inset-0 z-20"
          style={{ width: contentWidth, height: contentHeight }}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 7 7"
              refX="6"
              refY="3.5"
              markerWidth="7"
              markerHeight="7"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path
                d="M 1.1 1.15 L 5.85 3.5 L 1.1 5.85"
                fill="none"
                stroke="context-stroke"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>

          {paths.map(({ dep, d, targetPoint }) => (
            <g
              key={dep.id}
              ref={(node) => {
                if (node) groupRefs.current.set(dep.id, node)
                else groupRefs.current.delete(dep.id)
              }}
              className="group pointer-events-auto outline-none"
              data-dependency-type={dep.type}
              data-timeline-dependency="true"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <title>
                {canRemoveDependency(dep)
                  ? "Dependency — use the red × at its destination to remove"
                  : "Dependency"}
              </title>
              <path
                ref={(node) => {
                  if (node) hitAreaRefs.current.set(dep.id, node)
                  else hitAreaRefs.current.delete(dep.id)
                }}
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                strokeLinecap="round"
                data-testid={`dependency-hit-area-${dep.id}`}
              />
              <path
                ref={(node) => {
                  if (node) pathRefs.current.set(dep.id, node)
                  else pathRefs.current.delete(dep.id)
                }}
                data-testid={`dependency-path-${dep.id}`}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none text-amber-500/65 transition-[color,opacity,stroke-width] duration-150 group-hover:[stroke-width:2] group-hover:text-amber-500 group-data-[live=true]:[stroke-width:2] group-data-[live=true]:text-amber-500/95 dark:text-amber-400/65 dark:group-hover:text-amber-400 dark:group-data-[live=true]:text-amber-400/95"
                markerEnd={`url(#${markerId})`}
              />

              {canRemoveDependency(dep) && (
                <g
                  ref={(node) => {
                    if (node) removeControlRefs.current.set(dep.id, node)
                    else removeControlRefs.current.delete(dep.id)
                  }}
                  data-testid={`dependency-remove-${dep.id}`}
                  transform={`translate(${targetPoint.x} ${targetPoint.y})`}
                  className="pointer-events-none cursor-pointer text-red-500 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100 focus:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove dependency from ${dep.fromItemId} to ${dep.toItemId}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeDependency(dep)
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "Enter" &&
                      event.key !== " " &&
                      event.key !== "Delete" &&
                      event.key !== "Backspace"
                    ) {
                      return
                    }
                    event.preventDefault()
                    removeDependency(dep)
                  }}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={9}
                    fill="transparent"
                    stroke="none"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={6.25}
                    fill="var(--background)"
                    stroke="currentColor"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M -2 -2 L 2 2 M 2 -2 L -2 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.25}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
            </g>
          ))}

          {editorState.type === "linking" && (
            <g data-testid="dependency-draft" className="text-amber-500">
              <path
                ref={draftPathRef}
                d={`M ${editorState.source.x} ${editorState.source.y}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="text-amber-500 drop-shadow-[0_2px_5px_rgb(245_158_11/0.35)] transition-colors duration-100 data-[backward]:text-red-400/80 dark:data-[backward]:text-red-400/75"
                markerEnd={`url(#${markerId})`}
              />
              <circle
                ref={draftEndpointRef}
                cx={editorState.source.x}
                cy={editorState.source.y}
                r={4}
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                className="transition-[r,fill] duration-100 data-[snapped]:fill-amber-500 data-[snapped]:[r:5]"
              />
            </g>
          )}
        </svg>
      )
    }
  )
)
