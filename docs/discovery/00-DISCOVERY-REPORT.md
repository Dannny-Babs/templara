# Doc Builder 1 → Templara (Doc Builder 2) — Discovery Report

**Purpose.** This is the single, consolidated index and synthesis of a completed, read-only discovery effort mapping Rose Rocket's current document system ("Doc Builder 1" — a Handlebars/HTML string engine rendered by an external `document-generator` microservice), in order to plan a future JSON/React "Templara" (Doc Builder 2) integration. It summarizes and links the nine evidence reports (P1–P9) and their fixtures; it does not duplicate them. Read the linked P-files for verbatim code and full detail.

- **Capture date:** Jul 24, 2026.
- **Nature:** Read-only discovery. No repo source code was modified; only markdown/JSON under the discovery folder was produced.

> **Location note (important for this repo):** The full run was executed in the **`denpasar` worktree of the `platform-components` repo** (`~/conductor/workspaces/platform-components/denpasar/docs/templara-discovery/`). **The P1–P9 reports and all `fixtures/` have now been copied into this repo** (`docs/discovery/`), so the relative links below resolve locally. The source repo's own README is preserved here as `SOURCE-README.md`. Related in-repo context: [../rose-rocket-integration-retrospective.md](../rose-rocket-integration-retrospective.md), [../embedding-field-test-issues.md](../embedding-field-test-issues.md), [../project-context-and-roadmap.md](../project-context-and-roadmap.md).

---

## 1. Work done this session

### Phase 1 — Templara dev environment setup

In the Conductor worktree `denpasar` (branch `templara-pdf-browser-print-boundary`):

- Ran `yarn install` in the `denpasar` worktree (no `node_modules`; `nodeLinker: node-modules`).
- Started `rock worktree:watch` — Docker file-sync + logs attached to the already-running swap-mode container `pm-denpasar` (owns the `platform-model` alias + ports 3001/5555/9229).
- Started `rock run start:ui:rspack` — rspack UI dev server on host port 8090, accessed via `https://network.development.roserocket.local`. First build compiled successfully (one pre-existing `__dirname` warning in `api-client FMCSAService.ts`).

### Phase 2 — Read-only discovery

A 9-prompt pack (P1–P9) was grouped into 3 background workers by shared context:

- **Data & binding:** P3 / P4 / P5
- **Generator & server-render:** P2 / P8 / P9
- **Editor / tokens / process:** P1 / P6 / P7

All outputs were saved to the discovery folder (the P-files and `fixtures/` below).

---

## 2. File index

All paths are relative to the source report (`denpasar/docs/templara-discovery/00-DISCOVERY-REPORT.md`).

### Reports

| File | One-line description |
| --- | --- |
| `P1-editor-architecture.md` | Editor package (Lexical WYSIWYG) + in-repo Monaco code mode, host integration, field picker, server-round-trip preview, and route/entitlement gating. |
| `P2-generator-pipeline.md` | Caller-side contract to the external `document-generator` service (routes, payload, auth, concurrency); service internals are a black box. |
| `P3-context-builder.md` | **THE CRUX:** path-driven context builder — `extractTemplatePaths` → `$byIdOrThrow({paths})` → `buildRecordContext`, with the full pre-formatted money/date/enum suffix-leaf tables. |
| `P4-real-templates-invoice-chain.md` | The longest real templates ranked by size + the full invoice chain (template → record → context → rendered HTML). |
| `P5-records-object-model.md` | RObject/field/connection model, the universal `$`-system mixin block, `serialize()` vs path-driven materialization, why editors surface thousands of fields. |
| `P6-design-tokens.md` | "Zinnia" design tokens (`@roserocket-sdk/zinnia-particles`), CSS-var delivery, Noto Sans / 62.5% root, and a proposed `HostDesignTokens` interface. |
| `P7-document-process-integration.md` | Doc-type registry (`RDocumentTypeConfig`), generation triggers, attach/store/merge/email/export lifecycle, and the Handlebars/PDF seam checklist. |
| `P8-fonts-assets-logo.md` | Fonts, logo/image resolution (URLs vs base64 barcodes vs pdf-lib merge), asset-timing risk; print-font resolution is service-internal. |
| `P9-server-render-feasibility.md` | A′ vs B server-render options; recommends **A′-lite** (SSR to HTML → existing print path) as the lowest-risk first step. |

### Fixtures

| File | One-line description |
| --- | --- |
| `fixtures/invoice-Invoice.handlebars` | Byte-identical copy of the real Invoice template (39,655 B) — the 2nd-largest, canonical fidelity test input. |
| `fixtures/invoice-context.json` | [SYNTHESIZED, shape-exact] the `{org, record, document}` context an invoice template actually receives (collapsed, pre-formatted leaves). |
| `fixtures/invoice-record.serialized.json` | [SYNTHESIZED, shape-faithful] a `serialize()`-style raw invoice record (2 orders, 3 order line items, 1 misc FLI, nested graph, `$`-system blocks). |
| `fixtures/invoice-rendered.html` | REAL render (repo Handlebars) of the template + context: 49,554 B, zero unresolved `{{...}}` tokens — the HTML that would be POSTed for Chrome to paginate. |
| `fixtures/manifest-RateConfirmation.handlebars` | Real Rate Confirmation template for the manifest object (26,948 B). |
| `fixtures/order-BillOfLading.handlebars` | Real Bill of Lading template (rating variant) for the order object (30,936 B). |
| `fixtures/order-record.serialized.json` | [SYNTHESIZED, shape-faithful] a raw order record (customer, shipper, consignee, commodities, stops→location, lineItems). |
| `fixtures/payStub-PayStub.handlebars` | Real Pay Stub template (41,969 B, 373 lines) — the largest and only multi-line template; primary complex fidelity input. |
| `fixtures/quote-Quote.handlebars` | Real Quote template for the quote object (23,184 B). |
| `fixtures/shipment-BillOfLading.handlebars` | Real Bill of Lading template for the shipment object (28,374 B). |

---

## 3. Confirmed vs Corrected

Original shared-context assumption → verdict against the evidence files.

| Original assumption | Verdict | Evidence | Read |
| --- | --- | --- | --- |
| Template is a Handlebars/HTML string on `DocumentTemplate.templateData` (`@RText`) | **CONFIRMED** | `templateData?: string @RText`; editor round-trips HTML/Handlebars text; hidden `dataFormatVersion` defaults `'1'`. | P1 §4.2, P7 §1.3 |
| Context ≈ `{ org, record: serialize(record), document }` | **CORRECTED** | Shape `{org, record, document}` is right, but `record` is **not** a blanket `serialize()`; it is built path-by-path by `buildRecordContext`. `serialize()` appears only in the generic system render action + legacy assemblers. | P3 §0/§4, P7 §6 |
| Context is built lazily / path-driven off `{{...}}` | **CONFIRMED** | `extractTemplatePaths(templateData)` → `normalizeRecordPaths` → `$byIdOrThrow({paths})` → `buildRecordContext`. | P3 §2, P7 §2.1 |
| Money/dates pre-formatted as strings at suffix leaves | **CONFIRMED** | `applyRecordValue` emits e.g. `withDecimalsAndCurrencyCode`, `dateTimeInLocation.shortDate`; closed suffix allowlist. | P3 §2d/§5 |
| Editor = external Bit pkg `@roserocket/components.document-template-editor` | **REFINED** | Confirmed (Lexical WYSIWYG, v4.6.4), but not the only editor — an in-repo Monaco **code mode** (`isCodeMode`) is a first-class alternative. | P1 §3, §8.2 |
| Preview behavior (open question in brief) | **REFINED** | Always a **server round-trip** against a real record: visual→HTML (`getBOLPreview`), code→base64 PDF (`previewPdf`). No client-side Handlebars in host. | P1 §6 |
| Generation compiles Handlebars→HTML→PDF (headless Chrome) in repo | **CORRECTED** | PDF generation is **out of repo**: `document-generator` is an external microservice (image-only in docker-compose, no build context). `platform-model` builds `{templateData, context, options}` and POSTs to `http://document-generator:8080/api/v1/docs/platform/{id}[/pdf|/preview]` with Bearer auth. | P2 |
| `documentContext.helpers.ts` is the field-picker source | **CORRECTED** | It is the **server-side record-context builder** (preview/generation). The picker is built **client-side** from the recipe objects ingredient (`useIngredientObjectFields`). | P1 §1, §5, §8.4 |

---

## 4. Key findings by prompt

### P1 — Editor architecture
- Route `#/ops/document-builder-admin/:templateId`, gated by `FourBuildersAccessACLRoute` (org entitlement `builders.access.secondaryBuilderBundle` OR `fullAccess` + role allow-list); no per-feature enrolment flag.
- Two mutually-exclusive editors: external Lexical WYSIWYG (`@roserocket/components.document-template-editor@4.6.4`) and in-repo Monaco **code mode** (`isCodeMode`, a one-way trap door).
- Load = `documentTemplate/readTemplate/1.0` (+ up to 10 recent real records for preview cycling); save = generic `objectRecord.updateById` (no dedicated write action).
- Field picker is fed client-side from the recipe objects ingredient, flattened one connection hop at a time.
- `initialState` prop already accepts a serialized Lexical JSON state — a latent hook for a JSON model.

### P2 — Generator pipeline / contract
- `document-generator` source is **not on disk anywhere** — consumed only as a container image; all service internals flagged NOT-LOCALLY-DETERMINABLE.
- Contract: `POST {base}/api/v1/docs/platform/{documentId}[/pdf|/preview]`, Bearer auth, body `{ templateData, context, options? }`; returns PDF bytes / HTML text / `{html}`.
- Two calling styles: legacy fixed-template (`documentId='invoice'|'bol'|…`, generator owns the `.hbs`) vs unified `'generate-document'` (caller ships the Handlebars string). **Templara targets the latter.**
- Observed Handlebars usage (lower bound on registry): built-ins `if`/`each`/`unless`/`@index` + a custom `inc` helper only.
- Ops: `MAX_TASK_CONCURRENCY=2` per generator instance.

### P3 — Context builder (THE CRUX)
- Record context is materialized on demand per template path via a **regex `TemplateVisitor`** (not a real Handlebars AST); `this.`/`../` resolved against a loop-prefix stack; array indices stripped.
- Closed set of "magic" suffix leaves: 3 money (`withCurrencyCode`, `withDecimalsAndCurrencyCode`, `unroundedWithoutCurrencyCode`), 6 date formats × 2 properties, 7 range formats, `url`.
- Money leaves hardcode a `$` glyph (e.g. `"$140.00 USD"`), **not** the brief's `"140.00 USD"`.
- **Live bug:** templates read `{{org.orgAddress.postalCode}}` but `getOrgAddress` emits `postal` → org postal renders blank (record addresses use `postalCode` and are fine).
- Because materialization is engine-agnostic below the parser, `buildRecordContext` **can be reused by Templara** if it can enumerate referenced `record.*` paths.

### P4 — Real templates + invoice chain
- Templates live as `.handlebars` files under `recipes/**/documentTemplates/` (defaults) and/or on `DocumentTemplate.templateData` (org-saved); ranked largest: payStub (41,969 B) > invoice (39,655 B) > order BOL (30,936 B).
- Full invoice chain captured end-to-end in fixtures (template → synthesized record → synthesized context → real rendered HTML with zero unresolved tokens).
- Invoice template uses only Handlebars built-ins; relies on many `@RDerived`/`@RLookup` virtual fields (`ordersDocBuilder`, `orderLineItems`/`miscLineItems`, `hasTax`, `formattedTaxComponentsSummary`).
- Engine also supports `###sortBy:` loop-sort encoding, `terms` triple-stash upgrade, and `<img data-code-type>` barcode components (two-pass render).

### P5 — Records & object model
- Objects are `RRecord` classes with decorated fields (`@RText`/`@RMoney`/`@RLocalDateTime`/`@RSelect`/…) and `@RConnection` relations (target `objectKey` is the drill-in key).
- A 13-field `$`-system block (Identity + Audit mixins, `targetKey:'*'`) is composed onto every object, hence the repeated `$id`/`$externalId`/`$createdAt`/... on every node.
- Two materializers: path-driven `buildRecordContext` (Doc Builder 1, preferred) vs generic `serialize()` (legacy assemblers + search index; full graph when fields omitted).
- Editors can surface ~3,474 fields because each connection expands to its target's full field set + `$`-block; the in-repo autocomplete avoids explosion by drilling one connection level on demand.

### P6 — Design tokens
- Design system is **"Zinnia"** (`@roserocket-sdk/zinnia-particles` via `@roserocket/design.tokens`): `tokens.global` (raw hex/rem) + `tokens.reference` (`var(--zinnia-*)`).
- Runtime delivery = **CSS custom properties on `:root`** (stylesheet) + importable JS token object; **no** React theme-provider/context (favorable — tokens are ambient).
- Font **Noto Sans**; `html { font-size: 62.5% }` so `1rem = 10px`.
- A drafted `HostDesignTokens` interface is provided; recommended delivery is **CSS-var inheritance** (mount in host DOM) plus a typed token prop for canvas/iframe cases.

### P7 — Document process integration
- Doc types are `RDocumentTypeConfig` ingredients (`createDocumentType({...})`) carrying `key`/`label`/`objectKey`/`isCustomizable`/`isAutoCreated`, optional in-code template, optional `normalizeParentId`; custom org types creatable at runtime.
- Triggers: interactive editor previews, on-demand REST controller GETs, programmatic `documentGeneration` actions, generic system render+attach, and `isAutoCreated` on record creation.
- Generated PDFs → system file records → `document` on the parent's `documents[]`; supports pdf-lib merge/combine, signatures, presigned URLs, and public-link/email delivery.
- **Two rendering worlds:** generic system render (thin `{record:serialize, org, currentDate}` context, rejects `hasSystemTemplate` types) vs base TMS `documentGeneration` (rich per-type context) — **Templara must state which it serves.**
- Provides an explicit checklist of Handlebars-string and PDF-bytes seams a new engine must satisfy or replace.

### P8 — Fonts, assets, logo
- Logo and record files are sent as **URLs** (`org.logoUrl`, presigned `getFileDownloadURL`) — Chrome fetches them at print time.
- Barcodes/QR are inlined as **base64 PNG data URIs** via the two-pass `getPDFWithCodeReplacement` (no fetch) — the pattern **Templara should reuse** for generated imagery.
- Bundled `NotoSans-Regular.ttf` is only for the platform-side pdf-lib merge/text path, **not** the Chrome print path.
- Print font families and the pre-print asset-wait strategy are service-internal and unknown (**top fidelity risk**).

### P9 — Server-render feasibility
- **A′-lite** (SSR Templara React → HTML string → existing `generate-document` print path) is feasible **today with zero service changes** = lowest-risk first step.
- Full client-side A′ (mount React in the service's Chrome) hinges on three service-internal unknowns: static bundle hosting, a "render-complete" readiness hook, and CSP.
- **B** (separate Puppeteer service) is a costly fallback that re-implements the print fidelity Doc Builder 1 already owns; avoid unless A′/A′-lite proven impossible.
- Recommendation: publish a versioned `@roserocket/components.templara-renderer` shared by editor and service, pinned like the current editor package.

---

## 5. Evidence gaps / follow-ups

Requires a follow-up run **inside the `RoseRocket/document-generator` repo** (all service internals are a black box from `platform-components`):

- Full Handlebars helper/partial registry (only built-ins + custom `inc` observed).
- Exact Puppeteer print config (`format`, `margin`, `printBackground`, `preferCSSPageSize`, `scale`, `displayHeaderFooter` / header-footer templates).
- Print CSS / `@page` / page-break handling.
- Container font families + any Google Fonts usage + fallback family.
- The pre-print asset-wait strategy (`document.fonts.ready` / `networkidle0` / timeout) — **the single biggest fidelity risk** for an async React renderer.
- Request timeouts / retry / internal queue behavior (caller sets no explicit timeout).
- CSP + static-bundle hosting capability + frontend dependency pinning — needed to finalize A′ vs A′-lite vs B.
- Reachability/authorization of `org.logoUrl` and presigned file URLs from inside the service's network isolation.

**P5 status:** P5 was pending/absent at the start of the write-up and appeared partway through (after re-checks). It was present and read at the time the report was written, and is fully summarized above.

---

## 6. Implications for Templara (Doc Builder 2)

A JSON/React engine must satisfy (or explicitly replace) the following existing seams, each already evidenced above:

1. **Template-string assumption.** `DocumentTemplate.templateData` is a single `@RText` string that the editor, `extractTemplatePaths`, `extractLoopSortConfigs`, and the `###sortBy:` / triple-stash regex surgery all treat as Handlebars text. JSON must fit here or use a new field + bump the existing hidden `dataFormatVersion` (default `'1'`) — the natural versioning seam.
2. **Server-side PDF bytes.** Generation is a synchronous HTTP POST to the external `document-generator` returning HTML or PDF Buffer. Every downstream consumer (REST controller streaming, base64 preview, pdf-lib merge, signature injection, S3 storage with `mimeType: application/pdf`) assumes bytes/HTML in hand.
3. **Path-driven context.** The engine needs an equivalent "which `record.*` fields does this doc reference?" extractor to preserve lazy loading; the record-side `buildRecordContext` is engine-agnostic and reusable.
4. **Pre-formatted leaves.** Money/date/enum/measurement values arrive as pre-formatted strings (or `{ suffixKey: string }`) — a closed, enumerable suffix set. An engine that wants raw values + client-side formatting diverges from this contract and must supply its own formatting.
5. **Doc-type registry.** Applicability is keyed by `objectKey` via `RDocumentTypeConfig`; Templara must register/bind types the same way and choose which rendering world it serves (generic render vs rich TMS `documentGeneration`).
6. **Attach / email / export.** Output must ultimately be a PDF Buffer / file / `document` (+ presigned URL) to participate in merge, signing, public-link, and email delivery.
7. **Design + assets.** Inherit Zinnia CSS vars (Noto Sans, 62.5% root); inline generated imagery as base64 (mirror the barcode pattern) to avoid print-time network fetches.

**Recommended lowest-risk first step: A′-lite** — server-side render the Templara React tree to an HTML string (in `platform-model` or a thin shared renderer lib) and POST that HTML to the existing `generate-document` print path. This reuses the proven Chrome print engine, print CSS/pagination, `showPageNumbers`, Letter sizing, and the entire permission-gated controller surface with **zero service changes** — deferring the three `document-generator`-internal unknowns (bundle hosting, readiness hook, CSP) until the service repo is available.
