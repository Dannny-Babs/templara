# Rose Rocket Integration Retrospective — Doc Builder 2 (Templara)

**Status:** Log / raw retrospective. Captured Jul 23, 2026. Feeds the "easy insert" backlog (§6) and the open questions in [project-context-and-roadmap.md](project-context-and-roadmap.md).

What we did, what broke, what we discovered, and what would turn this from "heavy lifting" into an "easy insert."

---

## 0. The one fact that explains everything

**Our existing document system is HTML-string-centric. Templara has no HTML anywhere in it.**

- **Doc Builder 1 (today):** a Handlebars **string** stored on `DocumentTemplate.templateData` → the `document-generator` service compiles Handlebars + JSON context into an **HTML string** → headless Chrome loads that HTML/CSS → Chrome prints it to a **PDF (real bytes)**. Layout and pagination are *Chrome's CSS engine*.
- **Templara:** a structured **JSON** template → `@templara/renderer` runs its **own layout + pagination engine** and emits a flat list of absolutely-positioned nodes (`RenderNode[]` with x/y/width/height + explicit page breaks) → `@templara/react-renderer` paints those as positioned `<div>`s **in a browser** → `@templara/pdf` calls the browser's `window.print()`. **It never produces HTML, and it never produces PDF bytes on a server.**

Every issue below is a consequence of that mismatch. When you said "map our HTML to our HTML templates" — the discovery is that **there is no HTML to map.** Templara replaced the entire HTML/Chrome pipeline with its own engine.

---

## 1. How rendering works — side by side

| | **Doc Builder 1 (Handlebars)** | **Templara (Doc Builder 2)** |
|---|---|---|
| Template format | Handlebars string | Structured JSON (`DocumentTemplate`) |
| Where it renders | `document-generator` HTTP service (server) | Browser (client) |
| Intermediate | HTML string | None — positioned nodes |
| Layout/pagination | Chrome CSS print | Templara's own layout engine + measurement provider |
| Output | **PDF bytes** (server) | DOM preview; PDF only via browser print (**no bytes**) |
| Data binding | `{{record.x.y}}` mustache | `{ binding: { path: "record.x.y" } }` |
| Editor | External Bit pkg `@roserocket/components.document-template-editor` | `@templara/editor` (React, controlled) |
| Data context | `{ org, record: serialize(record), document }`, **built lazily from the paths the template references** | Same shape *conceptually*, but we hand-fed it |

The critical asymmetry: **DB1's context builder is path-driven off the Handlebars `{{…}}` references.** It walks the template, sees `{{record.total.withDecimalsAndCurrencyCode}}`, and lazily materializes *only that leaf*. Templara's paths live inside JSON, invisible to that builder — so nothing hydrates them automatically. **That is the single biggest gap between "works in preview" and "works live."**

---

## 2. The heavy lifting — every code change we made

**Install / config (shared, tracked):**
- `.yarnrc.yml` — added `@templara/*` to `npmPreapprovedPackages` (the packages were 1 day old; the 7-day `npmMinimalAgeGate` refused them).
- `ui/package.json` + `yarn.lock` — added `@templara/core`, `@templara/editor`, `@templara/react-renderer` at pinned versions (version-sync matters for a future server renderer).

**New discriminator + template plumbing (no feature flag):**
- `templara/templaraTemplate.ts` — `isTemplaraTemplate()` (content-based JSON shape check — this is how we tell DB1 vs DB2 apart **without** a flag or a new schema field), `createBlankTemplate()`, `fieldsToDataSchema()` (platform fields → Templara `DataSchema`, one level deep), `parseTemplateOrBlank()`.
- `templara/templaraSampleData.ts` — synthesize placeholder data from the schema.

**Editor surface:**
- `templara/TemplaraDocumentEditor.tsx` + `.styled.tsx` — mount `@templara/editor`, live preview overlay via `renderDocument` + `DocumentPreview`, **CSS isolation** (`all: initial` root) so platform globals don't bleed in.
- `components/DocumentBuilder.tsx` — branch on `isTemplara`, render Templara editor vs the Bit editor, seed menu items.
- `hooks/useDocumentBuilderContext.ts` + `DocumentBuilderContainer.tsx` — thread `fields` + `rootObjectKey` through.

**The invoice template:**
- `templara/invoiceTemplate.ts` — the full invoice layout + sample data mapped to the real serialized invoice shape.

---

## 3. Issues we hit, and what we did about each

| Issue | Root cause | What we did |
|---|---|---|
| `yarn add` → "No candidates found" | 7-day npm age gate vs 1-day-old packages | Allowlisted `@templara/*` (flagged as a tracked config change) |
| 246 "build errors" | Stale worktree: `boreal-sdk` module-not-found + `TimelineLayoutZoom` — **not our code** | Rebuilt boreal-sdk, cleared 826 MB rspack cache |
| `@templara/pdf` returns `{status}`, no bytes | It's browser-print-only by design | Deferred server PDF (decision **A′**: run react-renderer inside doc-generator's Chrome) — you said export isn't the priority |
| Editor styles could bleed | Shared global CSS | `all: initial` isolation root (Shadow DOM noted as follow-up) |
| Money rendered as `[object Object]` risk | I first bound to numeric fields | Discovered money leaves are **pre-formatted strings**; rebound |
| Empty address lines left blank gaps | Every field always rendered | Wrapped optional fields in `conditional`/truthy |
| Layout guesswork | **Packages ship no docs/fixtures/types-with-comments** | Reverse-engineered the layout engine from bundled JS |

**Reverse-engineering was real manual work.** To place anything correctly I had to read the minified renderer and learn undocumented rules:
- A `flow` layer's root **must** be a `flowRegion` (silently dropped otherwise).
- Flow *leaf* nodes **ignore `frame.x`** (pinned to region); **sections honor `frame.x`** and paint their background behind content.
- A section inside a horizontal stack renders all children at **one origin** (no stacking) → must wrap content in a single vstack.
- `background` layers paint full-bleed behind flow.
- Grid rows need the binding to resolve to an **array**; row scope exposes `item.*`.

None of that is written down anywhere. That's the friction tax.

---

## 4. The data-mapping crux (the part that was genuinely subtle)

We pulled ground truth from DB1's `invoice-Invoice.handlebars` + `documentContext.helpers.ts` and learned the serialized shape is **not** raw model values:

- **Money = pre-formatted strings at suffix leaves:** `record.total.withDecimalsAndCurrencyCode` → `"4,590.00 USD"`. Bare `record.total` is an object; `.amount` isn't built. Line-item `subTotal` (no suffix) is already `"$1,234.00"`.
- **Dates = pre-formatted strings:** `record.invoiceDate.dateTimeInLocation.shortDate` → `"Jul 1, 2026"`.
- **"From" = the org** (`org.orgAddress.*`), **bill-to** = `record.invoiceToAddress.*`, **remit-to** = `record.remitToAddress.*` — individual fields, no `formattedAddress`.
- Terms prefer `record.paymentTerm.name`, fall back to legacy `record.terms`.

So we **bound to the pre-formatted leaves and applied no client-side formatting** — matching DB1 exactly. And I hand-authored sample data mirroring that nested shape so the preview is faithful.

**The open structural problem:** those leaves only exist because DB1's builder saw them referenced in Handlebars. For a live Templara render, nothing tells the builder to produce them.

---

## 5. Questions we raised (some still open)

1. **Server render:** run react-renderer in doc-generator's Chrome (A′), or add a Node renderer to Templara? (Deferred.)
2. **Version-sync:** a server renderer means `@templara/*` must be identical in `ui` and `document-generator`. How enforced?
3. **Formatting ownership:** bind to pre-formatted string leaves (what we did), or feed raw `Money`/`DateTimeValue` and give Templara a Money-aware formatter?
4. **Schema depth:** our `fieldsToDataSchema` only goes one connection level. Real invoices need `order.*`, `taxRate.*`, etc.
5. **Real records vs placeholder:** preview uses sample data; live needs `serialize(record)`.
6. **Doc-process integration:** attach-to-record, email, background export, default-template — none of that is wired for Templara yet.
7. **Migration/discrimination:** content-sniff (`isTemplaraTemplate`) vs a real type field — fine for a local test, not for GA.

---

## 6. What would make Templara an "easy insert" — prioritized

**#1 — A binding-path extractor that feeds the existing context builder.** Walk the Templara JSON, collect every `binding.path` / `condition.source` / grid binding, and hand that list to `getDocumentDataAndContext` exactly like it harvests `{{…}}` from Handlebars. *This one adapter lets Templara reuse the entire `serialize` + Money/Date-formatting pipeline for free.* Highest leverage by far.

**#2 — A server render entrypoint.** Either Templara ships a Node renderer that emits HTML/PDF, or we implement A′ (react-renderer inside doc-generator Chrome) with pinned version-sync. Without this there's no PDF and no document process.

**#3 — Registration parity.** A `createTemplaraDocumentType(...)` that plugs into the **same** document-type registry so DB2 docs show up in the doc process, attach to records, email, and export — no separate path.

**#4 — Deep auto-schema from the RObject.** Generate `DataSchema` (with money/date/connection sub-shapes) straight from the object definition instead of one-level field lists + hand-authored sample data.

**#5 — A value adapter.** One shared module that maps our `Money`/`DateTimeValue`/address types to whatever Templara consumes, so no template author ever re-derives `withDecimalsAndCurrencyCode` again.

**#6 — Ship docs + fixtures + layout types in the packages.** Everything in §3 that I reverse-engineered should be documented so nobody re-learns it.

**#7 — Fonts/assets/logo pipeline** and a **real discriminator field** for the GA migration story.

---

## 7. Execution Guardrails For The "Easy Insert" Work

The backlog above is ordered by leverage, but it is still too large to run as one branch. Execute it as contract-first slices:

1. **Binding extractor contract first.** Build a pure function that walks Templara JSON and returns every path needed by the host context builder: text field runs, image sources, barcode/QR values, repeat/grid bindings, conditions, repeat filters, variable formulas, and fallbacks where relevant. It should not mount React, render a preview, or call the host API.
2. **Context hydration proof second.** Feed the extracted paths into the existing context builder and prove that the returned context contains the same pre-formatted Money/date/address leaves that DB1 templates rely on.
3. **Preview parity third.** Render one known invoice/BOL fixture through Templara and compare it against the existing Handlebars output at the data level before chasing visual parity.
4. **Server PDF A′ after preview parity.** Do not spike Chrome printing until the browser preview is fed by real context data. Otherwise the PDF spike only proves the wrong data can be printed.
5. **Embedding contract in parallel, but isolated.** Host branding, fonts, tokens, dropdown layers, and CSS isolation can move separately as long as they do not change renderer semantics or data contracts.

Required evals for this work:

- extracted path snapshot for a representative Templara invoice
- context hydration fixture proving Money/date/address leaves exist
- large-schema fixture proving field extraction/search does not flood the UI
- browser preview check with real record data, not synthesized placeholders
- server render smoke test once A′ exists
- package version-sync check between the host UI and `document-generator`

Do not solve this by reintroducing HTML as the Templara authoring format. HTML can be an output or print host. The Templara source of truth remains structured JSON plus data.
