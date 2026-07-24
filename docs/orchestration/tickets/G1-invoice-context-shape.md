### TASK G1 — Invoice context-shape / fixture contract tests
**Stream:** G — Docs, fixtures & evals   **Depends on:** G0   **Model tier:** executor  
**Branch:** `chore/eval-harness-setup` (same branch as G0 if sequential; otherwise rebase onto G0)

**Context (why):**  
Doc Builder 1 context is `{ org, record, document }` built path-by-path — **not** a blanket `serialize(record)` ([P3-context-builder.md](../../discovery/P3-context-builder.md) §0, [00-DISCOVERY-REPORT.md](../../discovery/00-DISCOVERY-REPORT.md) §3). Money/date values are **pre-formatted string leaves** at a closed suffix set (P3 §2d/§5). Wave 1 locks that fixture contract in tests **before** SSR (G2 is backlog).

**Scope (do exactly this):**
1. In `apps/evals/`, add `src/invoice-context-shape.test.ts` (name may vary; keep under `src/`).
2. Load `apps/evals/fixtures/invoice-context.json`.
3. Assert top-level keys **exactly** include (at least): `org`, `record`, `document`. Prefer asserting these three exist and are objects; do not require that no other keys exist unless the fixture is known to have only those three (the fixture also has `_note` — allow `_note` or assert the three required keys without forbidding `_note`).
4. Assert known money suffix leaves exist as **strings** on sample paths (values may be illustrative; shapes/keys are the contract):
   - `record.total.withDecimalsAndCurrencyCode`
   - `record.subTotal.withDecimalsAndCurrencyCode`
   - At least one nested line money leaf, e.g. a path under `record` that ends with `withDecimalsAndCurrencyCode` (fixture has line-item totals).
5. Assert known date suffix leaves exist as **strings**:
   - `record.invoiceDate.dateTimeInLocation.shortDate`
   - `record.dueDate.dateTimeInLocation.shortDate`
6. Optionally assert `document` has a shortDate-style leaf if present in the fixture (`document` block in fixture).
7. Add a small constant module **only if helpful for assertions**, e.g. `apps/evals/src/suffix-allowlist.ts`, listing the money suffixes used in tests:
   - `withCurrencyCode`
   - `withDecimalsAndCurrencyCode`
   - `unroundedWithoutCurrencyCode`  
   Document that the full closed set lives in P3 §2d; this file is for G1 assertions only — **not** the full Stream C adapter.
8. After A1 is mergeable: add (or leave a clearly skipped/`it.todo` that becomes active) a test that imports `extractBindings` from `@templara/core`, runs it on `invoiceTemplate` from `@templara/templates`, and asserts a **non-empty sorted** path list. Prefer implementing this assertion in G1 once A1 lands on integration; if A1 is not yet merged, keep the test file structure ready and document the dependency — do **not** reimplement extraction in evals.

**What NOT to touch:**
- No HTML SSR / golden HTML comparison against `invoice-rendered.html` (that is **G2**).
- No Rose Rocket / platform-model imports.
- Do not change fixture JSON keys to “fix” tests — if a path is wrong, fail the test and escalate.
- Do not implement value formatting (Stream C).

**Inputs / references:**
- Fixture: `apps/evals/fixtures/invoice-context.json` (from discovery copy)
- Evidence: [P3-context-builder.md](../../discovery/P3-context-builder.md) §0, §2c–§2e, suffix allowlist §2d
- Sample money/date shapes already in the fixture (`withDecimalsAndCurrencyCode`, `dateTimeInLocation.shortDate`)

**Best-practice research:**  
Web-search: “contract testing JSON fixtures vitest deep path assertions” — prefer simple path helpers over heavy schema libs unless already in the repo.

**Acceptance criteria (testable):**
- [ ] Tests fail if `org` / `record` / `document` are missing.
- [ ] Tests fail if listed money/date suffix leaves are missing or not strings.
- [ ] `pnpm --filter @templara/evals test` green.
- [ ] `pnpm typecheck && pnpm test && pnpm build` green.
- [ ] No SSR/HTML golden assertions in this ticket.

**Tests to write:**
- `invoice-context-shape.test.ts` (unit/contract).
- Optional post-A1: `extractBindings(invoiceTemplate)` golden sorted list in evals (can land in a follow-up commit on the same branch after A1 merges).

**Commit(s):**
```txt
test(evals): lock invoice context-shape and suffix-leaf contracts

Refs: G1
```

**Definition of done:** all acceptance criteria + Verifier sign-off + merged into `integration/rr-doc-builder-2`.
