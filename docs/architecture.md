# Architecture

## Product Shape

Templara is an engine-first product. The visual editor is one consumer of the engine, not the engine itself.

```txt
Template JSON + Data JSON
        ↓
@templara/core
        ↓
@templara/renderer          ← Node-safe; emit RenderDocumentResult only (no HTML)
        ↓
Render Tree
        ↓
@templara/react-renderer    ← only path to markup/pixels (DOM paint)
        ↓
Browser preview / @templara/pdf print / (future) headless Chrome PDF
```

There is no Node-side HTML serialization path today. Two server-PDF routes follow from that:

- **Full A′** — run the same React paint in a headless browser (highest fidelity, but blocked on `document-generator`-internal unknowns).
- **A′-lite (recommended first step)** — add a Node-safe **SSR-to-HTML** entrypoint so `@templara/react-renderer` output can be serialized to an HTML string and POSTed to the host's existing Chrome print path. This is a new, concrete work item precisely because the Node-side HTML path does not exist yet.

See Q4 / A′-lite and the [discovery report](discovery/00-DISCOVERY-REPORT.md) referenced in [project-context-and-roadmap.md](project-context-and-roadmap.md).

## Integration Boundary Rules

These rules matter when Templara is embedded into an existing document system:

- **Template JSON stays the source of truth.** Do not convert Templara templates into Handlebars or raw HTML as the primary authoring format.
- **`@templara/renderer` stays DOM-free.** It can run in Node and emit `RenderDocumentResult`, but it should not grow React, browser, or PDF-print dependencies.
- **`@templara/react-renderer` owns pixels.** Browser preview, browser print, and future headless-Chrome PDF should paint through the same React renderer path.
- **Host integration adapts around contracts.** The host can provide real data, design tokens, fonts, asset resolvers, and a server print shell, but it should not reach into editor internals.
- **Binding extraction is an adapter, not a renderer feature.** Walking Template JSON to list required data paths belongs at the integration/editor boundary so the host context builder can hydrate real records.
- **No unsafe expression escape hatch.** Logic remains structured data. Do not add arbitrary JavaScript or raw HTML injection to close integration gaps.

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
