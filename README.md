# Entropy Data Views

`@entropy-ui/data-views` is a controlled React component library for showing
the same records as a list, kanban board, calendar, or timeline. It also
includes a Notion-inspired database shell with saved views and one composable
toolbar.

The library owns view layout, interaction, accessibility, transient state,
and optimistic presentation. Applications own records, fetching, persistence,
permissions, domain forms, and conflict resolution.

The extraction and application migration are complete for the
`0.1.0-next.1` release candidate. Public npm publication and stable promotion
remain release-owner actions; see `docs/RELEASE.md`.

## Workspace commands

```sh
pnpm install
pnpm check
```

## Imports

```tsx
import { DatabaseViews } from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"
import { Calendar, CalendarProvider } from "@entropy-ui/data-views/calendar"
import { Kanban, KanbanProvider } from "@entropy-ui/data-views/kanban"
import { DataList, DataListProvider } from "@entropy-ui/data-views/list"
import { Timeline, TimelineProvider } from "@entropy-ui/data-views/timeline"
import "@entropy-ui/data-views/styles.css"
```

Architecture, ownership, persistence, forms, theming, SSR, migration, release
process, verification, and API policy are documented under [`docs`](./docs).
