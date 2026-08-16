import type { KanbanPreferences } from "./types.js"

export const KANBAN_DENSITIES = ["compact", "comfortable"] as const
export const KANBAN_MIN_COLUMN_WIDTH = 240
export const KANBAN_MAX_COLUMN_WIDTH = 520
export const KANBAN_COLUMN_WIDTH_STEP = 20
export const KANBAN_DEFAULT_HISTORY_LIMIT = 50
export const KANBAN_DEFAULT_OVERSCAN = 6
export const KANBAN_POINTER_ACTIVATION_DISTANCE = 6
export const KANBAN_VIRTUALIZATION_THRESHOLD = 40
export const KANBAN_GROUP_VIRTUALIZATION_THRESHOLD = 20

export const KANBAN_DEFAULT_PREFERENCES: KanbanPreferences = {
  density: "comfortable",
  columnWidth: 288,
  collapsedGroupIds: [],
  collapsedSwimlaneIds: [],
  showWipLimits: true,
}

export function resolveKanbanPreferences(
  preferences?: Partial<KanbanPreferences>
): KanbanPreferences {
  return {
    ...KANBAN_DEFAULT_PREFERENCES,
    ...preferences,
    columnWidth: Math.min(
      KANBAN_MAX_COLUMN_WIDTH,
      Math.max(
        KANBAN_MIN_COLUMN_WIDTH,
        preferences?.columnWidth ?? KANBAN_DEFAULT_PREFERENCES.columnWidth
      )
    ),
    collapsedGroupIds: [...(preferences?.collapsedGroupIds ?? [])],
    collapsedSwimlaneIds: [...(preferences?.collapsedSwimlaneIds ?? [])],
  }
}
