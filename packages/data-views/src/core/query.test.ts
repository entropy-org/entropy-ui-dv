import { describe, expect, it } from "vitest"
import { applyDataViewQuery } from "./query.js"
import type { DataViewSchema } from "./types.js"

interface RecordFixture {
  readonly id: string
  readonly title: string
  readonly score: number
  readonly status: string
}

const schema: DataViewSchema<RecordFixture> = {
  adapter: {
    getId: (record) => record.id,
    getLabel: (record) => record.title,
  },
  properties: [
    { id: "title", label: "Title", type: "title", getValue: (record) => record.title },
    { id: "score", label: "Score", type: "number", getValue: (record) => record.score },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [],
      getValue: (record) => record.status,
    },
  ],
}

describe("applyDataViewQuery", () => {
  it("searches, filters, and stably sorts arbitrary records", () => {
    const records: readonly RecordFixture[] = [
      { id: "1", title: "Ship docs", score: 2, status: "ready" },
      { id: "2", title: "Ship package", score: 5, status: "ready" },
      { id: "3", title: "Draft roadmap", score: 9, status: "draft" },
    ]
    const result = applyDataViewQuery(
      records,
      {
        search: "ship",
        filters: [
          {
            type: "condition",
            id: "status-ready",
            propertyId: "status",
            operator: "equals",
            value: "ready",
          },
        ],
        sorts: [
          { id: "score-desc", propertyId: "score", direction: "descending" },
        ],
        grouping: [],
      },
      schema
    )

    expect(result.map((record) => record.id)).toEqual(["2", "1"])
  })
})
