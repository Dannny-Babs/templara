# Backlog stubs (post–Wave 4)

Planner expands remaining stubs into full §6 tickets when scheduled. Wave 4 shipped E1 + F1 (+ layers search / diagnostics chrome polish). D1 remains host-owned (ticket/spec only in this repo).

**Done (see [README.md](README.md)):** Wave 1 A1/A2/G0/G1; Wave 2 C1/C2/B0/B1; Wave 3 G2/C3; Wave 4 E1/F1.

## Stream A — Data binding (remaining)

<a id="a3"></a>

### A3 — Real-record preview contract (Templara seam + host wiring)
**Status:** backlog (Wave 5+)  
**Depends on:** A2, prefer after C3  
**Owner split:**
- **Templara (if any pure seam):** document/export a narrow preview-data contract (e.g. typed helper that accepts host-resolved `Record<string, unknown>` and does not synthesize sample placeholders). Do **not** invent host `buildRecordContext` / `$byIdOrThrow` inside this monorepo.
- **Host:** feed `extractBindings` → `toRecordContextPaths` → host context builder into `DocumentEditor` `data` / preview path; prove a real invoice record fills the canvas.

**Acceptance sketch:** real record IDs resolve on canvas; sample-data path remains opt-in for Studio.

## Stream B — Server render (A′-lite) remaining

<a id="b2"></a>

### B2 — Host POST integration for generate-document
**Status:** backlog (Wave 5+; **host-only**)  
**Depends on:** B1, H1 (fidelity unknowns)  
**One-liner:** Wire platform-model (or embed host) to SSR Templara → HTML → existing document-generator PDF/preview routes; preserve auth and options (`showPageNumbers`, Letter). Do **not** invent POSTs inside the Templara monorepo. Ticket/spec only here.

## Stream D — Doc-type registry

<a id="d1"></a>

### D1 — Doc-type registry parity
**Status:** ready (Wave 5 host execution) — see [D1-doc-type-registry.md](D1-doc-type-registry.md)  
**Note:** Templara may only add optional descriptor types/docs. Full `RDocumentTypeConfig` registration lives in the host. Keep as ticket/spec until host proof exists.

## Stream F — Editor UX (remaining after F1)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Depends on:** F1 (prefer after UX stabilizes)  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.

<a id="f3"></a>

### F3 — Dropdown / popover overflow + sizing
**Status:** backlog (Wave 5+)  
**Depends on:** F1  
**Field-test:** §1.1–1.3  
**One-liner:** Fix dropdown open/overflow/height so menus portal or clamp to viewport and use legible control sizing. Reproduce with a fixture + screen recording before coding; prefer a single clear root cause (anchored menu measure vs overflow:hidden ancestor).

<a id="f4"></a>

### F4 — Human-readable layer names (not UUID keys)
**Status:** backlog (Wave 5+)  
**Depends on:** F1  
**Field-test:** §1.7 (P0 UX)  
**One-liner:** Layer tree labels should prefer node name / content / type — never raw JSON UUID keys as the primary title. Keep ids available in tooltips or advanced views.

<a id="f5"></a>

### F5 — Large schema / data panel search & scale
**Status:** backlog (Wave 5+)  
**Depends on:** A3 preferred for real-record context; F1 layers search already shipped  
**Field-test:** §3.1, §3.7, §1.11 (data side)  
**One-liner:** Searchable, collapse-friendly data/schema tree for thousands of fields (hide `$` system keys, group connection sub-objects); measure search/selection latency against `fixtures/order-schema-sample.json`. Do not claim done without a perf check.

<a id="f6"></a>

### F6 — Preview button chrome polish
**Status:** backlog  
**Field-test:** §1.4–1.5  
**One-liner:** Clarify Preview control (chevron vs eye, sizing). Low priority vs F3/F4/F5; Preview itself already opens sample/large/export modes.
