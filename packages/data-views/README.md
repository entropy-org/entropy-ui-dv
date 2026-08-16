# `@entropy-ui/data-views`

Controlled React data views with standalone List, Kanban, Calendar, and
Timeline entry points plus a Notion-inspired saved-view database shell.

```tsx
import { useMemo, useState } from "react"
import {
  DatabaseViews,
  createSavedDataView,
  type DataViewSchema,
} from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"
import "@entropy-ui/data-views/styles.css"

type Task = {
  id: string
  title: string
  status: string
  startsAt: Date
  endsAt: Date
}

const schema: DataViewSchema<Task> = {
  adapter: {
    getId: (task) => task.id,
    getLabel: (task) => task.title,
  },
  properties: [
    { type: "title", id: "title", label: "Title", getValue: (task) => task.title },
    {
      type: "select",
      id: "status",
      label: "Status",
      options: [
        { id: "todo", label: "To do" },
        { id: "done", label: "Done" },
      ],
      getValue: (task) => task.status,
    },
    { type: "date", id: "start", label: "Start", getValue: (task) => task.startsAt },
    { type: "date", id: "end", label: "End", getValue: (task) => task.endsAt },
  ],
}

const initialViews = [
  createSavedDataView({ id: "all", name: "All tasks", definition: { type: "list" } }),
  createSavedDataView({
    id: "board",
    name: "Board",
    definition: { type: "kanban", groupByPropertyId: "status" },
  }),
]

export function TaskDatabase({ tasks }: { tasks: readonly Task[] }) {
  const [views, setViews] = useState(initialViews)
  const [activeViewId, setActiveViewId] = useState("all")
  const plugins = useMemo(() => createBuiltInDataViewPlugins<Task>(), [])

  return (
    <DatabaseViews
      source={{ mode: "client", id: "tasks", label: "Tasks", records: tasks }}
      schema={schema}
      views={views}
      activeViewId={activeViewId}
      onActiveViewIdChange={setActiveViewId}
      onViewsChange={setViews}
      plugins={plugins}
      onIntent={(intent) => {
        // Open an application form or call the application data layer.
        console.log(intent)
      }}
    />
  )
}
```

The library owns view layout, accessibility, focus, interaction, and transient
state. Consumers own records, fetching, saved-view persistence, permissions,
forms, validation, and conflict resolution.

See the repository documentation for architecture, forms, theming, SSR,
public API policy, and saved-view migrations.
