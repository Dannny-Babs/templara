# Host integration guide — Templara × Rose Rocket (Doc Builder 2)

**Audience:** platform-components / platform-model engineers wiring `@templara/*` into Doc Builder 2.  
**Status:** Templara Waves 1–5 shipped the package seams; **this repo cannot implement host registry or `document-generator` POSTs.** Use this checklist in the host worktrees.

Related: [D1](tickets/D1-doc-type-registry.md), [B2](tickets/B2-host-generate-document.md), [A3](tickets/A3-real-record-preview.md), [H1](tickets/H1-document-generator-discovery.md), [discovery/00-DISCOVERY-REPORT.md](../discovery/00-DISCOVERY-REPORT.md), **[host-runbook.md](host-runbook.md)** (copy/paste prompts).

---

## 1. Embed the editor

```tsx
import {
  DocumentEditor,
  preparePreviewData,
  type HostDesignTokens,
} from "@templara/editor";

<DocumentEditor
  value={template}
  data={preparePreviewData(liveContext)} // { org, record, document? }
  embedded
  hideBrand
  hostDesignTokens={zinniaTokensAsHostDesignTokens}
  onChange={setTemplate}
  onDataChange={setPreviewData}
  onSave={(template, data) => persist(template, data)}
/>
```

| Prop | Purpose |
| --- | --- |
| `embedded` / `hideBrand` | Hide Templara wordmark; inherit host font when no token font |
| `hostDesignTokens` | Map Zinnia CSS vars → `--templara-*` |
| `data` | Live preview context — **not** Studio sample JSON |
| `preparePreviewData` | Applies org `postal` ↔ `postalCode` aliases (C3) before render |

---

## 2. Binding → context (A1/A2)

```ts
import { extractBindings, toRecordContextPaths } from "@templara/core";

const paths = toRecordContextPaths(extractBindings(template));
// Feed `paths` into host `buildRecordContext` / `$byIdOrThrow({ paths })`
```

Money/date leaves stay **pre-formatted strings** — use `@templara/core` suffix helpers; do not reformat client-side by default.

---

## 3. Server PDF (A′-lite) — B1 → B2

```ts
import { renderTemplateToHtml } from "@templara/react-renderer/ssr";

const html = await renderTemplateToHtml(template, preparePreviewData(context));
// POST { templateData: html, context, options } to existing generate-document print path
```

**Blocked on H1:** print CSS, fonts, asset-wait, CSP inside `document-generator` (run [document-generator-prompts.md](../discovery/document-generator-prompts.md) in that repo).

---

## 4. Doc-type registry (D1)

Register via `RDocumentTypeConfig` keyed by `objectKey`. Template payload must fit `@RText templateData` **or** add a field + bump hidden `dataFormatVersion`. Generation must eventually return **PDF bytes** for attach/merge/sign/email.

---

## 5. Acceptance smoke (host)

- [ ] Embedded editor: no Templara logo; host font/tokens visible
- [ ] Preview with a real invoice/order record fills bound fields (IDs resolve)
- [ ] `extractBindings` → `buildRecordContext` round-trip for one invoice template
- [ ] SSR HTML POSTs through existing print path (once H1 unknowns closed)
- [ ] Doc type appears in document process for the target `objectKey`
