import { useCallback } from "react"
import { useKanbanConfig } from "../context/kanban-config-context.js"
import { useKanbanData } from "../context/kanban-data-context.js"
import type { KanbanPreferenceChange, KanbanPreferences } from "../types.js"

export function applyKanbanPreferenceChange(
  preferences: KanbanPreferences,
  change: KanbanPreferenceChange
): KanbanPreferences {
  switch (change.type) {
    case "density": return { ...preferences, density: change.value }
    case "column-width": return { ...preferences, columnWidth: change.value }
    case "wip-visibility": return { ...preferences, showWipLimits: change.value }
    case "group-collapsed": {
      const ids = new Set(preferences.collapsedGroupIds)
      if (change.collapsed) ids.add(change.groupId)
      else ids.delete(change.groupId)
      return { ...preferences, collapsedGroupIds: [...ids] }
    }
    case "swimlane-collapsed": {
      const ids = new Set(preferences.collapsedSwimlaneIds)
      if (change.collapsed) ids.add(change.swimlaneId)
      else ids.delete(change.swimlaneId)
      return { ...preferences, collapsedSwimlaneIds: [...ids] }
    }
  }
}

export function useKanbanPreferencesChange() {
  const config = useKanbanConfig()
  const { preferences } = useKanbanData()
  return useCallback((change: KanbanPreferenceChange) => {
    if (config.readOnly && (change.type === "group-collapsed" || change.type === "swimlane-collapsed")) return
    config.onPreferencesChange?.(applyKanbanPreferenceChange(preferences, change), change)
  }, [config, preferences])
}
