import { describe, expect, it } from "vitest"
import {
  DATA_LIST_DENSITIES,
  DataList,
  DataListProvider,
} from "./index.js"
import type {
  DataListConfig,
  DataListItem,
  DataListProperty,
} from "./index.js"

interface RecordData {
  readonly title: string
  readonly estimate: number
}

const estimateProperty: DataListProperty<RecordData, number> = {
  id: "estimate",
  label: "Estimate",
  accessor: (data) => data.estimate,
  capabilities: { sortable: true, editable: true },
  editor: {
    validate: (value) =>
      value >= 0
        ? { valid: true }
        : { valid: false, message: "Must be positive." },
  },
  render: ({ value }) => `${value} points`,
}

const items: readonly DataListItem<RecordData>[] = [
  { id: "one", data: { title: "Typed record", estimate: 3 } },
]

const config: DataListConfig<RecordData> = {
  items,
  properties: [estimateProperty],
  renderTitle: ({ item }) => item.data.title,
  selection: { mode: "multiple", allowAllMatching: true },
  operations: { mode: "client" },
}

function CompileFixture() {
  return (
    <DataListProvider config={config}>
      <DataList aria-label="Typed list" />
    </DataListProvider>
  )
}

describe("data-list public API", () => {
  it("exports generic heterogeneous property inference", () => {
    expect(CompileFixture).toBeTypeOf("function")
    expect(DATA_LIST_DENSITIES).toEqual(["compact", "default", "comfortable"])
  })
})
