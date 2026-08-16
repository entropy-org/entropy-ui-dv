# Kanban changelog

## 1.1.0

- Added two-stage command acknowledgement, monotonic data revisions, structured server rejections, superseding response handling, pending timeouts, and settlement callbacks.
- Added a consumer-owned optimistic ledger that safely rolls back concurrent create, update, delete, move, and reorder cache layers without putting server records in Zustand.
- Added controlled loading, partial, refetching, fatal/stale error, server/hybrid search, intersection paging, retry, idempotency-key, and authoritative WIP-count contracts.
- Added horizontal group virtualization with temporary focus/drag pins and retained ID-keyed vertical card virtualization.
- Added a concrete TanStack Query guide covering snapshots, rollback, infinite pages, live updates, rank generation/compaction, and server conflict handling.

## 1.0.0

- Added controlled cards, groups, opaque ordering ranks, and optional swimlanes.
- Added isolated per-instance selection, focus, search, drag preview, history metadata, and live announcements.
- Added pointer and keyboard card movement, group reordering, both-axis drag auto-scroll, multi-selection, bulk commands, undo/redo intents, collapse, settings, and WIP warning/hard enforcement.
- Added ID-keyed virtual card windows, a deterministic 5,000-card Storybook fixture, read-only behavior, renderer containment, forced-color/reduced-motion styles, and consumer documentation.
- Consumers remain responsible for authoritative data, ranks, persistence, permissions, forms, mutation confirmation, and server conflicts.
