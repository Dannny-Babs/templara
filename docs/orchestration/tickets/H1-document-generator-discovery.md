### TASK H1 — `document-generator` discovery prompt pack
**Stream:** H — Deep discovery (external)   **Depends on:** none   **Model tier:** planner/mid (run in external repo; no Templara code)  
**Branch:** n/a — commit prompt pack on `integration/rr-doc-builder-2`; execute inside `RoseRocket/document-generator`

**Context (why):**  
From `platform-components`, `document-generator` is an **image-only black box** ([P2](../../discovery/P2-generator-pipeline.md), [P9](../../discovery/P9-server-render-feasibility.md), [00-DISCOVERY-REPORT.md](../../discovery/00-DISCOVERY-REPORT.md) §5). Full A′ (mount React inside the service Chrome) is blocked on print CSS, fonts, asset-wait, CSP, and bundle hosting. A′-lite can ship without those answers, but Wave 1 still needs a **ready-to-run** prompt pack so discovery can proceed in parallel.

**Scope (do exactly this):**
1. Ensure the runnable prompt pack exists at [`docs/discovery/document-generator-prompts.md`](../../discovery/document-generator-prompts.md) (created with this ticket).
2. The pack must be self-contained for an agent **inside the document-generator repo**: shared context, quality bar, numbered prompts covering:
   - Puppeteer / Chrome print options
   - Print CSS / `@page` / page breaks
   - Fonts (families, loading, fallbacks)
   - Pre-print asset-wait strategy (biggest fidelity risk)
   - CSP / static hosting / readiness hooks
   - Handlebars helper registry (service-side)
   - Network/auth reachability for logos/assets
3. Instruct the agent to save findings to markdown files and **not** change service code.
4. No Templara package code changes.

**What NOT to touch:**
- Do not implement SSR (B1) or change `@templara/*` packages.
- Do not invent service internals — the pack asks questions; answers come from the other repo.
- Do not edit the Wave 1 plan file.

**Inputs / references:**
- [00-DISCOVERY-REPORT.md §5 evidence gaps](../../discovery/00-DISCOVERY-REPORT.md)
- [P9 §6 concrete integration points](../../discovery/P9-server-render-feasibility.md)
- [P8 fonts/assets](../../discovery/P8-fonts-assets-logo.md)
- Style reference: [discovery-prompts.md](../../discovery-prompts.md) (P1–P9 pack for platform-components)

**Best-practice research:**  
N/A for writing the pack. When **running** the pack in the service repo, the agent may web-search Puppeteer print readiness patterns only after mapping local code.

**Acceptance criteria (testable):**
- [ ] `docs/discovery/document-generator-prompts.md` exists and is copy-paste runnable.
- [ ] Covers print config, print CSS, fonts, asset-wait, CSP/hosting, helpers, asset network.
- [ ] States read-only + save markdown deliverables.
- [ ] Linked from this ticket / tickets README.
- [ ] Docs-only commit; no package code.

**Tests to write:** none (documentation / prompt pack).

**Commit(s):** included in:
```txt
docs(orchestration): add Wave 1 tickets and backlog index
```
(or a follow-up `docs(discovery): add document-generator prompt pack` if split).

**Definition of done:** prompt pack committed; Orchestrator can hand it to an agent with access to `RoseRocket/document-generator`. Findings return later as new discovery markdown (separate task).
