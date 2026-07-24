# Backlog stubs (post–Wave 5)

Planner expands remaining stubs into full §6 tickets when scheduled.

**Done (see [README.md](README.md)):** Waves 1–7 on `main`; Wave 8 diagnostics polish + D1 descriptor stub + host runbook (this branch).

**Host-owned execution:** Run [host-runbook.md](../host-runbook.md) in platform-components / document-generator. Tickets: [D1](D1-doc-type-registry.md), [B2](B2-host-generate-document.md), [H1](H1-document-generator-discovery.md), A3 host half.

## Stream F — Editor UX (remaining polish)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Status:** done (Wave 7–8)  
**Depends on:** F1  
**One-liner:** Screenshots wired; diagnostics dock captured in Wave 8.

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

### F1.15 — Diagnostics visual polish
**Status:** done (Wave 8)  
**One-liner:** Neutral dock chrome (no indigo “AI” look); screenshot in user guide.

## Stream A — Host follow-up

<a id="a3-host"></a>

### A3 host — Live record on canvas
**Status:** backlog (host) — prompts in [host-runbook.md](../host-runbook.md)  
**Depends on:** [A3](A3-real-record-preview.md) Templara seam  
**One-liner:** Resolve invoice/order context in the host and pass `preparePreviewData(context)` into `DocumentEditor` `data`; prove IDs resolve.
