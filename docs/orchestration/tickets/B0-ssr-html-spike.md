### TASK B0 — SSR-to-HTML spike / design note (A′-lite)
**Status:** done  
**Stream:** B — Server render   **Depends on:** A1 (paint does not require bindings)   **Model tier:** mid  
**Branch:** `integration/rr-doc-builder-2-wave2` (Wave 2)

**Context (why):**  
Architecture reserves HTML/pixels for `@templara/react-renderer`; `@templara/renderer` stays DOM-free ([architecture.md](../../architecture.md)). A′-lite needs a **Node-safe** HTML string to POST to the host `generate-document` print path ([P9](../../discovery/P9-server-render-feasibility.md)). No such entrypoint exists today.

**Scope (do exactly this):**
1. Research React 19 server APIs: `renderToStaticMarkup` / `renderToString` vs streaming (`renderToPipeableStream`) vs static prerender. For A′-lite (full HTML string for print POST), prefer **`renderToStaticMarkup`** (no React checksum attrs; no hydration). Document findings in this ticket’s **Spike findings** section (update when done).
2. Inventory blockers in `packages/react-renderer`:
   - `bwip-js/browser` import (barcode/QR) — verify Node import of `bwip-js/browser` or switch to node entry if needed
   - `DocumentPreview` `useEffect` font injection (does not run under SSR) — need in-tree `<style>` for fonts
   - peer `react` only; need `react-dom` peer for server APIs
3. Choose package placement: **`@templara/react-renderer`** (same paint path) with a dedicated **`./ssr` export** so browser bundles do not pull `react-dom/server` via the main entry. Do **not** put HTML serialization in `@templara/renderer`.
4. If a working path is feasible in-wave, implement the thin scaffold + hand off to B1. If blocked, leave a stub API + failing/skipping test that **names the blocker** in the assertion message.

**Spike findings (fill during execution):**
- React API choice: `renderToStaticMarkup` from `react-dom/server` — full HTML string for print POST; no hydration attrs. Streaming/`prerender` unnecessary for A′-lite.
- bwip-js Node: `bwip-js/browser` resolves under Node and `toSVG` works (verified). No switch to `./node` required for smoke.
- Fonts under SSR: `DocumentPreview` now emits in-tree `<style data-templara-fonts>` with `@import` so SSR includes fonts; client `useEffect` still mirrors into `document.head`.
- Export shape: `@templara/react-renderer/ssr` subpath — main `"."` entry stays free of `react-dom/server`.

**What NOT to touch:**
- Host POST / generate-document wiring (B2).
- Full invoice golden HTML (G2).
- Editor package.

**Best-practice research:**  
Web-search React 19 `renderToStaticMarkup` for static HTML generation; avoid shipping `react-dom/server` into client entrypoints.

**Acceptance criteria (testable):**
- [ ] Spike findings recorded in this ticket.
- [ ] Either a compilable SSR module scaffold exists, or a documented blocker list + stub with named skip/fail.
- [ ] No HTML serialization added to `@templara/renderer`.

**Commit(s):**
```txt
docs(ssr): record A′-lite SSR-to-HTML spike findings

Refs: B0
```
(or fold docs into B1 commit if implemented together)

**Definition of done:** findings written; path chosen; B1 unblocked or explicitly blocked with named reasons.
