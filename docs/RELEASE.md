# Release process

## Prepared release candidate

The repository is prepared at `0.1.0-next.1`. It includes Changesets, public
package metadata, MIT licensing, explicit exports, npm provenance settings,
CI, and a release workflow. The local tarball is intentionally ignored by Git
and is recreated with `pnpm pack:check`.

## Required release-owner setup

1. Create or select the GitHub repository and add it as `origin`.
2. Confirm that the publishing account owns the `@entropy-ui` npm scope.
3. Configure GitHub trusted publishing or an `NPM_TOKEN` for the release
   workflow.
4. Protect `main` so `pnpm check` must pass before merge.

Repository creation and npm ownership are external authority decisions. Do not
guess either from the source application's remote.

## Candidate publication

```sh
pnpm check
pnpm publish:next
```

After publishing, replace fixture tarball references with
`@entropy-ui/data-views@0.1.0-next.1`, reinstall with a frozen lockfile, and
repeat Vite, Next, React 18, and `entropy-ui` gates from the registry artifact.

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
