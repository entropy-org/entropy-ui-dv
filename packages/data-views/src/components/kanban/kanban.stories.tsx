import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Kanban, KanbanProvider } from "./index.js"
import type { KanbanCard, KanbanCommand, KanbanGroup, KanbanPreferences, KanbanSwimlane } from "./types.js"

const groups: readonly KanbanGroup[] = [
  { id: "backlog", rank: "a", data: { title: "Backlog" }, wipLimit: { type: "warning", maximum: 4 } },
  { id: "progress", rank: "b", data: { title: "In progress" }, wipLimit: { type: "hard", maximum: 3 } },
  { id: "review", rank: "c", data: { title: "Review" } },
  { id: "done", rank: "d", data: { title: "Done" } },
]

const initialCards: readonly KanbanCard[] = [
  { id: "design", groupId: "backlog", rank: "a", data: { title: "Design keyboard navigation", owner: "Ana" } },
  { id: "tokens", groupId: "backlog", rank: "b", data: { title: "Audit design tokens", owner: "Mo" } },
  { id: "drag", groupId: "progress", rank: "a", data: { title: "Pointer drag behavior", owner: "Lee" } },
  { id: "docs", groupId: "review", rank: "a", data: { title: "Consumer documentation", owner: "Sam" } },
  { id: "model", groupId: "done", rank: "a", data: { title: "Normalize display model", owner: "Ana" } },
]

const lanes: readonly KanbanSwimlane[] = [
  { id: "product", rank: "a", data: { title: "Product" } },
  { id: "platform", rank: "b", data: { title: "Platform" } },
]

const defaults: KanbanPreferences = { density: "comfortable", columnWidth: 288, collapsedGroupIds: [], collapsedSwimlaneIds: [], showWipLimits: true }

function titleOf(value: { readonly data: unknown }) { return (value.data as { title: string }).title }

function ControlledBoard({ sourceCards = initialCards, sourceGroups = groups, sourceLanes, readOnly = false, initialPreferences = defaults }: { readonly sourceCards?: readonly KanbanCard[]; readonly sourceGroups?: readonly KanbanGroup[]; readonly sourceLanes?: readonly KanbanSwimlane[]; readonly readOnly?: boolean; readonly initialPreferences?: KanbanPreferences }) {
  const [cards, setCards] = useState(sourceCards)
  const [preferences, setPreferences] = useState(initialPreferences)
  const handleCommand = (command: KanbanCommand) => {
    if (command.type === "delete-cards") setCards((current) => current.filter((card) => !command.cardIds.includes(card.id)))
    if (command.type === "move-cards") setCards((current) => current.map((card) => command.cardIds.includes(card.id) ? { ...card, groupId: command.destination.groupId, ...(command.destination.swimlaneId === undefined ? { swimlaneId: undefined } : { swimlaneId: command.destination.swimlaneId }), rank: `m-${command.cardIds.indexOf(card.id)}-${card.id}` } : card))
    if (command.type === "duplicate-cards") setCards((current) => [...current, ...command.sourceCardIds.flatMap((id, index) => { const source = current.find((card) => card.id === id); return source ? [{ ...source, id: `${source.id}-copy-${current.length}`, groupId: command.destination.groupId, ...(command.destination.swimlaneId === undefined ? { swimlaneId: undefined } : { swimlaneId: command.destination.swimlaneId }), rank: `copy-${index}-${source.id}` }] : [] })])
  }
  return <KanbanProvider config={{ cards, groups: sourceGroups, ...(sourceLanes ? { swimlanes: sourceLanes } : {}), preferences, readOnly, renderCard: (card, state) => { const data = card.data as { title: string; owner?: string }; return <div><p className="font-medium">{data.title}</p>{data.owner ? <p className="mt-2 text-[10px] text-muted-foreground">{data.owner}{state.pending ? " · Saving…" : ""}</p> : null}</div> }, renderGroupHeader: (group) => titleOf(group), renderSwimlaneHeader: (lane) => titleOf(lane), getCardLabel: titleOf, getGroupLabel: titleOf, getSwimlaneLabel: titleOf, getSearchText: titleOf, onCommand: handleCommand, onPreferencesChange: setPreferences, onAddCard: ({ groupId, swimlaneId }) => setCards((current) => [...current, { id: `new-${current.length}`, groupId, ...(swimlaneId ? { swimlaneId } : {}), rank: `new-${current.length}`, data: { title: "New card" } }]) }}><Kanban className="h-[680px] rounded-xl border" /></KanbanProvider>
}

const meta = { title: "Components/Kanban", component: Kanban, parameters: { layout: "fullscreen" }, decorators: [(Story) => <div className="min-h-screen bg-background p-6 text-foreground"><Story /></div>] } satisfies Meta<typeof Kanban>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <ControlledBoard /> }
export const Compact: Story = { render: () => <ControlledBoard initialPreferences={{ ...defaults, density: "compact", columnWidth: 248 }} /> }
export const ReadOnly: Story = { render: () => <ControlledBoard readOnly /> }
export const Empty: Story = { render: () => <ControlledBoard sourceCards={[]} sourceGroups={[]} /> }
export const EmptyColumns: Story = { render: () => <ControlledBoard sourceCards={[]} /> }
export const Swimlanes: Story = { render: () => <ControlledBoard sourceCards={initialCards.map((card, index) => ({ ...card, swimlaneId: index % 2 ? "platform" : "product" }))} sourceLanes={lanes} /> }
export const WipExceeded: Story = { render: () => <ControlledBoard sourceCards={[...initialCards, ...[0, 1, 2, 3].map((index) => ({ id: `extra-${index}`, groupId: "progress", rank: `x-${index}`, data: { title: `Limit card ${index + 1}` } }))]} /> }
export const Dark: Story = { render: () => <div className="dark"><ControlledBoard /></div>, parameters: { backgrounds: { default: "dark" } } }

export const Benchmark5000: Story = {
  render: function BenchmarkStory() {
    const benchmarkGroups = useMemo(() => Array.from({ length: 100 }, (_, index) => ({ id: `g-${index}`, rank: index.toString().padStart(3, "0"), data: { title: `Group ${index + 1}` }, ...(index % 12 === 0 ? { wipLimit: { type: "warning" as const, maximum: 60 } } : {}) })), [])
    const benchmarkCards = useMemo(() => Array.from({ length: 5_000 }, (_, index) => ({ id: `card-${index}`, groupId: `g-${index % 100}`, rank: Math.floor(index / 100).toString().padStart(4, "0"), data: { title: `Benchmark card ${index + 1}`, owner: `Owner ${index % 16}` } })), [])
    return <ControlledBoard sourceCards={benchmarkCards} sourceGroups={benchmarkGroups} />
  },
}
