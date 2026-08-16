"use client"

import { useMemo, useState } from "react"
import { DatabaseViews, createSavedDataView, type DataViewSchema, type SavedDataView } from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"

interface FixtureRecord { readonly id: string; readonly title: string }
const records: readonly FixtureRecord[] = [{ id: "next", title: "Clean Next consumer" }]
const schema: DataViewSchema<FixtureRecord> = {
  adapter: { getId: (record) => record.id, getLabel: (record) => record.title },
  properties: [{ type: "title", id: "title", label: "Title", getValue: (record) => record.title }],
}
const initialViews: readonly SavedDataView[] = [createSavedDataView({ id: "all", name: "All", definition: { type: "list" } })]

export function ClientViews() {
  const [views, setViews] = useState(initialViews)
  const plugins = useMemo(() => createBuiltInDataViewPlugins<FixtureRecord>(), [])
  return <DatabaseViews source={{ mode: "client", id: "fixture", records }} schema={schema} views={views} activeViewId="all" onActiveViewIdChange={() => undefined} onViewsChange={setViews} plugins={plugins} />
}
