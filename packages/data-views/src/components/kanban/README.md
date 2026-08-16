# Kanban

`Kanban` is a desktop-first controlled board for an independent collection or the same authoritative records shown in another view. The caller owns records, ranks, persistence, permissions, forms, and conflict resolution. Each mounted provider owns only isolated selection, focus, search, drag previews, announcements, and bounded command metadata.

## Basic use

```tsx
import { Kanban, KanbanProvider, type KanbanConfig } from "@/components/kanban"

const config: KanbanConfig = {
  cards,
  groups,
  renderCard: (card, state) => (
    <TaskCard task={card.data as Task} selected={state.selected} />
  ),
  renderGroupHeader: (group) => (group.data as Status).name,
  getCardLabel: (card) => (card.data as Task).title,
  getSearchText: (card) => (card.data as Task).title,
  onCommand: (command) => persistKanbanCommand(command),
}

export function ProjectBoard() {
  return (
    <KanbanProvider config={config}>
      <Kanban className="h-[720px]" />
    </KanbanProvider>
  )
}
```

Never reuse a provider between independent boards. It intentionally creates one vanilla Zustand store per mount, so overlapping card IDs in two boards cannot share selection, history, focus, shortcuts, or announcements.

## Data and ordering

Cards explicitly declare `groupId`, optional `swimlaneId`, an opaque `rank`, and caller data. Groups and swimlanes also carry opaque ranks. Ranks are compared lexically and must be unique in their scope. When swimlanes are configured, every card must have a valid `swimlaneId`; when they are absent, cards must omit it.

The board does not manufacture a database rank. Move and group-reorder commands provide `beforeId` and `afterId`:

- both `null`: the destination is empty;
- `beforeId: null`: insert at the start;
- `afterId: null`: insert at the end;
- both present: insert between those records.

The consumer calculates its own fractional, integer, lexicographic, or collaborative rank and may rebalance its records. Invalid IDs, ranks, placements, lanes, and WIP maxima are excluded and reported once per provider through `onInvalidItem`; caller arrays are never changed.

## Commands and reconciliation

Record mutations are atomic intent commands: `move-cards`, `reorder-groups`, `delete-cards`, `restore-cards`, and `duplicate-cards`. Each includes a stable `clientMutationId`. Bulk movement preserves visible selection order and either emits one command or, for a hard WIP violation, emits none.

For production, `onCommand` should return its promise and resolve to `{ status: "accepted", dataVersion? }` or `{ status: "rejected", code, message }`. The command remains `submitting` while the promise is unresolved, so an optimistic Query-cache update cannot be mistaken for server confirmation. It then remains `awaiting-data` until controlled records and, when supplied, `dataVersion` confirm placement and order. Older overlapping responses are superseded by the later command. `pendingTimeoutMs`, `onCommandSettled`, and `onMutationRejected` expose the complete lifecycle.

A thrown/rejected promise is a transport or consumer failure. Structured rejection codes cover server conflicts, missing records, permissions, validation, and WIP. The history journal contains IDs, placements, ranks, and neighbors only—never caller records or Query snapshots. `createKanbanOptimisticLedger` keeps consumer-owned snapshots outside Zustand and safely reapplies newer create/update/delete/move/reorder layers when an older request fails. Duplicate commands are not automatically undoable because the board cannot know server-allocated IDs.

See [TanStack Query production integration](TANSTACK_QUERY.md) for a concrete concurrent optimistic-cache example, paging, server search, revisions, idempotency, live updates, and rank compaction.

For a shared collection, adapt the same domain records into `KanbanCard`, calendar items, timeline items, or list rows independently. Do not place that collection in the board store.

## Preferences, WIP, and swimlanes

Preferences are controlled through `preferences` and `onPreferencesChange`: density, column width, group/lane collapse, and WIP visibility. The settings panel clamps column widths to 240–520 pixels. Collapse callbacks emit one complete next preference object plus a discriminated change.

WIP is counted from all accepted authoritative cards in a group, regardless of search or consumer filtering. For partial pages, `getGroupCardCount` must return the server total. A warning limit permits a drop and exposes warning render state. A hard limit blocks the entire pointer or keyboard drop, and the server must enforce it again transactionally. Reordering within a group does not double-count moved cards. Hiding WIP labels never disables enforcement.

`dataState` distinguishes initial loading, usable partial data, ready/refetching data, stale-data errors, and fatal errors. `getPageState` plus `onLoadMore` handles each group/lane independently and includes a request ID for idempotency. `search.mode` may be `local`, `server`, or `hybrid`; server/hybrid input is handed to `onQueryChange`, while the consumer controls the resulting records.

## Keyboard and accessibility

- Arrow keys move the logical card focus; Left/Right cross groups.
- Shift+Arrow extends the selection from its explicit anchor.
- Ctrl/Cmd+A selects visible cards; Ctrl/Cmd+F focuses search.
- Space picks up or drops selected cards; arrows change the destination; Escape cancels.
- Enter opens the focused card.
- N invokes the focused card's column/lane add action; C toggles its controlled group collapse state.
- Delete/Backspace deletes; Ctrl/Cmd+D duplicates; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo/redo.

Cards retain `option` selection semantics around custom renderer output, exactly one visible card is the roving tab stop, and the board announces pickup, destination, WIP block, drop, cancellation, rejection, and invalid inputs. Renderer-owned buttons, links, inputs, selects, textareas, and content-editable elements do not trigger card selection/open shortcuts. Focus indicators, destination borders, and errors remain visible in forced colors; motion transitions are removed under reduced-motion preferences.

Card renderers provide content only. They must supply understandable visible content, avoid positive `tabIndex`, mark custom interactive descendants with `data-kanban-interactive` when they are not native controls, and keep expensive work memoized. Use `getCardLabel`, `getGroupLabel`, and `getSwimlaneLabel` for meaningful accessible names.

## Rendering and performance

The board horizontally overflows below its configured desktop geometry. TanStack Virtual windows boards at 20 or more groups and intersections at 40 or more cards. Virtual keys are stable IDs; focused and actively dragged groups/cards are pinned only while needed. Counts, selection, keyboard order, search, WIP, and accessibility positions use the complete display model. Overscan is configurable (default 6), and pointer auto-scroll covers horizontal and vertical scroll owners. The `Benchmark5000` story contains 5,000 cards and 100 groups.

Custom renderers determine most card cost. Keep their output stable and avoid fetching in render. Server records and rollback snapshots belong in a query/cache layer, not Zustand. `dataState` is explicit—an empty cards array is never treated as loading.

## Resilience and support boundary

Consumer renderer errors are contained to one board and can be reset through the default or custom error state. Controlled entity removal cancels unsafe drag destinations. Read-only mode retains search, selection, focus, open, and view settings while removing command and drag affordances.

The supported surface is desktop Chromium/Firefox/Safari-class browsers with pointer or keyboard input. Horizontal scrolling is intentional at narrow widths and 200% zoom. Nested sub-boards, free-form positioning, dependencies, comments, automation, forms, server fetching, and persistence are caller concerns.

Manual acceptance checklist: Windows Chromium with NVDA discovery/counts/selection/keyboard drag/WIP/search/rejection/settings; keyboard-only operation; Windows forced colors; reduced motion; dark/light contrast; and 200% zoom at a 1024-pixel viewport.

## Verification

```sh
pnpm test:kanban
pnpm typecheck:kanban
pnpm lint:kanban
```
