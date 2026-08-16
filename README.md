# Entropy Data Views

[Documentation and live examples](https://entropy-org.github.io/entropy-ui-dv/) · [npm](https://www.npmjs.com/package/@entropy-ui/data-views)

`@entropy-ui/data-views` is a controlled React component library for showing
the same records as a list, kanban board, calendar, or timeline. It also
includes a Notion-inspired database shell with saved views and one composable
toolbar.

The library owns view layout, interaction, accessibility, transient state,
and optimistic presentation. Applications own records, fetching, persistence,
permissions, domain forms, and conflict resolution.

The extraction and application migration are complete, and the
`0.1.0-next.1` release candidate is public on npm. Stable promotion remains a
release-owner action; see `docs/RELEASE.md`.

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

## Documentation site

The public site is a workspace consumer under `apps/docs`. It imports only
declared package exports and includes live database, list, kanban, calendar,
and timeline examples.

```sh
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Merges to `main` deploy the production build to GitHub Pages after the `CI`
workflow succeeds.
