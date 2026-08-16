# Migration from `entropy-ui`

1. Pin the package tarball or prerelease version and import `styles.css` once.
2. Replace engine source imports with `/list`, `/kanban`, `/calendar`, and
   `/timeline` exports without changing behavior.
3. Replace `showHeader={false}` with the matching `*Surface` component.
4. Define one application record adapter and property schema.
5. Convert application view preferences into version-1 `SavedDataView` values.
6. Render the four first-party plug-ins through `DatabaseViews`.
7. Route record intents into the existing application forms and query layer.
8. Remove the application’s duplicate view tabs/header/search only after the
   shell acceptance tests pass.
9. Remove copied engines in a separate commit so rollback is a dependency
   change, not a source reconstruction.

The deprecated engine `showHeader` props remain for the prerelease window.
Saved-view migrations must run before controlled values reach the shell; use
`migrateSavedDataViews` and decide whether validation issues block loading or
fall back to a known default view.
