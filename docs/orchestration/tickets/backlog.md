# Backlog stubs (post–Wave 5)

Planner expands remaining stubs into full §6 tickets when scheduled.

**Done (see [README.md](README.md)):** Waves 1–3 on `main`; Wave 4 E1/F1; Wave 5 F3/F4/F5 + A3 Templara seam.

**Host-owned (ticket/spec only here):** [D1](D1-doc-type-registry.md), [B2](B2-host-generate-document.md), [H1](H1-document-generator-discovery.md). Host still must wire live records into `DocumentEditor` `data` (A3 host half).

## Stream F — Editor UX (remaining polish)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Depends on:** F1 (prefer after UX stabilizes)  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.

<a id="f6"></a>

### F6 — Preview button chrome polish
**Status:** backlog  
**Field-test:** §1.4–1.5  
**One-liner:** Clarify Preview control (chevron vs eye, sizing). Low priority vs F3/F4/F5; Preview itself already opens sample/large/export modes.

<a id="f5-virtualize"></a>

### F5 follow-up — Data panel virtualization
**Status:** backlog  
**Depends on:** F5  
**One-liner:** Windowed rendering if hosts still hitch when expanding thousands of schema rows after Wave 5 collapse/search.

## Stream A — Host follow-up

<a id="a3-host"></a>

### A3 host — Live record on canvas
**Status:** backlog (host)  
**Depends on:** [A3](A3-real-record-preview.md) Templara seam  
**One-liner:** Resolve invoice/order context in the host and pass `preparePreviewData(context)` into `DocumentEditor` `data`; prove IDs resolve.
