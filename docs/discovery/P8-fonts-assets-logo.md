# P8 — Fonts, assets & logo pipeline (PDF fidelity)

> **Evidence boundary (read first).** The step that actually rasterizes fonts and
> images into the PDF is **headless Chrome inside the `document-generator` service**,
> whose source is **NOT present locally** (separate repo, consumed as an image — see
> P2 §0). So the *authoritative* answers to “which font families are embedded” and
> “how does Chrome wait for assets before printing” live in that repo. This report
> nails down everything the **caller/platform** side controls — how the logo and
> images are *handed to* the service — and flags the service-internal gaps.

---

## 1. Fonts

### 1.1 What the print (Chrome) path uses — NOT LOCALLY DETERMINABLE

The Chrome print HTML’s font families, any `@font-face`/Google-Fonts `<link>`, and
bundled `.woff`/`.ttf` files are all inside the `document-generator` image. There is
**no** `@font-face`, no `fonts.googleapis.com`, and no font-loading reference in
`platform-components` on the generation path. Org templates authored in the editor
carry inline CSS `font-family` declarations, but the *resolution* of those families
to actual glyphs happens in the service’s Chromium. ⇒ **Follow-up required in
`document-generator`.**

Open questions to answer there:
- Which families ship in the container (system fonts vs bundled webfonts)?
- Are Google Fonts fetched at print time (network dependency + latency risk), or
  bundled/self-hosted?
- What is the fallback family when a template requests an unavailable font?

### 1.2 The ONE font that IS in this repo — and why it’s a red herring for Chrome

`NotoSans-Regular.ttf` is bundled, but it belongs to the **platform-side `pdf-lib`
text/merge path**, not the Chrome print path:

```148:162:platform-model/src/runtime/config/recipes/system/helpers/pdf.ts
    let font: PDFFont;
    try {
        // Register fontkit for custom font support
        pdfDoc.registerFontkit(fontkit);

        // Load Noto Sans font for Unicode support
        const notoFontPath = join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
        const notoFontBytes = await readFile(notoFontPath);
        font = await pdfDoc.embedFont(notoFontBytes);
    } catch (error) {
        ctx.logger.warn('Failed to load / embed Noto Sans font, falling back to standard font:', {
            error,
        });
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
```
On-disk locations:
`platform-model/src/runtime/config/recipes/system/assets/fonts/NotoSans-Regular.ttf`
(+ its `dist/` copy under base). This is used by `renderTextToPDFPages` (drawing raw
text pages with `pdf-lib`) and the attachment-merge routines — i.e. **post-processing
of already-generated PDFs**, never for template rendering. Do not conflate this with
the document’s visual typography.

---

## 2. Org logo & images

### 2.1 The org logo is passed as a URL, not bytes

`context.org.logoUrl` = the org’s `logo_url` straight from Classic:

```88:98:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
    return {
        orgId: ctx.orgId,
        logoUrl: org?.logo_url,
        orgAddress,
        remitToAddress,
        orgPhone: org?.phone,
        orgEmail: org?.email,
        ...
        documentTerms,
    };
```
Same in the generic render path:
```134:140:platform-model/src/runtime/config/recipes/system/actions/documentRender.ts
                org: {
                    orgId: ctx.orgId,
                    name: org?.name,
                    logoUrl: org?.logo_url,
                },
```
And in the legacy assembled payloads the logo is likewise a URL:
`orgLogoUrl: org.logo_url` (`recipes/base/helpers/documentGenerator.helpers.ts:113`),
`logoUrl: org?.logo_url` in the BOL payload (`…:520`).

⇒ The template references `{{org.logoUrl}}` and Chrome fetches that URL at print
time. **Auth/reachability of that URL from inside the service is service-internal /
NOT locally determinable** (is it a public CDN URL or a signed/S3 URL that needs a
token from within the container?). This is a concrete fidelity risk to verify in the
`document-generator` repo.

### 2.2 Record-attached files → presigned URLs

For file-typed record fields, the context builder resolves a **download URL** (not
bytes):
```345:349:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
        if (value.$config.key === 'file' && newPath === 'url') {
            data[fieldKey] = {
                ...(data[fieldKey] || {}),
                url: await getFileDownloadURL(value as unknown as File),
            };
```
Signatures likewise carry a `url` (`{ url, signedAt, signedBy }`,
`documentContext.types.ts:16`). So images generally reach the service as **URLs**,
and Chrome is responsible for fetching them.

### 2.3 Barcodes/QR are the exception → base64 data URIs

Barcode/QR images are **not** URLs. They’re generated platform-side and inlined as
base64 PNG data URIs *before* the final print, so Chrome never fetches them:

```99:105:platform-model/src/services/codeGeneration/replaceCodeComponents.ts
            const { base64 } = await generateCode({
                value: codeValue,
                type: codeType as CodeType,
            });
            const dataUri = `data:image/png;base64,${base64}`;
            result = result.replace(fullTag, injectSrc(fullTag, dataUri));
```
Failure/empty cases inline an SVG placeholder data URI instead
(`makeErrorPlaceholder`). This two-pass flow (`getPDFWithCodeReplacement`) exists
precisely so barcodes print reliably without a network round-trip. **Templara should
reuse this exact pattern** for any generated imagery.

### 2.4 Attachment images (merge path, not template path)

When merging uploaded images/PDFs into a generated PDF, `pdf-lib` embeds
JPEG/PNG bytes directly and scales to Letter
(`appendFileBuffersToPDFDocument` / `calculateScalingFactor`,
`platform-model/.../system/helpers/pdf.ts`). This is a separate, platform-side
concern from template image rendering.

---

## 3. Asset-timing (waiting for fonts/images before printing)

**NOT LOCALLY DETERMINABLE.** Whether the service waits for `document.fonts.ready`,
`networkidle0`, image `onload`, or a fixed delay before `page.pdf()` is entirely
inside `document-generator`. This is the highest-risk fidelity variable for Templara
(a React renderer will paint asynchronously) and **must** be characterized in that
repo.

What the platform does to *reduce* timing risk on its side:
- Inlines barcodes/QR as base64 (no fetch) — §2.3.
- Pre-resolves file fields to concrete download URLs (§2.2) rather than deferring
  resolution to the template.
- Everything else (logo URL, template webfonts) is fetched **by Chrome at print
  time**, so the service’s wait strategy is what guarantees they’re present.

---

## 4. Summary table

| Asset | How it reaches the service | Who fetches/embeds | Local evidence |
|---|---|---|---|
| Org logo | `context.org.logoUrl` (URL) | Chrome, at print time | `documentContext.helpers.ts:90`, `documentRender.ts:137` |
| Record file images | presigned `url` via `getFileDownloadURL` | Chrome, at print time | `documentContext.helpers.ts:345-349` |
| Signatures | `{ url, signedAt, signedBy }` (URL) | Chrome, at print time | `documentContext.types.ts:16` |
| Barcodes / QR | inlined **base64 PNG** data URI | platform (pre-print), no fetch | `replaceCodeComponents.ts:99-105` |
| Merge attachments | raw bytes via `pdf-lib` | platform (post-print) | `system/helpers/pdf.ts` |
| Template fonts | inline `font-family` CSS in `templateData` | Chrome (families resolved in-image) | NOT LOCAL |
| Print fonts bundle | — | service image | NOT LOCAL |

## 5. Explicit gaps for the `document-generator` follow-up run

1. Font families available in the container; Google-Fonts usage; fallback behavior.
2. Whether `org.logoUrl` / presigned file URLs are reachable+authorized from inside
   the service’s network (isolation risk).
3. The pre-print asset-wait strategy (`fonts.ready`? `networkidle0`? timeout?).
