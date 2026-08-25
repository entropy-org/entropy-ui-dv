# Migration from `entropy-ui`

1. Pin the package tarball or prerelease version and import `styles.css` once.
2. Replace engine source imports with `/list`, `/kanban`, `/calendar`, and
   `/timeline` exports without changing behavior.
3. Remove every `chrome` and `showHeader` prop. Engine headers are now fixed by
   the engine contract; `*Surface` is only a compatibility alias.
4. Define one application record adapter and property schema.
5. Convert application view preferences into version-1 `SavedDataView` values.
6. Render the four first-party plug-ins through `DatabaseViews`.
7. Route record intents into the existing application forms and query layer.
8. Remove application-owned view tabs, search, settings, New, and calendar or
   timeline navigation. `DatabaseViews` and the active engine render them.
9. Remove copied engines in a separate commit so rollback is a dependency
   change, not a source reconstruction.

Saved-view migrations must run before controlled values reach the shell; use
`migrateSavedDataViews` and decide whether validation issues block loading or
fall back to a known default view.

Consumers continue to own records, saved-view persistence, permissions,
add/edit forms, domain rendering, and mutation handling. They should not render
a second data-view toolbar.
