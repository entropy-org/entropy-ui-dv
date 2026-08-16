import { render, screen } from "@testing-library/react"
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

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByText("Surface: All")).toBeInTheDocument()
    expect(screen.getByRole("tablist", { name: "Data views" })).not.toContainElement(
      screen.getByRole("button", { name: "Add a view" })
    )
    await user.click(screen.getByRole("tab", { name: "Dates" }))
    expect(onActiveViewIdChange).toHaveBeenCalledWith("calendar")
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

  it("composes under a host header without rendering a second title", () => {
    render(
      <section aria-label="Host section">
        <h2>Host-owned title</h2>
        <DatabaseViews
          chrome={{ mode: "embedded" }}
          title="Hidden database title"
          source={{ mode: "client", id: "tasks", records }}
          schema={schema}
          views={views}
          activeViewId="list"
          onActiveViewIdChange={() => undefined}
          onIntent={() => undefined}
          renderView={() => <div>Embedded surface</div>}
        />
      </section>
    )

    expect(screen.getByRole("heading", { name: "Host-owned title" })).toBeVisible()
    expect(screen.queryByText("Hidden database title")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toBeVisible()
    expect(document.querySelector("[data-edv-part='database-views']")).toHaveAttribute(
      "data-edv-chrome",
      "embedded"
    )
  })
})
