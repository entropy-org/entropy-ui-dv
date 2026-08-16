# SSR and framework integration

All package modules are safe to import without `window` or `document` at module
evaluation time. Browser APIs are accessed in effects or event handlers.

## Vite

Import the CSS from the application entry point and render normally. Vite
should resolve the ESM and declaration exports without an alias.

## Next.js

Import the CSS from the root layout. Components using interaction must be
rendered below a client boundary. Types, saved-view helpers, validation,
migration, query utilities, operation-id helpers, and the version constant can
be imported from `@entropy-ui/data-views/server`. The root, engine, and adapter
barrels are explicit client boundaries.

Avoid creating locale/time-zone dependent saved definitions during server
render unless the values are explicit. The Calendar adapter accepts an
explicit saved `timeZone` or `calendarTimeZone` option to avoid hydration
differences.
