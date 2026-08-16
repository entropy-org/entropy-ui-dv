# Styling and theming

Import `@entropy-ui/data-views/styles.css` once. The stylesheet contains the
compiled component utilities and scoped semantic variables. It does not
require Tailwind in the consuming application.

Every root carries `.edv-root`, `data-edv-root`, and a documented
`data-edv-part`. `DataViewThemeProvider` scopes light/dark mode and token
overrides, and supplies an in-scope portal target so selects, popovers,
tooltips, and sheets retain the same variables.

## Token groups

- Surfaces: `--edv-background`, `--edv-card`, `--edv-popover`
- Text: `--edv-foreground`, `--edv-muted-foreground`
- Actions: `--edv-primary`, `--edv-secondary`, `--edv-accent`
- Feedback: `--edv-destructive`, `--edv-success`, `--edv-warning`, `--edv-info`
- Geometry: `--edv-border`, `--edv-input`, `--edv-ring`, `--edv-radius`
- Typography: `--edv-font-sans`, `--edv-font-heading`

Tokens first inherit common host variables such as `--background` and
`--primary`, then fall back to package defaults. Direct `--edv-*` overrides
always win when set on a theme provider.

## Stable parts

- `database-views`, `database-header`, `view-tabs`, `view-toolbar`,
  `view-surface`
- `list`, `kanban`, `calendar`, `timeline`
- `record-form`, `property-editor`

Use parts for targeted layout adjustments, not DOM ancestry or generated
utility classes. Adding a part is minor; removing or changing its meaning is
breaking.

Reduced-motion styles are scoped to data-view roots. The engines also retain
forced-color focus/border fallbacks. Consumer overrides must preserve visible
focus, hit targets, and state contrast.
