### TASK F1 — Editor UX field-test batch (first concrete fix)
**Status:** ready (Wave 4; Wave 3 ticket only)  
**Stream:** F — Editor UX   **Depends on:** none (parallel; coordinate branding with E1)   **Model tier:** executor  
**Branch:** `fix/editor-default-canvas-toggles` (or `fix/editor-hide-brand-when-embedded`)

**Context (why):**  
Field-test P1 pain ([embedding-field-test-issues.md](../../embedding-field-test-issues.md) §1.14, §2.1, §8–9): canvas aids default ON (grid/bleed/margins clutter), and Templara branding must not appear when the package is embedded in a host product.

**Scope (do exactly this) — pick ONE first PR, not the whole log:**

**Option A (recommended first — smallest, high value):** Default canvas toggles OFF  
1. In `packages/editor/src/index.ts` / inspector defaults (`packages/editor/src/inspector/index.ts`):
   - `showGrid` initial state → `false`
   - `showMarginGuides` / `bleedEnabled` defaults → `false` (keep `bleedMm` value for when re-enabled)
   - Consider `showRulers` / snap defaults: prefer OFF for visual clutter; snap may stay ON if it does not paint overlays — document choice in PR.
2. Tests: assert default draft/workspace props have aids off; existing toggle-on tests still pass when explicitly enabled.
3. Changeset: `@templara/editor` patch/minor.

**Option B:** Hide Templara branding when embedded  
1. Add `embedded?: boolean` (or `hideBrand?: boolean`) to `DocumentEditorProps`.
2. When true (or when `brandLogo` is explicitly `null` sentinel — prefer boolean), omit BrandMark + “Templara” text; hosts may still pass `brandLogo` / `brandLogoSrc` for their mark.
3. Tests for toolbar brand presence/absence.
4. Changeset: `@templara/editor` minor.

**What NOT to touch in F1:**
- Do not boil the ocean (dropdowns, virtualization, diagnostics visual, layer UUID names — separate tickets).
- Do not break standalone Studio unless behind embed prop (Option B) or intentional default change (Option A — call out in PR/changelog).
- Wave 3 does **not** require implementing F1 code if time is spent on G2/C3.

**Inputs / references:** embedding-field-test §1.14, §2.1, §9; editor toolbar brand lockup ~`DocumentEditorProps` / `BrandMark`.

**Best-practice research:**  
Embeddable editor defaults: empty canvas; host-owned chrome branding.

**Acceptance criteria (testable):**
- [ ] Exactly one Option A or B shipped with tests + changeset.
- [ ] Remaining field-test rows stay ticketed (F2+ or backlog), not silently closed.
- [ ] `pnpm` typecheck/test for editor green.

**Tests to write:** editor unit tests for defaults or brand visibility.

**Commit(s):**
```txt
fix(editor): default canvas layout aids off

Refs: F1
# or
fix(editor): hide Templara brand when embedded

Refs: F1
```

**Definition of done:** one concrete UX fix + tests + Verifier; rest of field-test log remains open.
