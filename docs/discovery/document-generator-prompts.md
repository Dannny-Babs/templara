# Discovery Prompts — `document-generator` service (Stream H)

**Status:** Prompt pack for Wave 1 / H1. Captured Jul 24, 2026.  
**Where to run:** Inside the **`RoseRocket/document-generator`** repository (or whatever checkout has the service source). Do **not** run these expecting answers from `platform-components` alone — that repo only sees the service as a container image ([P2](P2-generator-pipeline.md), [P9](P9-server-render-feasibility.md)).

**Related Templara docs:** [00-DISCOVERY-REPORT.md](00-DISCOVERY-REPORT.md) §5, [orchestration tickets H1](../orchestration/tickets/H1-document-generator-discovery.md), [discovery-prompts.md](../discovery-prompts.md) (platform-side P1–P9).

## How to use

1. Open a coding agent in the `document-generator` repo.
2. Prepend **§0 Shared context** to every prompt.
3. Run prompts **DG1–DG7** (batch or one-by-one). Each is read-only.
4. Save findings to markdown files in that repo (suggested names below), then copy scrubbed outputs back into Templara `docs/discovery/` (e.g. `DG-document-generator-print.md`).

## Discovery quality bar

- Cite **exact file paths** and paste critical code verbatim.
- Label claims **confirmed** / **inferred** / **unknown**.
- Prefer the longest real print path over toy examples.
- Name the **downstream evals** each finding enables (e.g. “golden PDF margin assertion”, “asset-wait timeout budget”).
- Do **not** change service code in this discovery pass.
- Scrub secrets, customer data, and private URLs before copying fixtures into Templara.

---

## 0. Shared context (prepend to every prompt)

```
CONTEXT — read before you start.

We are integrating a JSON/React document engine ("Templara", Doc Builder 2) with Rose Rocket's
existing PDF pipeline. Callers in platform-model POST `{ templateData, context, options }` to
something like:

  POST http://document-generator:8080/api/v1/docs/platform/{documentId}[/pdf|/preview]
  Authorization: Bearer …

From outside this repo we confirmed:
- This service compiles Handlebars (or accepts HTML for generate-document) and prints via
  headless Chrome / Puppeteer.
- Print CSS, font loading, pre-print asset-wait, CSP, and static-bundle hosting are NOT visible
  from platform-components — they are the top fidelity risks for mounting React inside Chrome
  (full A′) vs SSR-to-HTML posted to the existing print path (A′-lite).

Our current understanding to CONFIRM or CORRECT with file references:
- Routes multiplex on `{documentId}` (e.g. generate-document, bol, invoice) and `/pdf` vs `/preview`.
- Chrome print uses Letter (or similar), non-zero awareness of `@page` / preferCSSPageSize /
  printBackground / margins.
- Page numbers / footers may be injected via Puppeteer header/footer or print CSS.
- Fonts include something like Noto Sans in the product UI; print fonts may differ inside this
  container.
- Images/logos may be fetched at print time from org URLs; barcodes in DB1 are often base64.

RULES:
- Read-only. Do not change code, configs, or Docker images.
- Cite paths; paste verbatim where it matters.
- If something contradicts the understanding above, say so explicitly.
- Save full findings to a new markdown file and tell me the path.
```

---

## DG1 — HTTP surface & mode routing

```
Map the HTTP entrypoints of document-generator.

Find and document:
1. Framework (Express/Fastify/etc.), listen port, health checks.
2. Route table for `/api/v1/docs/platform/:documentId` and `/pdf` vs `/preview` (or equivalents).
3. Request body schema: templateData vs HTML, context, options (showPageNumbers, etc.).
4. Auth: how Bearer tokens are validated; what happens on missing/invalid auth.
5. Response shapes: PDF Buffer, HTML string, base64, error JSON.
6. Where a new `templara` selector or `/render-json` mode would naturally hook — if at all —
   versus reusing `generate-document` with POSTed HTML (A′-lite).

Deliverable: markdown `DG1-http-routing.md` with route table, payload types, and code excerpts.
Save it and give me the path.
```

---

## DG2 — Puppeteer / Chrome print configuration

```
Find the exact headless Chrome / Puppeteer print invocation(s).

Document:
1. How HTML is loaded: `page.setContent` vs `page.goto` vs file URL.
2. The full `page.pdf()` (or print) options object: format, margin, printBackground,
   preferCSSPageSize, scale, displayHeaderFooter, headerTemplate, footerTemplate, timeout.
3. Browser launch flags (sandbox, font render hinting, etc.).
4. Whether preview vs pdf modes share the same print options.
5. Any environment-variable overrides for print settings.

Deliverable: markdown `DG2-puppeteer-print.md` with the verbatim options block(s) and call sites.
Save it and give me the path.
```

---

## DG3 — Print CSS, `@page`, and pagination

```
Map print CSS and pagination behavior.

Find and document:
1. Where stylesheets for print live (static files, inline strings, per-documentId templates).
2. `@page` size/margin rules; page-break utilities; widows/orphans if any.
3. How `showPageNumbers` (or equivalent) is implemented (CSS counters vs Puppeteer footer).
4. Differences between Letter and any other page sizes.
5. Whether POSTed HTML for generate-document is wrapped in a shell document that injects CSS.

Deliverable: markdown `DG3-print-css.md` with file paths and the critical CSS verbatim.
Save it and give me the path.
```

---

## DG4 — Fonts

```
Document how fonts are available inside the print container.

Find and document:
1. Font packages or files baked into the Docker image / OS.
2. Any `@font-face` rules in print CSS; Google Fonts or other network font loading.
3. Default / fallback font stacks used in document HTML.
4. Whether `document.fonts.ready` (or similar) is awaited before print.
5. Implications for a React renderer that brings its own font CSS.

Deliverable: markdown `DG4-fonts.md`. Save it and give me the path.
```

---

## DG5 — Pre-print asset-wait strategy (highest priority)

```
This is the single biggest fidelity risk for async React rendering. Map exactly what the
service waits for before calling page.pdf().

Find and document:
1. Wait calls: `networkidle0` / `networkidle2`, `waitForSelector`, `waitForFunction`,
   `document.fonts.ready`, fixed timeouts, custom readiness flags.
2. Order of waits relative to setContent/goto and pdf().
3. Timeouts and failure behavior when assets hang.
4. Special handling for images, stylesheets, webfonts.
5. Whether there is an existing extension point like `window.__READY__` we could reuse for
   Templara (`window.__TEMPLARA_READY__`).

Deliverable: markdown `DG5-asset-wait.md` with a sequence diagram (text/mermaid) of
load → wait → print. Save it and give me the path.
```

---

## DG6 — CSP, static hosting, and A′ feasibility

```
Assess whether full A′ (serve a JS bundle, mount React in the service Chrome) is feasible.

Find and document:
1. Content-Security-Policy or other security headers on HTML/print responses.
2. Whether the service serves static assets today (JS/CSS/font routes).
3. Frontend dependency installation in the image build (private npm/GitHub packages,
   GITHUB_TOKEN, lockfile pinning).
4. Ability to add `page.exposeFunction` / `waitForFunction` readiness hooks (point to DG5).
5. Explicit verdict: A′ feasible / blocked / unknown — with the blocking evidence.
6. Confirm A′-lite (external SSR HTML → existing generate-document print) needs zero of the
   above capabilities.

Deliverable: markdown `DG6-csp-hosting-a-prime.md`. Save it and give me the path.
```

---

## DG7 — Handlebars helpers, assets network, timeouts

```
Close remaining black-box gaps.

Find and document:
1. Full Handlebars helper and partial registry (built-ins + custom). Paste the registration list.
2. Outbound network policy from the container: can it fetch `org.logoUrl` and presigned file
   URLs? Any allowlist/proxy?
3. Request timeouts, retries, concurrency limits, or internal queues (caller often sets none).
4. Error mapping back to the HTTP client (status codes, body shape).
5. Any barcode/QR/PDF-merge logic that still lives in this service vs the caller.

Deliverable: markdown `DG7-helpers-network-timeouts.md`. Save it and give me the path.
```

---

## After you finish

Return to the Templara repo with:

1. The seven markdown files (scrubbed).
2. A short index note: what is confirmed for A′-lite vs what still blocks full A′.
3. Suggested eval names (e.g. print-margin golden, font-ready timeout budget) for Stream B tickets.
