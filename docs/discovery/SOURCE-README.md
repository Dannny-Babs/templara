# Templara discovery — Doc Builder 1 (current system)

Read-only, evidence-based findings on Rose Rocket's **current** Handlebars document system
("Doc Builder 1"), to inform the future JSON-based "Templara" (Doc Builder 2) integration.
No repo code was modified; only the files in this folder were created.

## Deliverables in this workstream (P3–P5)

- [`P3-context-builder.md`](P3-context-builder.md) — **THE CRUX**: how the `{org, record,
  document}` JSON context is built (path extraction, lazy materialization, full formatting
  rules table).
- [`P4-real-templates-invoice-chain.md`](P4-real-templates-invoice-chain.md) — the
  longest/most-complex real templates + the complete invoice chain (template → record →
  context → rendered HTML).
- [`P5-records-object-model.md`](P5-records-object-model.md) — the RObject/field/connection
  model, `serialize()`, and why an Order surfaces thousands of picker fields.

## Companion workstreams in this folder (produced separately)

- [`P1-editor-architecture.md`](P1-editor-architecture.md) — Document Builder (editor)
  architecture.
- [`P2-generator-pipeline.md`](P2-generator-pipeline.md) — `document-generator` template →
  PDF pipeline.
- [`P6-design-tokens.md`](P6-design-tokens.md) — design tokens for Templara to inherit.
- [`P7-document-process-integration.md`](P7-document-process-integration.md) — document
  process integration (registry, generate, attach, email, export).
- [`P8-fonts-assets-logo.md`](P8-fonts-assets-logo.md) — fonts, assets & logo pipeline.
- [`P9-server-render-feasibility.md`](P9-server-render-feasibility.md) — server-render
  feasibility for Templara.

## Fixtures

- `fixtures/invoice-Invoice.handlebars`, `payStub-PayStub.handlebars`,
  `order-BillOfLading.handlebars`, `shipment-BillOfLading.handlebars`,
  `manifest-RateConfirmation.handlebars`, `quote-Quote.handlebars` — **verbatim** copies of
  the real templates.
- `fixtures/invoice-context.json` — [SYNTHESIZED] built context Handlebars receives.
- `fixtures/invoice-rendered.html` — **REAL** render (repo Handlebars) of the invoice
  template against that context; 0 unresolved tokens.
- `fixtures/invoice-record.serialized.json`, `order-record.serialized.json` — [SYNTHESIZED]
  shape-faithful serialized record graphs showing `$`-system fields + nested connections.

## Key source files (in the checkout)

- `platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts` — entry
  point `getDocumentDataAndContext`.
- `platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts` —
  `getRecordContextForDocument`, `buildRecordContext`, `applyRecordValue` (formatting).
- `platform-model/src/runtime/config/recipes/system/helpers/templateVisitor.helpers.ts` —
  `{{...}}` path extraction + loop-sort parsing.
- `platform-model/src/runtime/documents/document.ts` — `getHTML`/`getPDF` transport to the
  external `document-generator` service.
- `platform-model/src/runtime/rrecord.serializer.ts` — generic `serialize()`.
- `recipes/base/objects/platformInvoice.ts`, `.../objects/identity.ts`, `.../objects/audit.ts`
  — object/field model + `$`-system mixins.
