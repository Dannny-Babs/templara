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

This repo uses [Changesets](https://github.com/changesets/changesets) to version and publish `@templara/*` packages.

**Published (8 packages, versioned together):**

| Package | Role |
| --- | --- |
| `@templara/core` | Schema, bindings, validation |
| `@templara/renderer` | Template + data → render tree |
| `@templara/react-renderer` | Render tree → React preview |
| `@templara/editor` | Visual editor |
| `@templara/pdf` | Browser PDF export |
| `@templara/templates` | Starter templates + sample data |
| `@templara/assets` | Fonts and asset helpers |
| `@templara/cli` | CLI scaffolding |

**Not published:** `@templara/docs`, `@templara/studio`, `@templara/playground`

All eight packages share one version number per release (configured as a fixed group in `.changeset/config.json`).

---

### One-time setup (do this once)

**1. npm account**

- Sign up at [npmjs.com/signup](https://www.npmjs.com/signup)
- Enable 2FA (recommended for publishing)

**2. Create the `@templara` org**

- Go to [npmjs.com/org/create](https://www.npmjs.com/org/create)
- Name it `templara` — this unlocks scoped packages like `@templara/core`

**3. Log in on your machine**

```sh
npm login
npm whoami   # should print your npm username
```

**4. Install repo deps** (if you haven't)

```sh
pnpm install
```

---

### First publish (`0.1.0`)

The repo is already prepared: packages are at `0.1.0`, LICENSE files and changelogs exist, Changesets is configured. You just need to publish:

```sh
# from repo root
pnpm release
```

That runs, in order:

1. `pnpm release:check` — typecheck + test
2. `pnpm build` — compile all packages to `dist/`
3. `changeset publish` — upload tarballs to npm

Verify:

```sh
npm view @templara/core version    # → 0.1.0
npm install @templara/core         # should work
```

---

### Every release after that

Think of it as three phases: **changeset → version → publish**.

#### Phase 1 — After you merge feature work

Whenever you change code in a publishable package, add a changeset **before** or **with** your PR:

```sh
pnpm changeset
```

The CLI will ask:

1. **Which packages changed?** — space to select, enter to confirm
2. **Bump type** — `patch` (bugfix), `minor` (feature), `major` (breaking)
3. **Summary** — one line for the changelog

This creates a file in `.changeset/` (e.g. `.changeset/happy-lions-dance.md`). Commit it with your code changes.

> Because all packages are in a fixed group, selecting any one bumps **all eight** to the same version.

#### Phase 2 — When you're ready to cut a release

Apply version bumps and regenerate changelogs:

```sh
pnpm version-packages
```

This will:

- Read all `.changeset/*.md` files
- Bump `0.1.0` → `0.1.1` (or `0.2.0`, `1.0.0`, etc.)
- Update every `packages/*/CHANGELOG.md`
- Update `package.json` versions
- Delete the consumed changeset files

Commit and push:

```sh
git add -A
git commit -m "chore: version packages"
git push
```

#### Phase 3 — Publish to npm

```sh
pnpm release
```

Or run the steps manually if you prefer:

```sh
pnpm run release:check   # typecheck + test
pnpm run build           # build dist/
changeset publish        # upload to npm
```

Tag the release (optional but good practice):

```sh
git tag v0.1.1
git push origin v0.1.1
```

---

### Quick reference

| Command | What it does |
| --- | --- |
| `pnpm changeset` | Record what changed (creates `.changeset/*.md`) |
| `pnpm version-packages` | Bump versions + update changelogs |
| `pnpm release:check` | Typecheck + test gate |
| `pnpm build` | Build all package `dist/` outputs |
| `pnpm release` | check → build → publish |

---

### Troubleshooting

**Stuck in Vim during a git command**

Press `Esc`, type `:qa!`, press Enter. That exits without saving. If git was waiting for a commit message, the commit was cancelled — run the command again.

**`403` or `ENEEDAUTH` on publish**

```sh
npm login
npm whoami
```

Make sure your account is a member of the `@templara` org with publish rights.

**`404` on `@templara/core` after publish**

The org may not exist yet, or the first publish of a scoped package needs `--access public` (already set in each package's `publishConfig`).

**`pnpm release` fails on tests**

Fix failures first, or run `pnpm run build && changeset publish` if you already ran checks separately.

**No pending changesets when running `version-packages`**

You forgot `pnpm changeset` after your last code changes. Add one, then run `version-packages` again.

---

### What lands on npm

Each published tarball includes:

- `dist/` (compiled JS + types)
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

Apps and examples are never published — only the eight packages under `packages/`.

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
