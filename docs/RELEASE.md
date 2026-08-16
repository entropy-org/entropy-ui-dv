# Release process

## Prepared release candidate

The repository is prepared at `0.1.0-next.1` at
`https://github.com/entropy-org/entropy-ui-dv`. It includes Changesets, public
package metadata, MIT licensing, explicit exports, npm provenance settings,
CI, and a release workflow. The local tarball is intentionally ignored by Git
and is recreated with `pnpm pack:check`.

## Release-owner setup

- [x] `@entropy-ui/data-views@0.1.0-next.1` published from the authenticated
  `mkkhlif` account and verified through a clean registry install.
- [x] GitHub trusted publishing configured for `entropy-org/entropy-ui-dv`,
  workflow `release.yml`, allowing `npm publish`.
- [ ] Protect `main` so `pnpm check` must pass before merge. This remains a
  repository-settings task because the GitHub CLI is unavailable locally.

The release workflow uses GitHub OIDC and npm provenance. It intentionally has
no long-lived npm publishing token.

## Candidate publication

```sh
pnpm check
pnpm publish:next
```

The source application now pins `@entropy-ui/data-views@0.1.0-next.1` from npm.
Its typecheck, lint, unit tests, and production build pass against the registry
artifact. Package fixtures continue to validate the exact tarball built by the
release gate before each publication.

## Stable promotion

Promote only after the candidate is used by the source application for the
acceptance window and no rollback is required. Use Changesets to produce the
stable version and changelog, rerun `pnpm check`, publish with provenance, then
tag the package and compatible application revisions.

Do not publish `latest` directly from an unverified local build. The release
workflow re-runs every gate before invoking Changesets publishing.

## Rollback

- npm: deprecate a bad version and pin the last verified release; do not
  unpublish versions consumers may have installed.
- application: pin the previous package version first. The original engines
  are recoverable from `entropy-ui` commit
  `1966cba3be470d73b091ae32101cbbaf87f11826` for one release window.
- saved views: retain schema-version migrations and never rewrite durable view
  JSON without a reversible application migration.
