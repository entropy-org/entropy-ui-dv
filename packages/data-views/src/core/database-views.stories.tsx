import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createBuiltInDataViewPlugins } from "./built-in-plugins.js"
import { DatabaseViews } from "./database-views.js"
import { createSavedDataView } from "./saved-views.js"
import type { DataViewSchema, SavedDataView } from "./types.js"

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
]

const schema: DataViewSchema<StoryRecord> = {
  adapter: {
    getId: (record) => record.id,
    getLabel: (record) => record.title,
  },
  properties: [
    { type: "title", id: "title", label: "Title", getValue: (record) => record.title },
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
    { type: "date", id: "start", label: "Start", getValue: (record) => record.start },
    { type: "date", id: "end", label: "End", getValue: (record) => record.end },
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

function DatabaseViewsStory() {
  const [views, setViews] = useState(initialViews)
  const [activeViewId, setActiveViewId] = useState("all")
  const plugins = useMemo(() => createBuiltInDataViewPlugins<StoryRecord>(), [])
  return (
    <div className="h-[760px]">
      <DatabaseViews
        source={{ mode: "client", id: "stories", label: "Product work", records }}
        schema={schema}
        views={views}
        activeViewId={activeViewId}
        onActiveViewIdChange={setActiveViewId}
        onViewsChange={setViews}
        plugins={plugins}
        onIntent={() => undefined}
      />
    </div>
  )
}

const meta = {
  title: "Core/DatabaseViews",
  component: DatabaseViewsStory,
} satisfies Meta<typeof DatabaseViewsStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
