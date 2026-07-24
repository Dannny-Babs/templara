# Orchestration tickets — index

**Integration branch:** `integration/rr-doc-builder-2-wave6`  
**Plan:** [orchestration-plan.md](../../orchestration-plan.md) §6 template / §9–10 streams  
**Wave:** Wave 6 (F6 preview chrome, left-panel resize, host guide). Waves 1–3 merged to `main` (PRs #2–#5). Wave 4/5 open as PRs #7/#6 — see [pr-titles.md](../pr-titles.md). Host wiring: [host-integration-guide.md](../host-integration-guide.md).

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
  A3[A3 real-record preview seam]
  C3[C3 org postal aliases]
  D1[D1 doc-type registry]
  E1[E1 host tokens]
  F1[F1 editor UX]
  F3[F3 dropdown overflow]
  F4[F4 layer names]
  F5[F5 large schema panel]
  B2[B2 host POST]

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
  C3 --> A3
  B1 --> B2
  H1 --> B2
  E1 -.-> F1
  F1 --> F3
  F1 --> F4
  F1 --> F5
```

Rough order: Waves 1–4 done (or Wave 4 branch) → Wave 5 **F3/F4/F5/A3 (Templara)** + **D1/B2/H1 (host)**.

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
| [G2](G2-invoice-ssr-golden.md) | Templara invoice SSR golden + discovery HTML contract | G | G1, B1 | done | merged `main` (PR #5) |
| [C3](C3-org-postal-aliases.md) | Org address `postal` ↔ `postalCode` adapter aliases | C | C2 | done | merged `main` (PR #5) |
| [D1](D1-doc-type-registry.md) | Doc-type registry parity (host) | D | A2, B1 | ready | Wave 5 host (ticket/spec only) |
| [E1](E1-host-design-tokens.md) | Host design-token inheritance | E | — | done | `integration/rr-doc-builder-2-wave4` |
| [F1](F1-editor-ux-field-test.md) | Editor UX field-test (canvas defaults + brand) | F | — | done | `integration/rr-doc-builder-2-wave4` |
| [A3](A3-real-record-preview.md) | Real-record preview seam (`preparePreviewData`) | A | A2, C3 | done (Templara); host wiring open | `integration/rr-doc-builder-2-wave5` |
| [B2](B2-host-generate-document.md) | Host POST generate-document integration | B | B1, H1 | backlog | Wave 5+ (host) |
| [F3](F3-dropdown-overflow.md) | Dropdown / popover overflow + sizing | F | F1 | done | `integration/rr-doc-builder-2-wave5` |
| [F4](F4-readable-layer-names.md) | Human-readable layer names | F | F1 | done | `integration/rr-doc-builder-2-wave5` |
| [F5](F5-large-schema-data-panel.md) | Large schema / data panel search & scale | F | F1 | done | `integration/rr-doc-builder-2-wave5` |
| [F6](F6-preview-button-chrome.md) | Preview button chrome (no eye icon) | F | F1 | done | `integration/rr-doc-builder-2-wave6` |

**Status values:** `ready` · `in_progress` · `blocked` · `done` · `backlog`

## Wave 5 merge gate

Before marking Wave 5 complete on `integration/rr-doc-builder-2-wave5`:

1. F3: viewport-aware dropdown placement + tests.
2. F4: `friendlyLayerLabel` + tests (no UUID primary titles).
3. F5: hide `$` system fields, ancestor-preserving search, large-schema fixture smoke.
4. A3: `preparePreviewData` + README (host still wires live records).
5. D1 / B2 / H1 remain host-owned — tickets/docs only in this repo.
6. `pnpm typecheck && pnpm test` green for `@templara/editor`.
7. Changeset for `@templara/editor`.

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
| [D1-doc-type-registry.md](D1-doc-type-registry.md) | Full §6 ticket (host Wave 5; Templara ticket/spec only) |
| [E1-host-design-tokens.md](E1-host-design-tokens.md) | Full §6 ticket (Wave 4, done) |
| [F1-editor-ux-field-test.md](F1-editor-ux-field-test.md) | Full §6 ticket (Wave 4, done) |
| [A3-real-record-preview.md](A3-real-record-preview.md) | Full §6 ticket (Wave 5 Templara seam done) |
| [B2-host-generate-document.md](B2-host-generate-document.md) | Full §6 ticket (host-only) |
| [F3-dropdown-overflow.md](F3-dropdown-overflow.md) | Full §6 ticket (Wave 5, done) |
| [F4-readable-layer-names.md](F4-readable-layer-names.md) | Full §6 ticket (Wave 5, done) |
| [F5-large-schema-data-panel.md](F5-large-schema-data-panel.md) | Full §6 ticket (Wave 5, done) |
| [backlog.md](backlog.md) | Remaining stubs (F2, F6, host follow-ups) |
