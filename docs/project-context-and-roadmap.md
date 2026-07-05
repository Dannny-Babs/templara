# Project Context And Roadmap

This document summarizes the working context from the current build conversation and the remaining work.

## Original Product Idea

The project started from the idea of a visual document/template builder that combines:

- Canva/Figma-style freeform editing
- JSON-backed templates
- data binding
- array/repeat rendering
- deterministic document preview/export

The motivating examples were documents like:

- receipts
- invoices
- shipment BOLs
- paystubs
- labels
- structured business documents

The major challenge identified early was that this is not just a normal webpage or HTML-table builder. It is a layout engine plus a design editor plus a renderer/export system.

## Core Decisions Made

### JavaScript / TypeScript Stack

We chose a JavaScript/TypeScript direction because it matches the browser-first product and the user's familiarity.

The repo is a PNPM/Turborepo-style monorepo with apps and packages.

### Pixels As Document Units

We chose document pixels as the internal unit.

```txt
Letter = 816 x 1056 px
A4     = 794 x 1123 px
```

This keeps the editor natural for browser canvas positioning. PDF point conversion can happen at export boundaries.

### JSON Templates As Source Of Truth

We chose JSON templates over HTML templates for authoring.

Reason:

- easier to validate
- easier to migrate
- easier to diff
- easier to package
- easier to render deterministically
- better fit for editor state

HTML can become an output/export format later.

### Editor And Preview Separation

This was a major architectural decision.

The editor must show authored template structure.

The preview must show resolved rendered output.

That means:

- editor shows one page
- preview can show many pages
- editor does not paginate
- preview paginates
- editor shows one repeat row/template
- preview expands repeat arrays
- editor shows handlebars
- preview resolves sample data

This separation is now implemented in the editor architecture.

## Repository Created

Current repo:

```txt
/Users/danielbabalola/code/personal/practice/templara
```

Current package/app structure:

```txt
apps/
  studio/
  playground/
  docs/

packages/
  core/
  renderer/
  react-renderer/
  editor/
  pdf/
  assets/
  templates/
  cli/
```

## What Has Been Built

### Core Schema

Implemented in `@templara/core`.

Current concepts:

- document template
- pages
- page presets
- page layers
- fixed nodes
- flow nodes
- text nodes
- image nodes
- shape nodes
- barcode nodes
- QR nodes
- group/frame nodes
- repeat nodes
- grid nodes
- binding refs
- dynamic values
- data schema fields

### Renderer

Implemented in `@templara/renderer`.

Current capabilities:

- resolves bindings
- renders text/image/shape/code nodes into a render tree
- expands repeats
- lays out repeat rows
- calculates row fit in available space
- paginates overflow repeat rows
- returns warnings and repeat-fit analysis
- supports font metadata
- includes tests for renderer behavior

The renderer is still early, but it has the important foundation for dynamic repeat documents.

### React Renderer

Implemented in `@templara/react-renderer`.

Current capabilities:

- displays render tree in browser
- supports preview surface
- supports debug overlay concepts
- loads render fonts

### Editor Model

Implemented in `@templara/editor`.

Current capabilities:

- editor-only page model
- active page rendering
- authored nodes only
- no renderDocument call for the design canvas
- one repeat template row in editor mode
- flow region children rendered without pagination in editor mode
- tests for editor page model and alignment behavior

### Editor UI

Current editor UI includes:

- fixed viewport app shell
- top toolbar
- left insert rail
- left layers panel
- left data panel
- center canvas viewport
- right contextual inspector
- bottom-left canvas dock
- bottom-center page switcher
- full-screen preview overlay

Recent UI improvements:

- icon-only insert toolbar
- Hugeicons-based toolbar icons
- delayed insert rail tooltips
- keyboard shortcuts for insert tools
- dedicated QR/barcode layer icons
- Google Fonts Geist and Geist Mono setup
- preview split button and dropdown UI
- more/options menu
- contextual right inspector sections
- data schema search
- copy binding path
- insert binding path into selected node

### Template

Current main template:

- Shipment BOL

It includes:

- business fields
- BOL metadata
- shipper/recipient/delivery cards
- handling units repeat
- instructions
- totals
- barcode and QR nodes
- signature/terms sections

This template replaced the earlier invoice/receipt direction as the active stress-test document.

## Current Handoff State

The preview and zoom dropdowns now use measured fixed-position menu placement so they are not dependent on toolbar overflow or panel stacking.

The strongest continuation reference is:

- [100 percent execution plan](100-percent-execution-plan.md)

That document includes the current progress estimate, package responsibilities, algorithms, milestone order, acceptance criteria, and handoff rules for another agent.

## What Is Left Overall

### 1. Fix Preview Dropdown Interaction

This is the immediate known bug.

Expected behavior:

- clicking main Preview opens preview
- clicking chevron opens dropdown
- dropdown is visible above the canvas
- dropdown is not clipped by toolbar overflow
- dropdown closes after selecting an action

### 2. Finish Right Inspector Behavior

The inspector is now sectioned and contextual, but it still needs deeper real controls.

Remaining inspector work:

- real collapsible state persistence
- page size selector
- orientation switch
- margin editors
- page background editor
- font picker
- text alignment icons
- color swatches/picker
- repeat header controls backed by schema
- keep-together controls backed by schema
- barcode human-readable metadata
- QR/barcode format options
- image source controls
- group/frame controls

### 3. Make Data Binding More Intuitive

The data panel now lists and filters schema fields, but the next level should include:

- grouped field tree
- better visual hierarchy for nested fields
- repeatable array badges
- drag field onto canvas
- drag field into selected text node
- visual field chips
- binding insertion cursor behavior for text nodes
- schema diagnostics
- sample data viewer

### 4. Add Real Editing Operations

Current editing is still basic.

Needed:

- resize handles
- rotate controls
- duplicate
- delete
- nudge with arrow keys
- shift-nudge
- z-order controls
- lock/unlock
- hide/show
- group/ungroup
- better selection bounding boxes
- marquee selection
- history undo/redo

### 5. Improve Canvas Tools

Needed:

- hand/pan tool
- zoom-to-fit refinement
- zoom around cursor
- draggable guides from rulers
- guide deletion
- snap indicators
- alignment guide labels
- better grid density at zoom levels

### 6. Improve Repeat/Layout Engine

Renderer repeat logic is one of the most important hard parts.

Needed:

- stronger measurement strategy
- support mixed row heights
- support repeat headers on continuation pages
- keep-together semantics
- better compression/expansion rules
- row splitting rules
- overflow diagnostics
- nested repeat policy
- larger test fixtures

### 7. Add Export Workflows

Needed:

- working PDF export button
- browser print/PDF workflow
- saved export presets
- PNG export
- HTML export
- export diagnostics view
- eventual vector PDF backend

### 8. Package And Embed Strategy

The long-term goal includes making this installable and embeddable.

Needed:

- stable public package APIs
- package build outputs
- README usage examples
- versioning strategy
- template migration strategy
- example embedded editor app
- example render-only app
- npm package naming and publishing plan

### 9. Template Library

More templates should be added after the BOL is solid.

Good next templates:

- invoice
- receipt
- paystub
- shipping label
- delivery note
- certificate
- statement/report

## Current Technical Checks

Recent checks have passed:

```txt
pnpm run typecheck
pnpm run test
pnpm run build
```

Build warnings remain about large Vite chunks. That is acceptable for now, but code splitting should be revisited later.

## Current Design Direction

The editor should continue moving toward a Figma-like product feel:

- quiet UI
- dense but readable panels
- icon-first tools
- fixed viewport
- independently scrollable panels
- contextual inspectors
- canvas docks
- predictable selection and snapping

Avoid:

- marketing-style pages
- card-heavy decorative layouts
- editor rendering final resolved data
- expanding repeat rows in the editor canvas
- generic form dumps in the inspector

## Recommended Next Work

Recommended next order:

1. Add resize handles for selected nodes.
2. Add delete, duplicate, nudge, and shift-nudge keyboard shortcuts.
3. Harden history transactions so drag/resize/slider gestures commit one undo entry.
4. Add real PDF export from the Preview dropdown.
5. Add export diagnostics in the preview surface.
6. Improve binding insertion into existing text nodes.
7. Back more inspector controls with schema-supported renderer behavior.
8. Add template validation and migration scaffolding in `@templara/core`.

The next best practical step is resize handles plus keyboard editing operations, because they move the editor from a template viewer/editor into a real design tool.
