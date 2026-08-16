import type {
  DataListConfig,
  DataListItem,
  DataListProperty,
} from "../types.js"

export interface TestRecord {
  readonly title: string
  readonly status: "Todo" | "Doing" | "Done"
  readonly score: number
}

export function createListItems(count = 4): DataListItem<TestRecord>[] {
  const statuses = ["Todo", "Doing", "Done"] as const
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    rank: String(index).padStart(4, "0"),
    data: {
      title: `Record ${index + 1}`,
      status: statuses[index % statuses.length],
      score: count - index,
    },
  }))
}

export const testProperties: readonly DataListProperty<TestRecord, unknown>[] =
  [
    {
      id: "status",
      label: "Status",
      accessor: (data) => data.status,
      capabilities: { searchable: true, sortable: true },
      render: ({ value }) => <span>{String(value)}</span>,
    },
    {
      id: "score",
      label: "Score",
      accessor: (data) => data.score,
      capabilities: { sortable: true, editable: true },
      editor: {
        validate: (value) =>
          Number.isFinite(Number(value))
            ? { valid: true }
            : { valid: false, message: "Enter a number." },
      },
      render: ({ value }) => <span>{String(value)}</span>,
    },
  ]

export function createListConfig(
  overrides: Partial<DataListConfig<TestRecord>> = {}
): DataListConfig<TestRecord> {
  return {
    items: createListItems(),
    properties: testProperties,
    renderTitle: ({ item }) => item.data.title,
    getItemLabel: (item) => item.data.title,
    titleEditor: {
      accessor: (data) => data.title,
      validate: (value) =>
        value.trim() ? { valid: true } : { valid: false, message: "Required." },
    },
    operations: {
      mode: "client",
      getSearchText: (item) => item.data.title,
    },
    selection: { mode: "multiple" },
    virtualization: false,
    ...overrides,
  }
}
