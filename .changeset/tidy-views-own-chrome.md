---
"@entropy-ui/data-views": minor
---

Standardize data-view chrome ownership. `DatabaseViews` now exclusively renders
saved-view tabs, global search, dynamic user settings, and record creation.
Calendar and Timeline always render their required navigation headers, while
List and Kanban expose only contextual selection actions. Remove the legacy
`chrome`, `showHeader`, engine search/settings exports, and list controls slot;
add persisted Kanban and Timeline display settings.
