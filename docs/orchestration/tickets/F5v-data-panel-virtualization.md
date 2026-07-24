### TASK F5v — Data panel virtualization
**Stream:** F   **Depends on:** F5   **Status:** done (Wave 7)  
**Branch:** `integration/rr-doc-builder-2-wave7`

**Context:** After F5 search/collapse, expanding large schemas can still mount thousands of DOM rows. Field-test §3.1 / §3.7.

**Scope:**
- Add `getVirtualWindow` helper + unit tests.
- When flattened data-explorer rows ≥ 60, render a scroll window instead of the full tree.
- Keep non-virtual path for small lists (unchanged UX).

**Acceptance:**
- [x] Window size stays small for ~3k-row math in unit tests.
- [x] Editor tests + typecheck green.
- [x] Changeset for `@templara/editor`.
