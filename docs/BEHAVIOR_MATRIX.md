# Behavioral compatibility matrix

This matrix is the extraction acceptance baseline. “Controlled” means the
consumer remains authoritative; the view may project an optimistic result but
must reconcile or roll back.

| Capability | List | Kanban | Calendar | Timeline |
| --- | --- | --- | --- | --- |
| Standalone and embedded chrome | Yes | Yes | Yes | Yes |
| Keyboard navigation | Row/tree arrows, Home/End | Card/group arrows | Date-grid arrows | Row/bar shortcuts |
| Multi-selection | Explicit/all matching | Visible cards | Visible events | Visible rows |
| Pointer move | Manual row reorder | Cards and groups | Events | Bars |
| Resize | — | Column preferences | Event edges | Bar edges/sidebar |
| Create placement | Group/parent | Group/swimlane | Date/range | Row/date range |
| Undo/redo | Commands | Optimistic ledger | Commands | Mutation coordinator |
| Client query | Search/filter/sort | Search/filter | Search/range | Search/range |
| Server query state | Page/infinite | Page/intersection | Visible range | Bidirectional range |
| Virtualization | Rows | Groups/cards | Lane layout | Rows/time grid |
| Hierarchy | Flat/nested tree | Swimlanes | Sources/agenda | Flat/nested rows |
| Empty/loading/error/stale | Yes | Yes | Yes | Yes |
| Read-only mode | Yes | Yes | Yes | Yes |
| Independent instances | Store per provider | Store per provider | Store per provider | Store per provider |

## Mutation lifecycle

1. The view emits a typed command or a generic record intent.
2. The consumer validates permissions and updates its cache or service.
3. The view may show an optimistic projection tied to a client operation id.
4. An accepted authoritative snapshot confirms the operation.
5. Rejection, conflict, timeout, or supersession rolls back or reconciles.
6. Domain errors remain consumer-owned and are not converted into local data.

## Keyboard invariants

- Interactive editors, inputs, and content-editable descendants retain their
  native keyboard behavior.
- Escape cancels the active pointer/keyboard interaction before it closes a
  containing consumer flow.
- Focus is restored to a stable view control after popovers and settings close.
- Hidden views unmount. They do not retain observers, drag sessions, or hotkeys.
- Forced colors and reduced motion retain state and focus visibility.

The inherited characterization suite plus core contract tests is the automated
record of this matrix. Browser-level keyboard and zoom checks remain release
gates, not optional examples.
