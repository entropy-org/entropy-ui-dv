# Release-candidate verification matrix

Verified on 2026-08-16 for `@entropy-ui/data-views@0.1.0-next.2`.

| Gate | Result |
| --- | --- |
| Library lint and TypeScript | Passed |
| Unit and integration suites | 94 files, 581 tests passed |
| Storybook browser and accessibility | 5 files, 45 stories passed |
| Package build | ESM JavaScript, declarations, maps, and 103,654-byte compiled CSS passed |
| Export verification | 9 explicit package exports passed |
| Package metadata | Publint passed; ESM type-resolution profile passed |
| Bundle boundaries | Core and all engine/adapters entries passed forbidden-import and budget checks |
| React compatibility | Isolated React 18.3 tarball fixture passed; React 19 workspace passed |
| Vite consumer | Production tarball build passed |
| Next consumer | SSR-safe import, TypeScript, static prerender, and production build passed |
| Storybook static output | Production build passed |
| Source application | typecheck, lint, 3 migration tests, production build, Storybook build, and 3-file/22-story browser suite passed |

## Bundle report

| Entry | Minified | Gzip |
| --- | ---: | ---: |
| core | 232,398 B | 63,933 B |
| list | 175,715 B | 46,089 B |
| kanban | 434,662 B | 117,283 B |
| calendar | 463,058 B | 122,748 B |
| timeline | 438,146 B | 115,379 B |
| adapters | 919,685 B | 236,557 B |

The adapters entry intentionally composes all four engines. Engine subpaths
are checked independently so consumers can avoid that aggregate cost.

## Automated coverage boundaries

- Provider/store isolation is covered for every engine, including two mounted
  instances where component behavior matters.
- Client/server query ownership, saved-view validation/migration, rejected and
  overlapping mutations, permissions, loading/error/no-access states, and
  custom renderers are covered by unit/integration tests.
- Storybook browser tests run axe-based accessibility checks over standalone,
  embedded, dark, read-only, error, large-data, and responsive fixtures.
- Calendar includes DST/range/agenda coverage; Timeline covers hierarchy,
  dependencies, viewport modes, bulk drag, resize, and auto-scroll; Kanban
  covers WIP/swimlanes/reconciliation; List covers hierarchy, editing,
  selection, pagination, and virtualization.

Run the complete matrix with `pnpm check` from the repository root.
