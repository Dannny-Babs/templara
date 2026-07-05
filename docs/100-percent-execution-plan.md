# Templara 100 Percent Execution Plan

This is the principal-level continuation plan for Templara. It is written so another agent can continue the work without needing the chat context.

## Current Progress Estimate

These estimates separate the near-term MVP from the larger platform vision.

| Area | Estimate | Meaning |
| --- | ---: | --- |
| Editor shell | 85% | The fixed viewport, one-page canvas, tool rail, layers, data panel, inspector, preview overlay, grid/rulers/guides, selection, and dropdown shell are mostly in place. |
| Renderer/document semantics | 55-60% | Repeats, grids, sections, stacks, conditionals, visibility logic, formulas, and pagination exist, but measurement, keep-together, split rules, diagnostics, and export-grade determinism need hardening. |
| Data mapping and binding UX | 60% | Searchable grouped data explorer, scoped repeat fields, variable fields, click/drag binding, and inspector data reuse exist. Field insertion and schema authoring still need work. |
| Visual logic | 35-40% | Logic tab, visible-if, repeat filters, field fallback/formatting, and computed variables exist. A full expression builder and visual logic system do not yet exist. |
| PDF/export | 15-20% | Preview is strong enough to become the export source, but real export actions, presets, vector output, and export diagnostics remain unfinished. |
| Package/embed readiness | 25-30% | The monorepo shape is right, but public APIs, migrations, examples, docs, and publishing discipline are not complete. |
| MVP overall | 60-65% | Enough foundation exists to make Templara usable after focused editor interactions, export, and engine hardening. |
| Full platform vision | 25-30% | The larger document operating system vision still needs reusable components, visual logic, asset systems, template libraries, validation, and packaging. |

## Product Definition

Templara is a browser-native document runtime and visual authoring platform for structured business documents.

It is not just a design canvas and not just a renderer. It is the combination of:

- a JSON document language
- a Figma-like editor
- a deterministic renderer
- a visual data mapping layer
- a visual logic layer
- export surfaces
- embeddable packages

The core product promise is:

```txt
Design once.
Bind to structured data.
Render deterministic business documents.
```

Target documents:

- invoices
- shipment bills of lading
- receipts
- paystubs
- shipping labels
- delivery notes
- certificates
- statements and operational reports

## Non-Negotiable Architecture Rules

These rules should stay stable unless there is a deliberate architectural review.

1. Template JSON is the source of truth.
2. The editor does not use final rendering for its design canvas.
3. The editor shows authored nodes, handlebars, and one repeat template row.
4. Preview/export resolves data, evaluates logic, expands repeats, paginates, and reports diagnostics.
5. Renderer APIs remain deterministic and side-effect-free.
6. Runtime logic uses structured expressions only. No arbitrary JavaScript evaluation.
7. Metadata-only controls must be visibly editor-only or disabled.
8. Pointer interactions commit to history once per gesture, not on every pointer move.
9. Data schema and sample data are inputs to editor UX; renderer must still render from template + data alone.
10. Package boundaries matter. Do not leak editor-specific behavior into renderer APIs.

## Package Responsibilities

### `@templara/core`

Owns the document language:

- template schema
- page presets
- node types
- bindings
- variables
- structured expressions
- field formats
- validation
- migrations
- command types later

Next hardening:

- add schema versioning and migrations
- add validation for required node fields
- add validation for binding paths and variable cycles
- define stable public types for embedders
- add fixtures for old-template compatibility

### `@templara/renderer`

Owns final output planning:

- variable resolution
- formula resolution
- binding resolution
- conditional evaluation
- repeat filtering
- repeat expansion
- grid/section/stack flow layout
- measurement
- pagination
- warnings and diagnostics
- render tree output

The renderer should not know about selection, tools, panels, editor metadata UI, or React.

### `@templara/react-renderer`

Owns browser rendering of the render tree:

- document preview
- debug overlays
- page surfaces
- code visual rendering hooks
- export-preview display

This package can become the browser-first export source.

### `@templara/editor`

Owns authoring:

- editor-only page model
- insert tools
- selection
- drag/resize/rotate
- snapping/guides/rulers
- layers
- data explorer
- inspector
- visual logic authoring
- history transactions
- keyboard shortcuts

The editor should write valid template JSON, not hidden runtime state.

### `@templara/pdf`

Owns export:

- browser-first PDF export
- export presets
- print-safe page setup
- later vector PDF backend
- later server/CLI export support

### `@templara/templates`

Owns examples:

- invoice
- shipment BOL
- receipt
- paystub
- shipping label
- sample data
- data schemas
- domain-specific computed examples

## 100 Percent Definition

Templara reaches 100% for the current product cycle when a user can:

1. Open Studio.
2. Pick a template such as invoice or BOL.
3. Design one or more pages.
4. Insert text, images, shapes, barcode/QR, repeat sections, grid/table sections, and containers.
5. Bind fields from a structured data explorer.
6. Author repeat filters, visible-if rules, field fallback/formatting, and computed variables.
7. Resize, duplicate, delete, align, group, nudge, lock, hide, and reorder nodes.
8. Preview with sample data.
9. See clear diagnostics for pagination, overflow, missing data, invalid formulas, and export issues.
10. Export a correct PDF from the browser.
11. Save/load template JSON.
12. Embed the editor or renderer in another app using documented package APIs.

## Milestones

### Milestone 1: Finish Editing Operations

Goal: make the canvas feel like a real design tool.

Build:

- resize handles on selected nodes
- multi-node resize constraints
- delete keyboard shortcut
- duplicate keyboard shortcut
- nudge with arrow keys
- shift-nudge
- z-order actions
- lock/unlock behavior
- hide/show behavior
- group/ungroup
- marquee selection
- pan tool
- zoom around cursor
- cursor-specific tool states

Acceptance:

- every visible selected node can be resized
- resize commits one history entry per gesture
- delete/duplicate works from keyboard and inspector
- locked nodes cannot be moved/resized
- hidden nodes remain represented in layers
- multi-select has predictable bounding box behavior

Files to start:

- `packages/editor/src/index.ts`
- `packages/editor/src/editorModel.ts`
- `packages/editor/src/editorModel.test.ts`

### Milestone 2: Harden History And Command Semantics

Goal: all editing writes are safe, undoable, and coalesced.

Build:

- central command helpers for template mutations
- transaction naming
- coalescing for sliders and drags
- one history entry per text field commit
- undo/redo keyboard shortcuts
- redo after undo
- history invalidation when external `value` changes
- tests for commit behavior

History algorithm:

```txt
begin gesture or field edit
  capture template snapshot
  apply optimistic draft updates locally
end gesture or commit
  if changed:
    push original snapshot to past
    clear future
    emit onChange if needed
cancel gesture
  restore original snapshot
```

Acceptance:

- pointer move does not create many undo entries
- typing in inspector does not re-render preview per keystroke
- undo restores selection-safe template state
- redo reapplies the change

### Milestone 3: Complete Inspector Reality

Goal: no fake controls and no misleading editor-only controls.

Build:

- page size selector backed by page size
- orientation switch backed by page size
- margin editors backed by page margin
- full text typography backed by `TextStyle`
- text overflow controls backed by schema
- image source controls for URL, binding, and assets
- barcode/QR format controls backed by schema
- repeat layout controls backed by `RepeatNode.layout`
- repeat pagination controls backed by renderer-supported behavior
- metadata-only controls either disabled, hidden, or clearly editor-only

Acceptance:

- every enabled control changes preview/export, template JSON, or explicitly editor-only state
- `Logic` tab contains render-affecting logic
- `Advanced` tab contains metadata, lock/visible, diagnostics, and editor-only settings
- multi-select inspector shows only safe shared controls

### Milestone 4: Data Mapping V2

Goal: binding should feel intuitive instead of path-entry-heavy.

Build:

- nested tree explorer with expand/collapse
- schema badges for text/number/date/boolean/image/array/object
- repeat scope banner: `Current Scope: item`
- drag field into existing text at caret
- field chips inside text editing UI
- sample data editor with validation
- schema editor for adding fields
- missing-binding diagnostics
- variable group with computed variable badges

Scope algorithm:

```txt
for selected node:
  walk ancestors from node to page root
  collect nearest repeat/grid binding
  if repeat ancestor exists:
    scope alias = repeat.itemAlias
    show Current Scope fields from array item shape
  show Document Data below scoped fields
  show Variables separately
```

Binding application rules:

- Text: insert or replace first `FieldRun`
- Repeat: update `node.binding.path`
- Grid: update `node.binding.path`
- Image: update `node.source`
- Barcode/QR: update `node.value`
- No selection: create bound text node on active page
- Multi-select: disable direct binding

Acceptance:

- designers can bind common fields without typing paths
- repeat children show `item.*` choices
- variables are clearly distinct from source data
- sample changes update preview predictably

### Milestone 5: Visual Logic V2

Goal: logic becomes a product feature, not a raw form.

Build:

- expression builder with field, operator, value/source picker
- condition templates: exists, equals, greater than, contains, date before/after
- repeat filters with scoped fields
- formula builder for sum/count/arithmetic/concat
- formatting builder for currency/date/number/text transform
- fallback rules
- logic diagnostics
- logic preview sample: show whether selected node passes/fails

Expression model stays structured:

```ts
ExpressionRef = {
  source: string;
  operator?: ExpressionOperator;
  value?: unknown;
  compareSource?: string;
}
```

No arbitrary JavaScript strings.

Formula resolver algorithm:

```txt
resolve variable(id):
  if id in stack:
    warn variable.cycle
    return ""
  push id
  resolve DynamicValue
  pop id

resolve formula:
  count(path): resolve path values and count non-null entries
  sum(path): collect path values and sum numeric entries
  arithmetic: resolve operands as numbers
  concat: resolve operands as strings
```

Acceptance:

- logic rules are understandable by non-programmers
- invalid logic produces warnings, not crashes
- preview/export faithfully evaluates logic
- editor canvas still keeps nodes editable

### Milestone 6: Renderer Hardening

Goal: make output reliable for real operational documents.

Build:

- stronger text measurement
- deterministic line wrapping
- font load coordination
- mixed-height repeat rows
- repeat headers on continuation pages
- keep-together rules
- split row policy
- nested repeat policy
- grid/table pagination
- section break-before/break-after
- overflow warnings with exact node IDs
- render debug data for every decision
- performance targets for large arrays

Repeat pagination algorithm:

```txt
input repeat node, source items, flow cursor
filter items using repeatItemIf
for each item:
  create row scope { alias, loop }
  measure fixed height and minimum height
fit first page:
  use available height from cursor to flow bottom
  fit fixed rows
  if fillAvailableSpace:
    distribute extra space up to max expansion
  if rowSizing compact:
    compress down to minimums if useful
for overflow:
  create continuation pages
  repeat header if enabled
  place rows until page full
emit:
  render nodes
  repeat analysis
  warnings
```

Text measurement algorithm:

```txt
load declared fonts
for each text node:
  resolve inline content
  apply field formats/fallbacks
  measure with browser canvas or DOM range
  wrap by available width
  compute line count and height
  cache by text/style/width
```

Acceptance:

- BOL and invoice render correctly with small and large datasets
- renderer warnings are actionable
- same input produces same render tree
- large repeats remain performant

### Milestone 7: Export V1

Goal: real browser-first PDF export.

Build:

- export button wired from Preview dropdown
- PDF export surface uses rendered preview pages
- print CSS with exact page sizes
- page background preservation
- font readiness before export
- barcode/QR readiness before export
- export diagnostics before download
- file name generation
- export preset model

Browser-first export algorithm:

```txt
render template with data
wait for fonts and generated codes
open isolated export surface
apply print CSS page sizes
call browser print/download workflow
surface diagnostics and warnings
```

Later vector backend:

```txt
render tree
map px to PDF points
draw text/images/shapes/codes with PDF library
embed fonts
write PDF bytes
```

Acceptance:

- user can download a PDF from Studio
- exported pages match preview visually
- page sizes are correct
- export warns before downloading when data/layout is invalid

### Milestone 8: Template Library And Business Semantics

Goal: make Templara useful for real business documents, not only demos.

Build templates:

- invoice
- shipment BOL
- receipt
- paystub
- shipping label
- packing slip
- certificate
- statement/report

Business primitives to consider:

- Party block
- Address block
- Money block
- Totals block
- Signature block
- Code block
- Terms block
- Line-item table
- Tax breakdown
- Page footer
- Document metadata block

Business logic examples:

- invoice subtotal = sum line totals
- item count = count line items
- hide hazmat block unless any row is hazmat
- show payment QR only if payment URL exists
- paystub net pay = gross - deductions
- receipt tax lines by jurisdiction

Acceptance:

- each template has sample data, schema, variables, preview fixture, and export fixture
- templates prove renderer capabilities rather than hiding missing features

### Milestone 9: Components And Reuse

Goal: documents become composable systems.

Build:

- component definition model
- component instance node
- slots
- overrides
- shared styles
- design tokens
- asset library
- template includes
- component update strategy

Component model direction:

```txt
ComponentDefinition
  id
  name
  inputs
  nodes
  slots

ComponentInstanceNode
  componentId
  props
  slotOverrides
```

Acceptance:

- user can define a reusable company header
- user can reuse it across invoice/BOL/receipt templates
- component changes can propagate safely

### Milestone 10: Package And Embed Readiness

Goal: Templara can be installed and used by other products.

Build:

- stable package exports
- public `DocumentEditor`
- public `DocumentPreview`
- public renderer API
- migration API
- validation API
- example embedded editor
- example render-only service
- docs for React integration
- docs for template JSON
- package naming decision
- npm publishing setup

Public API shape:

```ts
renderDocument({ template, data, mode, fontFamily })
validateTemplate(template)
migrateTemplate(template)
<DocumentEditor value data onChange onDataChange />
<DocumentPreview document />
```

Acceptance:

- external app can embed editor
- external app can render template without editor
- package docs are enough for a new developer to start

### Milestone 11: Testing And Quality Gates

Goal: product confidence comes from tests, fixtures, and browser verification.

Required checks:

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

Add:

- renderer fixture tests
- editor model tests
- inspector helper tests
- data explorer scope tests
- browser screenshot checks
- PDF visual regression checks
- large-data performance tests
- schema migration tests
- invalid template tests

Browser verification checklist:

- body does not scroll
- left panel scrolls independently
- right inspector scrolls independently
- canvas remains centered
- editor shows one page
- preview shows paginated output
- dropdowns are visible and not clipped
- resize handles work
- bindings insert correctly
- logic affects preview but not editor editability
- export downloads correct pages

### Milestone 12: Security And Safety

Goal: safe rendering from untrusted data.

Rules:

- never evaluate arbitrary JavaScript from templates
- treat data as data, not HTML
- sanitize text output
- restrict formula language to structured operations
- validate image URLs/assets
- restrict barcode/QR input size if needed
- prevent prototype pollution from template/data paths
- avoid leaking secrets through template examples
- make export deterministic and local unless explicitly configured

Acceptance:

- no `eval`
- no template-provided functions
- no raw HTML injection path
- invalid formulas produce warnings
- malformed templates fail validation before rendering

## Immediate Next 10 Tasks

Do these in order.

1. Add resize handles for single selected nodes.
2. Add delete and duplicate keyboard shortcuts.
3. Add nudge and shift-nudge keyboard movement.
4. Add resize transaction tests and history coalescing tests.
5. Add real PDF export button from the Preview dropdown.
6. Add export diagnostics panel in preview.
7. Add text field chip insertion at caret.
8. Add repeat header and keep-together controls backed by renderer behavior.
9. Add renderer fixtures for invoice and BOL with small/large data.
10. Add template validation and migration scaffolding in `@templara/core`.

## Agent Handoff Instructions

Before editing:

```sh
cd /Users/danielbabalola/code/personal/practice/templara
git status --short
pnpm run typecheck
pnpm run test
```

When editing:

- prefer small vertical slices
- use existing package boundaries
- add tests for engine changes
- mark metadata-only controls clearly
- do not reintroduce renderer-based editor canvas rendering
- do not expand repeats in editor mode
- do not add arbitrary expression strings

Before handing back:

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

Known recurring warnings:

- pnpm warns about the committed Hugeicons auth token setting in `.npmrc`
- Vite warns about large chunks in Studio/Playground

These warnings are not current blockers, but should be cleaned up before package publishing.

## The Correct Next Product Bet

The next big value is not more UI polish. It is making Templara feel alive:

```txt
Visual Layout
  +
Visual Data
  +
Visual Logic
  +
Deterministic Export
```

After resize/keyboard/export basics, prioritize document semantics and logic over cosmetic refinements.
