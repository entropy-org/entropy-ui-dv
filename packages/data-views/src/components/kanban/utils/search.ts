import type { KanbanCard } from "../types.js"

export function normalizeKanbanSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase()
}

export function defaultKanbanSearchText(card: KanbanCard) {
  if (typeof card.data === "string" || typeof card.data === "number") {
    return `${card.id} ${String(card.data)}`
  }
  return card.id
}
