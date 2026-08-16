/**
 * Hook: useKeyboardShortcuts
 *
 * Registers global `keydown` listeners and dispatches the correct Zustand
 * store actions for all timeline keyboard shortcuts.
 *
 * | Shortcut               | Action                                   |
 * |------------------------|------------------------------------------|
 * | `Delete` / `Backspace` | Delete selected items                    |
 * | `Ctrl+Z`               | Undo                                     |
 * | `Ctrl+Shift+Z`         | Redo                                     |
 * | `Escape`               | Cancel drag / clear selection            |
 * | `+` / `=`              | Zoom in (finer viewport mode)            |
 * | `-`                    | Zoom out (coarser viewport mode)         |
 * | `Ctrl+A`               | Select all items                         |
 * | `Ctrl+D`               | Duplicate selected items                 |
 * | `T`                    | Scroll to today                          |
 *
 * The listener is attached to `document` so it works regardless of which
 * element is focused. It is removed on unmount.
 */
import { useEffect, useCallback, useContext } from "react"
import { useTimelineStore } from "./use-timeline-store.js"
import { VIEWPORT_MODES_ORDERED } from "../constants.js"
import type { ViewportMode } from "../types.js"
import { useOptionalTimelineMutations } from "../context/timeline-mutation-context.js"
import { TimelineConfigContext } from "../context/timeline-config-context.js"
import { TimelineContext } from "../context/timeline-context.js"

/**
 * Registers global keyboard shortcuts for the timeline.
 * Must be called inside a `<TimelineProvider>` tree.
 */
export function useKeyboardShortcuts(): void {
  const actions = useTimelineStore((s) => s.actions)
  const viewportMode = useTimelineStore((s) => s.viewportMode)
  const dragState = useTimelineStore((s) => s.dragState)
  const store = useContext(TimelineContext)
  const mutations = useOptionalTimelineMutations()
  const onMutation = useContext(TimelineConfigContext)?.onMutation

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement | null
      const isTextEntry =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable

      if (isTextEntry) return
      const current = store?.getState()
      if (!current) return
      const currentReadOnly = current.readOnly
      const currentSelectedIds = current.selectedIds
      const currentItems = current.items

      // ── Escape ────────────────────────────────────────────────────────
      if (e.key === "Escape") {
        if (dragState) {
          actions.endDrag()
        }
        actions.clearSelection()
        actions.clearActiveDependencyPort()
        return
      }

      // ── Delete / Backspace ────────────────────────────────────────────
      if (e.key === "Delete" || e.key === "Backspace") {
        if (currentReadOnly || currentSelectedIds.size === 0) return
        if (mutations && onMutation) {
          const itemIds = [...currentSelectedIds]
          const previousItems = itemIds.flatMap((id) => {
            const item = currentItems.get(id)
            return item ? [item] : []
          })
          void mutations.dispatch({ type: "delete", itemIds, previousItems })
        } else {
          actions.deleteSelected()
        }
        return
      }

      // ── Ctrl+A ────────────────────────────────────────────────────────
      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault()
        actions.selectAll()
        return
      }

      // ── Ctrl+D → Duplicate ─────────────────────────────────────────
      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault()
        if (currentReadOnly || currentSelectedIds.size === 0) return
        if (mutations && onMutation) {
          const itemIds = [...currentSelectedIds]
          const previousItems = itemIds.flatMap((id) => {
            const item = currentItems.get(id)
            return item ? [item] : []
          })
          void mutations.dispatch({
            type: "bulk",
            itemIds,
            action: "duplicate",
            previousItems,
          })
        } else {
          actions.duplicateSelected()
        }
        return
      }

      // ── Ctrl+Shift+Z → Redo ───────────────────────────────────────────
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (mutations && onMutation) {
          void mutations.dispatch({
            type: "bulk",
            itemIds: [],
            action: "custom",
            payload: { command: "redo" },
            previousItems: [],
          })
        } else actions.redo()
        return
      }

      // ── Ctrl+Z → Undo ─────────────────────────────────────────────────
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (mutations && onMutation) {
          void mutations.dispatch({
            type: "bulk",
            itemIds: [],
            action: "custom",
            payload: { command: "undo" },
            previousItems: [],
          })
        } else actions.undo()
        return
      }

      // ── Zoom in: + or = ──────────────────────────────────────────────
      if (e.key === "+" || e.key === "=") {
        const idx = VIEWPORT_MODES_ORDERED.indexOf(viewportMode)
        if (idx > 0) {
          actions.setViewportMode(
            VIEWPORT_MODES_ORDERED[idx - 1] as ViewportMode
          )
        }
        return
      }

      // ── Zoom out: - ──────────────────────────────────────────────────
      if (e.key === "-") {
        const idx = VIEWPORT_MODES_ORDERED.indexOf(viewportMode)
        if (idx < VIEWPORT_MODES_ORDERED.length - 1) {
          actions.setViewportMode(
            VIEWPORT_MODES_ORDERED[idx + 1] as ViewportMode
          )
        }
        return
      }

      // ── T → Scroll to today ──────────────────────────────────────────
      if (e.key.toLowerCase() === "t" && !ctrl) {
        actions.scrollToToday()
        return
      }
    },
    [
      actions,
      dragState,
      mutations,
      onMutation,
      store,
      viewportMode,
    ]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])
}
