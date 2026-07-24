# Templara × Rose Rocket — Multi-Agent Orchestration Plan

**Status:** Operating model. Captured Jul 24, 2026. This defines *how* we execute the large Templara (Doc Builder 2) integration as a swarm of agents — roles, model tiering, per-task workflow, branching, verification gates, and commit conventions. It is grounded in the completed audit ([discovery/00-DISCOVERY-REPORT.md](discovery/00-DISCOVERY-REPORT.md)), the field-test issues ([embedding-field-test-issues.md](embedding-field-test-issues.md)), and the retrospective ([rose-rocket-integration-retrospective.md](rose-rocket-integration-retrospective.md)).

> This is the **scaffold** a high-thinking **Planner** model expands into concrete task tickets. The workstreams in §9 are a first cut derived from the audit, not the final task list.

---

## 0. Guiding reality

The scope is very large and a **bulk of execution will be delegated to smaller, cheaper, less technically-apt models**. That single fact drives every rule below:

- **Plans must be so explicit that a weaker model cannot meaningfully misinterpret them.** Ambiguity is a defect in the *plan*, not the executor.
- **Every task must be independently verifiable** (tests + acceptance criteria) so we never rely on an executor "getting it right" on trust.
- **Small tasks beat big tasks.** Prefer many narrow, well-scoped tickets over few broad ones.
- **Trust nothing; verify everything.** A dedicated verification pass runs on every task, ideally by a *different* agent than the one that wrote the code.

---

## 1. Roles & model tiering

| Role | Model tier | Responsibility |
| --- | --- | --- |
| **Planner** | Highest-thinking (e.g. top Opus/GPT reasoning tier) | Turns this scaffold + the audit into a dependency-ordered task graph. Writes each task ticket to the §6 spec. Owns acceptance criteria and eval design. Does NOT write feature code. |
| **Orchestrator** | Mid tier | Schedules tasks, assigns branches, launches Executors, tracks status, enforces gates, sequences merges. Escalates blockers to the Planner. |
| **Executor** | Small / cheap | Implements exactly one task ticket on its own branch. Follows the ticket literally. Writes code + the tests the ticket requires. |
| **Verifier / QA** | Mid tier (must differ from the Executor) | Re-verifies the task against acceptance criteria, runs tests, adds/strengthens integration tests, checks for regressions, reviews diff quality. Can reject back to Executor. |
| **Integrator / Reviewer** | Mid–high tier | Reviews the PR, resolves cross-branch conflicts, confirms integration tests across dependent tasks, approves merge. |

Cost strategy: spend reasoning budget on **planning and verification** (where mistakes are caught cheaply), and spend cheap tokens on **execution** (where the ticket removes most of the thinking).

---

## 2. Per-task lifecycle (the loop every task follows)

```txt
Planner writes ticket
      ↓
Orchestrator creates branch  ── conventional name (see §4)
      ↓
Executor: research best practices (web search) → implement → self-check → write required tests
      ↓
Automated gate: typecheck + unit tests + lint + build  (must be green)
      ↓
Verifier/QA (different agent): re-verify vs acceptance criteria, add integration tests, hunt regressions
      ↓  (reject → back to Executor)   (pass → continue)
Conventional commit(s)  →  open PR  →  Integrator review
      ↓  (reject → back)   (approve → merge)
Merge to integration branch  →  Orchestrator marks done, unblocks dependents
```

Key rules:
- **Research step is mandatory.** Each task begins with a short web-search pass on current best practices for that specific problem (e.g. React SSR-to-HTML, design-token theming, deep-tree virtualization, Handlebars-safe string embedding). Findings go in the PR description.
- **A task is not done until its evals pass.** Evals/tests are the definition of done, not the executor's say-so.
- **Verification is a separate agent.** The author never signs off on their own work.

---

## 3. Branching & parallelism

- **Branch per task.** Many tasks run **simultaneously** across streams, each isolated on its own branch.
- **Integration branch per workstream** (e.g. `integration/binding`), merged into the main long-lived integration branch only when the stream's tasks are green and integration-tested together.
- **Merge order follows the dependency graph** (§9). The Orchestrator serializes merges to minimize conflicts; the Integrator resolves any that arise.
- **Keep branches short-lived.** Rebase/merge from the integration branch frequently to avoid drift.
- Current working branch for this docs/planning stage: `docs/server-pdf-architecture-decision` (docs only). Feature work starts on fresh branches off the chosen integration base.

Branch naming (conventional-commit-aligned):

```txt
<type>/<stream>-<short-slug>
feat/binding-path-extractor
feat/ssr-html-entrypoint
fix/org-postal-code-mapping
test/invoice-fidelity-golden
docs/value-adapter-reference
chore/eval-harness-setup
```

---

## 4. Conventional Commits (required in this repo)

All agent commits use [Conventional Commits](https://www.conventionalcommits.org/). This repo also uses Changesets — any change to a publishable package under `packages/` must include a changeset (see [../README.md](../README.md)).

**Format:**

```txt
<type>(<scope>): <imperative summary ≤ 72 chars>

<body: what & why, not how>

<footer: BREAKING CHANGE:, Refs: TICKET-ID>
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `build`, `ci`, `style`, `revert`.

**Scopes (suggested, match packages/streams):** `core`, `renderer`, `react-renderer`, `editor`, `pdf`, `templates`, `binding`, `ssr`, `tokens`, `doctype`, `docs`, `evals`.

**Examples:**

```txt
feat(binding): extract record.* paths from Templara JSON for context reuse
fix(renderer): map org postalCode so org address no longer renders blank
test(pdf): add invoice golden-HTML fidelity check against DB1 output
docs(discovery): import P1–P9 reports and fixtures
```

Rules: one logical change per commit; imperative mood; reference the task ticket in the footer; `BREAKING CHANGE:` footer whenever a public package contract changes; never bypass hooks.

---

## 5. Verification & QA gates (non-negotiable)

Every task must pass, in order:

1. **Automated gate** — `pnpm run typecheck`, `pnpm run test`, lint, and `pnpm run build` all green (see [../README.md](../README.md)). For publishable changes, `pnpm run release:check`.
2. **Unit tests** authored with the change (the ticket names them).
3. **Integration tests between tasks** — the Verifier adds tests proving the new piece works with its dependencies (e.g. binding extractor → context builder → rendered output).
4. **Golden/fidelity checks** where output correctness matters — compare Templara output against the captured DB1 fixtures (`docs/discovery/fixtures/*`), especially the invoice chain.
5. **Regression sweep** — full test suite stays green; no unrelated breakage.
6. **Diff review** — Integrator confirms scope, quality, and conventions.

If any gate fails, the task returns to the Executor with the specific failure. Weak-model output is *expected* to fail sometimes — the gates exist to catch it cheaply.

---

## 6. Task ticket template (Planner fills this for every task)

Because execution is delegated to weaker models, each ticket must be self-contained enough to implement without further reasoning.

```md
### TASK <ID> — <title>
**Stream:** <workstream>   **Depends on:** <task IDs or none>   **Model tier:** <executor/mid>
**Branch:** <type>/<stream>-<slug>

**Context (why):** 1–3 sentences. Link the exact audit evidence (e.g. P3 §2d, discovery §6.3).

**Scope (do exactly this):**
- Precise, ordered steps.
- Exact files/functions to touch (paths).
- What NOT to touch (guardrails).

**Inputs / references:** fixtures, types, prior tasks' outputs, doc links.

**Best-practice research:** the specific question(s) to web-search first.

**Acceptance criteria (testable):**
- [ ] Behavior X verified by test Y.
- [ ] `pnpm typecheck && pnpm test && pnpm build` green.
- [ ] Fidelity: output matches fixture Z (if applicable).

**Tests to write:** unit + which integration test(s).

**Commit(s):** conventional message(s) to use.

**Definition of done:** all acceptance criteria + Verifier sign-off + merged.
```

---

## 7. Guardrails for weak-model execution

- **No scope creep:** executors touch only the files the ticket names.
- **No silent assumptions:** if the ticket is ambiguous, the executor must stop and escalate to the Orchestrator/Planner, not guess.
- **No dependency additions** unless the ticket authorizes them (and then pinned, latest, via the package manager).
- **No cross-package contract changes** without an explicit `BREAKING CHANGE` ticket.
- **Read the linked audit evidence before coding** — the answers to most "how does the current system do X" questions are already in `docs/discovery/`.
- **Keep the renderer/editor split** and the engineering rules in [../README.md](../README.md).

---

## 8. Grounding in the audit (what we already know)

The Planner must build tasks around the confirmed seams (full detail in [discovery/00-DISCOVERY-REPORT.md](discovery/00-DISCOVERY-REPORT.md) §6):

- Template lives as an `@RText` string on `DocumentTemplate.templateData`; JSON must fit there or use a new field + bump hidden `dataFormatVersion`.
- Context is **path-driven**; `buildRecordContext` is reusable if we can enumerate referenced `record.*` paths → **binding-path extractor**.
- Money/date/enum values are **pre-formatted string leaves** (closed suffix set) → **value adapter**, no client reformatting by default.
- PDF generation is an **external microservice** (black box) → prefer **A′-lite** (SSR React → HTML → existing print path); needs a new **Node-safe SSR-to-HTML entrypoint** in Templara.
- Doc types register via `RDocumentTypeConfig` keyed by `objectKey`; output must become **PDF bytes** to attach/merge/sign/email.
- Design tokens are **Zinnia CSS vars on `:root`** (no theme provider) → token inheritance is feasible; inline generated imagery as base64.
- Top risk / evidence gap: `document-generator` internals (print config, fonts, asset-wait) — a **follow-up discovery run inside that repo** is its own task.

---

## 9. First-cut workstreams & dependency graph (Planner to expand)

Priority follows [embedding-field-test-issues.md](embedding-field-test-issues.md) §8 and the retrospective §6.

| Stream | Goal | Key tasks (seed) | Depends on |
| --- | --- | --- | --- |
| **A — Data binding** | Real records fill templates | Binding-path extractor from Templara JSON; adapter to `buildRecordContext`; real-record preview wiring | audit P3/P5 |
| **B — Server render (A′-lite)** | PDF via existing print path | Node-safe SSR-to-HTML entrypoint in `@templara/renderer`/thin lib; POST to `generate-document`; golden-HTML fidelity harness | Stream A |
| **C — Value adapter** | Money/date/address parity | Map RR pre-formatted leaves; suffix-set coverage tests | audit P3 |
| **D — Doc-type registry parity** | Show up in doc process | `createTemplaraDocumentType` bound by `objectKey`; attach/email/export path | Streams A, B |
| **E — Design-token inheritance** | Match host UI | Consume Zinnia CSS vars; `HostDesignTokens` prop; remove Templara branding when embedded | audit P6 |
| **F — Editor UX fixes** | Fix field-test issues | Dropdowns, preview button, default toggles off, layer names, large-schema search, diagnostics visual | field-test issues |
| **G — Docs, fixtures & evals** | Prove & document | Eval/golden harness; user-guide screenshots; layout-engine reference; document reverse-engineered rules | all |
| **H — Deep discovery (external)** | Close evidence gaps | Discovery run inside `document-generator` repo (print config, fonts, asset-wait, CSP) | — |

Rough order: **H** (unblock B fidelity) and **A** first → **C**, **B** → **D**, **E**, **F** in parallel → **G** continuous.

---

## 10. Kickoff checklist

- [ ] Choose the integration base branch and create per-stream integration branches.
- [ ] Planner (high-thinking) expands §9 into concrete tickets using the §6 template.
- [ ] Stand up the **eval/golden harness** (Stream G) first — nothing merges without gates.
- [ ] Confirm conventional-commit + changeset enforcement (hooks/CI).
- [ ] Launch the external `document-generator` discovery (Stream H) in parallel.
- [ ] Orchestrator begins scheduling Executors per the dependency graph.
