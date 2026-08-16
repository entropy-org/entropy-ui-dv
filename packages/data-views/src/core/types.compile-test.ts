import type {
  DataViewDataSource,
  DataViewFlowState,
  DataViewProperty,
  SavedDataView,
} from "./types.js"

interface CompileFixture {
  readonly id: string
  readonly title: string
}

const titleProperty: DataViewProperty<CompileFixture> = {
  type: "title",
  id: "title",
  label: "Title",
  getValue: (record) => record.title,
}
void titleProperty

const flow: DataViewFlowState<CompileFixture> = { mode: "closed" }
void flow

// @ts-expect-error Edit flows always require a record.
const invalidFlow: DataViewFlowState<CompileFixture> = { mode: "edit", viewId: "all" }
void invalidFlow

// @ts-expect-error Server sources require status and pagination ownership.
const invalidServerSource: DataViewDataSource<CompileFixture> = {
  mode: "server",
  id: "records",
  records: [],
}
void invalidServerSource

const invalidKanbanView: SavedDataView = {
  schemaVersion: 1,
  id: "board",
  name: "Board",
  // @ts-expect-error Kanban saved views require a grouping property.
  definition: { type: "kanban" },
  query: { search: "", filters: [], sorts: [], grouping: [] },
}
void invalidKanbanView
