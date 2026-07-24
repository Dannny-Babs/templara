### TASK D1 — Doc-type registry parity (host)
**Status:** ready (Wave 5 host execution; Templara ticket/spec only in Wave 4)  
**Stream:** D — Doc-type registry   **Depends on:** A2, B1   **Model tier:** mid  
**Branch:** `feat/doctype-registry-parity` (host repo; not implemented in Templara Wave 4)

**Context (why):**  
Doc Builder 1 registers generators via `RDocumentTypeConfig` keyed by `objectKey`; attach/merge/sign/email consume **PDF bytes** ([P7](../../discovery/P7-document-process-integration.md)). Templara must show up in the same process without inventing a parallel registry in this repo.

**Scope (do exactly this):**
1. **In Templara (this repo — thin stubs only):**
   - Optional: export a typed *shape* doc (e.g. `TemplaraDocumentTypeDescriptor`) describing `objectKey`, template id, and “HTML payload via `renderTemplateToHtml`” — **no fake host registry implementation**.
   - Document the host contract in this ticket / a short `docs/` note if missing: host owns `createTemplaraDocumentType` / `RDocumentTypeConfig` registration.
2. **In host / platform-model (out of repo — Wave 4 executor):**
   - Register Templara types by `objectKey`.
   - Pipeline: bindings → context → `renderTemplateToHtml` → existing generate-document PDF path (B2 / H1).
   - Prove attach/email/export receive PDF bytes like DB1 types.
3. Acceptance tests live primarily in the host; Templara may only add contract types + docs.

**What NOT to touch:**
- Do not invent platform-model document-generator POSTs in Templara.
- Do not fake a full `RDocumentTypeConfig` runtime in `@templara/*`.
- Do not block on H1 if HTML→PDF path is already proven for other HTML sources — still document fidelity unknowns.

**Inputs / references:** P7; B1 SSR entry; A2 path mapping; H1 discovery pack.

**Best-practice research:**  
Host registry adapter pattern; keep publishable packages free of host-specific registries.

**Acceptance criteria (testable):**
- [ ] Host can register at least one Templara doc type by `objectKey` (host test or manual checklist recorded).
- [ ] Generated artifact is PDF bytes on the existing attach/merge path (host).
- [ ] Templara repo: no fake registry; any exported descriptor types have unit shape tests.
- [ ] Ticket status → done only after host proof exists.

**Tests to write:** host integration (primary); optional Templara type stub tests.

**Commit(s):**
```txt
docs(doctype): document host RDocumentTypeConfig contract for Templara

feat(core): add TemplaraDocumentTypeDescriptor stub types  # only if needed
```

**Definition of done:** host registration proven + docs/stubs merged; Verifier confirms no invented POSTs.
