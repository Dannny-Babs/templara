# Templara Product And System Overview

Templara is a browser-first visual document/template builder.

The product goal is to let someone design a business document with the freedom of a Figma or Canva canvas, bind that design to structured JSON data, and render deterministic outputs such as previews, PDFs, images, and eventually HTML exports.

The core idea is:

```txt
Design once.
Bind to data.
Render many documents.
```

Templara is not trying to be Google Docs, LibreOffice, or a normal HTML page editor. It is closer to a hybrid of:

- a design canvas for fixed visual layout
- a template language for data bindings
- a layout engine for repeats, flow regions, and pagination
- an export pipeline for preview/PDF/image/HTML output

## Product Model

Templara has two separate user experiences.

### Editor

The editor is where the user designs the template.

Editor rules:

- shows one active template page at a time
- displays authored nodes, not resolved sample data
- shows field bindings as handlebars like `{{shipment.bolNumber}}`
- shows repeat nodes as a single editable row/template frame
- does not paginate
- does not expand arrays into many generated rows
- behaves like a design tool, with layers, selection, guides, rulers, snapping, and inspectors

The editor should feel like a professional design surface, not a rendered document preview.

### Preview And Export

Preview/export is where template + data becomes final output.

Preview/export rules:

- resolves data bindings
- expands repeats
- applies pagination
- creates continuation pages
- runs renderer diagnostics
- prepares export surfaces such as PDF, PNG, and HTML

This separation is important. If the editor expands 100 repeat rows while designing, the canvas becomes noisy and difficult to edit. The editor should show the thing being designed. The renderer should show the final document.

## Current Template Target

The current working template is a Shipment BOL document.

It includes:

- business identity and contact fields
- bill of lading metadata
- shipper, recipient, and delivery address blocks
- handling units / commodities repeat section
- special instructions
- totals
- barcode and QR code nodes
- signature and terms areas

This template is being used as a stress test for the real system because it exercises the important hard parts:

- absolute layout
- field bindings
- generated codes
- repeat arrays
- flow positioning
- document-size constraints
- editor/preview separation

## Document Unit

The internal unit is a document pixel.

```txt
1 document px = 1 CSS px = 1/96 inch
1 PDF point = 1/72 inch
1 document px = 0.75 PDF points
```

Current page presets:

```txt
Letter: 816 x 1056 px
A4:     794 x 1123 px
```

The system starts in pixels because the editor is browser-first and the user is positioning nodes on a canvas.

## Template Format

Templates are JSON documents.

JSON is the source of truth because it is easier to parse, validate, migrate, diff, version, package, and render than freeform HTML.

The template contains:

- pages
- page size and margins
- layers
- nodes
- fonts
- assets
- variables
- data schema
- bindings
- repeat definitions
- layout metadata

HTML can become an export target later. It should not be the main authoring format.

## Node Types

The current document language includes these major node families.

### Fixed Visual Nodes

Fixed visual nodes live exactly where the designer placed them.

Examples:

- text
- image
- rectangle
- line
- shape
- barcode
- QR code
- group/frame

### Text Nodes

Text nodes support:

- literal text
- field runs such as `{{business.name}}`
- font family
- font size
- font weight
- line height
- alignment
- color
- overflow behavior

Current editor behavior shows bindings as handlebars. Preview resolves them with real data.

### Generated Code Nodes

Generated code nodes represent values that render into barcode or QR visuals.

Current supported concepts:

- barcode node
- QR node
- value binding
- barcode format
- position and size

The project uses safe package direction for code generation, with `bwip-js` already identified as the barcode-generation direction.

### Repeat Nodes

Repeat nodes are the core abstraction for arrays.

Example:

```txt
shipment.handlingUnits[]
```

Editor behavior:

- show one editable row/template instance
- show a repeat frame label
- show child bindings as handlebars
- do not expand all rows

Preview behavior:

- resolve the array
- measure each row
- calculate what fits in the available space
- continue rows on later pages when needed
- report diagnostics and warnings

### Flow Regions

Flow regions are where dynamic content can grow and paginate.

Editor behavior:

- show the flow region frame
- render authored children in their authored positions
- do not paginate

Renderer behavior:

- lays out dynamic flow content
- measures rows and text
- handles available page space
- creates continuation pages

## Data Binding

Templara binds to structured JSON data.

Example binding paths:

```txt
business.name
shipment.bolNumber
shipment.handlingUnits
shipment.recipient.address
shipment.totals.weight
```

The editor should make bindings intuitive for both designers and developers.

Supported UI direction:

- visual field chips later
- handlebars in the design canvas today
- searchable data panel
- copy binding path
- insert binding into selected node
- repeatable fields clearly marked

## Renderer Pipeline

The renderer is deterministic. It accepts a template and data, then returns a render tree.

Current conceptual pipeline:

```txt
Template JSON
    +
Data JSON
    |
Validate / normalize
    |
Resolve variables and bindings
    |
Expand conditionals
    |
Expand repeats
    |
Measure content
    |
Layout flow regions
    |
Paginate
    |
Produce render tree
    |
React preview / PDF export / diagnostics
```

The editor must not call the renderer for its design canvas. The editor has its own editor-page model that reads authored page nodes directly.

## Current Package Architecture

```txt
apps/
  studio/              main visual editor product
  playground/          renderer/template experiments
  docs/                documentation site shell

packages/
  core/                document schema, node types, page presets, bindings
  renderer/            template + data -> paginated render tree
  react-renderer/      render tree -> React DOM/SVG preview
  editor/              editor canvas, tools, layers, inspector, data panel
  pdf/                 browser-first PDF export direction
  assets/              fonts/images/assets helper package
  templates/           starter templates and sample data
  cli/                 future command-line rendering/export package
```

## Package Responsibilities

### `@templara/core`

Owns the document language:

- document schema
- node types
- bindings
- dynamic values
- page presets
- data schema types
- future migrations and validation

### `@templara/renderer`

Owns final document rendering:

- binding resolution
- repeat expansion
- flow layout
- pagination
- generated-code values
- render diagnostics
- warnings

### `@templara/react-renderer`

Owns browser display of the render tree:

- rendered document preview
- debug overlays
- visual output surface for preview/export

### `@templara/editor`

Owns design-time editing:

- single-page editor model
- insert tools
- selection
- layer panel
- data panel
- inspector
- dragging
- snapping
- guides
- rulers
- editor-only repeat display

### `@templara/templates`

Owns starter documents and sample data:

- Shipment BOL template
- template font metadata
- sample data schema

### `@templara/pdf`

Owns export direction:

- browser-first PDF export first
- vector PDF backend later

## Editor UI Shape

The editor UI is moving toward a Figma-like layout.

Current editor shell:

- top toolbar
- left insert rail
- left layers/data panel
- center canvas viewport
- right contextual inspector
- bottom-left canvas dock
- bottom-center page switcher
- full-screen preview overlay

Important behavior:

- app body does not scroll
- panels scroll independently
- canvas viewport scrolls independently
- editor canvas shows one active page
- preview overlay shows final rendered output

## Current Editor Features

Already implemented:

- fixed app viewport
- compact icon-only insert rail
- delayed rail tooltips
- keyboard shortcuts for insert tools
- one-page editor canvas
- editor-only repeat rendering
- handlebars on editor canvas
- rulers
- grid
- snap toggles
- guide toggles
- multi-selection support
- alignment commands
- preview overlay
- preview dropdown UI
- bottom-left canvas dock
- bottom-center page switcher
- contextual right inspector
- searchable data panel
- data binding copy/insert actions
- Geist / Geist Mono Google Font setup
- dedicated layer icons for barcode and QR

## Export Direction

The export path should grow in stages.

Near term:

- browser-first PDF export
- preview diagnostics
- export from the rendered preview surface

Later:

- vector PDF backend
- PNG export
- HTML export
- render service / CLI

## Key Engineering Rules

- Keep template JSON as the source of truth.
- Keep editor and renderer separate.
- Do not expand repeat rows in the editor canvas.
- Do not paginate in the editor canvas.
- Keep renderer deterministic.
- Keep packages embeddable.
- Prefer explicit data schemas over guessing.
- Add abstractions only when the editor or renderer actually needs them.

## Long-Term Direction

Templara should become both:

- a visual document builder product
- an installable package system for embedding document editing/rendering into other platforms

The package direction matters because other products should eventually be able to use:

- the schema
- the renderer
- the React preview
- the editor
- templates
- export tools

The product should feel simple for a designer, but the underlying system should be rigorous enough for invoices, receipts, BOLs, paystubs, shipment documents, labels, certificates, reports, and other structured business documents.
