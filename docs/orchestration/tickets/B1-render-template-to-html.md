### TASK B1 — `renderTemplateToHtml` (DocumentPreview-equivalent SSR)
**Status:** done  
**Stream:** B — Server render   **Depends on:** B0   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave2` (Wave 2)

**Context (why):**  
A′-lite needs `renderDocument` → React paint → HTML string for the host print path. First working cut: serialize **DocumentPreview-equivalent** output for a **simple** template (not full invoice golden — that is G2).

**Scope (do exactly this):**
1. Add `packages/react-renderer/src/ssr.ts` exporting:
   - `renderTemplateToHtml(template: DocumentTemplate, data: unknown, options?: { scale?: number; showDebug?: boolean }): string`
   - Implementation: `renderDocument({ template, data })` → React element equivalent to `DocumentPreview` → `renderToStaticMarkup` from `react-dom/server`.
2. Package exports: add `"./ssr"` pointing at `dist/ssr.js` / types. Keep `"."` free of `react-dom/server` imports.
3. Peer deps: `react` and `react-dom` `^19.0.0`. Add `@templara/core` if types need it (via renderer). Ensure workspace test resolution has react/react-dom available.
4. Fix SSR-safe paint gaps discovered in B0 (minimal):
   - Fonts: render `@import` CSS via an in-tree `<style>` so SSR HTML includes font links (keep or simplify client `useEffect` as needed without breaking browser preview).
   - Barcodes: use a Node-safe bwip path if `bwip-js/browser` fails under Node in CI; for templates without barcodes, smoke may omit this.
5. Unit/smoke test in `packages/react-renderer` and/or `apps/evals`:
   - Trivial one-page template with a bound text field → HTML contains the resolved string and a page container (`data-templara-page-id` or equivalent).
   - Prefer evals golden/smoke once deps are wired; keep scope small (not invoice-rendered.html fidelity).
6. Changeset: `@templara/react-renderer` **minor**.

**What NOT to touch:**
- G2 full HTML fidelity vs `invoice-rendered.html`.
- B2 host POST integration.
- PDF package / Chrome print.

**Inputs / references:**
- B0 findings; `DocumentPreview` in `packages/react-renderer/src/index.ts`; `renderDocument` in `@templara/renderer`.

**Best-practice research:**  
`renderToStaticMarkup` for print HTML; conditional/subpath exports for SSR entry.

**Acceptance criteria (testable):**
- [ ] `renderTemplateToHtml` exported from `@templara/react-renderer/ssr`.
- [ ] Smoke/golden test: simple template HTML includes expected text.
- [ ] Main browser entry does not import `react-dom/server`.
- [ ] Changeset + focused tests green.

**Tests to write:** react-renderer and/or apps/evals SSR smoke.

**Commit(s):**
```txt
feat(react-renderer): add Node-safe renderTemplateToHtml SSR entry

Refs: B1
```

**Definition of done:** working minimal HTML path + tests + changeset + Wave 2 merge.
