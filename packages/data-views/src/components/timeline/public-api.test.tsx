import { describe, expect, it } from "vitest"
import {
  Timeline,
  TimelineProvider,
  validateTimelineItems,
  type TimelineConfig,
  type TimelineItem,
  type TimelineMutationIntent,
} from "./index.js"

describe("timeline public API", () => {
  it("supports controlled consumer composition", () => {
    const item = {
      id: "launch",
      startDate: new Date("2026-08-17T00:00:00Z"),
      endDate: new Date("2026-08-21T00:00:00Z"),
      data: { title: "Launch" },
    } satisfies TimelineItem

    const config = {
      items: [item],
      renderBar: (candidate) => candidate.id,
      onMutation: (intent: TimelineMutationIntent) => ({
        status: "accepted",
        operationId: intent.operationId,
      }),
    } satisfies TimelineConfig

    const element = (
      <TimelineProvider config={config}>
        <Timeline showHeader={false} aria-label="Launch timeline" />
      </TimelineProvider>
    )

    expect(element).toBeTruthy()
    expect(validateTimelineItems(config.items)).toEqual([])
  })
})
