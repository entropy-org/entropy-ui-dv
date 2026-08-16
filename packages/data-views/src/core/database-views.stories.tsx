import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createBuiltInDataViewPlugins } from "./built-in-plugins.js"
import { DatabaseViews } from "./database-views.js"
import { createSavedDataView } from "./saved-views.js"
import type {
  DataViewCreateRequest,
  DataViewDataSource,
  DataViewIntent,
  DataViewSchema,
  SavedDataView,
} from "./types.js"

interface StoryRecord {
  readonly id: string
  readonly title: string
  readonly status: "todo" | "doing" | "done"
  readonly start: Date
  readonly end: Date
}

const records: readonly StoryRecord[] = [
  {
    id: "research",
    title: "Research interaction patterns",
    status: "done",
    start: new Date("2026-08-11T09:00:00-07:00"),
    end: new Date("2026-08-12T15:00:00-07:00"),
  },
  {
    id: "contracts",
    title: "Finalize public contracts",
    status: "doing",
    start: new Date("2026-08-14T10:00:00-07:00"),
    end: new Date("2026-08-18T16:00:00-07:00"),
  },
  {
    id: "release",
    title: "Verify consumer fixtures",
    status: "todo",
    start: new Date("2026-08-19T09:00:00-07:00"),
    end: new Date("2026-08-22T17:00:00-07:00"),
  },
  {
    id: "accessibility",
    title: "Review keyboard journeys",
    status: "doing",
    start: new Date("2026-08-17T09:00:00-07:00"),
    end: new Date("2026-08-20T12:00:00-07:00"),
  },
  {
    id: "examples",
    title: "Publish integration examples",
    status: "todo",
    start: new Date("2026-08-21T10:00:00-07:00"),
    end: new Date("2026-08-26T16:00:00-07:00"),
  },
  {
    id: "tokens",
    title: "Validate host theme tokens",
    status: "done",
    start: new Date("2026-08-08T09:00:00-07:00"),
    end: new Date("2026-08-10T17:00:00-07:00"),
  },
]

const schema: DataViewSchema<StoryRecord> = {
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
      options: [
        { id: "todo", label: "To do" },
        { id: "doing", label: "In progress" },
        { id: "done", label: "Done" },
      ],
      getValue: (record) => record.status,
    },
    {
      type: "date",
      id: "start",
      label: "Start",
      getValue: (record) => record.start,
    },
    {
      type: "date",
      id: "end",
      label: "End",
      getValue: (record) => record.end,
    },
  ],
}

const initialViews: readonly SavedDataView[] = [
  createSavedDataView({
    id: "all",
    name: "All records",
    definition: { type: "list", visiblePropertyIds: ["status", "start"] },
  }),
  createSavedDataView({
    id: "board",
    name: "Board",
    definition: {
      type: "kanban",
      groupByPropertyId: "status",
      visiblePropertyIds: ["start"],
    },
  }),
  createSavedDataView({
    id: "calendar",
    name: "Calendar",
    definition: {
      type: "calendar",
      datePropertyId: "start",
      endDatePropertyId: "end",
      mode: "month",
      timeZone: "America/Los_Angeles",
    },
  }),
  createSavedDataView({
    id: "timeline",
    name: "Timeline",
    definition: {
      type: "timeline",
      startDatePropertyId: "start",
      endDatePropertyId: "end",
      zoom: "day",
    },
  }),
]

type DatabaseViewsStoryProps = {
  readonly initialActiveViewId?: "all" | "board" | "calendar" | "timeline"
  readonly sourceMode?: "client" | "server"
  readonly embedded?: boolean
  readonly readOnly?: boolean
}

function describeIntent(intent: DataViewIntent<StoryRecord>) {
  if (intent.type === "create-record") return `create record in ${intent.view.name}`
  if (intent.type === "edit-record") return `edit ${intent.record.title}`
  if (intent.type === "delete-records") {
    return `delete ${intent.records.length} record(s)`
  }
  return `update ${intent.propertyId} on ${intent.record.title}`
}

function describeCreateRequest(request: DataViewCreateRequest) {
  return request.type === "custom"
    ? `create ${request.pluginId} view`
    : `create ${request.type} view`
}

function DatabaseViewsStory({
  initialActiveViewId = "all",
  sourceMode = "client",
  embedded = false,
  readOnly = false,
}: DatabaseViewsStoryProps) {
  const [views, setViews] = useState(initialViews)
  const [activeViewId, setActiveViewId] = useState<string>(initialActiveViewId)
  const [lastHostEvent, setLastHostEvent] = useState("Waiting for an intent")
  const plugins = useMemo(() => createBuiltInDataViewPlugins<StoryRecord>(), [])

  const source: DataViewDataSource<StoryRecord> =
    sourceMode === "server"
      ? {
          mode: "server",
          id: "storybook-server",
          label: "Product work",
          records,
          status: { status: "ready" },
          pageInfo: { totalCount: 128, hasNextPage: true },
          onLoadMore: () => setLastHostEvent("load the next server page"),
          onRetry: () => setLastHostEvent("retry the server request"),
          onQueryChange: (request) =>
            setLastHostEvent(`run server ${request.reason} query`),
        }
      : {
          mode: "client",
          id: "storybook-client",
          label: "Product work",
          records,
        }

  const viewSurface = (
    <DatabaseViews
      className={embedded ? "min-h-[42rem]" : "h-[46rem]"}
      source={source}
      schema={schema}
      views={views}
      activeViewId={activeViewId}
      onActiveViewIdChange={setActiveViewId}
      onViewsChange={(nextViews) => setViews(nextViews)}
      plugins={plugins}
      title="Product work"
      description={`${sourceMode === "server" ? "Server-backed" : "Local"} records`}
      chrome={embedded ? { mode: "embedded" } : { mode: "standalone" }}
      readOnly={readOnly}
      headerActions={
        <span className="max-w-64 truncate text-xs text-muted-foreground" role="status">
          Host: {lastHostEvent}
        </span>
      }
      onIntent={(intent) => setLastHostEvent(describeIntent(intent))}
      onCreateViewRequest={(request) =>
        setLastHostEvent(describeCreateRequest(request))
      }
      onConfigureView={(view) => setLastHostEvent(`configure ${view.name}`)}
      onDuplicateView={(view) => {
        const copy = {
          ...view,
          id: `${view.id}-copy-${views.length}`,
          name: `${view.name} copy`,
        }
        setViews((current) => [...current, copy])
        setLastHostEvent(`duplicate ${view.name}`)
      }}
      onDeleteView={(view) => {
        setViews((current) => current.filter((item) => item.id !== view.id))
        setActiveViewId("all")
        setLastHostEvent(`delete ${view.name}`)
      }}
    />
  )

  return embedded ? (
    <section className="min-h-screen bg-muted p-6">
      <header className="mx-auto mb-4 flex max-w-7xl items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Workspace</p>
          <h1 className="font-heading text-2xl font-semibold">Product delivery</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          The host owns this header
        </span>
      </header>
      <div className="mx-auto max-w-7xl">{viewSurface}</div>
    </section>
  ) : (
    <div className="min-h-screen bg-muted/40 p-6">{viewSurface}</div>
  )
}

const meta = {
  title: "Core/Database Views",
  component: DatabaseViewsStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The controlled multi-view shell combines saved-view tabs, one shared toolbar, and pluggable list, kanban, calendar, or timeline renderers. The host owns records, persistence, permissions, mutations, and add/edit forms.",
      },
    },
  },
  argTypes: {
    initialActiveViewId: {
      control: "select",
      options: ["all", "board", "calendar", "timeline"],
    },
    sourceMode: { control: "inline-radio", options: ["client", "server"] },
  },
} satisfies Meta<typeof DatabaseViewsStory>

export default meta
type Story = StoryObj<typeof meta>

export const ListView: Story = {}

export const KanbanView: Story = {
  args: { initialActiveViewId: "board" },
}

export const CalendarView: Story = {
  args: { initialActiveViewId: "calendar" },
}

export const TimelineView: Story = {
  args: { initialActiveViewId: "timeline" },
}

export const ServerBacked: Story = {
  args: { sourceMode: "server" },
  parameters: {
    docs: {
      description: {
        story:
          "Search, filtering, sorting, refresh, and pagination are emitted to the server-state owner instead of being stored inside the component library.",
      },
    },
  },
}

export const EmbeddedChrome: Story = {
  args: { embedded: true },
  parameters: {
    docs: {
      description: {
        story:
          "Embedded mode removes the database title header when an application page already owns that level of chrome, while retaining view tabs and actions.",
      },
    },
  },
}

export const ReadOnly: Story = {
  args: { readOnly: true },
}
