import { StrictMode, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { DatabaseViews, createSavedDataView, type DataViewSchema, type SavedDataView } from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"
import "@entropy-ui/data-views/styles.css"

interface FixtureRecord { readonly id: string; readonly title: string; readonly status: string }
const records: readonly FixtureRecord[] = [
  { id: "one", title: "Clean Vite consumer", status: "ready" },
]
const schema: DataViewSchema<FixtureRecord> = {
  adapter: { getId: (record) => record.id, getLabel: (record) => record.title },
  properties: [
    { type: "title", id: "title", label: "Title", getValue: (record) => record.title },
    { type: "select", id: "status", label: "Status", options: [{ id: "ready", label: "Ready" }], getValue: (record) => record.status },
  ],
}
const initialViews: readonly SavedDataView[] = [createSavedDataView({ id: "all", name: "All", definition: { type: "list" } })]

function App() {
  const [views, setViews] = useState(initialViews)
  const plugins = useMemo(() => createBuiltInDataViewPlugins<FixtureRecord>(), [])
  return <DatabaseViews source={{ mode: "client", id: "fixture", records }} schema={schema} views={views} activeViewId="all" onActiveViewIdChange={() => undefined} onViewsChange={setViews} plugins={plugins} />
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
