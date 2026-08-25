import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DatabaseViews } from "./database-views.js"
import { createSavedDataView } from "./saved-views.js"
import type { DataViewSchema } from "./types.js"

interface RecordFixture {
  readonly id: string
  readonly title: string
}

const records: readonly RecordFixture[] = [{ id: "one", title: "First" }]
const schema: DataViewSchema<RecordFixture> = {
  adapter: {
    getId: (record) => record.id,
    getLabel: (record) => record.title,
  },
  properties: [
    { id: "title", label: "Title", type: "title", getValue: (record) => record.title },
  ],
}
const views = [
  createSavedDataView({ id: "list", name: "All", definition: { type: "list" } }),
  createSavedDataView({
    id: "calendar",
    name: "Dates",
    definition: { type: "calendar", datePropertyId: "title" },
  }),
]

describe("DatabaseViews", () => {
  it("owns shell chrome while delegating the active surface", async () => {
    const user = userEvent.setup()
    const onActiveViewIdChange = vi.fn()
    const onViewsChange = vi.fn()
    const onIntent = vi.fn()
    const onCreateViewRequest = vi.fn()
    render(
      <DatabaseViews
        source={{ mode: "client", id: "tasks", label: "Tasks", records }}
        schema={schema}
        views={views}
        activeViewId="list"
        onActiveViewIdChange={onActiveViewIdChange}
        onViewsChange={onViewsChange}
        onIntent={onIntent}
        onCreateViewRequest={onCreateViewRequest}
        renderView={({ view }) => <div>Surface: {view.name}</div>}
      />
    )

    expect(screen.getByRole("region", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByText("Surface: All")).toBeInTheDocument()
    expect(screen.getByRole("tablist", { name: "Data views" })).not.toContainElement(
      screen.getByRole("button", { name: "Add a view" })
    )
    await user.click(screen.getByRole("tab", { name: "Dates" }))
    expect(onActiveViewIdChange).toHaveBeenCalledWith("calendar")
    await user.click(screen.getByRole("button", { name: "Search All" }))
    await user.type(screen.getByRole("textbox", { name: "Search All" }), "ship")
    expect(onViewsChange).toHaveBeenLastCalledWith(
      expect.any(Array),
      { type: "query", viewId: "list" }
    )
    await user.click(screen.getByRole("button", { name: "New" }))
    expect(onIntent).toHaveBeenCalledWith({
      type: "create-record",
      view: views[0],
    })
  })

  it("keeps the engine-specific header inside the active surface", () => {
    const onViewsChange = vi.fn()
    render(
      <section aria-label="Host section">
        <h2>Host-owned title</h2>
        <DatabaseViews
          title="Task database"
          source={{ mode: "client", id: "tasks", records }}
          schema={schema}
          views={views}
          activeViewId="list"
          onActiveViewIdChange={() => undefined}
          onViewsChange={onViewsChange}
          onIntent={() => undefined}
          renderView={() => (
            <div>
              <header>Engine navigation</header>
              <div>Surface</div>
            </div>
          )}
        />
      </section>
    )

    expect(screen.getByRole("heading", { name: "Host-owned title" })).toBeVisible()
    expect(screen.getByText("Engine navigation")).toBeVisible()
    expect(screen.getByRole("button", { name: "New" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Search All" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "View settings for All" })
    ).toBeVisible()
  })

  it("can hide all settings without moving settings ownership to the host", () => {
    render(
      <DatabaseViews
        source={{ mode: "client", id: "tasks", records }}
        schema={schema}
        views={views}
        activeViewId="list"
        settings={false}
        onActiveViewIdChange={() => undefined}
        onViewsChange={() => undefined}
        renderView={() => <div>Surface</div>}
      />
    )

    expect(
      screen.queryByRole("button", { name: "View settings for All" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Search All" })).toBeVisible()
  })

  it("renders view-specific settings with user-facing labels", async () => {
    const user = userEvent.setup()
    render(
      <DatabaseViews
        source={{ mode: "client", id: "tasks", records }}
        schema={schema}
        views={views}
        activeViewId="calendar"
        onActiveViewIdChange={() => undefined}
        onViewsChange={() => undefined}
        renderView={() => <div>Surface</div>}
      />
    )

    await user.click(
      screen.getByRole("button", { name: "View settings for Dates" })
    )
    const settings = screen.getByRole("dialog", { name: "Dates" })
    expect(within(settings).getByText("Monday")).toBeVisible()
    expect(within(settings).getByText("Compact")).toBeVisible()
    expect(within(settings).getByText("12 hour")).toBeVisible()
  })

  it("lets a renderer hide only unsupported user settings", async () => {
    const user = userEvent.setup()
    render(
      <DatabaseViews
        source={{ mode: "client", id: "tasks", records }}
        schema={schema}
        views={views}
        activeViewId="list"
        settings={{ hidden: ["density"] }}
        onActiveViewIdChange={() => undefined}
        onViewsChange={() => undefined}
        renderView={() => <div>Surface</div>}
      />
    )

    await user.click(
      screen.getByRole("button", { name: "View settings for All" })
    )
    const settings = screen.getByRole("dialog", { name: "All" })
    expect(within(settings).queryByText("Density")).not.toBeInTheDocument()
    expect(within(settings).getByText("Column labels")).toBeVisible()
  })
})
