### TASK C2 — Value adapter helpers (pre-formatted suffix leaves)
**Status:** done  
**Stream:** C — Value adapter   **Depends on:** C1   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave2` (Wave 2)

**Context (why):**  
Hosts hydrate `{ org, record, document }` with money/date leaves already formatted as strings (P3 §5). Templara must treat binding paths that end in known formatting suffixes as **display strings** — no client `Intl` money/date reformat by default ([orchestration-plan.md](../../orchestration-plan.md) §8, retrospective money/`[object Object]` risk).

**Scope (do exactly this):**
1. Add helpers in `@templara/core` (same module as C1 or `valueAdapter.ts`):
   - `isFormattingPathSuffix(segment: string): boolean` — true if `segment` is in the C1 allowlist (terminal leaf keys including money, date formats, range, `url`; document whether nested property keys like `dateTimeInLocation` count).
   - `bindingPathHasFormattingSuffix(path: string): boolean` — true when the path’s final segment (or a known composite like `dateTimeInLocation.shortDate` as trailing suffix) matches the allowlist / composite date paths used by DB1.
   - `asPreformattedDisplayString(value: unknown): string | undefined` — if `value` is a non-empty string, return it; if missing/wrong type, return `undefined` (do **not** run currency/date formatters).
2. Unit tests against **invoice-context fixture shapes** (prefer loading via evals or a small JSON fixture under core tests copied from discovery — do not add a runtime dependency from core → evals). Options:
   - Core tests with inline objects mirroring `record.total.withDecimalsAndCurrencyCode` string leaves; plus
   - Evals test that imports helpers and asserts real `invoice-context.json` leaves pass `asPreformattedDisplayString` / path detection.
3. Document in JSDoc: default integration rule is “suffix leaf → string as-is”; Templara `FieldFormat` currency/date should not be applied on those host paths by hosts/templates by default.
4. Changeset: fold into C1 minor or add patch/minor note on `@templara/core`.

**What NOT to touch:**
- Do not change `@templara/renderer` `formatValue` yet (optional follow-up: skip format when path has formatting suffix).
- Org `postal` vs `postalCode` mismatch is **C3** (backlog) — not this ticket.
- No Rose Rocket host code.

**Inputs / references:**
- C1 constants; [P3](../../discovery/P3-context-builder.md) §5; `apps/evals/fixtures/invoice-context.json`

**Best-practice research:**  
Adapter pattern: detect contract leaves, pass through strings; avoid double-formatting.

**Acceptance criteria (testable):**
- [ ] Helpers exported from `@templara/core`.
- [ ] Tests prove money/date suffix paths on invoice-shaped data are treated as strings without reformatting.
- [ ] Package tests green.

**Tests to write:** core unit + evals integration against fixture.

**Commit(s):**
```txt
feat(core): add preformatted suffix value-adapter helpers

Refs: C2
```

**Definition of done:** acceptance criteria + Verifier + Wave 2 merge.
