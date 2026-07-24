# Host runbook — copy/paste into platform-components / document-generator

Templara package seams for Waves 1–7 are on `main`. Everything below runs **in the host repos**, not in Templara. Companion: [host-integration-guide.md](host-integration-guide.md).

---

## A3 — Live record preview (platform-components embed)

```text
Wire DocumentEditor so Preview uses a real record, not Studio sample JSON.

1. Load up to N recent records for the template's objectKey (same pattern as DB1 preview cycling).
2. Build context with existing path-driven buildRecordContext after:
     import { extractBindings, toRecordContextPaths, preparePreviewData } from ...
     // extractBindings from @templara/core; preparePreviewData from @templara/editor
     const paths = toRecordContextPaths(extractBindings(template));
     const context = await buildRecordContext(record, paths, ...);
     const data = preparePreviewData(context); // aliases org postal ↔ postalCode
3. Pass data={data} to DocumentEditor; onDataChange optional.
4. Acceptance: open invoice template, pick a real invoice, bound fields show live values (IDs resolve).
```

---

## D1 — Doc-type registry

```text
Register a Templara document type via RDocumentTypeConfig keyed by objectKey.

Use TemplaraDocumentTypeDescriptor from @templara/core as the shape:
  { objectKey, label, templateId, renderMode: "ssr-html" }

Pipeline: extractBindings → buildRecordContext → renderTemplateToHtml → existing generate-document PDF.
Prove attach / email / export receive PDF bytes like DB1 types.
Do not invent a parallel registry inside @templara/*.
```

---

## B2 — generate-document POST

```text
After SSR:
  import { renderTemplateToHtml } from "@templara/react-renderer/ssr";
  const html = await renderTemplateToHtml(template, preparePreviewData(context));
POST to existing generate-document / document-generator routes with the same auth + options
(showPageNumbers, Letter) as DB1 HTML templates.
Do not add generate endpoints inside Templara packages.
```

---

## H1 — document-generator discovery

Run the prompt pack in the document-generator repo (or image source if available):

→ [../discovery/document-generator-prompts.md](../discovery/document-generator-prompts.md)

Capture: print CSS, fonts, asset-wait / render-complete, CSP. Results unblock PDF fidelity claims for A′-lite.
