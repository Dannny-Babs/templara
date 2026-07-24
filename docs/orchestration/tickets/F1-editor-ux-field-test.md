### TASK F1 — Editor UX field-test batch (first concrete fix)
**Status:** done (Wave 4)  
**Stream:** F — Editor UX   **Depends on:** none (parallel; branding coordinated with E1)   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave4`

**Context (why):**  
Field-test P1 pain ([embedding-field-test-issues.md](../../embedding-field-test-issues.md) §1.14, §2.1, §8–9): canvas aids default ON (grid/bleed/margins clutter), and Templara branding must not appear when the package is embedded in a host product.

**Shipped (Wave 4):**
1. **Option A — Default canvas toggles OFF**
   - `DEFAULT_WORKSPACE_AIDS`: `showGrid` / `showRulers` → `false`; snap stays `true` (no painted overlays).
   - `resolvePageInspectorDraft`: `showMarginGuides`, `showPrintableArea`, `pageShadow`, `safeAreaEnabled`, `bleedEnabled`, `includeCropMarks` → `false` (bleed/safe-area mm values retained).
2. **Option B — Hide Templara branding when embedded** (shared with E1)
   - `embedded` / `hideBrand` on `DocumentEditorProps`; omit default mark + “Templara” wordmark.
   - Hosts may still pass `brandLogo` / `brandLogoSrc`.
3. **Wave 4b (same PR):** layers panel search (`filterLayerTreeRows`); quieter diagnostics dock chrome.

**What NOT touched (still open — see F2/F3/F4 tickets):**
- Dropdown overflow/size (1.1–1.3), UUID layer names (1.7), layer virtualization (1.9), left-panel resize (1.12), preview button restyle (1.4–1.5), large-schema data panel.

**Acceptance criteria:**
- [x] Canvas layout aids default off with tests + changeset.
- [x] Remaining field-test rows stay ticketed (F2+ / backlog), not silently closed.
- [x] `pnpm` typecheck/test for editor green.

**Commit(s):**
```txt
fix(editor): default canvas layout aids off

Refs: F1

feat(editor): accept HostDesignTokens and hide brand when embedded

Refs: E1, F1
```

**Definition of done:** met on Wave 4 integration branch.
