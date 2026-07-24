### TASK F4 — Human-readable layer names
**Status:** done (Wave 5)  
**Stream:** F — Editor UX   **Depends on:** F1  
**Field-test:** §1.7 (P0 UX)  
**Branch:** `integration/rr-doc-builder-2-wave5`

**Context (why):**  
Layer tree used `node.name ?? humanizeId(node.id)`, so UUID keys became primary titles on host-authored templates.

**Shipped:**
1. `friendlyLayerLabel(node)` — prefers `name`, then content/type-aware fallbacks (text content, grid/section/stack/repeat labels), then `Type · shortId` for UUID-ish ids.
2. Wired through `collectPageNodeItems`, canvas render labels, and inspector titles.
3. Page rows prefer authored `page.name`.
4. Unit tests for UUID templates.

**Acceptance:**
- [x] UUID ids are never the primary layer title.
- [x] Studio starters with friendly names unchanged in spirit.
- [x] Tests cover authored name, content fallback, and short-id fallback.
