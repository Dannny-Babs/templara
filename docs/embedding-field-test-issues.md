# Embedding Field-Test Issues Log — Templara in a Host Product

**Status:** Raw issue log. Captured Jul 23, 2026, while embedding `@templara/editor` + renderer live into the Rose Rocket platform. **Do not build from this yet** — per the log, the next step is research + planning + QA, then chunked build/iterate branches. This is the "what I'm going through" record.

Companion docs: [rose-rocket-integration-retrospective.md](rose-rocket-integration-retrospective.md) (the how-it-works / data-mapping crux) and [project-context-and-roadmap.md](project-context-and-roadmap.md).

Evidence: [fixtures/order-schema-sample.json](fixtures/order-schema-sample.json) — the real ~3,474-field Order schema fed into the data panel (see §3).

---

## TL;DR — overall read

- The foundation is genuinely good and worth building on: React-based, drag/drop, map-to-field, loop/repeat logic. **The logic isn't the problem.**
- **Data binding is the single biggest problem.**
- The editor UI is too small, too cluttered, not intuitive, and does not adapt to the host product.
- Preview does not work the way the real document system does (fetch a record → map it through).
- There are no in-product docs / guidance to teach a user how to build a template.
- Verdict: "it's not bad, it just could be *way* better." Needs heavy QA + assessment before more building.

---

## 1. Editor UI / UX

| # | Issue | Notes / desired behavior |
|---|---|---|
| 1.1 | **Dropdowns don't work properly** | Toggling a dropdown doesn't open/behave correctly. |
| 1.2 | **Dropdowns overflow their bounds** | When clicked they expand beyond where they should sit. |
| 1.3 | **Dropdown text/height too tiny** | Increase height and the content size; make it legible. |
| 1.4 | **Preview button (bottom-right) is confusing/empty** | It shows an eye icon + "preview" text and doesn't work. Could hold content later, but not now. |
| 1.5 | **Preview button styling** | Remove the eye icon; use a dropdown/chevron icon instead; increase size; make it sharp. |
| 1.6 | **Layer chevron/caret (left panel) is rounded** | Remove the rounded style. |
| 1.7 | **Layer names show the JSON/UUID id** | Templates are JSON keyed by UUID, so layer titles render as UUIDs. Nobody can tell what they're looking at — needs human-readable names. |
| 1.8 | **Clicking a layer is slow to respond** | Selection latency. |
| 1.9 | **Layers are slow at scale** | Deeply nested layers (imagine 1000s nested) are sluggish; needs virtualization/perf work. |
| 1.10 | **Left inspector panel isn't helpful** | Feels redundant, not intuitive, especially with large data. |
| 1.11 | **Add search to the left panel** | Needed to find layers/fields when there are many. |
| 1.12 | **Make the left panel resizable/draggable** | Same drag-to-resize behavior as the right inspector panel. |
| 1.13 | **Fonts too tiny across the whole platform** | General legibility problem. |
| 1.14 | **Default toggles are ON (bleed, grid, margin, etc.)** | Clutters the canvas; user should see just the template by default. |
| 1.15 | **Diagnostics panel looks "off" / AI-generated** | The *concept* is liked (tells the user what will/won't work). Improve the visual design of the section. |
| 1.16 | **Overall UI too small / not intuitive** | Prefer a much simpler UI. |

---

## 2. Theming / embedding (it's a package, not a product)

| # | Issue | Notes / desired behavior |
|---|---|---|
| 2.1 | **Templara logo must not appear when embedded** | This is a package embedded in someone else's product; no Templara branding. |
| 2.2 | **Inherit the host app's font** | Don't ship/force our own font; use the host platform's font. |
| 2.3 | **Inherit host design tokens via props** | Pass in the host's design tokens (buttons, fonts, dropdowns, colors) so we reuse their UI instead of defining our own. Keep our own UI as a fallback, but allow token override. |
| 2.4 | **Google Fonts support (like Figma)** | Would like a curated set of Google Fonts available in-editor — *without* introducing heavy server infrastructure. Studio is already heavy; don't bloat it. Open question, not a hard requirement. |

---

## 3. Data & bindings — the biggest problem

| # | Issue | Notes / desired behavior |
|---|---|---|
| 3.1 | **Data panel is flooded** | The record object surfaces ~3,474 fields (see fixture). Overwhelming and unusable as-is. |
| 3.2 | **"Data under the layer" doesn't work** | The per-layer data section beneath the layers tree is broken. |
| 3.3 | **Sample-data preview shows garbage** | Synthesized sample values render as "weird" placeholder junk. |
| 3.4 | **Preview should use a real record** | The real system fetches a DB record and maps it through the template. Preview should be able to pipe an existing record in, not fabricate sample data. |
| 3.5 | **Browse field only shows a few fields** | The field browser exposes only a select subset; it isn't pulling/binding the actual data. |
| 3.6 | **Bindings don't pull real data** | Lots of data present but not binding/resolving. |
| 3.7 | **Huge + deeply nested schema handling** | Need a strategy for very large schemas: perf, search, grouping, hiding `$`-system fields, collapsing connection sub-objects. |

> Cross-reference: the retrospective §6 #1 ("binding-path extractor that feeds the existing context builder") is the structural fix that makes real records + real formatting work. This is where it bites in practice.

---

## 4. Preview & rendering

| # | Issue | Notes / desired behavior |
|---|---|---|
| 4.1 | **Preview doesn't work properly** | General — the preview path is unreliable. |
| 4.2 | **Preview should mirror the real doc flow** | Fetch record → map through template → render (the way the current HTML document system works). |
| 4.3 | **Template doesn't follow the existing HTML doc** | The current production doc is HTML; the Templara version should be reviewed against that HTML for parity. |

---

## 5. Guidance / documentation (in-product)

| # | Issue | Notes / desired behavior |
|---|---|---|
| 5.1 | **No onboarding/guidance for authors** | Nothing teaches a user how to set up a template, add a field, bind data, loop, etc. |
| 5.2 | **Guide the user (Notion-style doc generator)** | Want a guided, clean authoring experience that walks the user through building. |
| 5.3 | **Old docs don't help for custom templates** | Building a from-scratch (non-provided) template is unsupported by current docs. |

---

## 6. What's actually good (keep / build on)

- React foundation — liked.
- Drag-and-place, map-to-field, and loop/repeat ("put this in a loop") logic — the logic is good.
- Diagnostics *concept* — helpful signal of what will/won't work (just needs visual polish, see 1.15).
- Overall: strong base with real potential; "not bad."

---

## 7. Process / meta (how to proceed)

- Needs **heavy QA and assessment** of what's been built — much of it doesn't work properly yet.
- Needs **research + understanding + planning before building anything more.**
- **Chunk the plan** into small pieces, one branch each: build → iterate → build → iterate.
- Figure out a **proper, global way** for this to work (not one-off hacks).
- Expect this to require **ongoing conversation** to get the approach right.

### Build Gates Before Any Fix Branch

This log is intentionally raw. Do not turn every row into a UI task. The first implementation work should pass these gates:

1. **Reproduce the issue with a fixture or screen recording.** Example: the 3,474-field data panel problem should point to `fixtures/order-schema-sample.json` and a measurable render/search behavior, not just a subjective "too much data" note.
2. **Classify the failure layer.** Decide whether the issue belongs to host integration, `@templara/editor`, data schema generation, renderer behavior, preview orchestration, or docs/onboarding.
3. **Define the user-visible success state.** Example: "real-record preview resolves `record.total.withDecimalsAndCurrencyCode`" is actionable; "make preview better" is not.
4. **Name the regression check.** Every P0/P1 issue needs a unit, fixture, browser, or performance check before it is marked done.
5. **Avoid local-demo regressions.** Embedded-mode fixes must not break standalone Studio unless the behavior is explicitly behind an embedding prop or mode.

---

## 8. Suggested triage (my read, for a later planning pass — not a build order yet)

- **P0 (blocks real use):** 3.1, 3.4, 3.5, 3.6 (data/bindings + real-record preview), 4.1/4.2 (preview flow), 1.7 (UUID layer names).
- **P1 (embedding credibility):** 2.1 (logo), 2.2/2.3 (font + token inheritance), 1.1–1.3 (dropdowns), 1.14 (default toggles off).
- **P2 (scale + ergonomics):** 1.8/1.9 (layer perf), 1.10–1.12 (left panel: usefulness, search, resize), 3.7 (huge-schema UX), 1.13 (font sizes).
- **P3 (polish + delight):** 1.4–1.6 (preview button + caret), 1.15 (diagnostics visual), 2.4 (Google Fonts).
- **Cross-cutting:** 5.x (in-product guidance) and the §7 process/QA work wrap around all of the above.

## 9. Principal Read On Priority

The P0 is not "make the data panel prettier." The P0 is **prove that a Templara template can name the same data leaves the existing document system knows how to hydrate**. That means the binding-path extractor and real-record preview contract come before deep data-browser UI work.

The P1 embedding work should be treated as a product contract, not cosmetic polish:

- no Templara branding in embedded mode
- host font inheritance by default
- host design tokens accepted through a typed API
- dropdowns/popovers rendered in a predictable layer
- default layout aids off unless the host explicitly enables them

The large-schema problem needs both UX and performance work. A searchable tree is not enough if rendering the tree blocks input. The eval should include thousands of fields, deep nesting, repeated `$` system fields, search latency, and selection latency.
