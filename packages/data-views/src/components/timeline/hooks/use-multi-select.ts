/**
 * Hook: useMultiSelect
 *
 * Translates pointer-event modifier keys (shift, ctrl/cmd) into the correct
 * Zustand store `select` mode:
 *
 * | Modifiers       | Mode      | Effect                             |
 * |-----------------|-----------|------------------------------------|
 * | none            | 'replace' | Replace entire selection           |
 * | shift           | 'range'   | Extend selection to clicked item   |
 * | ctrl / cmd      | 'toggle'  | Add or remove item from selection  |
 *
 * Returns a stable `handleClick` callback — attach it to bar click handlers.
 */
import { useCallback } from "react"
import { useTimelineStore } from "./use-timeline-store.js"

export interface MultiSelectHandlers {
  /**
   * Call on item click.
   *
   * @param itemId - ID of the clicked item
   * @param shiftKey - Whether Shift was held
   * @param ctrlOrMeta - Whether Ctrl or Meta (Cmd) was held
   */
  handleClick: (itemId: string, shiftKey: boolean, ctrlOrMeta: boolean) => void
}

/**
 * Provides click handlers that translate modifier keys → Zustand `select` modes.
 *
 * @returns Object with `handleClick` handler
 */
export function useMultiSelect(): MultiSelectHandlers {
  const select = useTimelineStore((s) => s.actions.select)

  const handleClick = useCallback(
    (itemId: string, shiftKey: boolean, ctrlOrMeta: boolean) => {
      if (shiftKey) {
        select(itemId, "range")
      } else if (ctrlOrMeta) {
        select(itemId, "toggle")
      } else {
        select(itemId, "replace")
      }
    },
    [select]
  )

  return { handleClick }
}
