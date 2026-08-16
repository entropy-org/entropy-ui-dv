# Record forms and flow ownership

Create and edit flows are controlled by the application. `DatabaseViews`
emits `DataViewIntent` values; it never writes a record and never assumes a
dialog, route, mutation library, or validation system.

## Recommended flow

1. Handle `create-record` or `edit-record` in `onIntent`.
2. Set an application-owned `DataViewFlowState`.
3. Render a sheet, dialog, or routed page through `renderForm`.
4. Use `DataViewRecordFormFields` if the schema’s default editors are useful.
5. Validate and submit through the application’s service/query layer.
6. Close the flow only after the application’s chosen success policy.

Kanban group/swimlane, Calendar range, Timeline range, and List group/parent
placements arrive as `initialValues`. The application may reject, transform,
or augment those values before showing a form.

`DataViewFormSurface` is optional visual chrome. It owns no form state.
`DataViewPropertyEditor` is controlled and emits values only. Custom/person
properties deliberately require a consumer editor. Canceling either component
cannot mutate data because neither receives a mutation function.

For optimistic updates, apply the intent to the consumer’s query cache, send
the service request, and return the next authoritative `records` snapshot.
Do not put fetched records into the shell’s Zustand store.
