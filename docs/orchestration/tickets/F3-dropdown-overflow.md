### TASK F3 — Dropdown / popover overflow + sizing
**Status:** done (Wave 5)  
**Stream:** F — Editor UX   **Depends on:** F1  
**Field-test:** §1.1–1.3  
**Branch:** `integration/rr-doc-builder-2-wave5`

**Context (why):**  
Toolbar Preview/Zoom menus always opened below the trigger and could clip at the viewport bottom. Inspector selects already flipped; toolbar did not share that logic. Layer caret/add hit targets were tight (18–24px).

**Shipped:**
1. Shared `measureDropdownFrame` / `anchoredDropdownStyle` with flip-up + `maxHeight` clamp + horizontal viewport clamp.
2. Zoom + Preview menus and inspector `Select` use the shared measure.
3. Slightly larger layer row / caret / add hit targets (24–32px).
4. Unit tests for placement/clamp.

**Deferred / residual:**
- No React portal layer yet — fixed positioning is the escape hatch. If a host chrome `transform` creates a containing block that still clips menus, add a portal root in a follow-up.
- Full visual regression / screen recording not captured in CI.

**Acceptance:**
- [x] Toolbar menus flip/clamp; regression unit tests.
- [x] Inspector select max-height respects available viewport.
- [ ] Optional: portal + Playwright visual (backlog polish).
