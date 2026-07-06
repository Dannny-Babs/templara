# Templara Launch Readiness

This document defines the readiness bar for the current local-demo product cycle. It is intentionally stricter than “the app builds.” Templara is launch-ready only when a user can create, bind, preview, save, reload, and export structured business documents without editing template JSON by hand.

## Current Launch Target

The target is a strong browser-local demo and embeddable package foundation:

- no auth
- no cloud sync
- no collaboration
- no npm publish yet
- no server-rendered PDF pipeline yet

Studio owns project persistence, template library, diagnostics, and saved state. `DocumentEditor` remains the controlled editor surface. Renderer packages remain responsible for final data resolution, logic evaluation, repeat/grid expansion, pagination, and render warnings.

## Ready Now

- Blank project opens by default.
- Projects can be created from Blank, Invoice, Shipment BOL, Receipt, Pay Stub, and Shipping Label starters.
- Local project persistence supports save, reload, duplicate, delete, import, and export.
- Editor canvas is separate from preview/export and shows authored template structure only.
- Inline text editing commits to `TextNode.content`.
- Copy/paste, duplicate, delete, group/ungroup, reorder, nudge, resize, and undo/redo are available.
- Data explorer supports schema/sample/variable/scope fields.
- Sample JSON and schema authoring are available.
- Fields can be clicked or dragged onto canvas; array fields can create bound grids.
- Inspector has Layout, Data, Advanced, and Logic surfaces.
- Visual logic V1 supports visibility, repeat filters, text value rules, and computed variables through structured expressions.
- Tables are grid nodes, not HTML tables. They support static rows, bound columns, cell styling, header/footer toggles, row height, canvas cell targeting, and column boundary resizing.
- Unified diagnostics aggregate template validation, render warnings, and export preflight diagnostics.
- Preview/export remains renderer-owned.

## Required Gate Before Calling This Launchable

Run these from the repo root:

```sh
CI=true pnpm run typecheck
CI=true pnpm run test
CI=true pnpm run build
git diff --check
```

Then run one browser pass against Studio:

1. Open a blank project.
2. Add text, edit inline, undo and redo.
3. Paste sample JSON and infer schema.
4. Drag a primitive field onto the canvas.
5. Drag an array field onto the canvas and create a bound grid.
6. Select the grid, resize a column boundary, select a cell target, and confirm child text remains selectable.
7. Add a computed variable.
8. Add a visible-if rule or repeat filter.
9. Open Preview and confirm data resolves.
10. Open export preflight.
11. Save, reload, and reopen the project.
12. Confirm the body does not scroll and panels scroll independently.

## Known Risks

- Browser PDF export is still browser-first and should be treated as a V1 export path, not the final vector/export service.
- Grid cell targeting is editor chrome over real grid templates. It does not introduce first-class cell nodes.
- Diagnostics are useful but not exhaustive. More validation-path-to-node mapping is needed.
- Large-document pagination needs broader golden coverage before production commitments.
- Local storage is sufficient for demo persistence but should move behind IndexedDB/server storage before binary assets or customer data.
- Public package APIs are documented for local use but not ready for npm publishing guarantees.

## Shortest Path To Green

1. Keep the renderer/editor split intact.
2. Fix any failing local checks before adding product scope.
3. Add golden browser workflows for Blank, Invoice, Shipment BOL, Receipt, Pay Stub, and Shipping Label.
4. Harden export preflight and missing-binding diagnostics.
5. Stabilize public package examples and package metadata.
6. Only after those gates, consider npm publishing or cloud productization.
