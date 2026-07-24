# Backlog stubs (post–Wave 3)

Planner expands remaining stubs into full §6 tickets when scheduled. Wave 3 shipped G2 + C3; D1/E1/F1 are full tickets in this folder (ready for Wave 4).

**Done (see [README.md](README.md)):** Wave 1 A1/A2/G0/G1; Wave 2 C1/C2/B0/B1; Wave 3 G2/C3.

## Stream A — Data binding (remaining)

<a id="a3"></a>

### A3 — Real-record preview wiring (host)
**Depends on:** A2  
**One-liner:** In the host embed, feed `extractBindings` → `toRecordContextPaths` → host `buildRecordContext` / `$byIdOrThrow` into Templara preview data; prove a real invoice record fills the canvas without sample placeholders. Prefer after C3 so org postal aliases are applied in the host adapter.

## Stream B — Server render (A′-lite) remaining

<a id="b2"></a>

### B2 — Host POST integration for generate-document
**Depends on:** B1, H1 (fidelity unknowns)  
**One-liner:** Wire platform-model (or embed host) to SSR Templara → HTML → existing document-generator PDF/preview routes; preserve auth and options (`showPageNumbers`, Letter). Do not invent POSTs inside the Templara monorepo.

## Stream F — Editor UX (remaining after F1)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Depends on:** F1 (prefer after UX stabilizes)  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.

### F3 — Dropdown / layer / diagnostics UX (later)
**Depends on:** F1  
**One-liner:** Remaining [embedding-field-test-issues.md](../../embedding-field-test-issues.md) rows not covered by F1 Option A/B (dropdowns 1.1–1.3, UUID layer names 1.7, diagnostics visual 1.15, large-schema search). Split into narrow tickets before execution.
