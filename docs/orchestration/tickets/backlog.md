# Backlog stubs (post–Wave 1)

Planner expands these into full §6 tickets in a later pass. One-liners + depends-on only.

## Stream A — Data binding (remaining)

<a id="a3"></a>

### A3 — Real-record preview wiring (host)
**Depends on:** A2  
**One-liner:** In the host embed, feed `extractBindings` → `toRecordContextPaths` → host `buildRecordContext` / `$byIdOrThrow` into Templara preview data; prove a real invoice record fills the canvas without sample placeholders.

## Stream G — Evals (remaining)

<a id="g2"></a>

### G2 — SSR golden / HTML fidelity harness
**Depends on:** G1, B1  
**One-liner:** After a Node-safe SSR-to-HTML entrypoint exists, compare Templara HTML (or normalized subset) against `docs/discovery/fixtures/invoice-rendered.html` / evals copy; no HTML golden in Wave 1.

## Stream B — Server render (A′-lite)

<a id="b1"></a>

### B1 — Node-safe SSR-to-HTML entrypoint
**Depends on:** A1 (bindings not strictly required for paint, but Wave order prefers A first)  
**One-liner:** Add a DOM-free HTML serialization path for `@templara/react-renderer` output (or thin shared lib) so platform-model can POST HTML to existing `generate-document` print path ([P9](../../discovery/P9-server-render-feasibility.md) A′-lite).

### B2 — Host POST integration for generate-document
**Depends on:** B1, H1 (fidelity unknowns)  
**One-liner:** Wire platform-model (or embed host) to SSR Templara → HTML → existing document-generator PDF/preview routes; preserve auth and options (`showPageNumbers`, Letter).

## Stream C — Value adapter

<a id="c1"></a>

### C1 — Value adapter / suffix allowlist parity
**Depends on:** A2  
**One-liner:** Document and test closed money/date/enum/measurement suffix leaves from P3 §2d so Templara bindings expect pre-formatted strings; no client reformat by default.

### C2 — Org address key mismatch guard
**Depends on:** C1  
**One-liner:** Capture/fix the known `org.orgAddress.postal` vs `postalCode` mismatch ([P3](../../discovery/P3-context-builder.md) §0 / P4) so Templara templates do not silently blank.

## Stream D — Doc-type registry

<a id="d1"></a>

### D1 — Doc-type registry parity
**Depends on:** A2, B1  
**One-liner:** Register Templara types via `RDocumentTypeConfig` keyed by `objectKey`; return PDF bytes for attach/merge/sign/email ([P7](../../discovery/P7-document-process-integration.md)).

## Stream E — Design tokens

<a id="e1"></a>

### E1 — Host design-token inheritance
**Depends on:** none (can parallel)  
**One-liner:** Consume Zinnia CSS vars on `:root`; `HostDesignTokens` prop; disable Templara branding when embedded ([P6](../../discovery/P6-design-tokens.md)).

## Stream F — Editor UX

<a id="f1"></a>

### F1 — Editor UX field-test fixes (batch)
**Depends on:** none (can parallel after contracts)  
**One-liner:** Address [embedding-field-test-issues.md](../../embedding-field-test-issues.md) priorities: dropdowns, preview button, default toggles off, layer names, large-schema search, diagnostics visual.

### F2 — Remaining user-guide screenshots
**Depends on:** F1 (prefer after UX stabilizes)  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.
