# P7 — Document PROCESS Integration (registry, generate, attach, email, export)

Read-only discovery of how documents are registered, generated, stored, and attached in "Doc Builder 1", to enumerate the seams a JSON/React-rendered "Templara" engine must satisfy. All findings cited to exact files.

---

## 0. TL;DR

- A document type is an **`RDocumentTypeConfig`** ingredient (`createDocumentType({...})`), carrying `key`, `label`, `objectKey` (the record type it applies to), `isCustomizable`, `isAutoCreated`, optional in-code `.handlebars` `template`, and optional `normalizeParentId`.
- The stored template is a **Handlebars string** on `DocumentTemplate.templateData` (`@RText`). Confirmed.
- Generation is **not done in this repo**. `platform-model` builds a JSON payload `{ templateData, context, options }` and **POSTs it to an external `document-generator` microservice** (`http://document-generator:8080/api/v1/docs/platform/...`) that compiles Handlebars → HTML → prints PDF (headless Chrome, out-of-repo). platform-model receives back **HTML or PDF bytes (Buffer)**.
- Context is `{ org, record, document }`, built **lazily/path-driven** from the `{{...}}` tokens in the template (confirmed), with money/dates **pre-formatted to strings at suffix leaves** (confirmed).
- Generated PDFs are stored as system `file` records and attached via a `document` record on the parent's `documents[]` connection. Documents can be **merged/combined** (pdf-lib) and **emailed / exposed via public link**.

---

## 1. The document-type REGISTRY

### 1.1 The type: `RDocumentTypeConfig`

`platform-model/interpreter/src/config.types/rdocumentType.type.ts`:

```16:96:platform-model/interpreter/src/config.types/rdocumentType.type.ts
export class RDocumentTypeConfig
    extends RConfigurable
    implements RMixable, Omit<DocumentTypeConfig, 'configKey'>
{
    public static configKey: RConfigKey = RConfigKey.documentType;
    public isMixin?: boolean;
    public targetKey?: string;
    public isDisabled?: boolean;
    /** True if this type of document and its templates can be customized. */
    public isCustomizable?: boolean;
    /** If true, a document of this type will be attached to all new records with the same objectKey. */
    public isAutoCreated?: boolean;
    /** Object key this document type can be used with. */
    public objectKey: string = invalidObjectKey;
    public version: string = '1';
    public description?: string;
    /** Path to provided system default template file. */
    template?: string | ((ctx: SecurityContext) => Promise<string | undefined>);
    /** Optional server-side resolver that normalizes the parent record id before document context
     * is built (e.g. legacy invoice documents that persisted an Order id instead of an Invoice id). */
    normalizeParentId?: (args: {
        systemDocParentId: string;
        ctx: SecurityContext;
    }) => Promise<string>;
    public get hasSystemTemplate(): Readonly<boolean> {
        return !!this.template;
    }
    ...
```

Metadata carried: `key`, `label`, `objectKey` (which record type it applies to), `version`, `isCustomizable`, `isAutoCreated`, `isDisabled`, `hasSystemTemplate`, `description`, and the non-serialized server hooks `template` + `normalizeParentId`. `toJSON()` (lines 98–111) is what the client sees — note `template`/`normalizeParentId` are **intentionally server-only**.

### 1.2 How types are registered

Types are declared as recipe ingredients via `createDocumentType(...)`. The base TMS catalog — `recipes/base/documentTypes/baseDocumentTypes.ts` (longest real example, excerpted):

```47:68:recipes/base/documentTypes/baseDocumentTypes.ts
export const order_BillOfLading = createDocumentType({
    isCustomizable: true,
    key: DocumentType.billOfLading,
    label: DocumentTypeLabel.billOfLading,
    description: 'Main bill of lading for an entire order',
    objectKey: 'order',
    template: createFeatureFlagTemplate(
        '../documentTemplates/order-BillOfLading.handlebars',
        '../documentTemplates/order-BillOfLading-shipments.handlebars',
        FFKey.CarrierTasksShipmentsAndLegs
    ),
});

export const shipment_BillOfLading = createDocumentType({
    isAutoCreated: true,
    isCustomizable: true,
    key: DocumentType.shipmentBillOfLading,
    label: DocumentTypeLabel.shipmentBillOfLading,
    description: 'Bill of lading for a specific shipment',
    objectKey: 'shipment',
    template: '../documentTemplates/shipment-BillOfLading.handlebars',
});
```

```123:134:recipes/base/documentTypes/baseDocumentTypes.ts
export const invoice_Invoice = createDocumentType({
    isCustomizable: true,
    key: DocumentType.invoice,
    label: DocumentTypeLabel.invoice,
    description: 'Invoice',
    objectKey: 'invoice',
    template: '../documentTemplates/invoice-Invoice.handlebars',
    // Legacy invoice documents may carry an Order id as the parent; resolve it to the first
    // related Invoice id.
    normalizeParentId: normalizeInvoiceParentId,
});
```

Key facts:
- **Applicability** = `objectKey` (e.g. `order`, `manifest`, `invoice`, `partner`, `partnerCompliance`, `payStub`, `customer`, `driverProfile`, `*` for "other"). `objectKey: '*'` = generic.
- Some types ship an **in-code default `.handlebars`** (`template`); `createFeatureFlagTemplate(a, b, FFKey)` picks between two template files by flag.
- Registry lookups: `(await ctx.recipe).documentTypes.get(key)` / `.find(key)`. Types are mixinable per terminal (e.g. `recipes/moduleRatingTier0/documentTypes/mixins/…`, `recipes/modulePayrollTier0/documentTypes/mixins/payStub-PayStub.ts`).
- **Custom (org-authored) document types** can be created at runtime via `POST documents/customType` → `DocumentsController.upsertCustomDocumentType` (`platform-model/src/services/documents/documents.controller.ts` lines 904–918), surfaced in the settings UI (`config-CustomDocumentType`). This is how boreal/non-TMS orgs (which register no code types) get types for templates to bind to.

### 1.3 The template record + its default binding

`platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts` — the `DocumentTemplate` RObject. Confirms `templateData` is a plain text field:

```127:177:platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts
    @RText({
        label: 'Template data',
        description: 'Data used to generate document content.',
    })
    templateData?: string;

    @RText({
        isHidden: true,
        defaultValue: '1',
        label: 'Data format version',
        description: 'Version of the template data format.',
    })
    dataFormatVersion?: string;

    @RToggle({
        defaultValue: false,
        label: 'Show page numbers',
        description: 'Display page numbers in the footer of generated PDF documents.',
    })
    showPageNumbers: boolean;

    @RToggle({
        isHidden: true,
        defaultValue: false,
        label: 'Is code mode',
        ...
    })
    isCodeMode: boolean;

    @RConfigSelect({
        label: 'Document type',
        description: 'Type of document this template is for.',
        rootConfigKey: RRootConfigKey.documentType,
        filterOptions: ({ config }) => !!config.isCustomizable,
    })
    documentType: string;
```

Notable:
- `dataFormatVersion` (default `'1'`) already exists — a natural seam for Templara to bump to a JSON format version (`'2'`).
- `documentType` select is filtered to `isCustomizable` types (only those can be authored).
- Derived `editorUrl` returns `` `_/#/ops/document-builder-admin/${this.$id}` `` (the editor route from P1).
- The org "default template per type" binding is a separate object, `DocumentTemplateConfig` (`getDefaultDocumentTemplate({ documentType, ctx })` / `setDefaultDocumentTemplate`), managed by the `documentTemplate` actions `getOrgDefault` / `setOrgDefault` / `clearOrgDefault` (`recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts`).

---

## 2. GENERATION — the pipeline (Handlebars + context → HTML → PDF)

### 2.1 The context builder (payload assembly) — CONFIRMS the shared context

`platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts` — `getDocumentDataAndContext` is the central assembler:

```105:132:platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts
    const context = {
        [ContextKeys.org]: orgContext,
        [ContextKeys.record]: recordContext,
        [ContextKeys.document]: formattedDocumentContext,
    };

    // Strip sort encoding before sending to document-generator so it receives clean Handlebars
    let cleanedTemplateData = templateData?.replace(/\s+###sortBy:[^\s})]+/g, '');

    // Upgrade terms_conditions fields to triple-stash so sanitized HTML renders unescaped
    cleanedTemplateData = cleanedTemplateData?.replace(
        /(?<!\{)\{\{(org\.documentTerms\.[^}]*\.terms_conditions)\}\}(?!\})/g,
        '{{{$1}}}'
    );

    const options: DocumentGenerationOptions | undefined =
        showPageNumbersOverride !== undefined
            ? { showPageNumbers: showPageNumbersOverride }
            : showPageNumbers
              ? { showPageNumbers }
              : undefined;

    return {
        templateData: cleanedTemplateData,
        context,
        ...(options && { options }),
    };
```

- Context shape `{ org, record, document }` — **confirmed** (`ContextKeys` enum in `documentContext.types.ts`).
- **Template-string coupling is explicit:** the assembler does regex surgery on the Handlebars text (`###sortBy:` sort-encoding stripping, and triple-stash upgrading for `terms_conditions`). This is a hard seam — it presumes the template is Handlebars text.
- Default-template resolution: if no `templateData` is passed, it loads the org default (`DocumentTemplateConfig.getDefaultDocumentTemplate`), then falls back to the in-code base `.handlebars` (`findBaseTemplateData` reads the file off disk). Whitespace-only template counts as "missing".
- `normalizeParentId` hook runs here (lines 89–91) before building record context.

The **lazy/path-driven** record context — `documentContext.helpers.ts` (confirms shared context):

```186:210:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
    const allPaths = extractTemplatePaths(templateData);
    let recordPaths = normalizeRecordPaths(allPaths);
    recordPaths = excludeInvalidPaths(recordPaths, config);
    ...
    const paths = stripFormattingPathSuffixes(recordPaths);
    const code = config.getObjectCtor<typeof RRecord>();
    const record = await code.$byIdOrThrow({ id: systemDocParentId, paths }, ctx);
    return buildRecordContext(record, recordPaths, loopSortConfigs);
```

- **Confirmed lazy/path-driven:** only the paths referenced by `{{...}}` tokens are extracted (`extractTemplatePaths`), loaded (`$byIdOrThrow({ paths })`), and materialized. Nothing else on the record is serialized.
- **Confirmed money/date pre-formatting at suffix leaves:** `applyRecordValue` formats `Money`, `MultiCurrencyMoney`, `DateTimeValue`, `Measurement`, `select/status/multiSelect/time` into **strings** keyed by the path suffix (e.g. `costs.withCurrencyCode`, `invoiceDate.dateTimeInLocation.shortDate`). Example (money):

```379:414:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
        if (isMoney(value)) {
            if (newPath === MoneyFormatType.withCurrencyCode) {
                const formattedAmount = formatNumber({
                    value: value.amount, minDecimalsLength: 0, maxDecimalsLength: 4,
                    currencyId: value.currencyCode,
                });
                data[fieldKey] = { withCurrencyCode: `${formattedAmount}` };
            } else if (newPath === MoneyFormatType.withDecimalsAndCurrencyCode) {
                ...
            } else {
                const formattedAmount = formatNumber({
                    value: value.amount, minDecimalsLength: 2, maxDecimalsLength: 2,
                });
                data[fieldKey] = `$${formattedAmount}`;
            }
        }
```

Org context (logo, addresses, terms) is fetched separately via `getOrgContextForDocument` (RR1 SDK), and `terms_conditions` is HTML-sanitized (`sanitizeAndAutolinkHtml`). `document` context carries signatures + a pre-formatted `currentDate` map.

### 2.2 The generator call — external microservice returning HTML / PDF bytes

`platform-model/src/runtime/documents/document.ts` — the HTTP client to the doc service:

```102:152:platform-model/src/runtime/documents/document.ts
export const getPDF = async (
    documentData: object,
    documentId: string,
    ctx: InvocationContext | Context
): Promise<Buffer | undefined> => {
    const endpoint = `${DocumentsController.documentServiceBaseEndpoint}${DocumentsController.documentServiceGenerateEndpoint}/${documentId}/pdf`;
    const [resp, error] = await of(
        superagent
            .post(endpoint)
            .set({
                Accept: 'application/pdf',
                'Content-Type': 'application/json',
                [authHeader]: `Bearer ${ctx.token}`,
            })
            .send(documentData)
            .buffer(true)
    );
    ...
    return resp?.body;   // PDF bytes
};

export const getHTML = async (documentData, documentId, ctx): Promise<string | undefined> => {
    // POST .../{documentId}   → returns resp.text (HTML)
};
```

The service base URL / paths — `platform-model/src/services/documents/documents.controller.ts`:

```32:36:platform-model/src/services/documents/documents.controller.ts
    public static readonly documentServiceBaseEndpoint =
        process.env.DOCUMENT_SERVICE_URL ??
        process.env.DOCS_LISTEN_ADDRESS ??
        'http://document-generator:8080';
    public static readonly documentServiceGenerateEndpoint = '/api/v1/docs/platform';
```

**Correction / clarification vs. shared context:** the Handlebars-compile + headless-Chrome-PDF step is **NOT in `platform-components`** — it lives in the external `document-generator` service. This repo only builds the JSON `{ templateData, context, options }` payload and POSTs it; it receives back HTML (`getHTML`, `/{id}`), an HTML preview (`getHTMLPreview`, `/{id}/preview`), or PDF bytes (`getPDF`, `/{id}/pdf`). So "server-side PDF bytes" is correct, but the server is a *separate microservice*, and platform-model is a pass-through client.

Two-pass code-component flow (barcodes/QR) — `getPDFWithCodeReplacement`:

```189:203:platform-model/src/runtime/documents/document.ts
export async function getPDFWithCodeReplacement(
    documentData: Record<string, unknown>,
    documentId: string,
    ctx: InvocationContext
): Promise<Buffer | undefined> {
    if (!templateHasCodeComponents(documentData)) {
        return await getPDF(documentData, documentId, ctx);
    }
    const html = await getHTML(documentData, documentId, ctx);
    if (!html) return undefined;
    const processedHtml = await replaceCodeComponents(html);
    return await getPDF({ ...documentData, templateData: processedHtml }, documentId, ctx);
}
```

When a template contains `<img data-code-type="...">`, it renders HTML first, swaps in generated barcode/QR images (`replaceCodeComponents`), then re-renders to PDF — i.e. the template can be **HTML with embedded code directives**, another Handlebars/HTML-string assumption.

### 2.3 Generation TRIGGERS

- **Editor preview (manual, interactive):** `documentTemplate/previewPdf/1.0` (PDF base64) and `documentGeneration/getBOLPreview/1.0` (HTML). See §2.4 and P1.
- **On-demand download/view via REST controller** (`DocumentsController`): a large surface of `GET` endpoints — `order/:id/bol[/pdf]`, `invoice/:id/[html|pdf]`, `bill/:id/[html|pdf]`, `manifest/:id/rate_con[/pdf|/json]`, `shipment/:id/bol/pdf`, `quote/:id/[html|pdf]`, `payStub/:id/[html|pdf]`, `:id/[html|pdf]` (generic by document id), `presignedUrl/:id` (redirect). Each ensures viewer permission then calls a recipe `documentGeneration` action via `callRecipeAction`.
- **Programmatic / around-composition actions** (not REST-callable): `getBOL`, `downloadBOL`, `getSignedBOLPDF`, `getRateConfirmation`, `downloadInvoice`, etc. — see `recipes/base/actions/documentGeneration.ts` and the TMS mixin `recipes/moduleDocumentBuilderTms/actions/mixins/documentGeneration-DocumentBuilderTier1.ts`.
- **Generic eager render + attach** (system, layer-clean): `system` recipe `DocumentRenderActions.render` (see §3.2) renders a configured type to PDF and attaches it — used for org-authored/custom types.
- **Auto-creation:** `RDocumentTypeConfig.isAutoCreated` — "a document of this type will be attached to all new records with the same objectKey." (declarative trigger tied to record creation).
- **Defaults:** per-type org default template via `DocumentTemplateConfig` (§1.3); in-code base template fallback via `findBaseTemplateData`.

### 2.4 The two preview server actions (editor)

`recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts` — `previewPdf` (viewer-gated), reuses the exact generation pipeline:

```246:275:recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts
    async previewPdf(
        params: z.infer<typeof PreviewPdfParams>,
        ctx: InvocationContext
    ): Promise<{ pdfBase64: string }> {
        const { recordId, templateData, documentType, showPageNumbers } = params;
        const documentData = await getDocumentDataAndContext({
            systemDocParentId: recordId,
            documentType,
            templateData,
            ...(showPageNumbers !== undefined && { showPageNumbersOverride: showPageNumbers }),
            ctx,
        });
        const pdf = await getPDFWithCodeReplacement(documentData, 'generate-document', ctx);
        if (!pdf?.length) {
            throw new BadRequestException('Failed to generate PDF preview');
        }
        return { pdfBase64: pdf.toString('base64') };
    }
```

`getBOLPreview` (admin-gated) in the TMS mixin returns sanitized HTML via `getHTMLPreview`:

```23:50:recipes/moduleDocumentBuilderTms/actions/mixins/documentGeneration-DocumentBuilderTier1.ts
    public async getBOLPreview(
        params: { recordId: string; rootObjectKey?: string; templateData: string; documentType: string; },
        ctx: InvocationContext
    ): Promise<{ html: string }> {
        const { templateData, documentType, recordId } = params;
        const documentData = await getDocumentDataAndContext({ systemDocParentId: recordId, documentType, templateData, ctx });
        const resp = await getHTMLPreview(documentData, 'generate-document', ctx);
        const html = typeof resp?.html === 'string' ? resp.html.trim() : '';
        if (!html) { throw new Error('Failed to generate HTML document'); }
        return { html: await replaceCodeComponents(html) };
    }
```

`readTemplate` (editor load) also resolves an in-code base template when the record has no `templateData` and picks the latest real record for preview:

```161:244:recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts
    async readTemplate(params, ctx): Promise<{ ...; templateData?: string; latestRecordId?: string; recentRecords: {...}[] }> {
        const template = await DocumentTemplate.$byIdOrThrow<DocumentTemplate>({ id: recordId }, ctx);
        const documentTypeConfig = (await ctx.recipe).documentTypes.find(template.documentType);
        let templateData = template.templateData;
        if (!templateData && documentTypeConfig) {
            templateData = await findBaseTemplateData({ documentTypeConfig, ctx });
        }
        ...
        // fetch 10 latest records of documentTypeConfig.objectKey → recentRecords / latestRecordId
    }
```

---

## 3. What happens to a generated document (attach / store / email / combine / lifecycle)

### 3.1 The `document` object + storage

- Generated PDFs are stored as **system `file` records** via `saveSystemGeneratedDoc` (`documentRender.helpers.ts`), which wraps `saveFile({ recipeKey: 'system', folder: 'generated-docs', mimeType: 'application/pdf', body })`. A `base`-recipe variant exists too (`recipes/base/actions/documentGeneration.ts` `saveSystemGeneratedDoc`, folder `generated-docs`, `recipeKey: 'base'`).
- A `document` record captures `documentType`, `fileName`, `mimeType`, `file`, `systemDocParentId`, `isSystemGenerated`, `isDeletable`, and optionally a legacy `url`/`externalUrl`.
- Download/view resolves a presigned S3 URL — `getPresignedUrl` (`documentRender.helpers.ts` 42–69), with legacy-URL and `externalUrl` fallbacks and public-link token-swap (`tryGetRR1SDKWithTokenSwap`).

### 3.2 Attach-to-record (the generic, layer-clean flow)

`platform-model/src/runtime/config/recipes/system/actions/documentRender.ts` — `DocumentRenderActions.render`: renders → stores file → creates `document` on the parent's `documents[]` connection:

```131:179:platform-model/src/runtime/config/recipes/system/actions/documentRender.ts
        const body = {
            templateData,
            context: {
                org: { orgId: ctx.orgId, name: org?.name, logoUrl: org?.logo_url },
                record: serialize(record),
                document: { currentDate: new Date().toISOString() },
            },
            ...(showPageNumbers ? { options: { showPageNumbers } } : {}),
        };
        const pdf = await getPDFWithCodeReplacement(body, 'generate-document', ctx);
        if (!pdf) { throw new BadRequestException(`Failed to render document for type: ${documentTypeKey}`); }
        const fileName = `${label}.pdf`;
        const file = await saveSystemGeneratedDoc({ fileName, body: pdf }, ctx);
        const document = await Document.$new<Document>({
            isSystemGenerated: true, isDeletable: true, fileName,
            documentType: documentTypeKey, file, mimeType: 'application/pdf',
            systemDocParentId: recordId,
        }, ctx);
        if (!record.$getValue(documentsField)) { record.$setValue(documentsField, []); }
        (record.$getValue(documentsField) as Document[]).push(document);
        await ctx.commit();
        return document;
```

Notable:
- Attachment field defaults to `documents` but is configurable (`fieldName`, e.g. `attachments` for custom objects).
- This generic path **rejects types that ship a built-in template** (`cfg.hasSystemTemplate`) — those need the rich TMS context assembled in base and must go through `documentGeneration`. So there are **two rendering worlds**: (a) generic system render for org-authored/custom templates with a thin `{record, org, currentDate}` context, and (b) the base TMS generator with rich per-type context (line items, remitTo, signatures, terms). Templara must decide which world(s) it plugs into.

### 3.3 Combining / merging documents

`recipes/base/actions/documentGeneration.ts` — `mergeToPDF` / `mergeFileBuffersToPDF` combine images (jpeg/png) and PDFs into one using `pdf-lib`, then save via `saveSystemGeneratedDoc`:

```772:815:recipes/base/actions/documentGeneration.ts
export async function mergeToPDF(params: MergePDFParams, ctx: InvocationContext): Promise<File> {
    const { files, destination } = params;
    const { docType, pdf } = destination;
    let combinedPDFBuffer: Buffer;
    ...
    if (!pdf) {
        const targetPDF = await PDFDocument.create();
        const consolidatedPDF = await appendFilesToPDFDocument(files, targetPDF);
        combinedPDFBuffer = Buffer.from(await consolidatedPDF.save());
    } else {
        const sourcePdfBuffer = await buffer(await getFileStream(pdf));
        const targetPDF = await PDFDocument.load(sourcePdfBuffer);
        const consolidatedPDF = await appendFilesToPDFDocument(files, targetPDF);
        combinedPDFBuffer = Buffer.from(await consolidatedPDF.save());
    }
    const combinedFile = await saveSystemGeneratedDoc({ getPDFBuffer: async () => combinedPDFBuffer, uploadData: … }, ctx);
    return combinedFile;
}
```

Merge assumes **PDF/image bytes** (embedJpg/embedPng/copyPages). A React/HTML-rendered engine must still produce PDF bytes to participate in merging. Page sizing uses `LETTER_PAGE_WIDTH/HEIGHT` from `system/helpers/pdf`.

### 3.4 Email / public link / lifecycle

- **Signed documents:** `getSignedBOLPDF` / `getSignedRateConfirmationPDF` inject signature URLs + timestamps into `document.signatures` context then render (base + TMS mixin). Signatures are formatted in `formatSignatures` (`documentContext.helpers.ts`).
- **Public link / anonymous access:** controller endpoints accept `?subscriptionToken=` and use `permissionsService.createInvocationContextForSession(... publicLinkImpersonationSecret ...)` + `AccessType.publicLink` token swap (`tryGetRR1SDKWithTokenSwap`). So documents are viewable/emailable via subscription/public links.
- **Emailing** itself is orchestrated elsewhere (notifications/email services and workflows consume these PDF buffers / presigned URLs); the document layer's contract to email is "produce a `file`/`document` (+ presigned URL) or a `Buffer`".
- **Lifecycle flags** on `document`: `isSystemGenerated`, `isDeletable`, plus legacy `url` vs `file` vs `externalUrl` provenance.

---

## 4. Data-flow diagram (generate → store → attach → deliver)

```
 Trigger (REST GET / recipe action / render action / auto-create)
        │
        ▼
 getDocumentDataAndContext({ systemDocParentId, documentType, templateData?, ctx })
        │  • resolve template: override → org default (DocumentTemplateConfig)
        │                      → in-code base .handlebars (findBaseTemplateData)
        │  • normalizeParentId hook
        │  • extractTemplatePaths(templateData) ── lazy/path-driven ──┐
        │  • load record with ONLY those paths                        │
        │  • buildRecordContext → money/dates pre-formatted STRINGS   │
        │  • org context (logo/addresses/terms) + document context    │
        ▼                                                             │
 { templateData(Handlebars, cleaned), context:{org,record,document}, options }
        │  POST JSON  (Bearer token)
        ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  EXTERNAL document-generator microservice  (NOT in this repo)     │
 │  http://document-generator:8080/api/v1/docs/platform/{id}[/pdf]   │
 │  Handlebars compile → HTML → headless-Chrome print → PDF bytes    │
 └─────────────────────────────────────────────────────────────────┘
        │ HTML (getHTML/getHTMLPreview)   │ PDF Buffer (getPDF)
        ▼                                 ▼
  (code components? replaceCodeComponents → re-render)   getPDFWithCodeReplacement
        │                                 │
        ▼                                 ▼
  return HTML (preview/view)      saveSystemGeneratedDoc → file (S3, mime application/pdf)
                                          │
                                          ▼
                                 Document.$new({ file, documentType, systemDocParentId,… })
                                          │  push onto record.documents[]  → ctx.commit()
                                          ▼
                        deliver: presigned URL redirect / public link / merge (pdf-lib) / email
```

---

## 5. CHECKLIST — "Handlebars string / PDF-bytes" assumptions a new engine must satisfy

A JSON/React-rendered Templara must satisfy or explicitly replace each of these seams:

**Template-is-a-Handlebars-string assumptions**
- [ ] `DocumentTemplate.templateData` is a single `@RText` string; editor save/load treat it as text (P1). JSON must fit here (or add a new field + bump `dataFormatVersion`, which already exists defaulting to `'1'`).
- [ ] `extractTemplatePaths(templateData)` regex-parses `{{...}}` tokens to decide what record data to load (`documentContext.helpers.ts`). Path-driven lazy loading depends on parsing the template. A JSON engine needs an equivalent "which fields does this doc reference?" extractor, or it must accept over/under-fetching.
- [ ] `getDocumentDataAndContext` performs **regex surgery** on the template string: strips `###sortBy:` loop-sort encoding and upgrades `terms_conditions` to triple-stash. These operations assume Handlebars text.
- [ ] `extractLoopSortConfigs(templateData)` reads loop-sort directives out of the template string.
- [ ] Field picker inserts **Handlebars path tokens** (`{{customer.name}}`, `{{this.x}}` in loops) built from `connectionKey` traversal (P1 §3). Loops/conditionals authored via `ControlFlowPlugin` (`{{#each}}`,`{{#if}}`).
- [ ] `replaceCodeComponents` scans rendered **HTML** for `<img data-code-type>` to inject barcodes/QR — assumes an HTML render stage.
- [ ] Money/date/select/status/measurement values are pre-formatted into **strings at suffix leaves** (`withCurrencyCode`, `dateTimeInLocation.shortDate`, etc.). A JSON engine that wants raw values + client-side formatting diverges from this contract and must supply its own formatting.
- [ ] Field-view permission enforcement (`enforceFieldView` → `getViewDeniedPaths`) is keyed by field-path form derived from template paths (`templatePathToFieldPath`).

**Generation-produces-PDF-bytes-server-side assumptions**
- [ ] Generation is a **synchronous HTTP POST** to an external `document-generator` service returning HTML or a PDF `Buffer` (`getPDF`/`getHTML`/`getHTMLPreview`). Payload contract is `{ templateData, context, options }` (+ ad-hoc `objectKey` for legacy BOL/invoice/rate-con paths). A React-rendered engine must either (a) render to the same HTML the doc service expects, or (b) provide its own PDF-bytes producer that slots into every consumer below.
- [ ] REST controller returns `StreamableFile(pdf)` / `text/html` directly to the browser (`DocumentsController`); it assumes bytes/HTML in hand.
- [ ] `previewPdf` returns `pdf.toString('base64')`; the code-mode editor renders base64 PDF (P1).
- [ ] `mergeToPDF` / `mergeFileBuffersToPDF` (pdf-lib) require **PDF/image bytes** to combine documents.
- [ ] Storage (`saveSystemGeneratedDoc`) stores a `Buffer` with `mimeType: 'application/pdf'`; `document.mimeType` and downstream presigned-URL delivery assume a stored PDF file.
- [ ] Signature injection (`getSignedBOLPDF`, `getSignedRateConfirmationPDF`) mutates the `document` context then renders to PDF bytes.
- [ ] Two rendering worlds exist: generic system `render` (thin context, rejects `hasSystemTemplate` types) vs base TMS `documentGeneration` (rich per-type context). Templara must state which it serves; built-in `.handlebars` types cannot be rendered by the generic path.

---

## 6. Contradictions / corrections vs. shared context

1. **"The `document-generator` service compiles Handlebars… then prints to PDF via headless Chrome."** Correct in behavior, but that service is **external to `platform-components`**. In this repo, `platform-model` is only an HTTP client (`document.ts`) that POSTs `{ templateData, context, options }` to `http://document-generator:8080/api/v1/docs/platform/...` and receives HTML or PDF bytes. No Handlebars compile or Chrome print happens in-repo.
2. **Context `{ org, record: serialize(record), document }`** — confirmed shape, but `record` is **not** a blanket `serialize(record)` in the main pipeline. `getRecordContextForDocument` builds it **path-by-path** from template tokens (`buildRecordContext`). The literal `serialize(record)` form is only used in the *generic* system `render` action and some legacy base assemblers (bill/rate-con), which pre-serialize bespoke shapes.
3. **Lazy/path-driven + pre-formatted money/date leaves** — both **confirmed** verbatim (`extractTemplatePaths`, `applyRecordValue`).
4. **Template is a Handlebars string on `DocumentTemplate.templateData`** — confirmed. Note the existing hidden `dataFormatVersion` field (default `'1'`) is the intended versioning seam for a new format.

---

## 7. File index (P7)

| Concern | Path |
|---|---|
| Doc-type config type | `platform-model/interpreter/src/config.types/rdocumentType.type.ts` |
| Base doc-type catalog | `recipes/base/documentTypes/baseDocumentTypes.ts` |
| Template RObject | `platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts` |
| Context/payload assembler | `platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts` |
| Record context (lazy, formatting) | `platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts` |
| Context types (ContextKeys/options) | `platform-model/src/runtime/config/recipes/system/helpers/documentContext.types.ts` |
| Doc-service HTTP client | `platform-model/src/runtime/documents/document.ts` |
| REST controller (view/download/customType) | `platform-model/src/services/documents/documents.controller.ts` |
| Base generation actions + merge | `recipes/base/actions/documentGeneration.ts` |
| TMS generation mixin + preview HTML | `recipes/moduleDocumentBuilderTms/actions/mixins/documentGeneration-DocumentBuilderTier1.ts` |
| Template editor actions (read/preview/default) | `recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts` |
| Generic render+attach action | `platform-model/src/runtime/config/recipes/system/actions/documentRender.ts` |
| Storage/presign helpers | `platform-model/src/runtime/config/recipes/system/helpers/documentRender.helpers.ts` |
