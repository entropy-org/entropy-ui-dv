# Data List

`DataList` is a production-oriented, Notion-style database list. It emphasizes record identity, compact secondary
properties, grouping, hierarchy, selection, editing, manual order, and large datasets. It is not a table, page editor,
or record-detail form.

## Quick start

```tsx
import { DataList, DataListProvider } from "@/components/list"
import type { DataListConfig, DataListItem } from "@/components/list"

type Task = { title: string; status: string }

function TaskList({ items }: { items: readonly DataListItem<Task>[] }) {
  const config: DataListConfig<Task> = {
    items,
    renderTitle: ({ item }) => item.data.title,
    getItemLabel: (item) => item.data.title,
    properties: [{
      id: "status",
      label: "Status",
      accessor: (task) => task.status,
      capabilities: { searchable: true, sortable: true },
      render: ({ value }) => String(value),
    }],
    operations: {
      mode: "client",
      getSearchText: (item) => `${item.data.title} ${item.data.status}`,
    },
    selection: { mode: "multiple" },
  }

  return <DataListProvider config={config}><DataList /></DataListProvider>
}
```

Every provider creates an isolated Zustand store. The same authoritative records can therefore back a list, calendar,
timeline, table, or board without sharing private component state. Items and saved preferences remain caller-owned;
Zustand contains only transient focus, selection, disclosure, editing, drag, history, and viewport state.

## Data and operation ownership

- IDs and property IDs must be stable and non-empty. Duplicate IDs are reported through `onError` and ignored
  deterministically.
- `client` operations run search, filters, stable sort, grouping/hierarchy composition, then flattening. Property values
  are cached once per model pass.
- `server` operations treat `items` as already resolved. The list reports requests through `onOperationsChange` and never
  reapplies remote sort/filter/search locally.
- Server mode supports controlled page navigation and cursor/infinite loading. `loadedCount`, `matchingCount`, and
  `totalCount` remain distinct so partial results and all-matching selection are represented honestly.
- Every operation request carries an instance-local `requestId` and reason. Put the operation descriptors in the TanStack
  Query key; the component never stores responses or decides which response is current.
- Search only uses `getSearchText` or explicitly searchable primitive property values. Opaque record data is never
  serialized.
- For remote or unbounded datasets, prefer server mode. Client mode is intended for data already available in memory.

See [TanStack Query integration](./TANSTACK_QUERY.md) for a complete cursor-loading and optimistic-edit adapter.

## Grouping and hierarchy

`grouping.mode: "derived"` creates canonical groups from `getKey`; `resolved` accepts caller-supplied groups. Group keys,
not rendered labels, are identities. Headers can collapse, show aggregates, and emit per-group add context without the
list creating domain drafts.

Hierarchy supports `disabled`, `flattened`, and `nested`. Nested mode uses tree semantics, validates parents/cycles/depth,
and never renders a record twice. A parent outside the current group is treated as an orphan in that section and
reported without taking down the list.

## Selection and actions

Selection can be disabled, single, or multiple. Multiple mode supports replace, modifier toggle, visible range,
select-visible, and an `all-matching` descriptor with exclusions. All-matching selection never materializes unknown
server IDs. `renderRowActions` and `renderBulkActions` own action content while the list owns placement, focus, scope, and
pending chrome.

Delete, duplicate, restore, edit, and reorder callbacks receive typed commands with deterministic mutation IDs. Commands
never mutate caller records. Editing and reorder use local visual previews. A rejected callback promise rolls the preview
back; a resolved promise accepts it. Synchronous handlers may return `await-authoritative`, while
`mutationSettlements` handles server canonicalization or an externally coordinated conflict. `onCommandSettled` reports
the final source and outcome. Consumers own persistence, permissions, rank generation, and record forms.

## Editing and manual order

Provide `titleEditor` or a property `editor` plus `onEdit`. Built-in scalar editing supports Enter, Escape, blur policy,
sync/async validation, IME safety, accessible validation messages, and pending confirmation. Custom editors receive
value, validation, pending, commit, and cancel controls.

Manual order appears only when `onReorder` exists, the list is writable, and no client search/filter/sort makes the
destination ambiguous. Server mode must explicitly set `manualOrderAllowed`. Reorder commands describe moved IDs and
before/after neighbors; the consumer calculates ranks. Pointer and keyboard moves use the same destination resolver.

## Keyboard and accessibility

The semantic root is a `list`, `listbox`, or `tree` according to configuration. One row participates in roving focus.

| Keys | Behavior |
| --- | --- |
| Arrow Up/Down, Home/End, Page Up/Down | Move logical row focus, including virtual rows |
| Enter | Activate the focused record |
| F2 | Edit the title when available |
| Escape | Cancel editor/reorder, then clear selection |
| Ctrl/Cmd+A | Select visible records or all matching when enabled |
| Ctrl/Cmd+D, Delete | Duplicate or delete the selected scope |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Emit undo/redo callbacks |
| Space, arrows, Space | Pick up, position, and drop manual-order rows |
| Arrow Left/Right | Collapse/expand focused tree parents |

Live regions announce results, selection scope, edits, validation, reorder, and rollback. Focus, selection, pending, and
errors have non-color-only treatments; animations honor reduced motion; forced colors retain boundaries and focus.
Consumer renderers must provide a useful `getItemLabel`; the stable ID is only a fallback.

## Virtualization and performance

TanStack Virtual uses one flattened stream of group and item entries with stable keys, bounded overscan, measured rows,
logical focus restoration, and a noninteractive sticky group mirror. The verified fixture is 50,000 records; mounted DOM
stays bounded. Keep item/property arrays and render callbacks stable, make accessors pure and inexpensive, and avoid
mounting heavy popovers in every row. `virtualization: false` is useful for small embedded lists and deterministic tests.

## States and resilience

Built-in surfaces cover initial loading, non-blocking refresh, empty, filtered-empty, blocking/refresh error, retry,
no-access, and read-only. Custom row/property/editor/control/action/state renderers are contained by error boundaries;
`onError` receives structured context without serializing opaque data. Read-only preserves search, navigation, selection,
copy-oriented actions, and activation while removing every mutation affordance.

## Scope

Supported: primary identity, compact properties, client/server operations, grouping, hierarchy, selection, actions,
inline editing, manual order, virtualization, and caller-owned detail activation.

Out of scope: arbitrary table headers, spreadsheet cell navigation, board columns, rich page content, comments,
permission storage, remote fetching, persistence, and record-detail forms.

## Migration notes

- Existing client-mode configuration is unchanged.
- Server filters now accept optional `propertyId`, `operator`, and `value` fields; an existing `{ id }` descriptor remains
  valid.
- `onOperationsChange` now receives `reason` and `requestId` in addition to query, filters, and sort.
- Promise-returning mutation handlers settle when the promise settles. A synchronous edit/reorder handler keeps the
  optimistic preview until matching authoritative items arrive, or it can return an explicit mutation result.
- Controlled selection (`selection.value`) is strictly caller-owned. Server mode retains explicit IDs that are not in the
  currently loaded page.

## Verification

```sh
pnpm test:list
pnpm typecheck:list
pnpm lint:list
```
