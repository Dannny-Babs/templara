### TASK E1 — Host design-token inheritance
**Status:** ready (Wave 4)  
**Stream:** E — Design tokens   **Depends on:** none (parallel)   **Model tier:** mid  
**Branch:** `feat/host-design-tokens` (off Wave 4 integration)

**Context (why):**  
Embedding field-test P1 ([embedding-field-test-issues.md](../../embedding-field-test-issues.md) §2 / §9): when embedded, Templara must inherit Zinnia / host CSS vars on `:root`, accept a typed `HostDesignTokens` (or equivalent) prop, and not force product branding ([P6](../../discovery/P6-design-tokens.md)).

**Scope (do exactly this):**
1. Inventory current editor/studio CSS variables and brand lockup (`DocumentEditorProps.brandLogo` / `brandLogoSrc` already exist — extend rather than reinvent).
2. Add typed `HostDesignTokens` (name may match existing patterns) covering fonts, colors, control radii used by editor chrome — map from documented Zinnia vars where known (P6).
3. Wire editor root to consume CSS vars with fallbacks to current Templara defaults.
4. Embedding mode: when host sets an explicit embed prop (e.g. `embedded` / `hideBrand`) **or** supplies `brandLogo` / empty brand contract, do not render the default “Templara” wordmark (coordinate with F1 if F1 lands first).
5. Unit/component tests: tokens override a visible style; default standalone Studio still branded unless embed flag set.
6. Changeset on `@templara/editor` (and renderer if paint tokens change).

**What NOT to touch:**
- Do not build Google Fonts infrastructure (field-test 2.4 is out of scope).
- Do not rewrite the whole design system in one PR — prop + CSS var bridge first.
- Do not require host repo changes for Templara unit tests (use fixture tokens).

**Inputs / references:** P6; embedding-field-test §2.1–2.3, §9; existing `brandLogo*` props.

**Best-practice research:**  
CSS custom properties inheritance for embeddable editors; typed token bags with fallbacks.

**Acceptance criteria (testable):**
- [ ] Host can pass tokens/CSS vars and see at least one chrome surface change in test.
- [ ] Standalone defaults remain usable without host tokens.
- [ ] Branding hide path documented and tested (shared with F1 if overlapping).
- [ ] Changeset + typecheck/tests green.

**Tests to write:** editor unit/component tests with token fixture.

**Commit(s):**
```txt
feat(editor): accept HostDesignTokens and CSS var inheritance

Refs: E1
```

**Definition of done:** acceptance criteria + Verifier + Wave 4 merge.
