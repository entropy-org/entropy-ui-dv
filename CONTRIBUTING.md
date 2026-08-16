# Contributing

Changes must preserve the controlled-data ownership boundary: records and
server state stay outside library stores. Public component work follows the
store -> memoized presentation -> container split, uses narrow Zustand
selectors, and models modes and interaction states with discriminated unions.

Before opening a change, run:

```sh
pnpm check
```

User-visible package changes require a Changeset. Public API additions need a
consumer-style type test and documentation. Interaction changes need keyboard,
pointer, accessibility, and two-instance isolation coverage as applicable.
