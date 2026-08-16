import type { KanbanCard, KanbanConfig, KanbanGroup, KanbanPreferences, KanbanSwimlane } from "../types.js"

export const testGroups: readonly KanbanGroup[] = [
  { id: "todo", rank: "a", data: { title: "To do" }, wipLimit: { type: "warning", maximum: 2 } },
  { id: "doing", rank: "b", data: { title: "Doing" }, wipLimit: { type: "hard", maximum: 2 } },
  { id: "done", rank: "c", data: { title: "Done" } },
]

export const testCards: readonly KanbanCard[] = [
  { id: "one", groupId: "todo", rank: "a", data: { title: "First task" } },
  { id: "two", groupId: "todo", rank: "b", data: { title: "Second task" } },
  { id: "three", groupId: "doing", rank: "a", data: { title: "Third task" } },
]

export const testLanes: readonly KanbanSwimlane[] = [
  { id: "high", rank: "a", data: { title: "High priority" } },
  { id: "low", rank: "b", data: { title: "Low priority" } },
]

export const testPreferences: KanbanPreferences = {
  density: "comfortable",
  columnWidth: 280,
  collapsedGroupIds: [],
  collapsedSwimlaneIds: [],
  showWipLimits: true,
}

export function createTestKanbanConfig(overrides: Partial<KanbanConfig> = {}): KanbanConfig {
  return {
    cards: testCards,
    groups: testGroups,
    preferences: testPreferences,
    renderCard: (card) => (card.data as { title: string }).title,
    renderGroupHeader: (group) => (group.data as { title: string }).title,
    getCardLabel: (card) => (card.data as { title: string }).title,
    getGroupLabel: (group) => (group.data as { title: string }).title,
    getSearchText: (card) => (card.data as { title: string }).title,
    ...overrides,
  }
}
