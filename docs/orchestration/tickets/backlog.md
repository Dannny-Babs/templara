# Backlog stubs (post–Wave 5)

Planner expands remaining stubs into full §6 tickets when scheduled.

**Done (see [README.md](README.md)):** Waves 1–6 on `main`; Wave 7 F5v data-panel virtualization (this branch).

**Host-owned (ticket/spec only here):** [D1](D1-doc-type-registry.md), [B2](B2-host-generate-document.md), [H1](H1-document-generator-discovery.md). Host still must wire live records into `DocumentEditor` `data` (A3 host half). See [host-integration-guide.md](../host-integration-guide.md).

## Stream F — Editor UX (remaining polish)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Status:** in progress (Wave 7)  
**Depends on:** F1  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.

<a id="f6"></a>

### F6 — Preview button chrome polish
**Status:** done (Wave 6)  
**Ticket:** [F6-preview-button-chrome.md](F6-preview-button-chrome.md)  
**Field-test:** §1.4–1.5  

<a id="f5-virtualize"></a>

### F5 follow-up — Data panel virtualization
**Status:** done (Wave 7)  
**Ticket:** [F5v-data-panel-virtualization.md](F5v-data-panel-virtualization.md)  
**Depends on:** F5  
**One-liner:** Windowed rendering when flattened rows ≥ 60.

### F1.12 — Resizable left panel
**Status:** done (Wave 6)  
**One-liner:** Layers/data column drag-resize (220–480px), same pattern as the right inspector.

## Stream A — Host follow-up

<a id="a3-host"></a>

### A3 host — Live record on canvas
**Status:** backlog (host)  
**Depends on:** [A3](A3-real-record-preview.md) Templara seam  
**One-liner:** Resolve invoice/order context in the host and pass `preparePreviewData(context)` into `DocumentEditor` `data`; prove IDs resolve.
