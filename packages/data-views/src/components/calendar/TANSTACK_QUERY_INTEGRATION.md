# TanStack Query integration

The calendar is controlled. TanStack Query owns event records, range caching, optimistic snapshots, rollback,
invalidation, retry, and live updates. Calendar Zustand owns only per-instance navigation, focus, selection,
interaction previews, announcements, and command history.

```tsx
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Calendar,
  CalendarProvider,
  applyCalendarCommandOptimistically,
  getCalendarVisibleRange,
  type CalendarDataStatus,
  type CalendarItem,
  type CalendarMutationIntent,
  type CalendarQueryRange,
} from "@/components/calendar"

type EventsPage = {
  items: readonly CalendarItem[]
  revision: string
  complete: boolean
}

const [range, setRange] = useState<CalendarQueryRange>(
  getCalendarVisibleRange(initialAnchorDate, preferences)
)
const queryClient = useQueryClient()
const events = useQuery({
  queryKey: ["calendar-events", range] as const,
  queryFn: ({ signal }) => api.listEvents({ ...range, signal }),
  placeholderData: keepPreviousData,
})

const dataState: CalendarDataStatus = events.isPending
  ? { status: "loading", rangeKey: range.key }
  : events.isError
    ? {
        status: "error",
        rangeKey: range.key,
        error: events.error,
        hasUsableData: events.data !== undefined,
      }
    : events.isFetching
      ? {
          status: "refreshing",
          rangeKey: range.key,
          coverage: events.isPlaceholderData || !events.data.complete ? "partial" : "complete",
          updatedAt: events.dataUpdatedAt,
        }
      : {
          status: "ready",
          rangeKey: range.key,
          coverage: events.data.complete ? "complete" : "partial",
          updatedAt: events.dataUpdatedAt,
        }

const mutation = useMutation({
  mutationFn: (intent: CalendarMutationIntent) =>
    api.applyCalendarIntent(intent, { expectedRevision: events.data?.revision }),
  onMutate: async (intent) => {
    await queryClient.cancelQueries({ queryKey: ["calendar-events"] })
    const snapshots = queryClient.getQueriesData<EventsPage>({ queryKey: ["calendar-events"] })
    queryClient.setQueriesData<EventsPage>({ queryKey: ["calendar-events"] }, (current) =>
      current && intent.type === "command"
        ? {
            ...current,
            items: applyCalendarCommandOptimistically(
              current.items,
              intent.command,
              restoreTombstones(intent.command)
            ),
          }
        : current
    )
    return { snapshots }
  },
  onError: (_error, _intent, context) => {
    for (const [key, snapshot] of context?.snapshots ?? []) queryClient.setQueryData(key, snapshot)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
})

const config = {
  items: events.data?.items ?? [],
  preferences,
  dataMode: "visible-range" as const,
  dataState,
  onVisibleRangeChange: setRange,
  onDataRetry: () => events.refetch(),
  onMutationIntent: async (intent: CalendarMutationIntent) => {
    await mutation.mutateAsync(intent)
    return { status: "accepted" as const }
  },
  renderItem,
}

<CalendarProvider config={config}>
  <Calendar className="h-[720px]" />
</CalendarProvider>
```

Range keys include view, start/end dates, and IANA time zone. Mismatched payloads are blocked as stale. A refreshing
query can retain placeholder data and mark it partial; an error with usable data keeps the last records visible.

Use revision/ETag preconditions for writes. Restore Query snapshots on conflict, invalidate affected ranges, and apply
live records only when their revision is newer. Serialize dependent writes per record or reject all dependent optimistic
writes when an earlier write fails.

Create/update/duplicate/convert need application-specific optimistic ID/default logic. Use collision-proof client IDs
and retain delete tombstones for restore. Do not put these records in the calendar store.

Expand recurrence on the server or in the Query selector. Supply one item per occurrence with
`item.id === item.occurrence.occurrenceId`; preserve its series ID and original start when an exception moves, and omit
cancelled occurrences. Query by rendered dates and IANA zone, converting only timed boundaries to instants. All-day
dates stay date-only. The agenda keeps a visual 24-hour wall-clock grid on DST transitions; timed values remain
authoritative instants.

Month/week and agenda 1-9 day ranges are bounded. The calendar filters large inputs before layout and avoids a slot-cell
DOM matrix, so vertical virtualization is intentionally not enabled. If the API streams a range, report partial
coverage explicitly.
