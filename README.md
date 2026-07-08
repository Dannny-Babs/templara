# Templara

Templara is a browser-first visual document/template builder.

It combines a Figma-like design editor with a deterministic document renderer. The goal is to let users design structured business documents once, bind them to JSON data, and render final outputs such as previews, PDFs, images, and eventually HTML.

Templara is built for documents where layout matters and data changes:

- shipment BOLs
- invoices
- receipts
- paystubs
- shipping labels
- certificates
- structured reports

## Core Idea

```txt
Design once.
Bind to data.
Render many documents.
```

The editor and renderer are intentionally separate.

- The editor shows authored template structure on one active page.
- The preview/export renderer resolves data, expands repeats, paginates, and creates final output.

That means repeat nodes show as one editable template row in the editor, but expand into real rows in preview/export.

## Current Status

Current editor features:

- blank project by default on first load
- browser-local project persistence
- template library for Blank, Invoice, Shipment BOL, Receipt, Pay Stub, and Shipping Label
- project save/load, rename, duplicate, delete, import, and export
- fixed viewport app shell
- icon-only insert rail
- keyboard shortcuts for tools
- one-page editor canvas
- layers panel
- searchable data panel
- contextual right inspector
- table/grid groups with static rows and bound column authoring
- direct grid cell targeting and column boundary resizing on canvas
- grid, rulers, guides, and snapping controls
- unified diagnostics badge and dock
- bottom-left canvas dock
- bottom-center page switcher
- preview overlay
- preview dropdown UI
- barcode and QR node support
- Google Fonts Geist / Geist Mono setup

Current renderer features:

- binding resolution
- repeat expansion
- repeat row fit calculations
- pagination for overflow repeat rows
- semantic grid rendering, including static unbound rows
- render warnings and diagnostics
- React preview rendering

## Documentation

Start here:

- [Architecture blog](docs/architecture-blog.md)
- [The Templara package architecture](docs/package-architecture-blog.md)
- [Building a visual data binding UX](docs/visual-data-binding-ux-blog.md)
- [The editor is not the renderer](docs/editor-is-not-renderer-blog.md)
- [Building a Figma-inspired document rendering engine in React](docs/figma-inspired-document-rendering-engine-react-blog.md)
- [How I designed a graph-based layout engine for dynamic PDFs](docs/graph-based-layout-engine-dynamic-pdfs-blog.md)
- [Creating a custom document engine instead of using HTML templates](docs/custom-document-engine-over-html-templates-blog.md)
- [Product and system overview](docs/product-system-overview.md)
- [Project context and roadmap](docs/project-context-and-roadmap.md)
- [Architecture notes](docs/architecture.md)
- [100 percent execution plan](docs/100-percent-execution-plan.md)
- [Launch readiness checklist](docs/launch-readiness.md)

The architecture blog is the narrative version: what Templara is, what we built, the key architecture decisions, and code samples from the system.

The focused blog posts break down the package architecture, visual data binding UX, the editor/renderer split, the React rendering surface, the dynamic PDF layout engine, and the custom document-engine decision as separate engineering stories.

The overview explains what Templara is, how the editor/renderer split works, the package architecture, the document model, and the long-term product direction.

The context/roadmap doc summarizes what has been built in this chat and what remains.

The 100 percent execution plan is the principal-level handoff for another agent. It defines progress, system architecture, algorithms, milestones, acceptance criteria, and the exact continuation order.

The launch readiness checklist defines what is demo-ready now, what still carries risk, and the verification gate before calling the product launchable.

## Workspace

```txt
apps/
  studio/              main visual editor product
  playground/          renderer and template experiments
  docs/                Fumadocs documentation site (Vite + React Router + MDX)

packages/
  core/                document schema, node types, bindings, page presets
  renderer/            template + data -> paginated render tree
  react-renderer/      render tree -> React DOM/SVG preview
  editor/              canvas, tools, layers, inspector, data panel
  pdf/                 browser-first PDF export direction
  assets/              fonts, images, asset helpers
  templates/           starter templates and sample data
  cli/                 future command-line rendering/export
```

Package API references:

- [@templara/core](packages/core/README.md)
- [@templara/renderer](packages/renderer/README.md)
- [@templara/react-renderer](packages/react-renderer/README.md)
- [@templara/editor](packages/editor/README.md)
- [@templara/pdf](packages/pdf/README.md)
- [@templara/templates](packages/templates/README.md)
- [@templara/assets](packages/assets/README.md)
- [@templara/cli](packages/cli/README.md)

## Install

Published packages use the `@templara` scope on npm. Start with core for schema and types, or renderer for render-only workflows:

```sh
npm install @templara/core
# or
pnpm add @templara/renderer @templara/react-renderer
```

Common combinations:

| Goal | Packages |
| --- | --- |
| Render documents from template JSON | `@templara/core`, `@templara/renderer`, `@templara/react-renderer` |
| Embed the visual editor | `@templara/editor` (pulls renderer + preview dependencies) |
| Export PDFs in the browser | `@templara/pdf` |
| Starter invoice/BOL/receipt templates | `@templara/templates` |

All publishable packages are versioned together at `0.1.0` and share a single changelog entry per release.

## Development

Install dependencies from the repo root, then run the Studio app or docs site.

```sh
pnpm install
pnpm studio
pnpm docs
```

Useful checks:

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

Release gate before publishing:

```sh
pnpm run release:check
```

## Publishing

This repo uses [Changesets](https://github.com/changesets/changesets) to version and publish `@templara/*` packages. Apps (`studio`, `docs`, `playground`) are private and not published.

### One-time setup

1. Create an npm account at [npmjs.com](https://www.npmjs.com/signup)
2. Create the `@templara` org at [npmjs.com/org/create](https://www.npmjs.com/org/create)
3. Log in locally:

```sh
npm login
npm whoami
```

### Day-to-day release flow

When you change a publishable package, add a changeset:

```sh
pnpm changeset
```

Before release, apply version bumps and update changelogs:

```sh
pnpm version-packages
```

Commit the version and changelog changes, then publish:

```sh
pnpm release
```

`pnpm release` runs typecheck + test, builds all packages, then runs `changeset publish`. Scoped packages publish with public access.

Verify after publish:

```sh
npm view @templara/core version
```

## Key Engineering Rules

- Template JSON is the source of truth.
- The editor must not call the final renderer for its design canvas.
- The editor shows authored nodes and handlebars.
- Preview/export resolves data, expands repeats, and paginates.
- Repeated rows should not expand on the editor canvas.
- Packages should remain embeddable over time.

## Known Near-Term Work

- Harden import/export project bundle UX and add more malformed-bundle tests.
- Harden table editing with richer row/column keyboard commands and clearer cell-context inspector affordances.
- Add richer diagnostics navigation for validation paths that do not map to a node.
- Move local project persistence behind an IndexedDB/server-ready adapter when binary assets arrive.
