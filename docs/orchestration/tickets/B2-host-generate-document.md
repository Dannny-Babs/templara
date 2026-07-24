### TASK B2 — Host POST integration for generate-document
**Status:** backlog (Wave 5+; **host-only** — ticket/spec in Templara)  
**Stream:** B — Server render   **Depends on:** B1, H1 (fidelity unknowns)  
**Branch:** host repo (not implemented in Templara)

**Context (why):**  
A′-lite SSR (`renderTemplateToHtml`) exists in `@templara/react-renderer`. Production generate-document still lives behind platform-model / document-generator auth and options (`showPageNumbers`, Letter). Templara must not invent those POSTs.

**Scope (Templara — docs only):**
1. Keep this ticket as the host contract pointer.
2. Inputs: HTML from `renderTemplateToHtml` + existing PDF/preview routes (see H1 discovery pack).

**Scope (Host — execute elsewhere):**
1. Wire platform-model (or embed host) to SSR Templara → HTML → existing document-generator PDF/preview.
2. Preserve auth and print options.
3. Do not invent parallel generate endpoints inside `@templara/*`.

**Acceptance criteria (host):**
- [ ] Authenticated generate path returns PDF bytes for at least one Templara template.
- [ ] Options parity with DB1 where applicable (`showPageNumbers`, Letter).
- [ ] Fidelity gaps from H1 documented if still open.

**Commit(s) in Templara:** docs/orchestration only.
