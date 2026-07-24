### TASK C1 — Money/date/enum suffix allowlist in `@templara/core`
**Status:** done  
**Stream:** C — Value adapter   **Depends on:** A2   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave2` (Wave 2)

**Context (why):**  
Doc Builder 1 materializes money/date (and related) leaves as **pre-formatted strings** keyed by a closed suffix set ([P3-context-builder.md](../../discovery/P3-context-builder.md) §2d, §5). Wave 1 evals only listed the **fixture-present** money suffixes in `apps/evals/src/suffix-allowlist.ts`. Stream C needs the **full P3 allowlist** in `@templara/core` so hosts, evals, and the value adapter share one source of truth.

**Scope (do exactly this):**
1. Add `packages/core/src/formattingSuffixes.ts` (name may vary; keep public API clear) exporting:
   - `MONEY_FORMAT_SUFFIXES` — `withCurrencyCode`, `withDecimalsAndCurrencyCode`, `unroundedWithoutCurrencyCode` (P3 `MoneyFormatType`)
   - `DATE_FORMAT_SUFFIXES` — `standardDate`, `standardDateTime`, `shortDate`, `shortDateTime`, `longDate`, `longDateTime` (P3 `DateTimeValueFormatType`)
   - `DATE_TIME_PROPERTY_SUFFIXES` — `dateTimeInLocation`, `dateTimeInLocationEnd`
   - `DATE_RANGE_SUFFIXES` — the seven `DateTimeValueFormatRangeType` keys from P3 §5.3
   - `OTHER_FORMATTING_SUFFIXES` — at least `url` (file download leaf)
   - `FORMATTING_PATH_SUFFIXES` — flat union of all terminal / strip-relevant suffixes used to detect pre-formatted leaves (document composition rules in JSDoc)
   - Typed `as const` arrays + derived union types
2. Export from `packages/core/src/index.ts`.
3. Unit tests in `packages/core/src/formattingSuffixes.test.ts`:
   - Exact membership of money (3), date formats (6), range (7), properties (2), `url`
   - No accidental duplicates in the combined list
4. Rewire `apps/evals`: delete or thin `apps/evals/src/suffix-allowlist.ts` so G1 imports money suffixes (or a fixture-present subset helper) from `@templara/core` instead of a local duplicate.
5. Changeset: `@templara/core` **minor** (new public exports).

**What NOT to touch:**
- Do not implement display/format skipping helpers here if split to C2 — constants only for C1.
- Do not invent Rose Rocket host formatters.
- Do not change renderer `formatValue` behavior in this ticket (C2 / later).

**Inputs / references:**
- [P3-context-builder.md](../../discovery/P3-context-builder.md) §2d `suffixesToStrip`, §5.1–5.5
- Wave 1: `apps/evals/src/suffix-allowlist.ts`, `invoice-context-shape.test.ts`

**Best-practice research:**  
Closed allowlists as `as const` + derived types; single package source of truth for cross-app constants.

**Acceptance criteria (testable):**
- [ ] Full P3 money/date/range/url suffix constants exported from `@templara/core`.
- [ ] Core unit tests lock exact sets.
- [ ] Evals no longer maintain a divergent money-suffix duplicate (imports core).
- [ ] Changeset present; `pnpm typecheck && pnpm test && pnpm build` green for touched packages.

**Tests to write:** `formattingSuffixes.test.ts`; update evals import path.

**Commit(s):**
```txt
feat(core): export P3 formatting suffix allowlist

Refs: C1
```

**Definition of done:** acceptance criteria + Verifier sign-off + merged into Wave 2 integration.
