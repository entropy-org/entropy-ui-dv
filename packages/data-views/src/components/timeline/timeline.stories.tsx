import { useState } from "react"
import { Timeline, TimelineProvider } from "./index.js"
import type { TimelineConfig, TimelineItem } from "./types.js"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta: Meta<typeof Timeline> = {
  title: "Components/Timeline",
  component: Timeline,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof Timeline>

// ── Mock Data Generator ──────────────────────────────────────────────────────

function generateMockItems(count: number): TimelineItem[] {
  const items: TimelineItem[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const colors = [
    "bg-blue-500 text-white",
    "bg-emerald-500 text-white",
    "bg-violet-500 text-white",
    "bg-amber-500 text-white",
    "bg-rose-500 text-white",
  ]

  for (let i = 0; i < count; i++) {
    const startOffset = Math.floor(Math.random() * 30) - 15 // -15 to +15 days from today
    const duration = Math.floor(Math.random() * 10) + 2 // 2 to 11 days

    const startDate = new Date(today)
    startDate.setDate(today.getDate() + startOffset)

    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + duration)

    items.push({
      id: `task-${i + 1}`,
      startDate,
      endDate,
      data: {
        title: `Task ${i + 1}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        color: colors[Math.floor(Math.random() * colors.length)],
      },
    })
  }

  // Sort them so they roughly align into nice rows
  items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  return items
}

const initialItems = generateMockItems(15)

// ── Renderers ───────────────────────────────────────────────────────────────

const renderBar = (
  item: TimelineItem,
  state: { isDragging: boolean; isSelected: boolean }
) => {
  const data = item.data as { title: string; color: string }
  return (
    <div
      className={`flex h-full w-full items-center overflow-hidden rounded border border-black/10 px-3 text-xs font-medium whitespace-nowrap shadow-sm transition-shadow ${
        data.color
      } ${state.isDragging ? "opacity-70 shadow-lg" : ""} ${
        state.isSelected ? "ring-1 ring-white/25 ring-inset" : ""
      }`}
    >
      <span className="truncate">{data.title}</span>
    </div>
  )
}

// ── Stories ─────────────────────────────────────────────────────────────────

export const Interactive: Story = {
  render: function InteractiveStory() {
    // We wrap it in a stateful component so we can actually see changes when onItemAdd fires
    const [items, setItems] = useState<TimelineItem[]>(initialItems)

    const handleItemAdd = (
      startDate: Date,
      endDate: Date,
      rowIndex: number
    ) => {
      const newItem: TimelineItem = {
        id: `new-task-${Date.now()}`,
        startDate,
        endDate,
        data: {
          title: `New Task (Row ${rowIndex})`,
          color: "bg-sky-500 text-white",
        },
      }
      setItems((prev) => [...prev, newItem])
    }

    const config: TimelineConfig = {
      items,
      viewportMode: "day",
      snapToGrid: true,
      renderBar,
      onItemAdd: handleItemAdd,
    }

    return (
      <div className="flex h-screen w-full flex-col bg-muted/20 p-8 font-sans">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Timeline Component
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Interactive demo. Try dragging bars, resizing handles, holding
            Shift+Scroll, multiselecting with Shift/Cmd, and dragging multiple
            bars.
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <TimelineProvider config={config}>
            <Timeline />
          </TimelineProvider>
        </div>
      </div>
    )
  },
}

export const ReadOnly: Story = {
  render: function ReadOnlyStory() {
    const config: TimelineConfig = {
      items: initialItems,
      viewportMode: "week",
      readOnly: true,
      renderBar,
    }

    return (
      <div className="flex h-screen w-full flex-col bg-muted/20 p-8 font-sans">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Read Only Timeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag, resize, and ghost-bar interactions are disabled.
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <TimelineProvider config={config}>
            <Timeline />
          </TimelineProvider>
        </div>
      </div>
    )
  },
}

export const WithSubItemsAndSidebar: Story = {
  render: function SubItemsStory() {
    const [subItemMode, setSubItemMode] = useState<
      "disabled" | "flattened" | "nested"
    >("nested")
    const [sidebarVisible, setSidebarVisible] = useState(true)
    const [items, setItems] = useState<TimelineItem[]>([
      {
        id: "parent-1",
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-20"),
        data: { title: "Planning", color: "bg-blue-500 text-white" },
      },
      {
        id: "child-1a",
        parentId: "parent-1",
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-14"),
        data: {
          title: "Requirements Gathering",
          color: "bg-blue-400 text-white",
        },
      },
      {
        id: "child-1b",
        parentId: "parent-1",
        startDate: new Date("2026-07-13"),
        endDate: new Date("2026-07-19"),
        data: { title: "Architecture Design", color: "bg-blue-400 text-white" },
      },
      {
        id: "parent-2",
        startDate: new Date("2026-07-18"),
        endDate: new Date("2026-07-28"),
        data: { title: "Implementation", color: "bg-emerald-500 text-white" },
      },
      {
        id: "child-2a",
        parentId: "parent-2",
        startDate: new Date("2026-07-18"),
        endDate: new Date("2026-07-25"),
        data: {
          title: "Frontend Components",
          color: "bg-emerald-400 text-white",
        },
      },
      {
        id: "child-2b",
        parentId: "parent-2",
        startDate: new Date("2026-07-22"),
        endDate: new Date("2026-07-28"),
        data: {
          title: "Backend Integration",
          color: "bg-emerald-400 text-white",
        },
      },
      {
        id: "standalone-3",
        startDate: new Date("2026-07-15"),
        endDate: new Date("2026-07-25"),
        data: { title: "Security Review", color: "bg-amber-500 text-white" },
      },
    ])

    const config: TimelineConfig = {
      items,
      viewportMode: "day",
      snapToGrid: true,
      sidebar: sidebarVisible,
      subItems: subItemMode,
      renderBar,
      renderSidebarItem: (item) => (
        <span className="font-medium">
          {(item.data as { title: string }).title}
        </span>
      ),
      onItemAdd: (startDate, endDate, rowIndex) => {
        const newItem: TimelineItem = {
          id: `new-task-${Date.now()}`,
          startDate,
          endDate,
          data: {
            title: `New Task (Row ${rowIndex})`,
            color: "bg-purple-500 text-white",
          },
        }
        setItems((prev) => [...prev, newItem])
      },
    }

    return (
      <div className="flex h-screen w-full flex-col bg-muted/20 p-8 font-sans">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sidebar & Sub-items
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demonstrates row nesting modes, expandable parent tasks, and
              resizable labels sidebar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border bg-background p-1 shadow-sm">
              {(["disabled", "flattened", "nested"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSubItemMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    subItemMode === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSidebarVisible((v) => !v)}
              className={`rounded-lg border px-4 py-2 text-xs font-medium shadow-sm transition-all ${
                sidebarVisible
                  ? "bg-background text-foreground hover:bg-muted"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <TimelineProvider config={config}>
            <Timeline />
          </TimelineProvider>
        </div>
      </div>
    )
  },
}

export const WithDependenciesAndOffscreen: Story = {
  render: function DependenciesStory() {
    const [subItemMode, setSubItemMode] = useState<
      "disabled" | "flattened" | "nested"
    >("nested")
    const [sidebarVisible, setSidebarVisible] = useState(true)
    const [dependenciesEnabled, setDependenciesEnabled] = useState(true)
    const [items, setItems] = useState<TimelineItem[]>([
      {
        id: "offscreen-left-1",
        startDate: new Date("2026-06-15"),
        endDate: new Date("2026-06-25"),
        data: {
          title: "Pre-kickoff Planning (Offscreen Left)",
          color: "bg-indigo-500 text-white",
        },
      },
      {
        id: "parent-1",
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-20"),
        data: { title: "Planning", color: "bg-blue-500 text-white" },
      },
      {
        id: "child-1a",
        parentId: "parent-1",
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-14"),
        data: {
          title: "Requirements Gathering",
          color: "bg-blue-400 text-white",
        },
      },
      {
        id: "child-1b",
        parentId: "parent-1",
        startDate: new Date("2026-07-13"),
        endDate: new Date("2026-07-19"),
        data: { title: "Architecture Design", color: "bg-blue-400 text-white" },
      },
      {
        id: "parent-2",
        startDate: new Date("2026-07-18"),
        endDate: new Date("2026-07-28"),
        data: { title: "Implementation", color: "bg-emerald-500 text-white" },
      },
      {
        id: "child-2a",
        parentId: "parent-2",
        startDate: new Date("2026-07-18"),
        endDate: new Date("2026-07-25"),
        data: {
          title: "Frontend Components",
          color: "bg-emerald-400 text-white",
        },
      },
      {
        id: "child-2b",
        parentId: "parent-2",
        startDate: new Date("2026-07-22"),
        endDate: new Date("2026-07-28"),
        data: {
          title: "Backend Integration",
          color: "bg-emerald-400 text-white",
        },
      },
      {
        id: "standalone-3",
        startDate: new Date("2026-07-15"),
        endDate: new Date("2026-07-25"),
        data: { title: "Security Review", color: "bg-amber-500 text-white" },
      },
      {
        id: "offscreen-right-1",
        startDate: new Date("2026-08-15"),
        endDate: new Date("2026-08-25"),
        data: {
          title: "Production Deployment (Offscreen Right)",
          color: "bg-indigo-500 text-white",
        },
      },
    ])

    const dependenciesList = [
      {
        id: "dep-1",
        fromItemId: "child-1a",
        toItemId: "child-1b",
        type: "finish-to-start" as const,
      },
      {
        id: "dep-2",
        fromItemId: "child-1b",
        toItemId: "child-2a",
        type: "finish-to-start" as const,
      },
      {
        id: "dep-3",
        fromItemId: "child-2a",
        toItemId: "child-2b",
        type: "finish-to-start" as const,
      },
    ]

    const config: TimelineConfig = {
      items,
      viewportMode: "day",
      snapToGrid: true,
      sidebar: sidebarVisible,
      subItems: subItemMode,
      dependencies: dependenciesEnabled,
      dependenciesList,
      renderBar,
      renderSidebarItem: (item) => (
        <span className="text-xs font-medium">
          {(item.data as { title: string }).title}
        </span>
      ),
      onItemAdd: (startDate, endDate, rowIndex) => {
        const newItem: TimelineItem = {
          id: `new-task-${Date.now()}`,
          startDate,
          endDate,
          data: {
            title: `New Task (Row ${rowIndex})`,
            color: "bg-purple-500 text-white",
          },
        }
        setItems((prev) => [...prev, newItem])
      },
    }

    return (
      <div className="flex h-screen w-full flex-col bg-muted/20 p-8 font-sans">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Dependencies & Offscreen indicators
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demonstrates connection routing between dependent items and
              offscreen navigation indicators at viewport boundaries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border bg-background p-1 shadow-sm">
              {(["disabled", "flattened", "nested"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSubItemMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    subItemMode === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSidebarVisible((v) => !v)}
              className={`rounded-lg border px-4 py-2 text-xs font-medium shadow-sm transition-all ${
                sidebarVisible
                  ? "bg-background text-foreground hover:bg-muted"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
            </button>

            <button
              onClick={() => setDependenciesEnabled((d) => !d)}
              className={`rounded-lg border px-4 py-2 text-xs font-medium shadow-sm transition-all ${
                dependenciesEnabled
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {dependenciesEnabled
                ? "Disable Dependencies"
                : "Enable Dependencies"}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <TimelineProvider config={config}>
            <Timeline />
          </TimelineProvider>
        </div>
      </div>
    )
  },
}
