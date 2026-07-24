# Discovery Prompts — Learn the Current Rose Rocket Document System

**Status:** Prompt pack. Captured Jul 24, 2026. These are copy-paste prompts to run **inside the Rose Rocket repos** (`platform-components`, the `document-generator` service, and `platform-model`/backend) — not this Templara repo. The goal is to extract ground truth about how Doc Builder 1 works end-to-end so we can plan the Templara (Doc Builder 2) integration as detailed, chunked work.

How to use:
1. Prepend **§0 Shared context** to any prompt so the receiving agent has our current understanding to confirm/correct.
2. Run prompts **P1–P9** independently (or in a batch). Each asks the agent to **save its findings to a markdown file** so you can send the outputs back here.
3. Bring the outputs (and any saved code/fixtures) back into this repo's `docs/` so we build the plan from facts, not assumptions.

Related: [rose-rocket-integration-retrospective.md](rose-rocket-integration-retrospective.md), [embedding-field-test-issues.md](embedding-field-test-issues.md).

---

## Discovery Quality Bar

These prompts are not implementation tickets. They are evidence-gathering tasks that decide what the implementation tickets should be.

- **Host repo facts beat everything else.** If Rose Rocket source code contradicts a prior assumption, update the assumption. Do not preserve the old theory.
- **Web research is secondary.** Use current web research for best practices only after mapping the host code path. Relevant examples: Puppeteer print readiness, React large-list virtualization, embedded theming contracts, and schema-browser UX. Do not use web articles to infer private product behavior.
- **Every claim needs a file path.** Important claims should include exact file paths and code excerpts. If the source is a runtime observation, capture the command, route, fixture, or screenshot that produced it.
- **Prefer real fixtures.** Toy data is acceptable only when the real fixture is unavailable. Mark toy data clearly so it does not become an accidental contract.
- **Record uncertainty explicitly.** Use "confirmed", "inferred", and "unknown" labels. Unknowns should become follow-up prompts or implementation blockers.
- **Name the downstream evals.** Each discovery output should end with the tests or fixtures it enables. If it cannot name an eval, the output is probably still too vague.
- **Protect sensitive data.** Scrub real customer, account, and shipment identifiers before copying fixtures back into this repo unless the fixture is already approved for local development.

---

## 0. Shared context (prepend to every prompt)

```
CONTEXT — read before you start.

We are integrating a new JSON-based document engine ("Templara", aka Doc Builder 2) into
Rose Rocket, alongside the existing Handlebars-based system ("Doc Builder 1"). Before we
build, we need an accurate, evidence-based map of how the CURRENT system works.

Our current understanding (CONFIRM or CORRECT each point with file references):
- A document template is a Handlebars STRING stored on `DocumentTemplate.templateData`.
- The `document-generator` service compiles Handlebars + a JSON context into an HTML string,
  then loads that HTML/CSS in headless Chrome and prints it to a PDF (real bytes). Layout and
  pagination are done by Chrome's CSS print engine.
- The JSON context is roughly `{ org, record: serialize(record), document }`.
- The context is built LAZILY and PATH-DRIVEN: something walks the template, sees the `{{...}}`
  references, and only materializes the leaves that are referenced.
- Money and dates are PRE-FORMATTED STRINGS at suffix leaves
  (e.g. `record.total.withDecimalsAndCurrencyCode` -> "4,590.00 USD",
   `record.invoiceDate.dateTimeInLocation.shortDate` -> "Jul 1, 2026").
- The editor is an external Bit package `@roserocket/components.document-template-editor`.

RULES FOR YOUR ANSWER:
- Cite exact file paths and, where it matters, paste the relevant code VERBATIM.
- Prefer the LONGEST / most complex REAL examples over toy ones.
- If something contradicts our understanding above, say so explicitly and show the evidence.
- Do NOT change any code. This is read-only discovery.
- Save your full findings to a new markdown file and tell me the path.
```

---

## P1 — Document builder (editor) architecture

```
Investigate the current document TEMPLATE EDITOR and how it is embedded in the product.

Find and explain:
1. The editor package `@roserocket/components.document-template-editor` (or equivalent): where
   it lives, its public props/API, and how the host app mounts it.
2. The host integration: which app screen/route renders it, and how it loads/saves a template
   (what field holds the template, e.g. `DocumentTemplate.templateData`).
3. How the editor exposes available data FIELDS to the author (the field picker / merge-field
   inserter): where the field list comes from, how it is fetched, and how deep it goes.
4. How the editor's PREVIEW works today: does it call the server, render client-side, use a
   sample record, or a real record? Trace the exact data path.
5. Any feature flags, permissions, or doc-type gating around the editor.

Deliverable: a markdown file with an architecture summary, a data-flow diagram (template load ->
edit -> field insert -> preview -> save), exact file paths, and key code excerpts. Save it and
give me the path.
```

---

## P2 — `document-generator` service: full template -> PDF pipeline

```
Map the `document-generator` service end-to-end, from a stored template to PDF bytes.

Trace and document:
1. The HTTP entrypoint(s): route(s), request/response shape, auth. What does the caller send
   (template id? templateData string? record id? context?) and what comes back (PDF bytes,
   URL, base64)?
2. Handlebars compilation: where the template string is compiled, what options are set, and the
   full list of registered Handlebars HELPERS and PARTIALS (paste the helper registry / list).
3. The headless-Chrome step: Puppeteer/Chromium setup, how HTML is loaded, and the exact PRINT
   settings (page size, margins, `printBackground`, `preferCSSPageSize`, header/footer, scale).
4. CSS handling: where the print CSS/stylesheets come from, and how `@page`, page breaks, and
   pagination are controlled.
5. Fonts & assets: how fonts are loaded (system? bundled? Google Fonts?), and how images/logos
   are fetched and embedded.
6. Error handling, timeouts, and any concurrency/queueing.

Deliverable: a markdown file with the full pipeline (numbered steps), the entrypoint contract,
the verbatim helper list, and the exact Chrome print config. Save it and give me the path.
```

---

## P3 — The context builder (the crux): path-driven serialization + formatting

```
This is the most important one. Find the code that builds the JSON CONTEXT passed to Handlebars.
We believe it is path-driven off the `{{...}}` references and lazily serializes only referenced
leaves. Likely near `documentContext.helpers.ts` / a `getDocumentDataAndContext`-style function.

Document precisely:
1. WHERE the template's `{{...}}` references are parsed/collected, and HOW that list drives which
   record fields get materialized. Paste the core function(s) verbatim.
2. The exact SHAPE of the final context object (`org`, `record`, `document`, anything else).
3. How `serialize(record)` works: how connections/relations are expanded, and HOW DEEP it goes
   (one level? N levels? on-demand per referenced path?).
4. The FORMATTING rules for value types, with concrete examples:
   - Money: the object shape and the pre-formatted suffix leaves
     (e.g. `.withDecimalsAndCurrencyCode`, `.amount`, line-item `subTotal`). List ALL suffixes.
   - Dates/times: the object shape and suffix leaves
     (e.g. `.dateTimeInLocation.shortDate`, other formats available).
   - Addresses: individual fields vs any `formattedAddress`, and org vs record address sources.
   - Any other special-cased types (enums, phone, quantity/weight, percentages).

Deliverable: a markdown file with the verbatim path-extraction + serialization code, the full
context shape, and a TABLE of value type -> object shape -> available pre-formatted leaves ->
example output. Save it and give me the path.
```

---

## P4 — Longest / most complex real templates + rendered output + records

```
Give me the richest END-TO-END examples so we can learn the full mapping.

Collect:
1. The 3-5 LONGEST / most complex Handlebars templates in the system (e.g. invoice, bill of
   lading, rate confirmation, manifest, pay stub). Paste each template VERBATIM and give its
   file path and which doc type / record type it targets.
2. For the single most complex one (prefer the INVOICE if available), provide the COMPLETE chain:
   a) the Handlebars template,
   b) an example real (or realistic) input RECORD as JSON,
   c) the built CONTEXT object that Handlebars actually receives,
   d) the resulting HTML string,
   e) (if easy) the final PDF or a screenshot.
3. Call out every Handlebars helper and every conditional/loop used in that template and what
   each does.

Deliverable: a markdown file (or a folder of files) containing the verbatim templates and the
full invoice chain (template -> record -> context -> HTML). Save it and give me the paths.
```

---

## P5 — Records & the object model (`serialize`, RObject/field definitions)

```
Explain the record/object model that documents render from.

Document:
1. The object/field definition system (RObject or equivalent): where object types and their
   fields/connections are defined, and how field metadata (label, type, connection target) is
   declared.
2. How a record is turned into document data: the `serialize` implementation, connection
   traversal, and how it decides depth/what to include.
3. A REAL, large example record for the Invoice (and, if possible, the Order) object as JSON —
   the most complete one you can produce, showing nested connections and the `$`-system fields.
4. The relationship between the giant field list shown in editors and the actual serialized data
   (why an Order can surface ~3,474 fields, including repeated `$id/$externalId/...` blocks on
   every connection).

Deliverable: a markdown file with the object-model explanation, the `serialize` code, and a
saved JSON fixture of a real large Invoice record. Save it and give me the paths.
```

---

## P6 — Design tokens (so Templara can INHERIT the platform's UI)

```
We want to make an embedded editor inherit the platform's design tokens instead of shipping its
own UI. Map the design system.

Find and document:
1. WHERE the design tokens live: colors, typography (font families/sizes/weights/line-heights),
   spacing, radii, shadows, z-index, breakpoints. Name the package(s)/files.
2. HOW tokens are exposed at runtime: CSS custom properties (`--...`), a theme provider/context,
   a JS/TS tokens object, Tailwind config, or something else. Paste the canonical token
   source(s).
3. The FONT setup: exact font family/stack, where fonts are loaded, and how weights are declared.
4. Core primitives (Button, Input, Select/Dropdown, Panel) and how they consume tokens — enough
   that we could mirror their look via tokens passed as props.
5. A concrete RECOMMENDATION: what minimal token contract (a typed object or set of CSS vars)
   should an embedded 3rd-party editor accept as a prop to visually match the host? Draft that
   TypeScript interface.

Deliverable: a markdown file with the token inventory, the exposure mechanism, the font stack,
and a proposed `HostDesignTokens` TypeScript interface for embedding. Save it and give me the
path.
```

---

## P7 — Document PROCESS integration (registration, attach, email, export)

```
Map how a document TYPE plugs into the broader document process, so we can achieve parity for a
new engine.

Document:
1. The document-type REGISTRY: how a doc type is defined/registered, what metadata it carries,
   and how the system knows which record types it applies to.
2. GENERATION triggers: manual generate, background/bulk export, and defaults (default template
   per doc type / per customer).
3. What happens to a generated document: attach-to-record, storage, emailing, combining
   documents, and any status/lifecycle.
4. Every place that assumes a template is a Handlebars string or that generation produces PDF
   bytes server-side (i.e. the seams a JSON/React-rendered engine would have to satisfy).

Deliverable: a markdown file listing the registry API, the generation/attach/email/export flow,
and a checklist of "Handlebars/PDF-bytes assumptions" a new engine must satisfy. Save it and
give me the path.
```

---

## P8 — Fonts, assets & logo pipeline (PDF fidelity)

```
Document how fonts, images, and org logos flow into the rendered PDF today.

Cover:
1. Fonts: which font families are available in the PDF output, where they are hosted/bundled, and
   how the print HTML references them. Are Google Fonts used at all?
2. Org logo & images: how the org logo and other images are resolved (URLs, auth, base64) and
   embedded so Chrome can print them reliably.
3. Any asset-timing concerns (waiting for fonts/images to load before printing) and how they're
   handled.

Deliverable: a markdown file describing the font list, asset resolution, and load-timing
handling. Save it and give me the path.
```

---

## P9 — Server-render feasibility for the new engine (A′ vs B)

```
We are deciding how to render the new JSON+React engine on the server for PDF. Two options:
- A′: teach `document-generator` a new mode that serves a page which mounts the React renderer,
  injects `{ templateJson, data }`, waits for paint, and prints (reuse existing Chrome).
- B: run a separate Puppeteer/Chromium inside another service.

Investigate and report:
1. How hard it is to add a new render MODE/route to `document-generator` (routing, how it serves
   HTML/JS today, whether it can host a small React bundle).
2. How the existing Chrome instance is invoked and whether it can load an arbitrary app page and
   wait for a "render complete" signal before printing.
3. Version-sync: how the service pins/builds frontend dependencies, so a shared renderer package
   could be kept identical between the editor app and the service.
4. Any blockers (CSP, network isolation, build tooling) for hosting a React bundle in the service.

Deliverable: a markdown file with a feasibility assessment of A′ (and notes on B), including the
concrete integration points in `document-generator`. Save it and give me the path.
```

---

## Discovery Run Status (Jul 24, 2026)

**First run complete (in the `denpasar` repo, not this one).** Outputs live at `denpasar/docs/templara-discovery/`. Environment was stood up first (yarn install, `worktree:watch`, rspack UI on `:8090`), then all 9 prompts ran via a swarm.

On disk in the source repo (`denpasar/docs/templara-discovery/`):

- **All 9 reports** written (P1–P9). P5 (records & object model) finished last.
- **10 fixtures** captured (real `.handlebars` templates + synthesized records/context + one real rendered HTML).
- Consolidated **`00-DISCOVERY-REPORT.md`** completed.

**Captured into this repo (complete):** the consolidated report ([discovery/00-DISCOVERY-REPORT.md](discovery/00-DISCOVERY-REPORT.md), tables cleaned up), all nine reports **P1–P9**, the source `SOURCE-README.md`, and all 10 `fixtures/` are now under `docs/discovery/`. Copied from `~/conductor/workspaces/platform-components/denpasar/docs/templara-discovery/`.

**Headline assumptions corrected/refined by the run** (full table in the consolidated report §3):

- **CONFIRMED:** context is **path-driven** (`extractTemplatePaths` → `$byIdOrThrow` → `buildRecordContext`); money/date leaves are pre-formatted strings from a **closed suffix allowlist**.
- **CORRECTED:** `record` is **not** a blanket `serialize()` — it's built path-by-path (`buildRecordContext`, which is engine-agnostic and **reusable by Templara**).
- **CORRECTED:** **PDF generation is an out-of-repo microservice** (`document-generator`, image-only) — `platform-model` POSTs `{templateData, context, options}` to it. Service internals (Puppeteer print config, print CSS, fonts, asset-wait) are a **black box** and are the top evidence gap.
- **CORRECTED:** `documentContext.helpers.ts` is the **server-side context builder**, not the field picker (the picker is client-side from the recipe objects ingredient).
- **REFINED:** there's also an in-repo **Monaco code-mode editor**; preview is **always a server round-trip** against a real record.
- **NEW:** design system is **"Zinnia"** delivered as **CSS vars on `:root`** (no theme provider) — favorable for token inheritance. Recommended server-render path is **A′-lite** (SSR React → HTML → existing print path, zero service changes).
- **Known live bug found:** templates read `{{org.orgAddress.postalCode}}` but the builder emits `postal` → org postal code renders blank.

## Suggested run order

1. **P3** (context builder) and **P4** (real templates + invoice chain) first — these unlock the data-binding work, our #1 problem.
2. **P2** (generator pipeline) and **P5** (records/object model) next — the rendering + data foundation.
3. **P6** (design tokens) — needed for the embedding/theming work you called out.
4. **P1**, **P7**, **P8**, **P9** — editor, process integration, assets, and server-render strategy.

Bring every saved output back into this repo's `docs/` so the build plan is written from evidence.

## Discovery Output Checklist

Before a discovery output becomes an implementation plan, it must answer:

- What exact source files or runtime paths prove the behavior?
- What public/internal contract does Templara need to satisfy?
- Which existing behavior must not regress?
- Which fixture proves the happy path?
- Which fixture proves the hardest edge case?
- Which test should fail before implementation and pass after implementation?
- What remains unknown, and is that unknown blocking?
