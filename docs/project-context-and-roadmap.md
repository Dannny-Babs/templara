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

### Server PDF: Headless Browser + React Renderer (Q4)

**Status:** Decided — capture for docs / Rose Rocket integration plan. Not implemented in this repo yet.

**Fact (confirmed in packages):**

- Source of truth is Template JSON.
- `@templara/renderer` is Node-safe and emits a **render tree** (`RenderDocumentResult`) only — no HTML string, no `renderToString`, no SSR helpers.
- Markup/pixels exist only after `@templara/react-renderer` paints that tree into a DOM.
- `@templara/pdf` clones already-painted preview DOM and calls browser `print()`; it does not re-render.

So there is no “JSON → static HTML string → feed Chrome” bridge. Server-hosted PDF requires a browser that runs `@templara/react-renderer`. That is a fidelity win: preview and PDF use the same painter by construction.

**Decision — A′ (preferred over B):**

| Option | Where headless Chrome + `@templara/react-renderer` + print lives |
| --- | --- |
| **A′** | Teach `document-generator` a Templara-JSON mode (reuse existing Chrome). Endpoint serves a page that mounts `@templara/react-renderer`, injects `{templateJson, data}`, waits for paint, prints (`margin:0` / `preferCSSPageSize` / `printBackground`). |
| **B** | Run Puppeteer/Chromium inside `platform-model` instead. Full control, but a second Chromium ownership workstream. |

**Plan primitive:** `POST` Templara JSON + context → doc-gen Templara route → PDF. Not an in-`platform-model` Node HTML render, and not a Handlebars/`templateData` string bridge.

**Docs follow-up:** Fold this into architecture / export docs when the integration plan is rewritten around A′.

**Update (Jul 24, 2026) — refined by discovery to A′-lite.** The read-only discovery run (see [discovery/00-DISCOVERY-REPORT.md](discovery/00-DISCOVERY-REPORT.md)) changed the recommended first step:

- `document-generator` is an **external, out-of-repo microservice** (image-only; source not on disk). `platform-model` POSTs `{ templateData, context, options }` to `POST /api/v1/docs/platform/{id}[/pdf|/preview]` (Bearer auth). Its internals — Puppeteer print config, print CSS, fonts, and the pre-print asset-wait strategy — are a **black box** and are the top fidelity risk.
- Because of that, full A′ (mount `@templara/react-renderer` inside the service's Chrome) is blocked on three service-internal unknowns: static bundle hosting, a render-complete readiness hook, and CSP.
- **Recommended lowest-risk first step: A′-lite** — SSR the Templara React tree to an **HTML string** (in `platform-model` or a thin shared renderer lib) and POST that HTML to the **existing `generate-document` print path**. Zero service changes; reuses the proven Chrome print engine, pagination, page numbers, Letter sizing, and the permission-gated controller surface. This *does* require a Node-safe HTML serialization path for Templara — which does not exist today (see the Fact above) — so **"add an SSR-to-HTML entrypoint" becomes a concrete Templara work item**, distinct from the earlier "no Node HTML path" framing.
- Other confirmed seams a JSON engine must satisfy: fit JSON into the `@RText templateData` string (or new field + bump hidden `dataFormatVersion`), reuse the **path-driven `buildRecordContext`** (add a `record.*` path extractor from Templara JSON), honor the **pre-formatted money/date suffix leaves**, register via `RDocumentTypeConfig` (keyed by `objectKey`), and ultimately return **PDF bytes** for attach/merge/sign/email. Design tokens are **Zinnia CSS vars on `:root`** (good for inheritance); inline generated imagery as base64.

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

## Docs & Onboarding Follow-ups

**Status:** Added Jul 24, 2026. A beginner-facing **User Guide** now exists in the docs site (`apps/docs/content/docs/user-guide/`, 11 pages: overview, your-first-document, the-interface, adding-elements, binding-data, layers-and-inspector, canvas-and-pages, preview-and-export, diagnostics, keyboard-shortcuts, faq). Three real Studio screenshots are captured and embedded (`apps/docs/public/user-guide/`): dashboard, editor overview, preview dropdown.

Remaining (do later):

- **Diagnostics screenshot** still thin — re-capture after the dock is opened with real findings (`diagnostics-dock.png` pipeline lives in `scripts/capture-user-guide.mjs`).
- **Establish a repeatable screenshot workflow** — `pnpm studio` then `node scripts/capture-user-guide.mjs http://localhost:<port>/` (Studio binds IPv6 `localhost`; avoid `127.0.0.1`). Fixed viewport 1440×900.
- **Add screenshot annotations/callouts** (numbered markers) for the interface tour.
- Revisit once remaining field-test polish lands.

## Execution Approach (how we'll run the work)

**Status:** Agreed direction, Jul 24, 2026. Not started — captured so we work this way once building begins.

> The full operating spec — roles, model tiering (high-thinking Planner + cheap Executors + separate Verifier), per-task lifecycle, branch-per-task parallelism, verification gates, the task-ticket template, conventional-commit rules, and the first-cut workstream/dependency graph — lives in **[orchestration-plan.md](orchestration-plan.md)**. The notes below are the rationale that shaped it.

### Stress Review Of This Approach

The swarm model is useful only if the work is decomposed around stable contracts. Without that, multiple agents can produce incompatible partial solutions: one branch changes the binding model, another changes the preview contract, and a third builds UI against assumptions neither branch keeps. The operating rule is therefore: **contract first, branch second**.

The "web-search best practices" step is useful for external implementation patterns, but it cannot be the source of truth for Rose Rocket behavior. Internal repo discovery wins over blogs, package READMEs, and generic architecture advice. Web research should answer "what is a good modern way to implement this class of thing?" Discovery should answer "what does this product actually do today?"

"Strong evals" also needs to mean named, repeatable checks, not vibes. Each task must define the fixture, the expected behavior, and the regression it prevents before code starts. If a branch cannot name its evals, it is still in discovery/planning.

### Operating Model

- **Discovery before build.** Run the relevant prompts in [discovery-prompts.md](discovery-prompts.md) and bring back evidence before opening implementation branches. Do not build from the raw issue log alone.
- **One integration owner branch.** Keep a single coordination branch that owns contracts, shared types, fixture names, and merge order. Feature branches merge into that branch after review; they do not merge directly into `main`.
- **Swarm of agents across scoped branches.** Break the work into independent chunks and run parallel agents only after the shared contract is written. Each branch gets one outcome, one owner, and one acceptance checklist.
- **Detailed plan per task.** Every task starts with a written plan covering scope, target files/packages, public/internal API changes, fixtures, evals, rollback path, and what it explicitly will not touch.
- **Best-practice research with source ranking.** Use current web research for external practices such as headless Chrome PDF readiness, large-tree React performance, schema browsers, and embedded theming. Rank evidence in this order: host repo code and fixtures, Templara package behavior, official docs, then general articles.
- **Contract tests before UI polish.** The first green checks should prove binding extraction, context hydration, real-record preview, server render handoff, and schema scaling. UI polish branches should not proceed until those contracts hold.
- **Strong evals gate each task.** A task is done only when its named evals pass. Minimum eval classes are unit tests, fixture/golden tests, browser verification where UI is involved, and performance checks for large schema/layer trees.
- **Merge discipline.** No branch may silently change renderer semantics, public package APIs, template schema, or server-render contracts. Those changes require an architecture note plus migration/test coverage.
- **Security and data hygiene.** Fixtures that come from real records must be scrubbed or explicitly marked safe. Do not introduce raw JavaScript evaluation, unsafe HTML injection, or unauthenticated asset fetching as shortcuts.
- **Priority remains fixed.** Data-binding + real-record preview first, then server PDF, registration/process integration, schema depth, value adapters, package docs/fixtures, and embedded theming (see [embedding-field-test-issues.md](embedding-field-test-issues.md) §8 and [rose-rocket-integration-retrospective.md](rose-rocket-integration-retrospective.md) §6).

### First Branches When Work Starts

1. `integration/discovery-context-builder`: run P3/P4, document exact path extraction and context hydration behavior, and save a real invoice chain fixture.
2. `integration/binding-path-extractor-contract`: define and test a Templara JSON binding extractor without changing editor UI.
3. `integration/real-record-preview-contract`: prove a real record can hydrate the extracted paths and render through existing preview with no placeholder data.
4. `integration/server-render-a-prime-spike`: verify whether `document-generator` can host the React renderer page and wait for a render-complete signal.
5. `integration/embedded-theming-contract`: define the host token/font/branding interface, with Templara branding disabled by default when embedded.
