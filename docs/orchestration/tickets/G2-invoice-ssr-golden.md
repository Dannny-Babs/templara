### TASK G2 — Invoice SSR golden + discovery HTML contract
**Status:** done (Wave 3)  
**Stream:** G — Evals   **Depends on:** G1, B1   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave3`

**Context (why):**  
After B1’s `renderTemplateToHtml`, we need a regression gate for invoice-ish SSR output. Discovery ships `invoice-rendered.html` (DB1 Handlebars → Lexical HTML). Comparing that byte-for-byte (or naively normalized) to Templara’s JSON `invoiceTemplate` would claim false fidelity — different engine, layout, and sample identity ([P4](../../discovery/P4-real-templates-invoice-chain.md), orchestration §5 golden rules).

**Scope (do exactly this):**
1. Add `apps/evals/src/invoice-ssr-golden.test.ts`:
   - **Templara golden:** `renderTemplateToHtml(invoiceTemplate, invoiceSampleData)` asserts structure (`data-templara-document`, page id) and pinned markers (Acme Logistics, INV-2026-1048, line item, thank-you, balance total pattern).
   - **Discovery contract:** load `fixtures/invoice-rendered.html`; assert it still contains Northwind / INVOICE-100482 / `editor__layout` markers (fixture present + stable).
   - **Gap assertion:** discovery HTML must not contain Templara sample identity and vice versa — documents apples-to-oranges.
2. Document intentional diffs vs DB1 in this ticket (below) and in test file header comments.
3. Optional soft link: C3 alias check on `invoice-context.json` may live in the same file or C3 evals test.
4. No Changeset (evals private; no publishable API from this ticket alone).

**What NOT to touch:**
- Do not invent a Handlebars→JSON invoice template or claim DB1 HTML parity.
- Do not POST to document-generator / platform-model.
- Do not replace B1 smoke tests.

**Inputs / references:**
- B1 `renderTemplateToHtml`; `@templara/templates` invoice exports; `apps/evals/fixtures/invoice-rendered.html`; G1 context-shape.

**Known intentional diffs vs DB1 Handlebars HTML:**
| Aspect | DB1 `invoice-rendered.html` | Templara `invoiceTemplate` SSR |
| --- | --- | --- |
| Engine | Handlebars + Lexical classes (`editor__*`) | React DocumentPreview (`data-templara-*`) |
| Identity | Northwind / INVOICE-100482 | Acme Logistics / INV-2026-1048 |
| Context shape | `{ org, record, document }` | Demo schema `business` / `customer` / `invoice` |
| Org postal | Blank when template reads `postalCode` (P3 bug) | N/A on demo bindings |
| Layout | Multi-table freight invoice | Demo invoice cards + flow region |

**Best-practice research:**  
Prefer marker / contract goldens over brittle full-DOM snapshots when engines differ; pin what you own.

**Acceptance criteria (testable):**
- [x] Templara invoice SSR marker golden green.
- [x] Discovery HTML fixture contract green.
- [x] Gap documented in ticket + test comments.
- [x] Focused evals + package tests green.

**Tests to write:** `apps/evals/src/invoice-ssr-golden.test.ts`.

**Commit(s):**
```txt
test(evals): pin Templara invoice SSR golden and discovery HTML contract

Refs: G2
```

**Definition of done:** acceptance criteria + Verifier + Wave 3 merge.
