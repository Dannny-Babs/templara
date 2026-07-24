# `@templara/evals`

Private contract / golden tests for Rose Rocket Doc Builder integration.

## Purpose

Wave 1+ gates for:

- Fixture / context-shape contracts (`{ org, record, document }`, money/date suffix leaves)
- Binding extraction goldens (`extractBindings` once Stream A lands)
- Later: SSR HTML fidelity (G2 / Stream B — not in this package yet)

Run:

```bash
pnpm --filter @templara/evals test
```

## Fixtures

`apps/evals/fixtures/` is a **copy** of `docs/discovery/fixtures/` (invoice set for Wave 1).

- **Source of truth:** `docs/discovery/fixtures/`
- **Do not edit evals fixtures first.** Update discovery, then re-copy into this folder.
- Do **not** symlink — CI and package-local tests should not depend on repo-relative links outside the package.

Invoice files currently copied:

- `invoice-context.json`
- `invoice-record.serialized.json`
- `invoice-Invoice.handlebars`
- `invoice-rendered.html`
