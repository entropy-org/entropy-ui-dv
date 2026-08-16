# Publishable Data Views Library — Implementation Plan

Status: implementation complete through prerelease integration; public release pending external ownership
Working package name: `@entropy-ui/data-views`
Target repository: `entropy-data-views`
Source application: `entropy-ui`
Decision date: 2026-08-16
Last updated: 2026-08-16

Completion evidence and final commands are recorded in
[`TEST_MATRIX.md`](./TEST_MATRIX.md) and [`RELEASE.md`](./RELEASE.md). Phase
status is authoritative; the detailed checklists below preserve the original
acceptance design and are not used as a second release ledger.

## 1. Purpose

Extract the existing calendar, timeline, kanban, and list engines from
`entropy-ui` into a publishable React component library. The library must
support both:

1. independently mounted, production-grade data views; and
2. a Notion-inspired database shell that can display one controlled data
   source through multiple saved views.

The extraction is deliberately incremental. Existing view behavior and
consumer contracts are characterized before code is moved. The shared shell,
header composition, serializable saved-view model, and unified data-source
adapter are introduced only after the four engines pass their existing tests
outside the application.

## 2. Locked product and architecture decisions

The following decisions were accepted on 2026-08-16 and should not be reopened
without a written architecture decision record (ADR):

- Publish standalone view engines and a multi-view database shell.
- Accept arbitrary consumer record types through a generic property schema and
  adapters; do not require a library-owned normalized record database.
- Let users create, rename, duplicate, reorder, and delete saved views through
  controlled callbacks.
- Keep saved-view persistence, records, fetching, caching, permissions, and
  durable mutations consumer-owned.
- Keep domain create/edit/detail forms consumer-owned.
- Provide library-owned inline property editing for configured primitive or
  custom property editors.
- Ship a styled, token-driven v1 rather than a fully headless v1.
- Support React 18.3 and React 19, TypeScript, Vite, Next.js, modern evergreen
  browsers, and SSR-safe imports.
- Validate prereleases in `entropy-ui` before promoting a public stable release.
- Use one npm package and one release version for v1, with explicit subpath
  exports for tree-shakable view entry points.
- Use `@entropy-ui/data-views` as the working package name. Fall back to
  `@entropy-views/data-views` if the scope cannot be reserved.

## 3. Goals

- Preserve existing calendar, timeline, kanban, and list functionality,
  accessibility, keyboard behavior, virtualization, controlled mutation
  semantics, and per-instance state isolation.
- Present the same authoritative records through any supported view without
  copying server state into a library store.
- Define serializable, versioned saved-view configurations.
- Provide one coherent database toolbar rather than nested or duplicated
  headers.
- Allow each view to contribute view-specific navigation and settings to the
  shared toolbar.
- Provide typed create, open, inline-edit, reorder, move, resize, duplicate,
  delete, and bulk-action intents.
- Allow client-resolved and server-resolved search/filter/sort/group flows.
- Ship compiled CSS with a stable semantic token contract and no requirement
  that consumers run Tailwind over library source.
- Publish documented, intentionally limited public exports.
- Supply install fixtures, examples, migration documentation, and automated
  release checks.

## 4. Non-goals for v1

- Owning a database, API client, query cache, authentication, or permission
  store.
- Owning arbitrary domain record forms, record pages, comments, automations,
  or collaboration backends.
- Requiring TanStack Query; integration examples may use it, but the library
  contracts remain query-library agnostic.
- A rich Notion-style page editor.
- Spreadsheet formulas or general-purpose table functionality.
- A fully unstyled/headless implementation.
- React Native or non-React framework support.
- Cross-view synchronized transient selection unless a consumer explicitly
  controls it.
- Backward compatibility with deep imports into current `src/components/*`
  internals.

## 5. Current-state inventory

### 5.1 Package size and verification surface

Initial file inventory on 2026-08-16:

| View | Source files | Test files | Stories | Current dedicated commands |
| --- | ---: | ---: | ---: | --- |
| List | 23 | 5 | 1 | test, typecheck, lint |
| Kanban | 36 | 8 | 1 | test, typecheck, lint |
| Calendar | 59 | 35 | 1 | test, coverage, typecheck, lint |
| Timeline | 62 | 41 | 1 | test, typecheck, lint added in Phase 0 |

Timeline is the largest extraction surface. Phase 0 added symmetric
package-level verification commands before any timeline source movement.

### 5.2 Existing strengths to preserve

- Each view has a provider-created, per-instance Zustand store.
- Authoritative records are controlled inputs rather than Zustand-owned server
  data.
- Calendar, timeline, kanban, and list already expose render callbacks for
  consumer content.
- The engines already model loading/error/ready states, keyboard navigation,
  accessibility announcements, and optimistic interaction previews.
- Calendar, kanban, and list already have strongly controlled mutation
  boundaries.
- Timeline has a newer mutation-intent API alongside legacy callbacks.
- Every view supports hiding its built-in header for embedded composition.
- The application already proves that one domain record type can be projected
  into list, board, calendar, and timeline shapes.

### 5.3 Coupling that must be removed

- Package source imports application aliases such as `@/components/ui/*`,
  `@/lib/utils`, and `@/hooks/use-shift-wheel`.
- Styling assumes the application's Tailwind configuration and semantic CSS
  variables.
- Current application adapters read domain Zustand stores directly.
- `alignment-views.tsx` and `focus-views.tsx` repeatedly map the same records
  into view-specific item shapes.
- Saved preferences are currently stored as application workspace fields, not
  as versioned per-view definitions.
- The outer section toolbar disables inner headers and reimplements search,
  new-item actions, and calendar/timeline controls.
- `showHeader?: boolean` describes rendering, but not the composition contract
  between standalone and embedded modes.
- Public entry points export several low-level hooks and utilities that may be
  accidental rather than supported API.
- Timeline exposes both legacy mutation callbacks and the newer production
  mutation API, which must be normalized before v1.

### 5.4 Current application integration seam

The current application should be treated as the reference consumer, not as
library source. Its responsibilities remain:

- querying and filtering alignment/focus records;
- mapping domain fields to view roles;
- rendering domain badges, cards, list properties, and event bodies;
- applying commands to the application store or future query cache;
- opening create and edit dialogs;
- deciding which record kinds appear in each workspace section.

The extracted library must never import `alignment-*`, `focus-*`, application
routes, Clerk, or application stores.

## 6. Target repository and package layout

```text
entropy-data-views/
  .changeset/
  .github/workflows/
  apps/
    docs/                         # Storybook documentation and visual fixtures
    playground/                   # Manual Vite integration playground
  fixtures/
    next-app/                     # SSR and Next.js installation fixture
    vite-app/                     # Clean consumer installation fixture
  packages/
    data-views/
      src/
        core/
          data-source/
          properties/
          saved-views/
          mutations/
          selection/
          toolbar/
          view-registry/
        list/
        kanban/
        calendar/
        timeline/
        internal/
          primitives/
          styles/
          utilities/
        index.ts
      styles/
        index.css
        tokens.css
      package.json
      tsconfig.json
  package.json
  pnpm-workspace.yaml
```

Only `packages/data-views` is published in v1. Apps and fixtures are private.
Internal source folders do not imply public entry points.

### 6.1 Planned package exports

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",
    "./list": "./dist/list/index.js",
    "./kanban": "./dist/kanban/index.js",
    "./calendar": "./dist/calendar/index.js",
    "./timeline": "./dist/timeline/index.js",
    "./styles.css": "./dist/styles.css"
  }
}
```

The final export map must include matching TypeScript declaration conditions.
No wildcard public export is allowed for v1; each public entry point is
explicitly reviewed.

### 6.2 Dependency policy

Peer dependencies:

- `react`: `^18.3.0 || ^19.0.0`
- `react-dom`: `^18.3.0 || ^19.0.0`

Library implementation dependencies may include Zustand, TanStack Virtual,
dnd-kit, date-fns, and accessible primitive libraries. They are bundled or
declared as regular dependencies according to bundle analysis. Consumers must
not install shadcn components or copy application UI primitives.

## 7. Ownership model

| Concern | Library | Consumer |
| --- | --- | --- |
| View layout, interaction and accessibility | Owns | Configures |
| Records and data revisions | Reads controlled snapshots | Owns |
| Network fetching and query cache | Does not own | Owns |
| View-local transient state | Owns per mounted provider | May control selected pieces |
| Saved-view shape and migrations | Defines | Persists and authorizes |
| Active view | Supports controlled/uncontrolled | Usually controls/persists |
| Search/filter/sort/group descriptors | Models and renders | Resolves locally or remotely |
| Domain renderers | Provides slots and state | Owns content |
| Domain create/edit/detail forms | Emits context and slots | Owns UI and submission |
| Inline property editing | Owns interaction shell | Supplies accessor/editor/mutation |
| Permissions | Enforces supplied decisions | Supplies decisions |
| Optimistic interaction preview | Owns bounded transient preview | Owns authoritative cache update |
| Conflict resolution | Reports and reconciles contracts | Resolves durable conflict |
| Theme tokens and base CSS | Owns defaults | Overrides tokens |

## 8. Core contract design

Exact names can change during Phase 6, but the responsibility boundaries below
are normative.

### 8.1 Runtime property schema

```ts
type DataViewProperty<TRecord, TValue> = {
  readonly id: string
  readonly label: string
  readonly kind:
    | "title"
    | "text"
    | "number"
    | "date"
    | "date-range"
    | "select"
    | "multi-select"
    | "boolean"
    | "relation"
    | "custom"
  readonly getValue: (record: TRecord) => TValue
  readonly capabilities: {
    readonly searchable: boolean
    readonly sortable: boolean
    readonly filterable: boolean
    readonly groupable: boolean
    readonly editable: boolean
  }
  readonly render?: (context: PropertyRenderContext<TRecord, TValue>) => ReactNode
  readonly editor?: PropertyEditor<TRecord, TValue>
}
```

Runtime functions never appear in persisted saved-view JSON. Property IDs are
the stable bridge between runtime schema and serialized view definitions.

### 8.2 Controlled data source

```ts
type DataViewDataSource<TRecord> =
  | {
      readonly mode: "client"
      readonly records: readonly TRecord[]
      readonly getRecordId: (record: TRecord) => string
    }
  | {
      readonly mode: "server"
      readonly records: readonly TRecord[]
      readonly getRecordId: (record: TRecord) => string
      readonly totalCount?: number
      readonly queryState: DataViewQueryState
      readonly onQueryChange: (request: DataViewQueryRequest) => void
      readonly pagination?: DataViewPagination
    }
```

Both variants receive an explicit status discriminated union. The server
variant treats records as already resolved and never reapplies remote
operations locally.

### 8.3 Serializable saved views

```ts
type SavedDataView = {
  readonly schemaVersion: 1
  readonly id: string
  readonly name: string
  readonly type: "list" | "kanban" | "calendar" | "timeline"
  readonly query: DataViewQueryDefinition
  readonly config: SavedDataViewConfig
}

type SavedDataViewConfig =
  | { readonly type: "list"; readonly value: SavedListConfig }
  | { readonly type: "kanban"; readonly value: SavedKanbanConfig }
  | { readonly type: "calendar"; readonly value: SavedCalendarConfig }
  | { readonly type: "timeline"; readonly value: SavedTimelineConfig }
```

The repeated `type` discriminant is intentional: invalid type/config
combinations must fail at compile time and during runtime validation.

Saved definitions contain property IDs, not record accessors or React nodes.
Every schema change requires a pure migration and fixtures covering old JSON.

### 8.4 Mutation and flow intents

The core defines shared metadata and view-specific intent unions. It does not
erase the context required by a calendar or board.

```ts
type DataViewFlowIntent =
  | {
      readonly type: "create-record"
      readonly sourceViewId: string
      readonly defaults: Readonly<Record<string, unknown>>
      readonly placement?: DataViewPlacement
    }
  | {
      readonly type: "open-record"
      readonly sourceViewId: string
      readonly recordId: string
    }
  | {
      readonly type: "edit-property"
      readonly sourceViewId: string
      readonly recordId: string
      readonly propertyId: string
      readonly previousValue: unknown
      readonly proposedValue: unknown
      readonly mutationId: string
    }
```

View-specific movement and resize commands remain discriminated unions and
include stable neighbors, ranges, group/property IDs, and base data versions.

### 8.5 Saved-view persistence callbacks

The shell owns UI state for pending menus and drafts but does not persist:

```ts
type SavedViewsController = {
  readonly views: readonly SavedDataView[]
  readonly activeViewId: string
  readonly onActiveViewChange: (viewId: string) => void
  readonly onCreateView: (draft: NewSavedDataView) => void | Promise<void>
  readonly onUpdateView: (change: SavedDataViewChange) => void | Promise<void>
  readonly onDeleteView: (viewId: string) => void | Promise<void>
  readonly onReorderViews: (orderedIds: readonly string[]) => void | Promise<void>
}
```

Rejected promises restore pending shell state and surface a configurable error
without mutating the controlled view list.

## 9. Header and composition design

### 9.1 Required layers

Each engine is separated into:

- provider: config and isolated transient store;
- surface: the viewport/content without global chrome;
- view controls: controls specific to that engine;
- standalone convenience component: default title/count plus view controls;
- embedded registration: contributes controls and status to the database shell.

### 9.2 Replace `showHeader` with a discriminated contract

```ts
type ViewChromeProps =
  | {
      readonly mode: "standalone"
      readonly title?: ReactNode
      readonly renderHeader?: (context: StandaloneHeaderContext) => ReactNode
    }
  | {
      readonly mode: "embedded"
      readonly title?: never
      readonly renderHeader?: never
    }
```

During migration, deprecated `showHeader` compatibility may exist internally,
but it is not part of the stable v1 API.

### 9.3 Shared database toolbar ownership

The database shell owns:

- database title and result/loading count;
- view tabs and active-view selection;
- view create, rename, duplicate, reorder, and delete menus;
- shared search, filters, sorts, and grouping controls;
- the primary new-record action;
- responsive overflow and keyboard focus order.

The active view plugin contributes:

- calendar period navigation, calendar mode, and agenda span;
- timeline today, viewport/zoom, and timeline display settings;
- kanban density, column width, lane, and WIP display settings;
- list density and visible property controls.

Selection contributes a shared contextual action region. Search must have one
owner in embedded mode; inner view search controls are not rendered alongside
the shell search.

## 10. Forms, activation, and editing

### 10.1 Domain forms

The library emits typed intents and optionally renders consumer-provided flow
slots. It does not define domain fields or submit records.

Supported composition options:

- consumer handles `onCreateIntent` and opens its own dialog/sheet;
- consumer handles `onOpenIntent` and navigates to a record page;
- consumer supplies `renderCreateFlow` or `renderRecordFlow` for colocated
  overlays while retaining form ownership.

### 10.2 Inline property editing

The library owns focus, keyboard semantics, validation presentation, pending
state, cancel/commit behavior, and optimistic display. The property schema owns
value access, parsing, validation, rendering, and optional custom editor UI.
The consumer owns the durable edit handler and authoritative record update.

### 10.3 Create-context translation

View contexts are translated into property defaults without assuming domain
field names:

- calendar selection -> configured start/end property IDs;
- kanban add action -> configured group and optional lane property IDs;
- list group add -> configured group and optional parent property IDs;
- timeline creation -> configured range and optional parent/row property IDs.

## 11. Styling and theming contract

### 11.1 Distribution

- Publish compiled CSS as `@entropy-ui/data-views/styles.css`.
- Mark CSS as a package side effect so bundlers retain it.
- Do not require consumers to scan package source with Tailwind.
- Do not expose application `@theme` declarations.
- Internal primitives are owned library code and are not public by default.

### 11.2 Token layers

Use prefixed semantic variables with sensible fallbacks:

```css
.edv-root {
  --edv-background: var(--background, #fff);
  --edv-foreground: var(--foreground, #18181b);
  --edv-muted: var(--muted, #f4f4f5);
  --edv-muted-foreground: var(--muted-foreground, #71717a);
  --edv-border: var(--border, #e4e4e7);
  --edv-primary: var(--primary, #b76a36);
  --edv-primary-foreground: var(--primary-foreground, #fff);
  --edv-destructive: var(--destructive, #dc2626);
  --edv-ring: var(--ring, var(--edv-primary));
  --edv-radius: var(--radius, 0.625rem);
}
```

Token groups must cover color, typography, radius, elevation, density, motion,
z-index, and view geometry. Dark mode may inherit host tokens or be selected
through a provider/data attribute. No global `body`, universal selector, or
scrollbar rule is shipped.

### 11.3 Customization surface

- `className` and `style` are accepted on DOM-owning public components.
- Caller `className` is merged last.
- Stable `data-edv-part` attributes support targeted styling and testing.
- Render slots cover domain content and meaningful empty/error states.
- Variant props use `cva` and exported variant types when they are public.
- Internal DOM and class names are not a semantic-versioning contract.

## 12. State and store rules

- Every mounted engine or database shell creates an isolated store instance.
- Zustand stores contain only transient UI state, interaction previews, bounded
  command metadata, focus, selection, open panels, and viewport state.
- Actions remain under an `actions` key.
- Exported hooks require narrow selectors; no selector-free public store hook.
- Derived array/object selectors use shallow comparison.
- Persist middleware is not used for records or saved views.
- If optional UI preference persistence is added, `partialize` stores only
  serializable state and excludes actions.
- Consumer server/query state remains outside Zustand.

## 13. Accessibility and interaction baseline

All existing behaviors are regression requirements unless an ADR explicitly
changes them:

- roving focus and logical navigation across virtualized content;
- keyboard creation, activation, selection, deletion, duplication, undo/redo,
  drag/reorder, resize, hierarchy, and dependency editing where supported;
- live-region announcements for interaction and mutation outcomes;
- focus restoration across menus, dialogs, virtualization, and view switches;
- useful accessible labels supplied by consumer adapters;
- reduced-motion, forced-colors, dark/light contrast, and 200% zoom support;
- no keyboard collision between the shared toolbar and active view surface;
- one accessible toolbar hierarchy rather than nested competing toolbars.

Automated axe checks supplement but do not replace keyboard and screen-reader
acceptance checks.

## 14. Performance and bundle budgets

Initial budgets are confirmed during Phase 1 and enforced before stable v1:

- importing `/list` must not pull calendar, timeline, or kanban code;
- importing `/calendar` must not pull dnd-kit board code;
- React and React DOM must not be bundled;
- each subpath reports minified and compressed size in CI;
- large fixtures retain bounded mounted DOM through virtualization;
- pointer previews perform at most one effective layout update per animation
  frame;
- shared shell state changes must not rerender every visible record renderer;
- two independent instances must not share focus, selection, history, search,
  settings, or drag state.

## 15. Multi-phase execution plan

### Phase 0 — Baseline, contract freeze, and extraction safety

Status: complete

Deliverables:

- [x] Record accepted architecture decisions.
- [x] Inventory source/test/story counts for all four engines.
- [x] Identify application imports and the duplicate-header seam.
- [x] Identify current public entry points and accidental-export risk.
- [x] Add symmetric Timeline test, typecheck, and lint commands.
- [x] Run all four dedicated test suites and record exact results below.
- [x] Run all four typecheck lanes.
- [x] Run all four lint lanes.
- [x] Add or confirm public-entry-point contract tests for every engine.
- [ ] Capture Storybook stories for standalone header and embedded/no-header
  modes for every engine.
- [ ] Add a two-instance isolation characterization test per engine where one is
  not already present.
- [ ] Capture current keyboard behavior and mutation lifecycle matrices.
- [ ] Mark candidate public versus internal exports.
- [ ] Stabilize the source commit used for extraction; do not extract from a
  dirty or partially migrated application state.

Exit criteria:

- All verification commands are repeatable from the repository root.
- Existing failures are documented and either fixed or explicitly accepted as
  baseline debt.
- The source revision and extraction manifest are recorded.
- No application behavior changes are introduced by Phase 0.

### Phase 1 — Bootstrap the external repository

Status: complete except external repository/scope reservation

Deliverables:

- [ ] Reserve npm scope/package and repository name.
- [ ] Create the pnpm workspace and package/app/fixture layout.
- [ ] Configure TypeScript declarations, ESM build, explicit exports, CSS
  output, source maps, and package provenance.
- [ ] Configure Vitest, Testing Library, browser tests, Storybook, accessibility
  checks, and visual regression.
- [ ] Configure ESLint, formatting, API-extractor/type tests, and bundle-size
  reporting.
- [ ] Configure Changesets and `next`/snapshot publishing.
- [ ] Add Vite and Next.js clean-install fixtures.
- [ ] Add CI for build, test, typecheck, lint, package contents, SSR import, and
  fixture installation.
- [ ] Add license, contribution guide, support policy, security policy, and
  browser support statement.

Exit criteria:

- A placeholder package can be packed and installed in both fixtures.
- SSR import does not touch `window`, `document`, observers, or layout APIs.
- The package contents contain only intended runtime, types, CSS, license, and
  documentation assets.

### Phase 2 — Extract shared internal primitives and style foundation

Status: complete

Deliverables:

- [ ] Copy only UI primitives actually required by the four engines.
- [ ] Replace `@/lib/utils` with package-local generic utilities.
- [ ] Move `use-shift-wheel` into an internal interaction utility.
- [ ] Remove application aliases from all extracted source.
- [ ] Prefix IDs, CSS variables, data attributes, and animation names.
- [ ] Build the initial compiled stylesheet and host-token fallback bridge.
- [ ] Keep primitives private unless a concrete public composition need is
  documented.
- [ ] Add primitive interaction tests for menus, sheets, tooltips, selects, and
  focus restoration used by view controls.

Exit criteria:

- Extracted primitives render without application CSS or shadcn installation.
- No global style rule leaks into fixture applications.
- Light/dark and forced-color smoke fixtures pass.

### Phase 3 — Extract List

Status: complete

List is first because it has the smallest source surface and already has a
generic property model.

Deliverables:

- [ ] Move list provider, store, utilities, hooks, components, tests, and story.
- [ ] Preserve client/server operations, grouping, hierarchy, selection,
  editing, reorder, pagination, and virtualization.
- [ ] Replace application UI imports with private library primitives.
- [ ] Review and minimize `/list` exports.
- [ ] Split `DataListSurface` and `DataListControls` from standalone composition.
- [ ] Add the temporary embedded chrome adapter.
- [ ] Validate 50,000-record fixture and two-instance isolation.
- [ ] Pack and render List in both clean consumer fixtures.

Exit criteria:

- Existing List tests pass in the external repository.
- The Vite/Next fixtures import only `/list` plus styles.
- Consumer-owned renderers and editors do not require application types.

### Phase 4 — Extract Kanban

Status: complete

Deliverables:

- [ ] Move kanban provider, store, optimistic ledger, utilities, components,
  tests, and story.
- [ ] Preserve WIP rules, swimlanes, pagination, virtualization, selection,
  keyboard drag, pointer drag, history, and authoritative reconciliation.
- [ ] Split `KanbanSurface` and `KanbanControls` from standalone composition.
- [ ] Keep card/add/move commands view-specific and strongly typed.
- [ ] Validate 5,000-card/100-group fixture and independent instances.
- [ ] Verify importing `/kanban` does not load calendar/timeline code.

Exit criteria:

- Existing Kanban tests pass externally.
- Pointer and keyboard moves resolve the same stable-neighbor destination.
- Rejected/overlapping mutations reconcile without storing consumer snapshots
  in Zustand.

### Phase 5 — Extract Calendar

Status: complete

Deliverables:

- [ ] Move calendar provider, slices, date engine, agenda extension,
  interactions, components, tests, and stories.
- [ ] Preserve date-card and agenda modes, time zones, sources, visible ranges,
  overflow, selection, keyboard navigation, drag/create/resize, and mutation
  reconciliation.
- [ ] Split `CalendarSurface` and calendar-specific controls from standalone
  composition.
- [ ] Ensure shell search can replace inner search in embedded mode.
- [ ] Validate DST transitions, half-open ranges, locale/week-start behavior,
  and two independent time zones.
- [ ] Keep date primitives serializable in saved definitions; runtime records
  may continue to use `Date` where required by the engine.

Exit criteria:

- Calendar test and coverage thresholds pass externally.
- Vite/Next fixtures render month/week/agenda without host Tailwind scanning.
- SSR import and hydration are clean.

### Phase 6 — Extract and normalize Timeline

Status: complete with a documented prerelease compatibility bridge

Timeline is extracted last because it is the largest engine and has the most
public API debt.

Deliverables:

- [ ] Move timeline provider, mutation coordinator, store, hooks, utilities,
  components, dependencies, tests, and stories.
- [ ] Preserve virtualization, hierarchy, dependencies, zoom modes, sidebar,
  search, selection, drag, bulk drag, resize, auto-scroll, and data loading.
- [ ] Split `TimelineSurface` and timeline-specific controls from standalone
  composition.
- [ ] Consolidate legacy `onItemsChange`/`onItemAdd` callbacks into the newer
  controlled mutation-intent boundary.
- [ ] Define a deprecation bridge only if needed by `entropy-ui` migration.
- [ ] Make preference changes one controlled preferences object with typed
  change metadata, aligned with Calendar and Kanban.
- [ ] Review low-level hook exports and keep only supported extension points.
- [ ] Validate large-row virtualization, dependencies, two instances, and every
  viewport mode.

Exit criteria:

- Timeline has the same dedicated verification gates as other views.
- No duplicate legacy/new mutation path remains in stable v1 exports.
- Existing Timeline behavior passes externally before shell integration.

### Phase 7 — Implement shared core contracts

Status: complete

Deliverables:

- [ ] Implement runtime property schema and validation.
- [ ] Implement client/server data-source discriminated unions.
- [ ] Implement shared search/filter/sort/group descriptors.
- [ ] Implement stable operation request IDs and controlled status/pagination.
- [ ] Implement versioned saved-view unions and runtime validation.
- [ ] Implement pure migrations with JSON fixtures.
- [ ] Implement view plugin registry with exhaustive built-in view types.
- [ ] Implement shared flow intent metadata and selection vocabulary.
- [ ] Add type tests proving invalid role/config combinations fail.
- [ ] Add custom plugin feasibility test without committing third-party plugin
  API stability for v1.

Exit criteria:

- Saved view JSON round-trips without runtime functions or React nodes.
- Client and server operation modes cannot be configured ambiguously.
- Each built-in view resolves property roles into its native engine config.

### Phase 8 — Implement the database shell and unified header

Status: complete

Deliverables:

- [ ] Implement `DatabaseViewsProvider` and `DatabaseViews` container.
- [ ] Implement accessible view tabs and overflow behavior.
- [ ] Implement controlled active view and saved-view CRUD callbacks.
- [ ] Implement shared search, filter, sort, and grouping controls.
- [ ] Implement active-view contextual control registration.
- [ ] Implement one new-record action with view-derived defaults.
- [ ] Implement selection/bulk-action contextual region.
- [ ] Implement toolbar layout at narrow widths and 200% zoom.
- [ ] Preserve surface focus when changing non-structural view settings.
- [ ] Define focus destination when switching view types.
- [ ] Ensure hidden views do not retain active observers, pointer sessions, or
  keyboard handlers.

Exit criteria:

- Embedded mode renders exactly one database toolbar.
- Standalone mode remains available for every engine.
- Search and settings have a single owner in each composition mode.
- View switching does not leak store state between view instances.

### Phase 9 — Add consumer-owned form and record-flow integration

Status: complete

Deliverables:

- [ ] Implement typed create/open/edit flow callbacks.
- [ ] Implement optional `renderCreateFlow` and `renderRecordFlow` slots.
- [ ] Translate calendar/kanban/list/timeline placement to property defaults.
- [ ] Document dialog, sheet, and routed-page examples.
- [ ] Keep flow open state controllable by the consumer.
- [ ] Add permission and validation failure examples.
- [ ] Add optimistic TanStack Query example while keeping core query-agnostic.
- [ ] Verify that canceling a form never mutates view data.

Exit criteria:

- The same consumer form can be opened from all four views with appropriate
  defaults.
- No domain field names or form components exist in the core package.

### Phase 10 — Theming, customization, and documentation hardening

Status: complete for the release candidate

Deliverables:

- [ ] Finalize prefixed semantic tokens and theme provider.
- [ ] Document host-token inheritance and isolated custom theme examples.
- [ ] Document every public `data-edv-part` hook.
- [ ] Add density, radius, typography, motion, and geometry examples.
- [ ] Add custom record renderer, property editor, group header, event, bar,
  card, empty state, and error state examples.
- [ ] Add dark/light, high contrast, forced colors, reduced motion, RTL audit,
  and 200% zoom stories.
- [ ] Publish API reference and architecture/ownership guide.
- [ ] Add upgrade and saved-view migration guides.

Exit criteria:

- A clean consumer can visually integrate the package by overriding tokens
  without recompiling library source.
- Every supported customization path has a tested example.

### Phase 11 — Integrate prerelease into `entropy-ui`

Status: complete with `0.1.0-next.1`

Deliverables:

- [ ] Publish or pack a `next` prerelease.
- [ ] Install it into `entropy-ui` without source aliases.
- [ ] Create one application `AlignmentRecord` property schema.
- [ ] Create reusable application data-source/query adapters.
- [ ] Replace repeated record projections where the shared adapter applies.
- [ ] Replace outer manual view tabs/search/navigation with `DatabaseViews`.
- [ ] Move application dialogs behind create/open/edit intent handlers.
- [ ] Migrate workspace preferences into versioned saved views.
- [ ] Preserve application-specific filters, badges, validation, routes, and
  permissions outside the package.
- [ ] Run application unit, Storybook, route, visual, and manual acceptance
  checks.

Exit criteria:

- `entropy-ui` imports the package only through supported public entry points.
- The four old source directories have no remaining application consumers.
- Product behavior and accessibility meet or exceed the Phase 0 baseline.

### Phase 12 — Stable release and source removal

Status: source removal and release engineering complete; npm/GitHub publication pending external ownership

Deliverables:

- [ ] Complete public API and semver review.
- [ ] Confirm package name/scope ownership, provenance, license, README, and
  support policy.
- [ ] Publish a release candidate and test a clean installation from npm.
- [ ] Resolve release-candidate findings.
- [ ] Publish `1.0.0` only after the app uses the candidate successfully.
- [ ] Remove duplicated view engines from `entropy-ui` in a separate, reviewable
  change.
- [ ] Retain migration notes and a rollback path for one release window.
- [ ] Tag source/application compatibility revisions.

Exit criteria:

- Stable package installation, SSR import, types, CSS, all fixtures, and
  application integration pass from published artifacts.
- No application relies on unpublished or deep package paths.

## 16. Migration manifest

Before copying each engine, generate a manifest containing:

- source revision;
- file list and checksums;
- current public exports;
- internal application/UI imports;
- tests and stories copied;
- behavior matrix reference;
- known accepted debt;
- destination paths;
- post-copy import rewrites;
- verification results before and after movement.

Copy first, verify, then change contracts. Source removal happens only after
the packaged implementation is integrated back and stable.

## 17. Test matrix

Every view and the shell must cover:

| Dimension | Required cases |
| --- | --- |
| Composition | standalone, embedded, two independent instances |
| Data | empty, small, large/virtualized, partial page, live update |
| Status | initial loading, refresh, stale error, fatal error, no access |
| Permissions | read-only, per-record denial, mid-interaction change |
| Operations | client and server search/filter/sort/group |
| Mutation | accept, reject, conflict, canonicalize, overlap, timeout |
| Input | pointer, keyboard, touch where supported, IME editing |
| Display | light, dark, custom tokens, forced colors, reduced motion |
| Layout | narrow, desktop, 200% zoom, long labels, empty controls |
| Runtime | Vite CSR, Next SSR/hydration, Strict Mode |
| Isolation | focus, selection, history, query, settings, drag, IDs |

## 18. Versioning and compatibility policy

- Use Changesets for release intent, changelogs, prereleases, and publishing.
- Keep all subpath exports on the same package version in v1.
- Treat removal or narrowing of an exported type/component as semver-major.
- Treat saved-view JSON schema changes separately from package semver and
  always provide migrations for supported schema versions.
- Mark experimental extension points explicitly and exclude them from stable
  compatibility promises.
- Test at the minimum and current supported React/TypeScript versions.
- Document browser support and revisit it only in a major release or published
  policy change.

## 19. Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Runtime functions leak into saved JSON | Views cannot persist/migrate | Strict runtime/schema split and JSON fixtures |
| Outer and inner controls both remain active | Duplicate UI and conflicting state | Surface/control split and embedded mode contract |
| Shared core erases view-specific commands | Loss of calendar/board semantics | Shared metadata plus view-specific discriminated unions |
| Raw Tailwind classes lack consumer CSS | Broken published appearance | Ship compiled CSS and clean fixtures |
| Application UI primitives become accidental API | Large, unstable public surface | Private internal primitives and explicit export map |
| Timeline legacy API survives into v1 | Confusing mutation ownership | Normalize in Phase 6 before shell integration |
| Saved preferences remain global per workspace | Views overwrite one another | Persist preferences inside each saved view definition |
| Server records enter Zustand | Stale duplicate source of truth | Controlled snapshots and store review tests |
| Bundle imports all views | Excess consumer bundle cost | Subpath exports and CI bundle graphs |
| SSR import touches browser globals | Next.js failures | SSR fixture and lazy browser API initialization |
| Existing dirty work is overwritten | User work loss | Isolate changes and stabilize source revision before copy |
| Package/app drift during migration | Double maintenance and regressions | Short prerelease integration window and manifest checks |

## 20. Phase 0 verification record

Started: 2026-08-16

| Gate | Command | Result |
| --- | --- | --- |
| Calendar tests | `pnpm test:calendar` | Passed: 35 files, 168 tests |
| Kanban tests | `pnpm test:kanban` | Passed: 8 files, 40 tests |
| List tests | `pnpm test:list` | Passed: 5 files, 38 tests |
| Timeline tests | `pnpm test:timeline` | Passed: 41 files, 326 tests |
| Full unit project | root Vitest unit project | Passed: 89 files, 574 tests before the two new API checks |
| Calendar typecheck | `pnpm typecheck:calendar` | Passed |
| Kanban typecheck | `pnpm typecheck:kanban` | Passed |
| List typecheck | `pnpm typecheck:list` | Passed |
| Timeline typecheck | `pnpm typecheck:timeline` | Passed |
| Calendar lint | `pnpm lint:calendar` | Passed |
| Kanban lint | `pnpm lint:kanban` | Passed |
| List lint | `pnpm lint:list` | Passed |
| Timeline lint | `pnpm lint:timeline` | Passed |

Any failure caused by pre-existing in-progress application work is recorded
without modifying or reverting that work.

## 21. Remaining release-owner actions

1. Create or select the GitHub repository and push the prepared `main` branch.
2. Confirm ownership of the `@entropy-ui` npm scope and configure trusted
   provenance or an automation token.
3. Publish `0.1.0-next.1` with the `next` tag and repeat the clean-install gate
   from the registry artifact.
4. Promote to `1.0.0` only after the published candidate passes the application
   acceptance window. These are deliberately not inferred from local Git or
   npm credentials.
