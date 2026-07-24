# P9 — Server-render feasibility for the new (Templara / Doc Builder 2) engine

**Options under evaluation**

- **A′** — Teach `document-generator` a *new render mode/route* that serves an HTML
  page which mounts the React renderer, injects `{ templateJson, data }`, waits for
  paint, and prints — **reusing the existing Chrome**.
- **B** — Stand up a *separate* Puppeteer/Chromium service dedicated to Templara.

> **Hard evidence boundary.** `document-generator`’s source is **NOT present in any
> local repo** (separate `RoseRocket/document-generator` repo, consumed only as a
> container image — see P2 §0). Therefore the decisive A′ questions — *can the
> service host a JS bundle? how is Chrome invoked? does it expose a “render complete”
> hook? how are frontend deps pinned?* — **cannot be answered from local code.** This
> report gives an **evidence-based feasibility framing** from the contract + editor
> side, states clearly what is unknown, and lists the exact integration points to
> confirm inside that repo.

---

## 1. How hard is it to add a new render MODE/route?

### What we know (evidenced)
- The service already **multiplexes on a path segment**: `…/api/v1/docs/platform/{documentId}[/pdf|/preview]`, where `{documentId}` selects behavior (`generate-document`, `bol`, `invoice`, …) — P2 §1.1–1.3. Adding a **new selector** (e.g. `templara`) or a **new suffix** (e.g. `/render-json`) is the *natural* extension shape and mirrors how `generate-document` was itself added alongside the legacy `bol|invoice|…` selectors.
- The service already returns **three response modes** for the same input family — HTML (`/{id}`), `{html}` (`/preview`), PDF bytes (`/{id}/pdf`) — so it clearly has an internal branch on “render to HTML” vs “render to PDF.” A JSON-driven mode slots into that same branch structure.
- Auth, networking, and the platform-side client are **mode-agnostic**: `getPDF`/`getHTML` take an arbitrary `documentId` string, so a new mode needs **zero platform-model changes to the transport** — only a new payload shape (`{ templateJson, data }` instead of `{ templateData, context }`).

### What is UNKNOWN (needs the repo)
- Whether the service currently serves **any** static JS/HTML assets (i.e. does it already run an HTTP server capable of hosting a bundle, or only accept POSTed HTML strings and print them?). The Handlebars path suggests it primarily **receives** HTML and prints it, which means A′ likely requires the service to **host and serve a new React bundle route** — a new capability, not just a new payload.
- The templating abstraction: is Handlebars-compile hard-wired, or is there a pluggable “given HTML string → print” core that a React-rendered HTML could reuse?

### Feasibility read
A′ is **plausible and idiomatic** given the existing multi-selector/multi-mode
design, **provided** the service can host/serve a small React bundle. If it can only
accept-and-print HTML strings (no static hosting), there is a simpler **A′-lite**:
render the Templara React tree to an HTML string *elsewhere* (platform-model or a
tiny renderer) and POST that HTML to the **existing** `generate-document` print path
— reusing Chrome with **no new route at all**. A′-lite is the lowest-risk variant and
is fully supported by today’s contract (the service already prints arbitrary POSTed
HTML). Confirm which is needed once the repo is available.

---

## 2. How is the existing Chrome invoked? Can it load an app page and wait for “render complete”?

**NOT LOCALLY DETERMINABLE.** Puppeteer launch, `page.setContent` vs `page.goto`,
and any wait condition (`networkidle0` / `document.fonts.ready` / custom signal) are
service-internal.

Evidence-based inference:
- The `/preview` → `{html}` and `/pdf` behaviors imply Chrome loads HTML (very likely
  `page.setContent(compiledHtml)`), which is **content-injection**, not navigation to
  an app URL. For A′ (mount a live React app), the service would need to either
  (a) `setContent` an HTML shell that includes the bundle `<script>` and boot data,
  or (b) `goto` a self-hosted route. Both are standard Puppeteer, but **which is
  wired today is unknown.**
- **“Render complete” signal:** today’s pipeline prints a static compiled string, so
  it may only wait for network/fonts, not for a JS app’s “I’ve painted” event. A′ for
  a React app **needs an explicit readiness hook** (e.g. set `window.__READY__ = true`
  / dispatch an event / resolve a promise the service awaits). Whether the service
  exposes such a hook is the **single biggest unknown** and the crux of A′ vs B.

---

## 3. Version-sync: how does the service pin/build frontend deps?

**NOT LOCALLY DETERMINABLE** (no `package.json`/lockfile for `document-generator` in
these repos). The relevant *platform-side* facts for keeping a shared renderer
identical between editor and service:

- The editor is the Bit package **`@roserocket/components.document-template-editor@^4.6.4`**, pinned in **both** `ui/package.json` and `recipes/package.json` and resolved from GitHub Packages (`npm.pkg.github.com`) in `yarn.lock`. A shared **Templara renderer** should be a sibling Bit/npm package pinned the same way, so the **editor app and the service consume the same published version**.
- The container build already injects a `GITHUB_TOKEN` secret for `@roserocket/*` package installs (`docker-compose.yaml` secrets + platform-model Dockerfile), so a private renderer package is installable in a service image using the same mechanism — *if* the `document-generator` image build is set up analogously (unknown).

Recommendation: publish `@roserocket/components.templara-renderer` (pure render core,
no editor chrome), pin an exact version in the editor app **and** the service, and
gate PDF/preview parity on version equality. This is the migration-cost-minimizing
shape (a versioned contract, not a copy-paste bundle).

---

## 4. Blockers for hosting a React bundle in the service

Evidenced or strongly-inferable:
- **Network isolation (real risk).** The service sits on the internal
  `rr_shared_network`. Today’s templates already depend on Chrome fetching
  `org.logoUrl` and presigned file URLs at print time (see P8 §2) — so outbound
  fetch *from inside the container* is presumably allowed for those hosts. A React
  bundle that fetches additional assets/fonts at runtime would inherit the same
  isolation constraints. **Prefer inlining** (bundle CSS/fonts, base64 images) to
  avoid runtime fetches — mirrors the existing barcode base64 pattern (P8 §2.3).
- **Build tooling / static hosting (unknown).** Whether the service can `serve`
  static JS is unconfirmed (§1). If not, use **A′-lite** (render-to-string outside,
  print via existing path).
- **CSP:** NOT LOCALLY DETERMINABLE (service response headers unknown). If the
  service prints via `setContent`, inline `<script>` execution must be allowed — a
  React bundle mounted client-side needs script execution, so any restrictive CSP in
  the print context would block A′ (but not A′-lite, which ships static HTML).
- **Concurrency:** `MAX_TASK_CONCURRENCY=2` per instance (P2 §6). A heavier React
  mount+paint per task will consume that budget faster than string-compile; capacity
  planning needed regardless of A′ vs B.

---

## 5. Feasibility assessment

### A′ (reuse existing Chrome) — **recommended if** the service can host/serve a bundle *or* accept render-to-string HTML
Pros:
- Reuses the proven Chrome print engine, the existing print CSS/`@page`/pagination,
  `showPageNumbers` footer, Letter sizing, and the whole permission-gated controller
  surface — **zero duplication** of the hardest-to-replicate fidelity behavior.
- Transport unchanged: platform-model’s `getPDF`/`getHTML`/`getPDFWithCodeReplacement`
  already accept an arbitrary `documentId` selector; a Templara mode needs only a new
  payload shape and (maybe) a new selector string.
- Single service to operate, monitor, and secure; single font/asset environment ⇒
  fewer fidelity divergences vs Doc Builder 1.

Cons / gating unknowns:
- Needs a **render-complete signal** the service awaits before `page.pdf()` (§2).
- May need the service to **host a JS bundle** (§1/§4) — new capability.
- Shared-renderer **version pinning** discipline required (§3).

**A′-lite** (render Templara React → HTML string *outside* the service, POST to the
existing `generate-document` print path): the **lowest-risk path**, fully supported by
today’s contract, no new route, no bundle hosting, no CSP concern, no readiness hook.
Cost: you lose live client-side interactivity at print time (fine for documents) and
must run React SSR somewhere (platform-model or a thin renderer lib). **Start here
unless a hard requirement forces client-side mount.**

### B (separate Puppeteer service) — fallback only
Pros: full control of Chrome/wait/CSP/deps; isolates Templara load from Doc Builder 1;
independent scaling.
Cons: **duplicates** the entire print-fidelity surface (fonts, `@page`, margins,
footers, asset-wait) that Doc Builder 1 already solved — high migration cost and a
standing source of “PDF looks different in v2” bugs; second service to secure
(the same `Bearer`/permission gating must be rebuilt); more infra. Choose B **only**
if the `document-generator` repo proves it cannot host a bundle *and* cannot expose a
readiness hook, and A′-lite’s SSR constraint is unacceptable.

---

## 6. Concrete integration points to confirm inside `document-generator`

1. HTTP layer: does it serve static assets, or only accept POSTed HTML? (decides A′ vs A′-lite)
2. The router branch on `{documentId}` and `/pdf` vs `/preview` — where a `templara` selector or `/render-json` suffix would hook in.
3. The Puppeteer invocation: `setContent` vs `goto`; current wait condition; where to add `await page.waitForFunction('window.__TEMPLARA_READY__')` or equivalent.
4. Print options block (`format`, `margin`, `printBackground`, `preferCSSPageSize`, header/footer) — reuse verbatim so v2 PDFs match v1.
5. `package.json`/lockfile + image build: can it install a private `@roserocket/*` renderer package with the existing `GITHUB_TOKEN` secret; how to pin it to match the editor.
6. CSP / response headers on the print context (blocks client-side mount for A′).
7. Outbound network policy from the container (logo/font/asset fetch reachability).

---

## 7. Bottom line

A′ is **architecturally consistent** with the existing service (multi-selector,
multi-mode, mode-agnostic transport) and is the right target for reuse of print
fidelity. **A′-lite (SSR-to-HTML → existing `generate-document` print path) is
feasible *today* with zero service changes** and should be the default first step.
Full A′ (client-side React mount in the service’s Chrome) hinges on three
service-internal unknowns — bundle hosting, a render-complete hook, and CSP — that
**require the `document-generator` repo** to resolve. B is a costly fallback that
re-implements fidelity Doc Builder 1 already owns; avoid unless A′/A′-lite are proven
impossible.
