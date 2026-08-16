import { useMemo, useState } from "react"
import { Badge } from "../ui/badge.js"
import { Button } from "../ui/button.js"
import { DataList, DataListProvider } from "./index.js"
import type {
  DataListConfig,
  DataListItem,
  DataListProperty,
} from "./index.js"
import type { Meta, StoryObj } from "@storybook/react-vite"

interface WorkItem {
  readonly title: string
  readonly status: "Backlog" | "In progress" | "Done"
  readonly owner: string
  readonly priority: "Low" | "Medium" | "High"
}

const statuses = ["Backlog", "In progress", "Done"] as const
const owners = ["Maya", "Jon", "Sam", "No owner"] as const
const priorities = ["Low", "Medium", "High"] as const

function createItems(count = 18): DataListItem<WorkItem>[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `work-${index + 1}`,
    rank: String(index).padStart(6, "0"),
    data: {
      title:
        index === 3
          ? "A deliberately long record title that demonstrates truncation without losing its accessible name"
          : `Product work item ${index + 1}`,
      status: statuses[index % statuses.length],
      owner: owners[index % owners.length],
      priority: priorities[index % priorities.length],
    },
  }))
}

const properties: readonly DataListProperty<WorkItem, unknown>[] = [
  {
    id: "status",
    label: "Status",
    accessor: (data) => data.status,
    capabilities: {
      searchable: true,
      sortable: true,
      required: true,
      priority: 100,
    },
    render: ({ value }) => (
      <Badge variant="secondary" className="font-normal">
        {String(value)}
      </Badge>
    ),
  },
  {
    id: "owner",
    label: "Owner",
    accessor: (data) => data.owner,
    capabilities: { searchable: true, sortable: true, priority: 70 },
    render: ({ value }) => String(value),
  },
  {
    id: "priority",
    label: "Priority",
    accessor: (data) => data.priority,
    capabilities: {
      searchable: true,
      sortable: true,
      editable: true,
      collapsible: true,
      priority: 30,
    },
    editor: {
      validate: (value) =>
        priorities.includes(value as (typeof priorities)[number])
          ? { valid: true }
          : { valid: false, message: "Use Low, Medium, or High." },
    },
    render: ({ value }) => String(value),
  },
]

function useInteractiveConfig(
  options: Partial<DataListConfig<WorkItem>> = {}
): DataListConfig<WorkItem> {
  const [items, setItems] = useState(() => createItems())
  const [density, setDensity] = useState<"compact" | "default" | "comfortable">(
    "default"
  )
  return {
    items,
    properties,
    renderTitle: ({ item }) => item.data.title,
    getItemLabel: (item) => item.data.title,
    titleEditor: {
      accessor: (data) => data.title,
      validate: (value) =>
        value.trim()
          ? { valid: true }
          : { valid: false, message: "Title is required." },
    },
    operations: {
      mode: "client",
      getSearchText: (item) =>
        `${item.data.title} ${item.data.status} ${item.data.owner} ${item.data.priority}`,
    },
    selection: { mode: "multiple", allowAllMatching: true },
    preferences: { density },
    virtualization: { threshold: 100, maxHeight: 560 },
    onPreferencesChange: (preferences) =>
      setDensity(preferences.density ?? "default"),
    onEdit: (command) => {
      setItems((current) =>
        current.map((item) => {
          if (item.id !== command.itemId) return item
          if (command.propertyId === "__title__") {
            return {
              ...item,
              data: { ...item.data, title: String(command.proposedValue) },
            }
          }
          if (command.propertyId === "priority") {
            return {
              ...item,
              data: {
                ...item.data,
                priority: command.proposedValue as WorkItem["priority"],
              },
            }
          }
          return item
        })
      )
    },
    onReorder: (command) => {
      setItems((current) => {
        const moved = current.filter((item) =>
          command.itemIds.includes(item.id)
        )
        const remaining = current.filter(
          (item) => !command.itemIds.includes(item.id)
        )
        const beforeIndex = command.beforeId
          ? remaining.findIndex((item) => item.id === command.beforeId)
          : remaining.length
        remaining.splice(
          beforeIndex < 0 ? remaining.length : beforeIndex,
          0,
          ...moved
        )
        return remaining
      })
    },
    renderRowActions: ({ item }) => (
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
        Open {item.id.slice(-2)}
      </Button>
    ),
    renderBulkActions: ({ selectedItems }) => (
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
        Archive {selectedItems.length || "matching"}
      </Button>
    ),
    ...options,
  }
}

function InteractiveSurface({
  options,
  className,
}: {
  readonly options?: Partial<DataListConfig<WorkItem>>
  readonly className?: string
}) {
  const config = useInteractiveConfig(options)
  return (
    <div className={className ?? "mx-auto max-w-5xl p-8"}>
      <DataListProvider config={config}>
        <DataList />
      </DataListProvider>
    </div>
  )
}

const meta = {
  title: "Components/Data List",
  component: DataList,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DataList>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: () => <InteractiveSurface />,
}

export const Grouped: Story = {
  render: () => (
    <InteractiveSurface
      options={{
        grouping: {
          mode: "derived",
          getKey: (item) => item.data.status,
          getLabel: (key) => <span className="font-medium">{key}</span>,
          collapsible: true,
          onAdd: () => undefined,
        },
      }}
    />
  ),
}

export const NestedTree: Story = {
  render: () => {
    const nested = createItems(12).map((item, index) =>
      index > 0 && index < 4 ? { ...item, parentId: "work-1" } : item
    )
    return (
      <InteractiveSurface
        options={{
          items: nested,
          hierarchy: { mode: "nested", allowReparent: true },
          semanticMode: "tree",
        }}
      />
    )
  },
}

export const ReadOnly: Story = {
  render: () => <InteractiveSurface options={{ readOnly: true }} />,
}

export const ServerPending: Story = {
  render: () => (
    <InteractiveSurface
      options={{
        operations: {
          mode: "server",
          pending: true,
          totalCount: 12_450,
          matchingCount: 18,
          manualOrderAllowed: false,
        },
      }}
    />
  ),
}

function ServerInfiniteSurface() {
  const [loadedCount, setLoadedCount] = useState(18)
  return (
    <InteractiveSurface
      options={{
        items: createItems(loadedCount),
        operations: {
          mode: "server",
          totalCount: 12_450,
          matchingCount: 54,
          pagination: {
            mode: "infinite",
            hasNextPage: loadedCount < 54,
            onLoadMore: () =>
              setLoadedCount((current) => Math.min(current + 18, 54)),
          },
        },
      }}
    />
  )
}

export const ServerInfiniteLoading: Story = {
  render: () => <ServerInfiniteSurface />,
}

export const RefreshFailureWithCachedRows: Story = {
  render: () => (
    <InteractiveSurface
      options={{
        status: {
          state: "error",
          phase: "refresh",
          error: "The latest refresh failed. Cached records are still shown.",
          onRetry: () => undefined,
        },
      }}
    />
  ),
}

export const EmptyAndFailureStates: Story = {
  render: () => (
    <div className="grid gap-6 p-8 lg:grid-cols-2">
      <InteractiveSurface className="" options={{ items: [] }} />
      <InteractiveSurface
        className=""
        options={{
          status: { state: "loading", message: "Loading workspace…" },
        }}
      />
      <InteractiveSurface
        className=""
        options={{
          status: { state: "error", error: "Connection unavailable" },
        }}
      />
      <InteractiveSurface
        className=""
        options={{
          status: {
            state: "no-access",
            message: "Request access to continue.",
          },
        }}
      />
    </div>
  ),
}

export const Dark: Story = {
  render: () => (
    <div className="dark min-h-screen bg-background text-foreground">
      <InteractiveSurface />
    </div>
  ),
}

function LargeDataSurface() {
  const items = useMemo(() => createItems(50_000), [])
  const config: DataListConfig<WorkItem> = {
    items,
    properties,
    renderTitle: ({ item }) => item.data.title,
    getItemLabel: (item) => item.data.title,
    operations: { mode: "client", getSearchText: (item) => item.data.title },
    selection: { mode: "multiple" },
    virtualization: {
      enabled: true,
      threshold: 1,
      overscan: 8,
      maxHeight: 640,
      initialHeight: 640,
    },
  }
  return (
    <div className="p-8">
      <DataListProvider config={config}>
        <DataList />
      </DataListProvider>
    </div>
  )
}

export const FiftyThousandRecords: Story = {
  render: () => <LargeDataSurface />,
  parameters: {
    docs: {
      description: {
        story:
          "Production virtualization baseline. Inspect the DOM to verify that mounted rows remain bounded while scrolling.",
      },
    },
  },
}
