# Public API policy

Only declared `package.json` export paths are supported. Deep imports into
`dist`, `src`, `components/ui`, stores, slices, or private utilities are never
compatible API.

## Root and `/core`

The root and `/core` expose the controlled multi-view layer:

- `DatabaseViews`, `DatabaseViewsHeader`, `DatabaseViewTabs`,
  `DatabaseViewsToolbar`, and `DatabaseViewSurface`
- `DataViewThemeProvider`
- `DataViewFormSurface`, `DataViewPropertyEditor`, and
  `DataViewRecordFormFields`
- record schema, data source, saved-view, query, selection, flow, intent,
  controller, plug-in, and theme types
- `createDataViewPlugin` and `createDataViewRegistry`
- saved-view creation, validation, and migration helpers
- client query and operation-id helpers

## Engine paths

- `/list`: `DataList`, `DataListSurface`, `DataListControls`, provider, config,
  commands, selection, grouping, hierarchy, and status types.
- `/kanban`: `Kanban`, `KanbanSurface`, `KanbanControls`, provider, commands,
  optimistic ledger, preferences, data state, and model types.
- `/calendar`: `Calendar`, `CalendarSurface`, controls, provider, public date
  and range types, preferences, commands, date helpers, and data-state helpers.
- `/timeline`: `Timeline`, `TimelineSurface`, controls, provider, settings,
  item/dependency/preferences/mutation types, and validation helpers.
- `/adapters`: `createBuiltInDataViewPlugins` and its generic record/property
  rendering options. Keeping this separate means importing the shell does not
  evaluate all four engines.

The initially extracted low-level Calendar and Timeline hooks remain available
during the prerelease migration window. They are compatibility exports, not the
preferred composition API. They will not be removed before a documented major
release.

## CSS

`@entropy-ui/data-views/styles.css` is a side-effect-only export. Import it once.
No other JavaScript entry point imports global CSS.

## Semver

- Removing or renaming an export, prop, command, token, or documented
  `data-edv-part` is breaking.
- Adding an optional field or a new discriminant is minor when exhaustive
  consumer switches are not affected; otherwise it is breaking.
- Fixing behavior to match an existing documented invariant is patch-level.
- Saved-view schema changes require a pure migration before release.
