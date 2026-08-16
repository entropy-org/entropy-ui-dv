# Calendar

Production desktop month, date-card week, and hourly agenda calendar with controlled server data, pointer and keyboard
scheduling, bounded overflow, multi-selection, search, settings, and reversible mutation commands.

## Quick start

```tsx
import {
  Calendar,
  CalendarProvider,
  createDefaultCalendarPreferences,
  type CalendarConfig,
} from "@/components/calendar"

const preferences = {
  ...createDefaultCalendarPreferences("America/Los_Angeles"),
  weekStartsOn: 1 as const,
}

const config: CalendarConfig = {
  items,
  preferences,
  initialAnchorDate: "2026-08-10",
  renderItem: (item) => (item.data as { title: string }).title,
  getItemAriaLabel: (item) => (item.data as { title: string }).title,
  getSearchText: (item) => (item.data as { title: string }).title,
  onItemMutation: applyCalendarCommand,
  onItemCreate: openCreateDialog,
  onPreferencesChange: savePreferences,
}

<CalendarProvider config={config}>
  <Calendar className="h-[720px] border" />
</CalendarProvider>
```

## Data semantics and ownership

`CalendarItem` is a discriminated union:

- `all-day` items use inclusive `YYYY-MM-DD` `startDate` and `endDate` values.
- `timed` items use half-open `[start, end)` JavaScript `Date` instants. Date-card views render them in date lanes;
  agenda renders them against a 24-hour wall-clock axis in the controlled IANA time zone.
- `data` is consumer-owned opaque metadata. Renderers may narrow it to an application type.
- duplicate IDs, reversed/invalid ranges, zero-duration timed items, and excessive spans are excluded and reported by
  `onInvalidItem`.

`items` and `preferences` are controlled values and never enter Zustand or browser storage. The consumer owns API
fetching, persistence, optimistic server updates, and recurrence expansion. Zustand stores only instance-local UI
state: viewport/focus, selection IDs, interaction previews, bounded command metadata, search, settings, overflow,
hover, and accessibility announcements.

For range-backed APIs, set `dataMode: "visible-range"`, use `onVisibleRangeChange` as a TanStack Query key input, and
pass the current query lifecycle through `dataState`. A mismatched range key is treated as an out-of-order payload and
is not reconciled. Loading, partial refresh, recoverable error, and retry states are rendered without creating a second
event cache. See the [TanStack Query integration](TANSTACK_QUERY_INTEGRATION.md).

An empty `visibleCalendarIds` list shows every calendar. `CALENDAR_NO_VISIBLE_SOURCES` represents no configured source
being visible without changing that established empty-list behavior. Uncategorized items remain visible when category
filters are active.

## Configuration

Required `CalendarConfig` fields:

| Field         | Purpose                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| `items`       | Controlled `CalendarItem[]`                                                                |
| `preferences` | Controlled view, week, density, overflow, category, time-zone, and time-format preferences |
| `renderItem`  | Event-card content                                                                         |

Common optional fields:

| Field                                                                           | Purpose                                                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `initialAnchorDate`, `locale`, `now`, `maxSpanDays`                             | Date/formatting boundaries                                                              |
| `readOnly`                                                                      | Removes create/move/resize/delete affordances while preserving navigation and selection |
| `getSearchText`, `getItemAriaLabel`                                             | Search and accessible event names                                                       |
| `renderTooltip`, `renderEmptyState`, `renderOverflowItem`, `renderHeaderAction` | Composition hooks                                                                       |
| `renderErrorState`, `onRenderError`                                             | Recovery UI and reporting for consumer renderer failures                                |
| `onItemMutation`, `onItemCreate`, `onItemDuplicate`, `onItemConvert`            | Scheduling and consumer-owned record intent callbacks                                   |
| `agenda`                                                                        | Agenda renderers, duration/minimum geometry, and optional code-configured sidebar       |
| `onPreferencesChange`, `onAnchorDateChange`                                     | Controlled navigation/preference callbacks                                              |
| `onInvalidItem`, `onMutationRejected`                                           | Validation and authoritative-data feedback                                              |
| `dataMode`, `dataState`, `onVisibleRangeChange`, `onDataRetry`                  | Range-query lifecycle, stale-response protection, and retry                             |
| `sources`, `permissions`                                                        | Stable source metadata and global/source/item capabilities                              |
| `onMutationIntent`                                                              | Unified create/update/move/resize/delete/restore/duplicate/convert data boundary        |

Move, resize, delete, undo, and redo emit `CalendarMutationCommand` values with stable client mutation IDs. The calendar
shows the pending range until controlled items confirm it. Promise rejection or conflicting authoritative data removes
the pending presentation, repairs the history branch, announces the failure, and calls `onMutationRejected`.

Creation emits a proposed range only; it enters history after the consumer creates an authoritative item.

`onMutationIntent` is the preferred production boundary and takes precedence over the legacy mutation callbacks. Its
explicit accepted/rejected outcome works with Query `onMutate` snapshots and rollback. Consumer-expanded recurring
items may include a stable `occurrence` identity; cancelled occurrences are omitted and exception scope remains a
backend concern.

## Views and interactions

- Month uses complete weeks, a weekday header, continued multi-week segments, controlled visible lanes, and accessible
  `+N more` popovers.
- Week is one full-height row of seven date columns, or five when weekends are hidden. It is not an hourly time grid.
- Agenda is the hourly engine. Its controlled span is Day, aligned Week, or a custom 2–9 visible days. Hidden weekends
  are skipped by day/custom traversal and omitted from aligned weeks.
- Agenda has a sticky day header, optional all-day lanes, a vertically scrolling 24-hour grid, working-hour shading,
  configurable 5/10/15/30/60-minute snapping and hour height, overlapping event columns, cross-midnight segments,
  and an injected-clock current-time marker.
- Agenda's optional sidebar is configured in code as `hidden`, `default`, or `custom`. The default composition supports
  mini-month navigation, controlled calendar-source filters, collapse, and bounded resizing.
- Click selects; Ctrl/Cmd-click toggles; Shift-click selects a visible range; Ctrl/Cmd+A selects visible items.
- Drag an event to move the full selection. Drag either event edge to resize. Click or drag empty dates to create.
- Search filters immediately and navigates to the first offscreen result.
- Edge dwell during drag navigates to the adjacent period.

## Keyboard shortcuts

| Shortcut                              | Action                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| Arrow keys                            | Move the roving date focus                               |
| Home / End                            | Move to the week boundary                                |
| Page Up / Page Down                   | Previous / next month or week                            |
| T                                     | Today                                                    |
| M / W / A                             | Request month / date-card week / agenda view             |
| Enter / Space                         | Create on the focused date                               |
| Ctrl/Cmd+A                            | Select all visible items                                 |
| Ctrl/Cmd+D                            | Emit duplicate intent for selected items                 |
| Shift+C (agenda)                      | Emit explicit all-day/timed conversion intent            |
| Alt+Left / Alt+Right                  | Move selected items one day                              |
| Alt+Shift+Left / Right                | Expand from the selected item's start/end                |
| Arrow Left / Right on a resize handle | Move that edge in either direction (shrink or expand)    |
| Delete / Backspace                    | Delete selected items                                    |
| Ctrl/Cmd+Z                            | Undo                                                     |
| Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y        | Redo                                                     |
| Escape                                | Cancel interaction, close overflow, then clear selection |

Shortcuts are ignored inside editable controls.

Inside the agenda time grid, Up/Down moves the roving time by the configured snap interval, Left/Right changes visible
day, Page Up/Down moves by an hour, and Home/End moves to working-hour bounds (Ctrl/Cmd uses full-day bounds). Enter or
Space proposes a timed item. Alt+arrow moves selected events by day or snap interval. Focus enters the time grid through
one tab stop rather than hundreds of DOM cells.

## Agenda quick start

```tsx
const preferences = {
  ...createDefaultCalendarPreferences("America/Los_Angeles"),
  viewMode: "agenda" as const,
  showWeekends: false,
  agenda: {
    ...createDefaultCalendarPreferences().agenda,
    span: { type: "custom", dayCount: 5 } as const,
    snapMinutes: 15 as const,
    hourHeight: 64,
  },
}

const config: CalendarConfig = {
  items,
  preferences,
  renderItem: (item) => (item.data as { title: string }).title,
  agenda: {
    sidebar: {
      type: "default",
      resizable: true,
      calendars: [
        { id: "work", label: "Work", color: "#4f8cff" },
        { id: "personal", label: "Personal", color: "#c778dd" },
      ],
    },
  },
}
```

All-day values remain date-only and never shift through UTC. Agenda's wall-clock grid remains visually 24 hours on DST
transition dates. Timed endpoints remain authoritative instants; wall-clock creation/movement resolves nonexistent local
times forward to the first valid minute, preserves elapsed duration when moving, and renders repeated local times at
their resolved instant. Consumers expand recurring occurrences before supplying `items`.

## Accessibility and resilience

- Month/week and agenda expose labeled grids, date/time headers, counts, current-date/time, multiselect, read-only, and
  busy semantics.
- Date cells use one roving tab stop. Root-scoped focus restoration prevents one calendar instance from focusing another.
- Events, overflow triggers, and resize handles are real buttons. `getItemAriaLabel` should always be supplied when an
  item ID is not a useful name.
- A polite live region announces navigation, selection, create/move/resize/delete, undo/redo, invalid data, and rejected
  actions.
- Motion respects `prefers-reduced-motion`; forced-colors styles preserve borders/status without color-only meaning.
- Errors thrown by consumer render functions are contained to the calendar. Use `renderErrorState` for branded recovery
  and `onRenderError` for reporting.

The supported desktop geometry is 960px (`MIN_CALENDAR_DESKTOP_WIDTH_PX`). `Calendar` contains horizontal overflow,
so it remains usable inside a narrower host without widening the page. At 200% zoom, users can scroll the calendar
surface horizontally.

## Performance contract

Only items intersecting the visible month/week enter date-lane layout. Agenda filters before splitting records into
visible all-day/timed segments; its sweep-line overlap model is pure and memoized by controlled inputs. Visible lane
limits bound all-day DOM; one focus proxy avoids a date-by-snap cell matrix. The opt-in
`expand-week` preference is capped by `MAX_EXPANDED_CALENDAR_LANES`. Pointer previews use one animation frame at a time,
overflow data is indexed once per model, and item-level selectors keep unrelated consumer renderers from rerendering on
hover or active-item state. Fixed density heights avoid per-event measurement observers and their invalidation cost.

## Advanced exports

The public index exports controlled-provider/store hooks, presentational primitives, constants, discriminated types,
and pure date-grid, normalization, lane-layout, range, mutation, search, command, preference, and render-model helpers.
`CalendarProvider` plus `Calendar` is the supported default composition.

See [migration guide](../../../docs/CALENDAR_MIGRATION.md),
[architecture decisions](../../../docs/ARCHITECTURE_DECISIONS.md), and
[rewrite plan](../../../docs/CALENDAR_REWRITE_PLAN.md).

## Verification

```sh
pnpm test:calendar
pnpm test:calendar:coverage
pnpm typecheck:calendar
pnpm lint:calendar
pnpm build-storybook
```
