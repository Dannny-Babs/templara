# P2 — `document-generator` template → PDF pipeline

> **Scope of evidence.** This report is written from inside `platform-components`
> (the *caller* side) plus the `roserocket` Classic sibling. The
> `document-generator` **service source is NOT present anywhere on disk** — it
> lives in a separate repo (`RoseRocket/document-generator`) and is consumed only
> as a pre-built container image. Everything about the *inside* of the service
> (Handlebars registry, Puppeteer/Chromium config, print CSS, fonts) is therefore
> **NOT locally determinable** and is flagged explicitly. Everything about the
> *contract* (routes, payload, response, auth, concurrency env) is fully evidenced
> below.

Verification of absence:

- `docker-compose.yaml` runs it purely as an image, no `build:` context:
  ```406:436:docker-compose.yaml
  # Platform: Document Generator (repository: RoseRocket/document-generator)
  document-generator:
    image: ${AWS_ECR_ACCOUNT_URL}/document-generator:${DOCUMENT_GENERATOR_IMAGE_TAG:-latest}
    ...
    environment:
      MAX_TASK_CONCURRENCY: 2
      NODE_ENV: production
      PORT: 8080
    ports:
      - 8070:8080
  ```
- `find`/`rg` across all `RoseRocket/*` siblings returns **no** `document-generator`
  source dir and **no** `registerHelper`/`registerPartial`/`puppeteer.` usage
  outside `platform-components` codegen (unrelated).

---

## 0. TL;DR corrections to the shared understanding

| Shared assumption | Verdict | Evidence |
|---|---|---|
| Template is a Handlebars string on `DocumentTemplate.templateData` | ✅ Confirmed | `documentContext.helpers.ts` extracts paths from `templateData`; editor saves HTML/Handlebars string |
| Generator compiles Handlebars + JSON context → HTML → PDF via headless Chrome | ⚠️ **Partially confirmed / not locally verifiable.** Caller sends Handlebars + context and gets HTML/PDF back, so *something* compiles + prints. The Chrome/Puppeteer step is asserted by the container’s job but **its code is not in these repos**. | `document.ts` client; container image only |
| Context ≈ `{ org, record: serialize(record), document }` | ✅ Confirmed exactly | `document.helpers.ts` builds `{ [org], [record], [document] }` via `ContextKeys` |
| Context is lazy / path-driven off `{{...}}` | ✅ Confirmed | `extractTemplatePaths(templateData)` → only referenced paths are loaded |
| Money/dates pre-formatted strings at suffix leaves | ✅ Confirmed | `applyRecordValue` formats `$x.xx`, `withCurrencyCode`, `shortDate`, etc. server-side |
| Editor is external Bit pkg `@roserocket/components.document-template-editor` | ✅ Confirmed, **v4.6.4** | `ui/package.json`, `recipes/package.json`, `yarn.lock` |

One material nuance the shared model misses: there are **two calling styles** into
the generator (see §1.3): a **legacy fixed-template** style (`documentId = 'bol' |
'invoice' | 'bill' | 'rate_confirmation' | 'pay_stub'`) where the *generator owns
the template*, and the **unified `generate-document`** style where the caller
*ships the `templateData` Handlebars string in the payload*. Templara only needs to
care about the second; all modern paths (`getDocumentDataAndContext`) use
`'generate-document'`.

---

## 1. HTTP entrypoint(s) — the caller→generator contract

### 1.1 Base URL + path (verbatim)

```32:36:platform-model/src/services/documents/documents.controller.ts
    public static readonly documentServiceBaseEndpoint =
        process.env.DOCUMENT_SERVICE_URL ??
        process.env.DOCS_LISTEN_ADDRESS ??
        'http://document-generator:8080';
    public static readonly documentServiceGenerateEndpoint = '/api/v1/docs/platform';
```

So the base is `http://document-generator:8080` (in-cluster; host port `8070`), and
all platform generation calls hang off `POST /api/v1/docs/platform/...`.

### 1.2 The three client calls (verbatim)

All live in `platform-model/src/runtime/documents/document.ts` and use `superagent`
with a `Bearer` token.

**PDF** — `POST {base}/api/v1/docs/platform/{documentId}/pdf`, `Accept: application/pdf`, returns **PDF bytes** (`resp.body: Buffer`):

```102:126:platform-model/src/runtime/documents/document.ts
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
    return resp?.body;
};
```

**HTML** — `POST {base}/api/v1/docs/platform/{documentId}`, `Accept: application/json`, returns **HTML text** (`resp.text: string`):

```128:152:platform-model/src/runtime/documents/document.ts
export const getHTML = async (
    documentData: object,
    documentId: string,
    ctx: InvocationContext
): Promise<string | undefined> => {
    const [resp, error] = await of(
        superagent
            .post(
                `${DocumentsController.documentServiceBaseEndpoint}${DocumentsController.documentServiceGenerateEndpoint}/${documentId}`
            )
            .set({
                Accept: 'application/json',
                'Content-Type': 'application/json',
                [authHeader]: `Bearer ${ctx.token}`,
            })
            .send(documentData)
    );
    ...
    return resp?.text;
};
```

**HTML preview** — `POST {base}/api/v1/docs/platform/{documentId}/preview`, returns JSON `{ html }` (`resp.body`):

```154:178:platform-model/src/runtime/documents/document.ts
export const getHTMLPreview = async (
    documentData: object,
    documentId: string,
    ctx: InvocationContext
): Promise<{ html?: string }> => {
    const [resp, error] = await of(
        superagent
            .post(
                `${DocumentsController.documentServiceBaseEndpoint}${DocumentsController.documentServiceGenerateEndpoint}/${documentId}/preview`
            )
            ...
    );
    ...
    return resp?.body;
};
```

### 1.3 What the caller SENDS (request body shape)

`documentId` is a **template selector**, not a record id. Two families:

**(A) Unified `generate-document`** — caller ships the Handlebars string:
```131:146:platform-model/src/runtime/config/recipes/system/actions/documentRender.ts
        const body = {
            templateData,
            context: {
                org: {
                    orgId: ctx.orgId,
                    name: org?.name,
                    logoUrl: org?.logo_url,
                },
                record: serialize(record),
                document: { currentDate: new Date().toISOString() },
            },
            ...(showPageNumbers ? { options: { showPageNumbers } } : {}),
        };
        const pdf = await getPDFWithCodeReplacement(body, 'generate-document', ctx);
```
The richer builder (`getDocumentDataAndContext`) returns the same shape with a fully
formatted context and the sort-encoding stripped:
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
    ...
    return { templateData: cleanedTemplateData, context, ...(options && { options }) };
```
Canonical unified request body:
```jsonc
{
  "templateData": "<Handlebars/HTML string>",
  "context": {
    "org":    { "orgId", "logoUrl", "orgAddress", "remitToAddress", "orgPhone", "orgEmail", "documentTerms", ... },
    "record": { /* lazily-built, path-shaped, pre-formatted subset of the root record */ },
    "document": { "currentDate": { ...date formats }, "signatures": { "<key>": { "url", "signedAt", "signedBy" } } }
  },
  "options": { "showPageNumbers": true }   // optional
}
```

**(B) Legacy fixed-template** — caller ships assembled fields + `objectKey`, generator owns the `.hbs`:
```290:293:recipes/base/actions/documentGeneration.ts
        const resp = await getPDF({ ...bol, objectKey: 'platformBOL' }, DocumentIds.bol, ctx);
        return resp;
```
```14:20:platform-model/src/runtime/documents/document.ts
export enum DocumentIds {
    rateConfirmation = 'rate_confirmation',
    bol = 'bol',
    invoice = 'invoice',
    payStub = 'pay_stub',
    bill = 'bill',
}
```
> Note (modern override): `moduleDocumentBuilderTms` re-routes even BOL/invoice/
> rate-con through the unified `'generate-document'` path with a full
> `templateData` (`documentGeneration-DocumentBuilderTier1.ts`), so style (B) is the
> legacy/fallback and style (A) is the go-forward. **Templara should target (A).**

### 1.4 What comes BACK

- `/pdf` → raw **PDF bytes** (`Buffer`), streamed to the browser as
  `application/pdf` `StreamableFile` by the controller.
- `/{id}` → **HTML string**.
- `/{id}/preview` → **`{ html }`** JSON (used by the editor’s live preview).
- No URL/base64 is returned by the service; base64 only appears when
  `previewPdf` re-encodes the returned buffer for the editor
  (`pdf.toString('base64')`, `moduleDocumentBuilderTier1/actions/documentTemplate.ts:274`).

### 1.5 Auth

`Authorization: Bearer ${ctx.token}` on every call (the platform session token is
forwarded). The service is only reachable on the internal `rr_shared_network`; the
public surface is the NestJS `DocumentsController` (`@Controller(['documents',
'api/v2/platformModel/documents'])`) which enforces `ensureViewer(...)` +
`validateDocumentAccess(...)` before ever calling the generator.

### 1.6 Public entrypoints that fan into the generator

`documents.controller.ts` exposes (all `GET`, all permission-checked):
`:id/html`, `:id/pdf`, `manifest/:id/rate_con[/pdf|/json]`, `order/:id/bol[/pdf]`,
`shipment/:id/bol/pdf`, `bill/:id/[html|pdf]`, `invoice/:id/[html|pdf]`,
`payStub/:id/[html|pdf]`, `quote/:id/[html|pdf]`, `presignedUrl/:id`.
Each delegates via `callRecipeAction` to a `documentGeneration` recipe action, which
calls `getHTML`/`getPDF`/`getPDFWithCodeReplacement`.

---

## 2. Handlebars compilation

**NOT LOCALLY DETERMINABLE — lives in the `document-generator` repo.** The compile
call, `Handlebars.create()` options, `registerHelper`/`registerPartial` registry are
all inside the service image; there is **no** `registerHelper`/`registerPartial` in
`platform-components` or `roserocket`.

What *can* be evidenced from the caller side:

### 2.1 Helpers/features the templates actually USE (lower bound on the registry)

Grepping every `recipes/**/*.handlebars` (13 real templates):

```
block helpers:   171x {{#if ...}}   50x {{#each ...}}   9x {{#unless ...}}
custom inline:     4x {{inc @index}}
subexpressions:  none material (only literal text in parens)
triple-stash:    none in source templates (injected at runtime for terms_conditions)
```

So the service **must** register at minimum: Handlebars built-ins (`if`, `each`,
`unless`, `@index`, `this`) **plus a custom `inc` helper** (1-based loop numbering,
`{{inc @index}}`). The full registry is almost certainly larger but is **not
observable here** — flag for the follow-up run inside `document-generator`.

The `terms_conditions` triple-stash upgrade (`{{...}}` → `{{{...}}}`) done in
`document.helpers.ts` implies the service escapes HTML by default (standard
Handlebars) and relies on triple-stash for pre-sanitized rich text.

### 2.2 Longest / most complex real template (for fidelity testing)

Largest by bytes (all single-line editor HTML except payStub):

| Template | Bytes |
|---|---|
| `recipes/modulePayrollTier0/documentTemplates/payStub-PayStub.handlebars` | 41,969 (373 lines, most complex/multi-line) |
| `recipes/base/documentTemplates/invoice-Invoice.handlebars` | 39,655 |
| `recipes/moduleRatingTier0/documentTemplates/order-BillOfLading.handlebars` | 30,936 |
| `recipes/base/documentTemplates/task-LegBillOfLading-task.handlebars` | 28,446 |

Use **`payStub-PayStub.handlebars`** (multi-line, `{{#each}}` + `{{#if}}` +
`{{inc @index}}`, tabular line items) and **`invoice-Invoice.handlebars`** as the
canonical fidelity test inputs for Templara parity.

### 2.3 Barcode/QR two-pass (caller-side pre/post-processing)

The generator does **not** render barcodes. The platform does a two-pass dance:
Handlebars resolves first (`getHTML`), then `replaceCodeComponents` swaps
`<img data-code-type="...">` for a generated base64 PNG, then `getPDF` prints:

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
(Implementation in `platform-model/src/services/codeGeneration/replaceCodeComponents.ts` —
also note it observes “the document service strips `src` when the value is not a URL”,
a behavioral hint about the service’s HTML sanitization.)

---

## 3. Headless-Chrome / print settings

**NOT LOCALLY DETERMINABLE.** Puppeteer/Chromium launch args, `page.pdf()` options
(`format`, `margin`, `printBackground`, `preferCSSPageSize`, `scale`,
`displayHeaderFooter`, header/footer templates) all live in the service image.

Caller-side signals that constrain what the service must support:

- **`options.showPageNumbers`** is passed through in the payload (`document.helpers.ts`,
  `documentRender.ts`). Its docstring: *“When true, renders 'Page x of n' in the PDF
  footer.”* (`documentContext.types.ts:23-25`). ⇒ the service supports a
  **footer/`displayHeaderFooter`** mode toggled by this flag.
- **Page size = US Letter.** Every platform-side PDF constant is Letter
  (`LETTER_PAGE_WIDTH = 612`, `LETTER_PAGE_HEIGHT = 792` in
  `platform-model/.../system/helpers/pdf.ts`). Strongly implies the service prints
  Letter, though the actual `page.pdf({ format })` is in the service.
- Pagination/margins are described as *“including page breaks and margins”* in
  `previewPdf`’s summary — done by the service’s CSS print engine, not the caller.

> ⚠️ Everything numeric here (exact margins, scale, `preferCSSPageSize`) must be read
> from the `document-generator` repo. Do not assume.

---

## 4. CSS handling (@page, page-breaks, pagination)

**NOT LOCALLY DETERMINABLE.** The org template is authored HTML/CSS (inline styles +
whatever the editor emits) shipped as `templateData`; the *print* CSS (`@page`, page
breaks, running headers/footers, “Page x of n”) is applied inside the service by
Chrome’s print engine. No stylesheet, no `@page` rule, and no
`preferCSSPageSize` reference exists in `platform-components`. Flag for follow-up.

Caller-side truths: the template string is HTML with inline styles authored via the
Lexical-based editor; `terms_conditions` HTML is sanitized+autolinked server-side
(`sanitizeAndAutolinkHtml.helpers`) before being embedded.

---

## 5. Fonts & assets — see **P8** for detail

Summary: org logo/images are passed as **URLs** (`org.logo_url` → `context.org.logoUrl`)
or, for barcodes, **base64 data URIs**. Font families, Google-Fonts usage, and how the
service waits for asset load before printing are **service-internal / NOT locally
determinable**. The only bundled font in this repo (`NotoSans-Regular.ttf`) is used by
the **platform-side `pdf-lib`** text/merge path, *not* by the Chrome print path.

---

## 6. Error handling, timeouts, concurrency/queueing

- **Concurrency (evidenced):** `MAX_TASK_CONCURRENCY: 2` set on the service in
  `docker-compose.yaml`. ⇒ the service has an **internal task queue** capped at 2
  concurrent render tasks (per instance). This is the single most concrete
  operational fact available locally.
- **Caller error handling (evidenced):** `getPDF` throws
  `Error(Error sending data to document service PDF ...)`, `getHTML`/`getHTMLPreview`
  log + rethrow. No caller-side retry/backoff. Callers wrap with `await-of`.
- **Caller timeouts:** the `superagent` calls to the generator set **no explicit
  timeout** (unlike the AI/file fetches which use `.timeout(...)`). Any request
  timeout is the service’s own / infra default. Flag for follow-up.
- **Queueing/retry inside the service:** NOT LOCALLY DETERMINABLE.

---

## 7. Full numbered pipeline (end-to-end, evidenced portion + flagged gaps)

1. User hits a controller route (e.g. `GET /documents/:id/pdf`) →
   `DocumentsController` runs `ensureViewer` + `validateDocumentAccess`.
2. Controller calls a `documentGeneration` recipe action via `callRecipeAction`.
3. Action resolves the record + document type and calls
   `getDocumentDataAndContext({ systemDocParentId, documentType, ctx })`.
4. `extractTemplatePaths(templateData)` computes **only** the referenced record paths
   (lazy/path-driven); `getRecordContextForDocument` loads exactly those paths.
5. `buildRecordContext` pre-formats leaves: money → `"$x.xx"` /
   `withCurrencyCode`; dates → `shortDate`/`longDateTime`/ranges; selects →
   `labelId`; times → `HH:mm`.
6. `getOrgContextForDocument` adds `logoUrl`, addresses, phone/email, `documentTerms`
   (sanitized HTML).
7. `formatDocumentContext` adds `currentDate` (all formats) + formatted `signatures`.
8. Template cleaned: strip `###sortBy:` encodings, upgrade `terms_conditions` to
   triple-stash.
9. Payload `{ templateData, context, options? }` POSTed to
   `…/api/v1/docs/platform/generate-document[/pdf|/preview]` with `Bearer` token.
   *(Legacy path: assembled data + `objectKey` to `…/{bol|invoice|…}`.)*
10. **[SERVICE, not local]** compile Handlebars(`templateData`, `context`) → HTML.
11. **[SERVICE, not local]** load HTML in headless Chrome; wait for fonts/images;
    apply print CSS (`@page`, margins, page breaks); optional “Page x of n” footer.
12. **[SERVICE, not local]** `page.pdf()` → PDF bytes (Letter).
13. Response returns HTML (`/{id}`, `/preview`→`{html}`) or PDF bytes (`/{id}/pdf`).
14. If template has `data-code-type` barcodes: caller does HTML→`replaceCodeComponents`
    (base64 PNGs)→`/pdf` (two-pass).
15. Platform stores PDF via `saveSystemGeneratedDoc` (S3) and/or streams to browser;
    optional `pdf-lib` merge of attachments (`appendFileBuffersToPDFDocument`).

Steps **10–12** are the black box that requires the `document-generator` repo.

---

## 8. Deliverable answers (condensed)

- **Entrypoint contract:** `POST http://document-generator:8080/api/v1/docs/platform/{templateSelector}[/pdf|/preview]`, `Bearer` auth, JSON body `{ templateData, context:{org,record,document}, options? }`; returns PDF bytes / HTML text / `{html}`. Caller sends the **Handlebars string** (`generate-document`) or assembled fields (`bol|invoice|…`); it does **not** send a record id to the service (record is resolved platform-side first).
- **Verbatim helper list:** unavailable locally; observed minimum from templates = built-in `if`/`each`/`unless`/`@index` + custom **`inc`**. Full registry ⇒ follow-up in `document-generator`.
- **Exact Chrome print config:** unavailable locally; only `showPageNumbers` footer toggle + US-Letter sizing are inferable. ⇒ follow-up in `document-generator`.
- **Concurrency:** `MAX_TASK_CONCURRENCY=2` per service instance (evidenced).
