### TASK F6 — Preview button chrome polish
**Stream:** F   **Depends on:** F1   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave6`  
**Status:** done

**Context (why):** Field-test §1.4–1.5 — Preview control looked like an eye + label and felt unclear when embedded.

**Scope (do exactly this):**
- Remove the eye / View icon from the Preview toolbar control.
- Keep the label **Preview** plus a sharp chevron dropdown affordance.
- Increase control height/type size; drop soft shadow for a sharper edge.
- Do not change preview modes (sample / large / export).

**Acceptance criteria:**
- [x] No ViewIcon on the Preview button.
- [x] Chevron uses sharp icon set.
- [x] Changeset for `@templara/editor`.

**Definition of done:** Merged with Wave 6.
