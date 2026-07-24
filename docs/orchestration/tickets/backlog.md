# Backlog stubs (post–Wave 5)

Planner expands remaining stubs into full §6 tickets when scheduled.

**Done (see [README.md](README.md)):** Waves 1–5 Templara seams; Wave 6 F6 preview chrome + left-panel resize + [host integration guide](../host-integration-guide.md).

**Host-owned (ticket/spec only here):** [D1](D1-doc-type-registry.md), [B2](B2-host-generate-document.md), [H1](H1-document-generator-discovery.md). Host still must wire live records into `DocumentEditor` `data` (A3 host half). See [host-integration-guide.md](../host-integration-guide.md).

## Stream F — Editor UX (remaining polish)

<a id="f2"></a>

### F2 — Remaining user-guide screenshots
**Depends on:** F1 (prefer after UX stabilizes)  
**One-liner:** Capture the eight remaining Studio screenshots listed in [project-context-and-roadmap.md](../../project-context-and-roadmap.md) Docs & Onboarding Follow-ups.

<a id="f6"></a>

### F6 — Preview button chrome polish
**Status:** done (Wave 6)  
**Ticket:** [F6-preview-button-chrome.md](F6-preview-button-chrome.md)  
**Field-test:** §1.4–1.5  

<a id="f5-virtualize"></a>

### F5 follow-up — Data panel virtualization
**Status:** backlog  
**Depends on:** F5  
**One-liner:** Windowed rendering if hosts still hitch when expanding thousands of schema rows after Wave 5 collapse/search.

### F1.12 — Resizable left panel
**Status:** done (Wave 6)  
**One-liner:** Layers/data column drag-resize (220–480px), same pattern as the right inspector.

## Stream A — Host follow-up

<a id="a3-host"></a>

### A3 host — Live record on canvas
**Status:** backlog (host)  
**Depends on:** [A3](A3-real-record-preview.md) Templara seam  
**One-liner:** Resolve invoice/order context in the host and pass `preparePreviewData(context)` into `DocumentEditor` `data`; prove IDs resolve.
