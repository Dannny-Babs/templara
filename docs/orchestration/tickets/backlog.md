# Backlog stubs (post–Wave 2)

Planner expands these into full §6 tickets in a later pass. One-liners + depends-on only.

**Wave 2 (in tickets/):** C1, C2, B0, B1 — see [README.md](README.md).

## Stream A — Data binding (remaining)

<a id="a3"></a>

### A3 — Real-record preview wiring (host)
**Depends on:** A2  
**One-liner:** In the host embed, feed `extractBindings` → `toRecordContextPaths` → host `buildRecordContext` / `$byIdOrThrow` into Templara preview data; prove a real invoice record fills the canvas without sample placeholders.

## Stream G — Evals (remaining)

<a id="g2"></a>

### G2 — SSR golden / HTML fidelity harness
**Depends on:** G1, B1  
**One-liner:** After a Node-safe SSR-to-HTML entrypoint exists, compare Templara HTML (or normalized subset) against `docs/discovery/fixtures/invoice-rendered.html` / evals copy; no full invoice HTML golden in Wave 2 smoke.

## Stream B — Server render (A′-lite) remaining

<a id="b2"></a>

### B2 — Host POST integration for generate-document
**Depends on:** B1, H1 (fidelity unknowns)  
**One-liner:** Wire platform-model (or embed host) to SSR Templara → HTML → existing document-generator PDF/preview routes; preserve auth and options (`showPageNumbers`, Letter).

## Stream C — Value adapter (remaining)

<a id="c3"></a>

### C3 — Org address key mismatch guard
**Depends on:** C2  
**One-liner:** Capture/fix the known `org.orgAddress.postal` vs `postalCode` mismatch ([P3](../../discovery/P3-context-builder.md) §0 / P4) so Templara templates do not silently blank. (Formerly backlog “C2”; Wave 2 C2 is value-adapter helpers.)

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
