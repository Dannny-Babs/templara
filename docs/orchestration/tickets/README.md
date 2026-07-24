# Orchestration tickets — index

**Integration branch:** `integration/rr-doc-builder-2-wave3`  
**Plan:** [orchestration-plan.md](../../orchestration-plan.md) §6 template / §9–10 streams  
**Wave:** Wave 3 (G2 SSR golden + C3 org postal aliases). Wave 2 (C1/C2/B0/B1) merged to `main` via PR #4; Wave 1 via PR #2; grid walker via PR #3.

## Dependency graph

```mermaid
flowchart TD
  H1[H1 document-generator prompts]
  G0[G0 apps/evals harness]
  G1[G1 invoice context-shape]
  A1[A1 extractBindings]
  A2[A2 toRecordContextPaths]
  C1[C1 suffix allowlist]
  C2[C2 value adapter helpers]
  B0[B0 SSR spike]
  B1[B1 renderTemplateToHtml]
  G2[G2 SSR golden]
  A3[A3 real-record preview - backlog]
  C3[C3 org postal aliases]
  D1[D1 doc-type registry]
  E1[E1 host tokens]
  F1[F1 editor UX]
  B2[B2 host POST - backlog]

  G0 --> G1
  G0 --> A1
  A1 --> A2
  A2 --> C1
  C1 --> C2
  A1 --> B0
  B0 --> B1
  A2 --> B1
  G1 --> G2
  B1 --> G2
  H1 -.->|unblocks fidelity| B1
  B1 --> D1
  C2 --> D1
  C2 --> C3
  B1 --> B2
  H1 --> B2
  E1 -.-> F1
```

Rough order: Waves 1–2 done → Wave 3 **G2 + C3** (+ D/E/F tickets) → Wave 4 executes D1/E1/F1 (+ B2/A3 as ready).

## Status table

| ID | Title | Stream | Depends on | Status | Branch |
| --- | --- | --- | --- | --- | --- |
| [G0](G0-evals-harness.md) | `apps/evals` package + Vitest | G | — | done | merged `main` (PR #2) |
| [G1](G1-invoice-context-shape.md) | Invoice context-shape / fixture contract tests | G | G0 | done | merged `main` (PR #2) |
| [A1](A1-extract-bindings.md) | `extractBindings` in `@templara/core` | A | — | done | merged `main` (PR #2) |
| [A2](A2-to-record-context-paths.md) | `toRecordContextPaths` ↔ P3 `normalizeRecordPaths` | A | A1 | done | merged `main` (PR #2) |
| [H1](H1-document-generator-discovery.md) | `document-generator` discovery prompt pack | H | — | ready | n/a (external repo) |
| [C1](C1-suffix-allowlist.md) | P3 formatting suffix allowlist in core | C | A2 | done | merged `main` (PR #4) |
| [C2](C2-value-adapter-helpers.md) | Pre-formatted suffix value-adapter helpers | C | C1 | done | merged `main` (PR #4) |
| [B0](B0-ssr-html-spike.md) | SSR-to-HTML spike / design note | B | A1 | done | merged `main` (PR #4) |
| [B1](B1-render-template-to-html.md) | `renderTemplateToHtml` Node-safe entry | B | B0 | done | merged `main` (PR #4) |
| [G2](G2-invoice-ssr-golden.md) | Templara invoice SSR golden + discovery HTML contract | G | G1, B1 | done | `integration/rr-doc-builder-2-wave3` |
| [C3](C3-org-postal-aliases.md) | Org address `postal` ↔ `postalCode` adapter aliases | C | C2 | done | `integration/rr-doc-builder-2-wave3` |
| [D1](D1-doc-type-registry.md) | Doc-type registry parity (host) | D | A2, B1 | ready | Wave 4 |
| [E1](E1-host-design-tokens.md) | Host design-token inheritance | E | — | ready | Wave 4 |
| [F1](F1-editor-ux-field-test.md) | Editor UX field-test (one concrete fix) | F | — | ready | Wave 4 (ticket only in W3) |
| [A3](backlog.md#a3) | Real-record preview wiring (host) | A | A2 | backlog | — |
| [B2](backlog.md#b2) | Host POST generate-document integration | B | B1, H1 | backlog | — |

**Status values:** `ready` · `in_progress` · `blocked` · `done` · `backlog`

## Wave 3 merge gate

Before marking Wave 3 complete on `integration/rr-doc-builder-2-wave3`:

1. G2 evals: Templara `invoiceTemplate` SSR marker golden + discovery `invoice-rendered.html` contract; fidelity gap documented (no false DB1 HTML parity).
2. C3: `ORG_ADDRESS_PATH_ALIASES` + `aliasOrgAddressPaths` in `@templara/core` with Changeset + unit/evals tests.
3. D1 / E1 / F1 full §6 tickets ready for Wave 4 (F1 code optional; prefer not half-shipping).
4. `pnpm typecheck && pnpm test` green for touched packages + evals.
5. Do **not** require H1 external discovery execution or invented platform-model POSTs.

## Files in this folder

| File | Kind |
| --- | --- |
| [G0-evals-harness.md](G0-evals-harness.md) | Full §6 ticket (Wave 1, done) |
| [G1-invoice-context-shape.md](G1-invoice-context-shape.md) | Full §6 ticket (Wave 1, done) |
| [A1-extract-bindings.md](A1-extract-bindings.md) | Full §6 ticket (Wave 1, done) |
| [A2-to-record-context-paths.md](A2-to-record-context-paths.md) | Full §6 ticket (Wave 1, done) |
| [H1-document-generator-discovery.md](H1-document-generator-discovery.md) | Full §6 ticket (+ prompt pack) |
| [C1-suffix-allowlist.md](C1-suffix-allowlist.md) | Full §6 ticket (Wave 2, done) |
| [C2-value-adapter-helpers.md](C2-value-adapter-helpers.md) | Full §6 ticket (Wave 2, done) |
| [B0-ssr-html-spike.md](B0-ssr-html-spike.md) | Full §6 ticket (Wave 2, done) |
| [B1-render-template-to-html.md](B1-render-template-to-html.md) | Full §6 ticket (Wave 2, done) |
| [G2-invoice-ssr-golden.md](G2-invoice-ssr-golden.md) | Full §6 ticket (Wave 3, done) |
| [C3-org-postal-aliases.md](C3-org-postal-aliases.md) | Full §6 ticket (Wave 3, done) |
| [D1-doc-type-registry.md](D1-doc-type-registry.md) | Full §6 ticket (Wave 4 ready) |
| [E1-host-design-tokens.md](E1-host-design-tokens.md) | Full §6 ticket (Wave 4 ready) |
| [F1-editor-ux-field-test.md](F1-editor-ux-field-test.md) | Full §6 ticket (Wave 4 ready; code deferred) |
| [backlog.md](backlog.md) | Remaining stubs (A3, B2, F2, …) |
