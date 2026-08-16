# Timeline component

`Timeline` is a desktop-focused, reusable Gantt-style timeline. It keeps client-side interaction state in an isolated Zustand store while callers retain ownership of item data and item presentation.

## Use it

```tsx
import {
  Timeline,
  TimelineProvider,
  type TimelineConfig,
  type TimelineItem,
} from "@/components/timeline"

const config: TimelineConfig = {
  items,
  viewportMode: "week",
  sidebar: true,
  sidebarSubItems: "nested",
  rowSubItems: "flattened",
  dependencies: true,
  snapToGrid: true,
  rowHeight: 44,
  renderBar: (item, { isSelected }) => (
    <div className={isSelected ? "ring-2 ring-primary" : ""}>
      {(item.data as { title: string }).title}
    </div>
  ),
  renderSidebarItem: (item) => (
    <span>{(item.data as { title: string }).title}</span>
  ),
  onItemAdd: (startDate, endDate, rowIndex) => {
    // Create the item in the caller's data source.
  },
}

export function ProjectTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <TimelineProvider config={{ ...config, items }}>
      <Timeline className="h-[640px]" />
    </TimelineProvider>
  )
}
```

## Data model

Each `TimelineItem` needs an `id`, `startDate`, `endDate`, and arbitrary `data`. Set `parentId` to organize items as sub-items. Dependencies use finish-to-start routing from a source item to a target item.

`TimelineConfig` controls the initial viewport mode, optional sidebar, independent sidebar/grid sub-item presentation, dependency layer, grid snapping, row height, render functions, and callbacks. Use `sidebarSubItems` and `rowSubItems` for independent hierarchy behavior; the older `subItems` option remains a shorthand fallback for both. The full type definitions live in [types.ts](./types.ts).

## Production data ownership

Timeline is controlled. `config.items`, `config.dependenciesList`, and `config.dataVersion` are the authoritative server projection. The per-instance Zustand store contains viewport, selection, hierarchy expansion, interaction previews, and a temporary optimistic projection; it is not a server cache. TanStack Query should own fetching, caching, invalidation, retry policy, and durable optimistic cache updates.

IDs must be stable across refetches and pages. Dates must already be `Date` instances with `endDate > startDate`; normalize API strings in the query `select` function. Parent IDs and dependency endpoints should use the same item IDs. `validateTimelineItems` and `validateTimelineDependencies` are exported for API-boundary validation. `onDataValidationError` reports invalid controlled input without making Timeline a data owner.

`dataState` is a discriminated union for initial loading, ready/background-fetching, and error/stale-data states. Existing rows remain interactive when a background fetch fails and `hasStaleData` is true. For infinite queries, pass `hasPreviousPage`, `hasNextPage`, and the corresponding fetching flags, then handle `onLoadMore`. Timeline deduplicates edge requests until the edge or page availability changes.

```tsx
function ServerTimeline() {
  const [range, setRange] = useState<TimelineVisibleRange>()
  const queryClient = useQueryClient()
  const query = useInfiniteQuery({
    queryKey: ["project-timeline", projectId, range?.start, range?.end],
    queryFn: ({ pageParam, signal }) =>
      api.timeline.list({ projectId, range, cursor: pageParam, signal }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
    select: (result) => ({
      ...result,
      pages: result.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => ({
          ...item,
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate),
        })),
      })),
    }),
  })
  const save = useMutation({ mutationFn: api.timeline.mutate })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <TimelineProvider
      config={{
        items,
        dependenciesList: query.data?.pages.flatMap((p) => p.dependencies) ?? [],
        dataVersion: query.dataUpdatedAt,
        dataState: query.isPending
          ? { status: "loading" }
          : query.isError
            ? { status: "error", error: query.error, hasStaleData: items.length > 0 }
            : {
                status: "ready",
                isFetching: query.isFetching,
                hasNextPage: query.hasNextPage,
                isFetchingNextPage: query.isFetchingNextPage,
              },
        onVisibleRangeChange: setRange,
        onLoadMore: ({ direction }) => {
          if (direction === "next") void query.fetchNextPage()
        },
        onRetry: query.refetch,
        onMutation: async (intent) => {
          const response = await save.mutateAsync(intent)
          queryClient.setQueriesData(
            { queryKey: ["project-timeline", projectId] },
            response.queryData
          )
          return {
            status: "accepted",
            dataVersion: response.version,
            items: response.items,
            dependencies: response.dependencies,
          }
        },
        renderBar,
      }}
    >
      <Timeline className="h-[640px]" />
    </TimelineProvider>
  )
}
```

Use a range rounded to your backend's natural bucket in the query key if pixel-level scrolling would create overly granular keys. TanStack Query supplies the request `AbortSignal`; Timeline only reports the visible range and never starts a network request itself.

## Mutations, races, and rollback

`onMutation` receives a discriminated `TimelineMutationIntent` for create, update, delete, move, resize, bulk, dependency, and hierarchy operations. It may return an accepted/rejected outcome or a promise. Timeline applies item edits optimistically by default, rebases them over query-result churn, rolls back a rejected operation to the newest controlled snapshot, and reports whether an out-of-order response is still latest through `onMutationResult`.

Return canonical `items` when the mutation response includes them. Otherwise update the TanStack Query cache before resolving and advance `dataVersion`; the next controlled sync retires the accepted overlay. A newer canonical response supersedes older pending operations affecting the same item, so late responses cannot overwrite it. Live server changes to an item during drag/resize cancel that gesture rather than committing against stale dates. `onInteractionCancel` reports live-update, permission, Escape, and pointer cancellation.

`getItemPermissions` can independently deny view, selection, move, resize, update, delete, hierarchy, or dependency edits. `readOnly` remains the global override. Invalid or forbidden intents are rejected before `onMutation` is called.

### Migrating legacy callbacks

`onItemAdd`, `onItemsChange`, `onItemsDelete`, `onDependencyAdd`, and `onDependencyRemove` remain supported. New server-backed integrations should use `onMutation` because it supplies operation IDs, base data versions, previous snapshots, explicit outcomes, and race metadata. Local undo/redo remains available for legacy uncontrolled store actions; with `onMutation`, keyboard undo/redo is emitted as a bulk custom intent so the backend/cache stays authoritative.

## Interaction model

- Drag a bar to move it; drag either handle to resize it.
- Hour view positions and resizes in 15-minute increments. Every broader zoom level uses one-calendar-day increments.
- Hover a bar row to project its full date range onto the header. During resize, the active endpoint label follows the handle.
- The header settings button opens a single controller for time scale, sidebar and dependency visibility, grid snapping, and independent grid/sidebar hierarchy modes.
- In nested mode, the grid and sidebar each have their own compact chevron and expansion state. Small file-tree elbow arrows sit beside child items without drawing another full connection network across the grid.
- With dependency editing callbacks configured, drag the small gold port on a bar into another row to create a link. Use the minimal red × at the destination arrow to remove it.
- Shift-click selects a range, while Ctrl/Cmd-click toggles a bar in the selection.
- Delete/Backspace removes selected items. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo.
- `T` centers the current date. `+`/`-` change zoom level. Shift+wheel scrolls horizontally.
- Hovering an editable row shows an add-item affordance when `onItemAdd` is provided.

Set `readOnly` to disable edits while retaining navigation and rendering.

## Time scale

Zoom controls density without replacing the calendar with larger date blocks. Hour view keeps 15-minute interaction precision while labeling and guiding every 30 minutes with complete time labels. Week, bi-week, and month views show individual days, with month view using a closer, scrollable scale. Quarter and year views retain the same daily coordinate system and sample four day labels per month. Year view stays farther out than quarter view while keeping month groups comfortably legible.

Vertical guides are intentionally mode-specific: hour, day, week, and bi-week views show regular column structure; month view uses weekend shading without vertical guides; quarter and year views draw only month boundaries. A vertical guide marks today in every mode. The header shows the exact current time in hour view and circles today's date in broader views; interactive range highlights render above that marker.

Because every non-hour column represents one calendar day, bars retain exact dates across zoom changes and daylight-saving boundaries.

## Layout and performance

The component virtualizes fixed-height rows with TanStack Virtual and calendar-aware columns with an overscanned date window. Its horizontal canvas extends in batches as either edge approaches the viewport, so a timeline is not limited to the initial item range. Edge scrolling remains active while dragging or resizing, and the preview accounts for viewport movement to stay under the pointer.

Timeline bars are memoized, interaction previews update the DOM inside animation frames, and date changes are committed when the pointer is released. The grid fills the available component height even when there are only a few items. Offscreen items receive a compact directional control on their own visible row; hovering the control shows that item's tooltip.

The sidebar, grid, headers, today marker, dependency paths, indicators, and empty state are composed internally. Dependency links use the same smooth, hand-drawn-style amber curve before and after creation, with compact open arrowheads and adaptive offsets for crowded relationships. A draft that bends backward becomes subtly red to clarify its direction. Draft links and connected paths update imperatively in a single animation-frame loop during pointer movement, drag, and resize, while a forgiving invisible hover target keeps the narrow visual line easy to interact with. Coarse quarter and year scales keep the add affordance large enough to target without changing its one-day precision. Offscreen arrows use a generous proximity area, and both the arrow and its revealed content navigate to the item's precise start timestamp. Consumers customize item content through `renderBar`, `renderSidebarItem`, `renderTooltip`, and `renderEmptyState` rather than replacing this layout.

## Advanced exports

The package also exports interaction hooks, virtual-row helpers, dependency path helpers, and presentational building blocks for focused integrations. Prefer `TimelineProvider` and `Timeline` for standard usage; advanced exports are useful when extending a specific behavior while preserving the same store instance.
