# Architecture

## Product Shape

Templara is an engine-first product. The visual editor is one consumer of the engine, not the engine itself.

```txt
Template JSON + Data JSON
        ↓
@templara/core
        ↓
@templara/renderer
        ↓
Render Tree
        ↓
React Preview / Editor Canvas / PDF Export / Image Export
```

## v0 Scope

Templara v0 is a structured business-document renderer, not a general document platform.

The first real target is one invoice template rendered from JSON data.

Supported in v0:

- Letter page preset
- document pixels
- absolute text/image/shape frames
- inline field binding
- one flow region
- vertical repeat frame
- simple row-level page breaks
- totals after the repeat
- browser preview
- visual debug overlay for layout decisions

Not supported in v0:

- arbitrary rich text editing
- collaborative editing
- multi-column prose
- footnotes
- floating figures
- colspan/rowspan table complexity
- nested repeat pagination
- custom vector PDF backend
- package publishing workflow

## Unit System

The internal unit is a document pixel:

```txt
1 document px = 1 CSS px = 1/96 inch
1 PDF point = 1/72 inch
1 document px = 0.75 PDF points
```

Initial page presets:

```txt
Letter: 816 x 1056 px
A4:     794 x 1123 px
```

## Layout Model

Documents support two layout modes.

Absolute nodes stay exactly where the designer placed them.

Flow nodes grow, split, and paginate inside explicit flow regions.

Initial page layers:

```txt
background
fixed
flow body
```

Headers and footers can become first-class regions later, but they should not repeat by default.

## Pagination Rules

Initial renderer rules:

- fixed nodes render only where the designer placed them
- flow nodes paginate only inside explicit flow regions
- repeat rows move as whole rows when possible
- repeat rows split only when explicitly allowed later
- v0 does not repeat the invoice header on continuation pages
- continuation pages start at the page margin, not under the original header
- unbreakable content taller than a page reports a layout warning

## Testing Strategy

The engine needs tests before it needs a full editor.

v0 testing priorities:

- binding resolution fixtures
- repeat expansion fixtures
- pagination boundary fixtures
- render-tree snapshots
- browser screenshot tests once the preview surface is stable

The debug overlay is part of the architecture. It should expose measured boxes, flow-region bounds, repeat-frame bounds, page-break decisions, and overflow warnings.

## State Domains

Keep these separate:

- document state
- render state
- selection state
- viewport state
- gesture state
- history state
- asset state
- export state

High-frequency pointer movement belongs in gesture state and should commit once at the end of an interaction.

## Package Responsibilities

### `@templara/core`

Owns the document language:

- document schema
- node types
- bindings
- variables
- expressions
- page presets
- commands
- validation
- migrations

### `@templara/renderer`

Turns template + data into a deterministic render tree.

Pipeline:

```txt
validate template
resolve variables
resolve bindings
expand conditionals
expand repeats
measure content
layout flow regions
paginate
produce render tree
report warnings
```

### `@templara/react-renderer`

Renders the render tree in the browser using React, DOM, CSS, and SVG.

### `@templara/editor`

Owns editor interaction:

- selection
- dragging
- resizing
- snapping
- guides
- layers
- property panels
- field insertion
- keyboard shortcuts
- undo/redo integration

### `@templara/pdf`

Starts with browser-first PDF export. Later, it can add a lower-level vector PDF backend.
