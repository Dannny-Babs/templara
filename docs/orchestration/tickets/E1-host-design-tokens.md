### TASK E1 — Host design-token inheritance
**Status:** done (Wave 4)  
**Stream:** E — Design tokens   **Depends on:** none (parallel)   **Model tier:** mid  
**Branch:** `integration/rr-doc-builder-2-wave4`

**Context (why):**  
Embedding field-test P1 ([embedding-field-test-issues.md](../../embedding-field-test-issues.md) §2 / §9): when embedded, Templara must inherit Zinnia / host CSS vars on `:root`, accept a typed `HostDesignTokens` (or equivalent) prop, and not force product branding ([P6](../../discovery/P6-design-tokens.md)).

**Shipped (Wave 4):**
1. Typed `HostDesignTokens` + `TEMPLARA_TOKEN_VARS` CSS-variable bridge (`hostDesignTokensToCssVars`).
2. `DocumentEditor` props: `hostDesignTokens`, `embedded`, `hideBrand`.
3. Shell root applies token CSS vars; chrome helpers use `var(--templara-*, fallback)`.
4. Embedded without `fontFamily` → `--templara-font-family: inherit` (host font cascade).
5. Branding hide path shared with F1; standalone Studio remains branded by default.
6. Unit tests + `@templara/editor` changeset; README embed contract updated.

**What NOT touched:**
- Google Fonts infrastructure (field-test 2.4).
- Full Zinnia primitive swap (buttons/inputs still Templara chrome — token bridge first).
- Host repo changes (fixture tokens in unit tests only).

**Acceptance criteria:**
- [x] Host can pass tokens/CSS vars and see chrome surface mapping in tests.
- [x] Standalone defaults remain usable without host tokens.
- [x] Branding hide path documented and tested.
- [x] Changeset + typecheck/tests green.

**Commit(s):**
```txt
feat(editor): accept HostDesignTokens and hide brand when embedded

Refs: E1
```

**Definition of done:** met on Wave 4 integration branch.
