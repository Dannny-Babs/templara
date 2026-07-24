# P4 — Longest / most complex real Doc Builder 1 templates + the full invoice chain

Read-only discovery. Paths relative to the `platform-components` checkout.

> **Where the real templates live.** Doc Builder 1 document templates are stored as a
> **Handlebars HTML string** either on `DocumentTemplate.templateData` (org-saved, in the
> DB) or, as the built-in default, in on-disk `*.handlebars` files under
> `recipes/**/documentTemplates/`. They are registered per document type via
> `documentTypeConfig.template` (a file path) — see
> `recipes/base/documentTypes/baseDocumentTypes.ts`. The `.mjml/html_templates/*.html`
> files are **email** templates (a different system) and are NOT document templates.

## 1. The longest / most complex templates (measured)

Ranked by byte size (these are single-line, editor-minified HTML strings):

| # | Doc type | Record (`objectKey`) | File | Size |
|---|---|---|---|---|
| 1 | Pay stub | `payStub` | `recipes/modulePayrollTier0/documentTemplates/payStub-PayStub.handlebars` | 41,969 B |
| 2 | **Invoice** | `invoice` | `recipes/base/documentTemplates/invoice-Invoice.handlebars` | 39,655 B |
| 3 | Bill of Lading (rating variant, order) | `order` | `recipes/moduleRatingTier0/documentTemplates/order-BillOfLading.handlebars` | 30,936 B |
| 4 | Leg BOL (task) | `task` | `recipes/base/documentTemplates/task-LegBillOfLading-task.handlebars` | 28,446 B |
| 5 | Shipment BOL | `shipment` | `recipes/base/documentTemplates/shipment-BillOfLading.handlebars` | 28,374 B |
| 6 | Rate Confirmation | `manifest` | `recipes/base/documentTemplates/manifest-RateConfirmation.handlebars` | 26,948 B |
| 7 | Quote | `quote` | `recipes/moduleQuoteTier0/documentTemplates/quote-Quote.handlebars` | 23,184 B |

> The payStub template is the only one authored with real newlines/indentation (373 lines);
> the rest are single-line minified blobs produced by the WYSIWYG editor. Note the
> `editor__*` CSS class names on every element — that is the fingerprint of the external
> `@roserocket/components.document-template-editor` (Lexical-based) serializer.

**Verbatim copies of the 6 largest are saved under `fixtures/`** (byte-identical `cp`):
- [`fixtures/payStub-PayStub.handlebars`](fixtures/payStub-PayStub.handlebars)
- [`fixtures/invoice-Invoice.handlebars`](fixtures/invoice-Invoice.handlebars)
- [`fixtures/order-BillOfLading.handlebars`](fixtures/order-BillOfLading.handlebars)
- [`fixtures/shipment-BillOfLading.handlebars`](fixtures/shipment-BillOfLading.handlebars)
- [`fixtures/manifest-RateConfirmation.handlebars`](fixtures/manifest-RateConfirmation.handlebars)
- [`fixtures/quote-Quote.handlebars`](fixtures/quote-Quote.handlebars)

Type→template wiring (verbatim):

```37:129:recipes/base/documentTypes/baseDocumentTypes.ts
    label: DocumentTypeLabel.legBillOfLading,
    description: 'Bill of lading for a given leg of an order',
    objectKey: 'task',
    template: createFeatureFlagTemplate(
        '../documentTemplates/task-LegBillOfLading.handlebars',
        '../documentTemplates/task-LegBillOfLading-task.handlebars',
        FFKey.CarrierTasksShipmentsAndLegs
    ...
    label: DocumentTypeLabel.billOfLading,
    description: 'Main bill of lading for an entire order',
    objectKey: 'order',
    template: createFeatureFlagTemplate(
        '../documentTemplates/order-BillOfLading.handlebars',
        '../documentTemplates/order-BillOfLading-shipments.handlebars',
        FFKey.CarrierTasksShipmentsAndLegs
    ...
    label: DocumentTypeLabel.invoice,
    description: 'Invoice',
    objectKey: 'invoice',
    template: '../documentTemplates/invoice-Invoice.handlebars',
```

---

## 2. Full chain for the most complex one — INVOICE

Record type: `invoice` (`recipes/base/objects/platformInvoice.ts`). Document type:
`invoice` (`baseDocumentTypes.ts`), which also registers a `normalizeParentId` that maps a
legacy Order id to the first related Invoice id.

### 2a. The Handlebars template (verbatim)

Full verbatim source: [`fixtures/invoice-Invoice.handlebars`](fixtures/invoice-Invoice.handlebars)
(byte-identical copy of `recipes/base/documentTemplates/invoice-Invoice.handlebars`).

Structural walkthrough (the template is one long `<div class="editor__layout">` containing
three `<table>`s):

1. **Header table** — org logo (`{{org.logoUrl}}`), org address block
   (`{{org.orgAddress.*}}`, `{{org.orgPhone}}`, `{{org.orgEmail}}`), and the invoice id +
   reference numbers (`{{record.fullId}}`, `{{record.orderRefNumbers}}`,
   `{{record.orderPoNumbers}}`, `{{record.orderLoadTenderNumbers}}`).
2. **Bill-to / remit / dates table** — `{{record.invoiceToAddress.*}}`,
   `{{record.remitToAddress.*}}`, `{{record.invoiceDate.dateTimeInLocation.shortDate}}`,
   payment terms (`if/unless` on `record.paymentTerm.name` vs `record.terms`),
   `{{record.dueDate.dateTimeInLocation.shortDate}}`.
3. **Body table** — three repeating sections + a totals footer:
   - `{{#each record.ordersDocBuilder}}`: per-order block with nested
     `{{#each this.origins}}` and `{{#each this.destinations}}` stop blocks, and
     `{{this.totalAmount.withDecimalsAndCurrencyCode}}`.
   - `{{#each record.orderLineItems}}`: order line-item rows (guarded by
     `{{#if record.orderLineItems.length}}` header).
   - `{{#each record.miscLineItems}}`: misc line-item rows (guarded by
     `{{#if record.miscLineItems.length}}`), with `{{record.miscLineItemsSubTotal...}}`.
   - Totals: `{{record.subTotal.withDecimalsAndCurrencyCode}}`, a tax row guarded by
     `{{#if record.hasTax}}` showing `{{record.formattedTaxComponentsSummary}}`, and the
     grand total `{{record.total.withDecimalsAndCurrencyCode}}`.
   - Footer terms: `{{org.documentTerms.invoice_regular.terms_conditions}}` (rewritten to
     triple-stash by the pipeline so the sanitized HTML is emitted unescaped).

### 2b. Example real/realistic input RECORD (JSON)

[`fixtures/invoice-record.serialized.json`](fixtures/invoice-record.serialized.json)
— **[SYNTHESIZED]** but shape-faithful to `serialize()` output and the object
definitions. Shows two orders, three order line items, one misc (order-less) line item,
nested `order → shipper/consignee/commodities/stops`, and the `$`-system field blocks
(`$id`, `$externalId`, `$createdAt`, `$version`, …) on every record. See P5 for how these
fields arise.

### 2c. The built CONTEXT Handlebars receives

[`fixtures/invoice-context.json`](fixtures/invoice-context.json) — **[SYNTHESIZED]** but
key/shape-exact. This is the `{ org, record, document }` object produced by
`getDocumentDataAndContext`. Note how the raw record above collapses into pre-formatted
leaves, e.g.:
- `lineItems[].rate = {amount:2950, currencyCode:'USD'}` (record) → the template asks for
  `{{this.rate.unroundedWithoutCurrencyCode}}` → context leaf `rate: {unroundedWithoutCurrencyCode: "$2,950"}`.
- `total` (a derived `Money` getter) → `{{record.total.withDecimalsAndCurrencyCode}}` →
  `total: {withDecimalsAndCurrencyCode: "$4,770.00 USD"}`.
- `invoiceDate = {dateTimeInLocation:'2026-07-01T00:00:00'}` → `.dateTimeInLocation.shortDate`
  → `invoiceDate: {dateTimeInLocation:{shortDate:"Jul 1, 2026"}}`.
- order-less FLI (`order:null`) is routed into `record.miscLineItems`; order-bearing FLIs
  into `record.orderLineItems` (see `Invoice.orderLineItems` / `miscLineItems` getters, P5).

### 2d. The resulting HTML string

[`fixtures/invoice-rendered.html`](fixtures/invoice-rendered.html) — **REAL RENDER**.
Produced by compiling the byte-identical template with the context above using the repo's
own Handlebars (`node_modules/handlebars`), mirroring the pipeline's triple-stash upgrade of
`org.documentTerms.*.terms_conditions`. 49,554 bytes, **zero unresolved `{{...}}` tokens**.
Verified substitutions include `INVOICE-100482`, `$4,770.00 USD`, `Jul 31, 2026`,
`ORDER-77310`, `MI State`, `$2,950.00`.

### 2e. Final PDF / screenshot

Not generated — the Handlebars→HTML→PDF hop runs in the external `document-generator`
microservice (headless Chrome CSS print), which is not present in this checkout. The HTML in
(2d) is exactly the string that would be POSTed to `…/docs/platform/generate-document/pdf`
for Chrome to paginate. (See P3 §1 for the transport.)

---

## 3. Every helper / conditional / loop used in the invoice template

The invoice template uses **only Handlebars built-ins** — no custom helpers are registered
for it:

| Construct | Where / token | What it does |
|---|---|---|
| `{{expr}}` (interpolation) | `{{record.fullId}}`, `{{org.orgEmail}}`, `{{this.subTotal}}`, … | Emits the (HTML-escaped) leaf value from the context at that path. |
| `{{#if x}} … {{/if}}` | `{{#if org.logoUrl}}`, `{{#if org.orgAddress}}`, `{{#if this.poNum}}`, `{{#if this.loadTenderNum}}`, `{{#if this.refNum}}`, `{{#if record.hasTax}}`, `{{#if record.orderLineItems.length}}`, `{{#if record.miscLineItems.length}}` | Renders the block only when the value is truthy. `.length` guards suppress empty tables/headers. `record.hasTax` is a derived boolean getter. |
| `{{#unless x}} … {{/unless}}` | `{{#unless record.paymentTerm.name}}` | Inverse of `#if`; used to fall back from the new `paymentTerm.name` to the deprecated `record.terms` string. |
| `{{#each xs}} … {{/each}}` | `{{#each record.ordersDocBuilder}}`, `{{#each this.origins}}`, `{{#each this.destinations}}`, `{{#each record.orderLineItems}}`, `{{#each record.miscLineItems}}` | Iterates an array in the context. Nested `#each` (orders → origins/destinations) sets the inner loop scope. |
| `{{this.*}}` | inside every `#each` | Refers to the current loop element. The `TemplateVisitor` resolves `this` against the loop-prefix stack so `record.ordersDocBuilder.origins.location.city` gets materialized (P3 §2b). |
| `.length` property | `record.orderLineItems.length` | Standard Handlebars path access to array length for the guard. |

### Pipeline-level helpers the invoice template does NOT use (but Doc Builder 1 supports)

These are worth knowing for Templara because the engine supports them even though the
invoice template happens not to use them:

- **`###sortBy` loop-sort encoding** — `{{#each record.x ###sortBy:field:dir}}`. Parsed by
  `extractLoopSortConfigs`, applied via lodash `orderBy` in `applyRecordValue`, then the
  `###sortBy:` marker is stripped from the template before it reaches the doc service
  (P3 §1). Supports multiple tiebreakers and a subexpression form
  `{{#each (reverse record.x ###sortBy:field:dir)}}`.
- **Triple-stash upgrade for terms** — `{{org.documentTerms.*.terms_conditions}}` is
  auto-rewritten to `{{{…}}}` so sanitized HTML renders unescaped.
- **Code components** — templates may contain `<img data-code-type="...">` tags for
  barcodes/QR; `getPDFWithCodeReplacement` does a two-pass render (`getHTML` →
  `replaceCodeComponents` → `getPDF`). The invoice path does not, but BOL/quote/shipment do.

### Notable computed/virtual fields the invoice template relies on

These are `@RDerived`/`@RLookup` getters on the `Invoice` object (not stored columns) —
they only exist because the template references them, and they encode real business logic
(see P5 §3 for the code):

- `record.orderRefNumbers`, `record.orderPoNumbers`, `record.orderLoadTenderNumbers` —
  de-duplicated, comma-joined strings gathered across connected orders.
- `record.ordersDocBuilder` — orders reached via `lineItems.order`, pre-loading
  `poNum/shipper/consignee/commodities/totalAmount/stops` specifically for doc rendering.
- `record.orderLineItems` / `record.miscLineItems` — line items split by whether they carry
  an `order` (booked-historical split).
- `record.subTotal`, `record.total`, `record.miscLineItemsSubTotal`, `record.hasTax`,
  `record.formattedTaxComponentsSummary` — derived money/tax rollups.
- Order-level `this.stopHeaderDocBuilder`, `this.formattedBaseCommodityFieldsDocBuilder`,
  `this.uniqueCommoditiesTotalWeight` — doc-builder-specific string projections on the Order
  object.

> **Observation (live mismatch).** The invoice template reads
> `{{org.orgAddress.postalCode}}`, but `getOrgAddress` populates `postal` (not `postalCode`)
> for org/remit addresses — so the org postal code renders blank in the header today. Record
> addresses (`invoiceToAddress`, `remitToAddress`, stop `location`) do use `postalCode` and
> render correctly. Same applies to the payStub template's `{{org.orgAddress.postalCode}}`.
