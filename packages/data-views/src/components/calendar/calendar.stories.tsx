import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Calendar,
  CalendarProvider,
  createDefaultCalendarPreferences,
  useCalendarStore,
  type CalendarConfig,
  type CalendarItem,
  type CalendarMutationCommand,
  type CalendarPreferences,
} from "./index.js"
import { cn } from "../../lib/utils.js"

type StoryData = { title: string; color?: string }

const denseItems: CalendarItem[] = [
  {
    id: "roadmap",
    calendarId: "work",
    kind: "all-day",
    startDate: "2026-08-03",
    endDate: "2026-08-12",
    data: { title: "Roadmap review" },
  },
  {
    id: "launch",
    calendarId: "work",
    kind: "all-day",
    startDate: "2026-08-10",
    endDate: "2026-08-14",
    data: { title: "Launch window" },
  },
  {
    id: "design",
    calendarId: "work",
    kind: "all-day",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    data: { title: "Design critique" },
  },
  {
    id: "research",
    calendarId: "work",
    kind: "all-day",
    startDate: "2026-08-10",
    endDate: "2026-08-11",
    data: { title: "Research synthesis" },
  },
  {
    id: "holiday",
    calendarId: "personal",
    kind: "all-day",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    data: { title: "Holiday" },
  },
  {
    id: "demo",
    calendarId: "work",
    kind: "timed",
    start: new Date("2026-08-13T17:30:00.000Z"),
    end: new Date("2026-08-13T18:30:00.000Z"),
    data: { title: "Customer demo" },
  },
  {
    id: "planning",
    calendarId: "work",
    kind: "timed",
    start: new Date("2026-08-10T16:00:00.000Z"),
    end: new Date("2026-08-10T18:00:00.000Z"),
    data: { title: "Weekly planning" },
  },
  {
    id: "overlap-demo",
    calendarId: "personal",
    kind: "timed",
    start: new Date("2026-08-10T16:30:00.000Z"),
    end: new Date("2026-08-10T17:30:00.000Z"),
    data: { title: "Appointment" },
  },
  {
    id: "overnight",
    calendarId: "work",
    kind: "timed",
    start: new Date("2026-08-12T06:30:00.000Z"),
    end: new Date("2026-08-12T09:00:00.000Z"),
    data: { title: "Release monitoring" },
  },
  {
    id: "offscreen",
    calendarId: "work",
    kind: "all-day",
    startDate: "2026-07-28",
    endDate: "2026-08-04",
    data: { title: "Continues into August" },
  },
]

const thousandItems: CalendarItem[] = Array.from(
  { length: 1000 },
  (_, index) => ({
    id: `load-${index}`,
    calendarId: "work",
    kind: "all-day" as const,
    startDate: `2026-08-${String(1 + (index % 28)).padStart(2, "0")}`,
    endDate: `2026-08-${String(1 + (index % 28)).padStart(2, "0")}`,
    data: { title: `Load event ${index + 1}` },
  })
)

const agendaBenchmarkItems: CalendarItem[] = Array.from({ length: 5000 }, (_, index) => {
  const visible = index < 1000
  const day = visible ? 10 + (index % 5) : 1 + (index % 28)
  const hour = 6 + (index % 14)
  const start = new Date(Date.UTC(2026, visible ? 7 : 9, day, hour, (index % 4) * 15))
  return {
    id: `agenda-load-${index}`,
    calendarId: index % 3 === 0 ? "personal" : "work",
    kind: "timed" as const,
    start,
    end: new Date(start.getTime() + (30 + (index % 4) * 15) * 60_000),
    data: { title: `Agenda event ${index + 1}` },
  }
})

function applyCommand(
  items: readonly CalendarItem[],
  command: CalendarMutationCommand
): CalendarItem[] {
  if (command.type === "delete") {
    const deleted = new Set(command.itemIds)
    return items.filter((item) => !deleted.has(item.id))
  }
  if (command.type === "restore") return [...items]
  const changes =
    command.type === "move"
      ? new Map(
          command.changes.map((change) => [change.itemId, change.nextRange])
        )
      : new Map([[command.itemId, command.nextRange]])
  return items.map((item) => {
    const range = changes.get(item.id)
    if (!range || range.kind !== item.kind) return item
    return range.kind === "all-day" && item.kind === "all-day"
      ? { ...item, startDate: range.startDate, endDate: range.endDate }
      : range.kind === "timed" && item.kind === "timed"
        ? { ...item, start: range.start, end: range.end }
        : item
  })
}

function InitialSelection({ ids }: { readonly ids: readonly string[] }) {
  const actions = useCalendarStore((state) => state.actions)
  useEffect(() => actions.replaceSelection(ids, ids[0]), [actions, ids])
  return null
}

type CalendarStoryProps = {
  readonly initialItems?: readonly CalendarItem[]
  readonly preferences?: Partial<CalendarPreferences>
  readonly readOnly?: boolean
  readonly invalid?: boolean
  readonly selectedIds?: readonly string[]
  readonly dark?: boolean
  readonly customRenderer?: boolean
  readonly rendererError?: boolean
  readonly reducedMotion?: boolean
  readonly width?: number
}

function CalendarStory({
  initialItems = denseItems,
  preferences: preferenceOverrides,
  readOnly,
  invalid,
  selectedIds = [],
  dark,
  customRenderer,
  rendererError,
  reducedMotion,
  width = 1664,
}: CalendarStoryProps) {
  const [items, setItems] = useState<readonly CalendarItem[]>(() =>
    invalid
      ? [
          ...initialItems,
          {
            id: "invalid",
            kind: "all-day",
            startDate: "2026-08-20",
            endDate: "2026-08-10",
            data: { title: "Invalid range" },
          },
        ]
      : initialItems
  )
  const [preferences, setPreferences] = useState<CalendarPreferences>(() => ({
    ...createDefaultCalendarPreferences("America/Los_Angeles"),
    weekStartsOn: 1,
    maxVisibleLanes: 3,
    ...preferenceOverrides,
  }))
  const config: CalendarConfig = {
    items,
    preferences,
    initialAnchorDate: "2026-08-10",
    locale: "en-US",
    readOnly,
    now: () => new Date("2026-08-10T16:00:00.000Z"),
    getSearchText: (item) => (item.data as StoryData).title,
    getItemAriaLabel: (item) => (item.data as StoryData).title,
    renderItem: (item, state) => {
      if (rendererError) throw new Error("Story renderer failure")
      const data = item.data as StoryData
      return customRenderer ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-current" />
          <span className="truncate">
            {data.title}
            {state.isSelected ? " · selected" : ""}
          </span>
        </span>
      ) : (
        data.title
      )
    },
    renderTooltip: (item) => (item.data as StoryData).title,
    onItemMutation: (command) =>
      setItems((current) => applyCommand(current, command)),
    onPreferencesChange: setPreferences,
    onItemCreate: (range) => {
      setItems((current) => [
        ...current,
        range.kind === "all-day"
          ? {
              id: `created-${current.length}`,
              kind: "all-day",
              startDate: range.startDate,
              endDate: range.endDate,
              data: { title: "New event" },
            }
          : {
              id: `created-${current.length}`,
              kind: "timed",
              start: range.start,
              end: range.end,
              data: { title: "New event" },
            },
      ])
    },
    onItemDuplicate: (selected) => {
      setItems((current) => [
        ...current,
        ...selected.map((item, index) => ({ ...item, id: `${item.id}-copy-${current.length + index}` })),
      ])
    },
    agenda: {
      sidebar: {
        type: "default",
        defaultWidth: 220,
        resizable: true,
        calendars: [
          { id: "work", label: "Work", color: "var(--primary)" },
          { id: "personal", label: "Personal", color: "var(--destructive)" },
        ],
      },
    },
  }
  return (
    <div
      data-reduced-motion={reducedMotion || undefined}
      className={cn(
        "bg-background p-4",
        dark && "dark",
        reducedMotion && "[&_*]:!animate-none [&_*]:!transition-none"
      )}
      style={{ width }}
    >
      <CalendarProvider config={config}>
        <InitialSelection ids={selectedIds} />
        <Calendar className="h-[760px] border" />
      </CalendarProvider>
    </div>
  )
}

const meta = {
  title: "Components/Calendar",
  component: CalendarStory,
  parameters: { layout: "fullscreen", a11y: { test: "error" } },
} satisfies Meta<typeof CalendarStory>

export default meta
type Story = StoryObj<typeof meta>

export const DenseMonth: Story = {}
export const Empty: Story = { args: { initialItems: [] } }
export const OneItem: Story = { args: { initialItems: [denseItems[1]] } }
export const Week: Story = { args: { preferences: { viewMode: "week" } } }
export const AgendaWeek: Story = { args: { preferences: { viewMode: "agenda" } } }
export const AgendaDay: Story = {
  args: {
    preferences: {
      viewMode: "agenda",
      agenda: {
        ...createDefaultCalendarPreferences("America/Los_Angeles").agenda,
        span: { type: "day" },
      },
    },
  },
}
export const AgendaFiveDayWorkWeek: Story = {
  args: {
    preferences: {
      viewMode: "agenda",
      showWeekends: false,
      agenda: {
        ...createDefaultCalendarPreferences("America/Los_Angeles").agenda,
        span: { type: "custom", dayCount: 5 },
      },
    },
  },
}
export const AgendaNineDays: Story = {
  args: {
    preferences: {
      viewMode: "agenda",
      agenda: {
        ...createDefaultCalendarPreferences("America/Los_Angeles").agenda,
        span: { type: "custom", dayCount: 9 },
      },
    },
  },
}
export const AgendaDark: Story = { args: { preferences: { viewMode: "agenda" }, dark: true } }
export const AgendaReadOnly: Story = { args: { preferences: { viewMode: "agenda" }, readOnly: true } }
export const MultiSelected: Story = {
  args: { selectedIds: ["roadmap", "launch", "design"] },
}
export const ReadOnly: Story = { args: { readOnly: true } }
export const InvalidItems: Story = { args: { invalid: true } }
export const CustomRenderer: Story = { args: { customRenderer: true } }
export const Dark: Story = { args: { dark: true } }
export const MinimumDesktopWidth: Story = { args: { width: 960 } }
export const ContainedBelowMinimumWidth: Story = { args: { width: 720 } }
export const ReducedMotion: Story = { args: { reducedMotion: true } }
export const RendererFailure: Story = { args: { rendererError: true } }
export const ThousandItemMonth: Story = {
  args: { initialItems: thousandItems },
}
export const AgendaFiveThousandItems: Story = {
  args: { initialItems: agendaBenchmarkItems, preferences: { viewMode: "agenda" } },
}
