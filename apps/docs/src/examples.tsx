import { useMemo, useState } from "react"
import {
  DataViewFormSurface,
  DataViewRecordFormFields,
  DataViewThemeProvider,
  DatabaseViews,
  createSavedDataView,
  type DataViewFlowState,
  type DataViewIntent,
  type DataViewPropertyId,
  type DataViewSchema,
  type SavedDataView,
} from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"
import {
  Calendar,
  CalendarProvider,
  createDefaultCalendarPreferences,
  type CalendarItem,
  type CalendarMutationCommand,
  type CalendarPreferences,
} from "@entropy-ui/data-views/calendar"
import {
  Kanban,
  KanbanProvider,
  type KanbanCard,
  type KanbanCommand,
  type KanbanGroup,
} from "@entropy-ui/data-views/kanban"
import {
  DataList,
  DataListProvider,
  type DataListItem,
  type DataListProperty,
} from "@entropy-ui/data-views/list"
import {
  Timeline,
  TimelineProvider,
  type TimelineItem,
} from "@entropy-ui/data-views/timeline"

type WorkRecord = {
  readonly id: string
  readonly title: string
  readonly status: "backlog" | "progress" | "review" | "done"
  readonly owner: string
  readonly priority: "Low" | "Medium" | "High"
  readonly start: Date
  readonly end: Date
}

const STATUS_OPTIONS = [
  { id: "backlog", label: "Backlog" },
  { id: "progress", label: "In progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
] as const

const SEED_RECORDS: readonly WorkRecord[] = [
  {
    id: "research",
    title: "Map customer workflows",
    status: "done",
    owner: "Maya",
    priority: "High",
    start: new Date("2026-08-10T09:00:00-07:00"),
    end: new Date("2026-08-12T17:00:00-07:00"),
  },
  {
    id: "contracts",
    title: "Finalize public contracts",
    status: "progress",
    owner: "Jon",
    priority: "High",
    start: new Date("2026-08-13T09:00:00-07:00"),
    end: new Date("2026-08-18T17:00:00-07:00"),
  },
  {
    id: "tokens",
    title: "Tune semantic color tokens",
    status: "review",
    owner: "Sam",
    priority: "Medium",
    start: new Date("2026-08-15T09:00:00-07:00"),
    end: new Date("2026-08-19T17:00:00-07:00"),
  },
  {
    id: "fixtures",
    title: "Verify consumer fixtures",
    status: "backlog",
    owner: "Maya",
    priority: "Medium",
    start: new Date("2026-08-20T09:00:00-07:00"),
    end: new Date("2026-08-23T17:00:00-07:00"),
  },
  {
    id: "docs",
    title: "Publish examples and guides",
    status: "progress",
    owner: "Lee",
    priority: "High",
    start: new Date("2026-08-16T09:00:00-07:00"),
    end: new Date("2026-08-22T17:00:00-07:00"),
  },
  {
    id: "launch",
    title: "Announce the prerelease",
    status: "backlog",
    owner: "Jon",
    priority: "Low",
    start: new Date("2026-08-25T09:00:00-07:00"),
    end: new Date("2026-08-26T17:00:00-07:00"),
  },
]

const schema: DataViewSchema<WorkRecord> = {
  adapter: {
    getId: (record) => record.id,
    getLabel: (record) => record.title,
  },
  properties: [
    {
      type: "title",
      id: "title",
      label: "Title",
      getValue: (record) => record.title,
    },
    {
      type: "select",
      id: "status",
      label: "Status",
      options: STATUS_OPTIONS,
      getValue: (record) => record.status,
    },
    {
      type: "text",
      id: "owner",
      label: "Owner",
      getValue: (record) => record.owner,
    },
    {
      type: "select",
      id: "priority",
      label: "Priority",
      options: [
        { id: "Low", label: "Low" },
        { id: "Medium", label: "Medium" },
        { id: "High", label: "High" },
      ],
      getValue: (record) => record.priority,
    },
    {
      type: "date",
      id: "start",
      label: "Start",
      getValue: (record) => record.start,
    },
    { type: "date", id: "end", label: "End", getValue: (record) => record.end },
  ],
}

const INITIAL_VIEWS: readonly SavedDataView[] = [
  createSavedDataView({
    id: "all",
    name: "All work",
    definition: {
      type: "list",
      visiblePropertyIds: ["status", "owner", "priority"],
    },
  }),
  createSavedDataView({
    id: "board",
    name: "Board",
    definition: {
      type: "kanban",
      groupByPropertyId: "status",
      visiblePropertyIds: ["owner", "priority"],
    },
  }),
  createSavedDataView({
    id: "calendar",
    name: "Calendar",
    definition: {
      type: "calendar",
      datePropertyId: "start",
      endDatePropertyId: "end",
    },
  }),
  createSavedDataView({
    id: "timeline",
    name: "Timeline",
    definition: {
      type: "timeline",
      startDatePropertyId: "start",
      endDatePropertyId: "end",
    },
  }),
]

export function DatabaseExample({
  theme,
}: {
  readonly theme: "light" | "dark"
}) {
  const [records, setRecords] = useState(SEED_RECORDS)
  const [views, setViews] = useState(INITIAL_VIEWS)
  const [activeViewId, setActiveViewId] = useState("all")
  const [notice, setNotice] = useState(
    "Switch views — the records stay consumer-owned.",
  )
  const [flow, setFlow] = useState<DataViewFlowState<WorkRecord>>({
    mode: "closed",
  })
  const [values, setValues] = useState<
    Readonly<Record<DataViewPropertyId, unknown>>
  >({})
  const plugins = useMemo(() => createBuiltInDataViewPlugins<WorkRecord>(), [])

  const handleIntent = (intent: DataViewIntent<WorkRecord>) => {
    if (intent.type === "create-record") {
      setValues(intent.initialValues ?? {})
      setFlow({
        mode: "create",
        viewId: intent.view.id,
        initialValues: intent.initialValues ?? {},
      })
      setNotice(
        "The library emitted a create intent; this form is owned by the docs app.",
      )
      return
    }
    if (intent.type === "edit-record") {
      setValues({})
      setFlow({ mode: "edit", viewId: intent.view.id, record: intent.record })
      setNotice(`Edit intent received for “${intent.record.title}”.`)
      return
    }
    setNotice(`Intent received: ${intent.type.replaceAll("-", " ")}.`)
  }

  const saveRecord = () => {
    if (flow.mode === "closed") return
    if (flow.mode === "edit") {
      setRecords((current) =>
        current.map((record) =>
          record.id === flow.record.id
            ? {
                ...record,
                title: String(values.title ?? record.title),
                owner: String(values.owner ?? record.owner),
                status: (values.status ??
                  record.status) as WorkRecord["status"],
                priority: (values.priority ??
                  record.priority) as WorkRecord["priority"],
              }
            : record,
        ),
      )
    } else {
      setRecords((current) => [
        ...current,
        {
          id: `record-${current.length + 1}`,
          title: String(values.title || "Untitled work"),
          owner: String(values.owner || "Unassigned"),
          status: (values.status || "backlog") as WorkRecord["status"],
          priority: (values.priority || "Medium") as WorkRecord["priority"],
          start: values.start
            ? new Date(String(values.start))
            : new Date("2026-08-20T09:00:00-07:00"),
          end: values.end
            ? new Date(String(values.end))
            : new Date("2026-08-22T17:00:00-07:00"),
        },
      ])
    }
    setFlow({ mode: "closed" })
    setNotice(
      "Consumer state updated; the same authoritative records now feed every view.",
    )
  }

  return (
    <DataViewThemeProvider theme={theme} className="example-theme">
      <div className="example-notice">
        <span className="status-dot" />
        {notice}
      </div>
      <DatabaseViews
        className="database-example"
        title="Launch workspace"
        description="One source, four saved perspectives"
        source={{
          mode: "client",
          id: "docs",
          label: "Launch workspace",
          records,
        }}
        schema={schema}
        views={views}
        activeViewId={activeViewId}
        onActiveViewIdChange={setActiveViewId}
        onViewsChange={setViews}
        plugins={plugins}
        onIntent={handleIntent}
        flow={flow}
        renderForm={(activeFlow) => (
          <DataViewFormSurface
            title={activeFlow.mode === "create" ? "Create work" : "Edit work"}
            description="State, validation, and persistence belong to this consumer."
            onCancel={() => setFlow({ mode: "closed" })}
            footer={
              <>
                <button
                  className="form-button secondary"
                  onClick={() => setFlow({ mode: "closed" })}
                >
                  Cancel
                </button>
                <button className="form-button" onClick={saveRecord}>
                  Save record
                </button>
              </>
            }
          >
            <DataViewRecordFormFields
              schema={schema}
              record={activeFlow.mode === "edit" ? activeFlow.record : null}
              values={values}
              onValueChange={(propertyId, value) =>
                setValues((current) => ({ ...current, [propertyId]: value }))
              }
            />
          </DataViewFormSurface>
        )}
      />
    </DataViewThemeProvider>
  )
}

const listProperties: readonly DataListProperty<WorkRecord, unknown>[] = [
  {
    id: "status",
    label: "Status",
    accessor: (record) => record.status,
    capabilities: { searchable: true, sortable: true },
    render: ({ value }) => (
      <span className={`pill pill-${String(value)}`}>
        {STATUS_OPTIONS.find((option) => option.id === value)?.label}
      </span>
    ),
  },
  {
    id: "owner",
    label: "Owner",
    accessor: (record) => record.owner,
    capabilities: { searchable: true, sortable: true },
    render: ({ value }) => String(value),
  },
  {
    id: "priority",
    label: "Priority",
    accessor: (record) => record.priority,
    capabilities: { searchable: true, sortable: true },
    render: ({ value }) => String(value),
  },
]

export function ListExample() {
  const items: readonly DataListItem<WorkRecord>[] = SEED_RECORDS.map(
    (record, index) => ({
      id: record.id,
      rank: String(index).padStart(3, "0"),
      data: record,
    }),
  )
  return (
    <DataListProvider
      config={{
        items,
        properties: listProperties,
        renderTitle: ({ item }) => item.data.title,
        getItemLabel: (item) => item.data.title,
        operations: {
          mode: "client",
          getSearchText: (item) => `${item.data.title} ${item.data.owner}`,
        },
        selection: { mode: "multiple" },
        grouping: {
          mode: "derived",
          getKey: (item) => item.data.status,
          getLabel: (key) =>
            STATUS_OPTIONS.find((option) => option.id === key)?.label ?? key,
          collapsible: true,
        },
      }}
    >
      <DataList chrome={{ mode: "embedded" }} />
    </DataListProvider>
  )
}

const boardGroups: readonly KanbanGroup[] = STATUS_OPTIONS.map(
  (status, index) => ({
    id: status.id,
    rank: String(index),
    data: { title: status.label },
  }),
)

export function KanbanExample() {
  const [cards, setCards] = useState<readonly KanbanCard[]>(() =>
    SEED_RECORDS.map((record, index) => ({
      id: record.id,
      groupId: record.status,
      rank: String(index).padStart(3, "0"),
      data: record,
    })),
  )
  const onCommand = (command: KanbanCommand) => {
    if (command.type === "move-cards")
      setCards((current) =>
        current.map((card) =>
          command.cardIds.includes(card.id)
            ? {
                ...card,
                groupId: command.destination.groupId,
                rank: `m-${card.id}`,
              }
            : card,
        ),
      )
    if (command.type === "delete-cards")
      setCards((current) =>
        current.filter((card) => !command.cardIds.includes(card.id)),
      )
  }
  return (
    <KanbanProvider
      config={{
        cards,
        groups: boardGroups,
        preferences: { density: "compact", columnWidth: 250 },
        renderCard: (card) => {
          const record = card.data as WorkRecord
          return (
            <div className="board-card">
              <strong>{record.title}</strong>
              <span>
                {record.owner} · {record.priority}
              </span>
            </div>
          )
        },
        renderGroupHeader: (group) =>
          String((group.data as { title: string }).title),
        getCardLabel: (card) => (card.data as WorkRecord).title,
        getGroupLabel: (group) =>
          String((group.data as { title: string }).title),
        onCommand,
      }}
    >
      <Kanban chrome={{ mode: "embedded" }} className="standalone-engine" />
    </KanbanProvider>
  )
}

const CALENDAR_SEED: readonly CalendarItem[] = SEED_RECORDS.map((record) => ({
  id: record.id,
  calendarId: "product",
  kind: "all-day" as const,
  startDate: record.start.toISOString().slice(0, 10),
  endDate: record.end.toISOString().slice(0, 10),
  data: record,
}))

function applyCalendarCommand(
  items: readonly CalendarItem[],
  command: CalendarMutationCommand,
): readonly CalendarItem[] {
  if (command.type === "delete")
    return items.filter((item) => !command.itemIds.includes(item.id))
  if (command.type === "restore") return items
  const changes =
    command.type === "move"
      ? new Map(
          command.changes.map((change) => [change.itemId, change.nextRange]),
        )
      : new Map([[command.itemId, command.nextRange]])
  return items.map((item) => {
    const range = changes.get(item.id)
    return range?.kind === "all-day" && item.kind === "all-day"
      ? { ...item, startDate: range.startDate, endDate: range.endDate }
      : item
  })
}

export function CalendarExample() {
  const [items, setItems] = useState(CALENDAR_SEED)
  const [preferences, setPreferences] = useState<CalendarPreferences>(() => ({
    ...createDefaultCalendarPreferences("America/Los_Angeles"),
    weekStartsOn: 1,
    maxVisibleLanes: 3,
  }))
  return (
    <CalendarProvider
      config={{
        items,
        preferences,
        initialAnchorDate: "2026-08-16",
        now: () => new Date("2026-08-16T12:00:00-07:00"),
        renderItem: (item) => (item.data as WorkRecord).title,
        getSearchText: (item) => (item.data as WorkRecord).title,
        getItemAriaLabel: (item) => (item.data as WorkRecord).title,
        onItemMutation: (command) =>
          setItems((current) => applyCalendarCommand(current, command)),
        onPreferencesChange: setPreferences,
      }}
    >
      <Calendar chrome={{ mode: "embedded" }} className="standalone-engine" />
    </CalendarProvider>
  )
}

const TIMELINE_SEED: TimelineItem[] = SEED_RECORDS.map((record) => ({
  id: record.id,
  startDate: record.start,
  endDate: record.end,
  data: record,
}))

export function TimelineExample() {
  const [items, setItems] = useState(TIMELINE_SEED)
  return (
    <TimelineProvider
      config={{
        items,
        viewportMode: "day",
        sidebar: true,
        snapToGrid: true,
        renderBar: (item) => (
          <span className="timeline-label">
            {(item.data as WorkRecord).title}
          </span>
        ),
        renderSidebarItem: (item) => (
          <span>{(item.data as WorkRecord).title}</span>
        ),
        getSearchText: (item) => (item.data as WorkRecord).title,
        onItemsChange: setItems,
      }}
    >
      <Timeline chrome={{ mode: "embedded" }} className="standalone-engine" />
    </TimelineProvider>
  )
}
