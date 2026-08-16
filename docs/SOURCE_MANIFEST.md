# Extraction source manifest

The first extraction is pinned to `entropy-ui` commit
`1966cba3be470d73b091ae32101cbbaf87f11826` from
`git@github.com:entropy-org/vite-client.git`.

The machine-readable manifest is [`source-manifest.json`](./source-manifest.json).
It records 297 committed files, their Git blob hashes, and byte sizes. This is
the immutable comparison point for behavioral audits and makes it possible to
distinguish intentional library work from source drift.

## Included roots

- `src/components/list`
- `src/components/kanban`
- `src/components/calendar`
- `src/components/timeline`
- the 12 UI primitives imported by those engines
- `src/hooks/use-shift-wheel.ts`
- `src/lib/utils.ts`

## Reproduction

```sh
node scripts/generate-source-manifest.mjs C:\dev\entropy-ui 1966cba3be470d73b091ae32101cbbaf87f11826
```

Changing the pinned commit is a migration decision. Regenerate the JSON,
review the diff, and record the reason in a Changeset.
