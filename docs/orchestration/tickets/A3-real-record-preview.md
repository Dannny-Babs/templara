### TASK A3 — Real-record preview contract (Templara seam + host wiring)
**Status:** done (Templara seam); host wiring remains  
**Stream:** A — Data binding   **Depends on:** A2, C3  
**Branch:** `integration/rr-doc-builder-2-wave5`

**Context (why):**  
Field-test P0: sample-data preview shows garbage / real IDs do not resolve on canvas ([embedding-field-test-issues.md](../../embedding-field-test-issues.md) §3.3–3.6, §4.1). Hosts already can pass controlled `data` into `DocumentEditor`; Wave 5 adds a narrow hydrate helper so org-address postal aliases apply when swapping in a real record.

**Scope (Templara — shipped):**
1. Export `preparePreviewData(data, { aliasOrgAddresses? })` from `@templara/editor` — wraps `@templara/core` `aliasOrgAddressPaths` (default on).
2. Document the contract in `@templara/editor` README: hosts resolve `{ org, record, … }` themselves; pass through `data` / `onDataChange`; do not invent `buildRecordContext` here.
3. Clarify page-inspector **Sample Data Source** is Studio chrome only (does not fetch).

**Scope (Host — remaining):**
1. Feed `extractBindings` → `toRecordContextPaths` → host context builder into `DocumentEditor` `data`.
2. Prove a real invoice record fills the canvas (IDs resolve; org `postalCode` bindings non-blank).

**What NOT to touch in Templara:**
- No platform-model fetch / `$byIdOrThrow` / fake record loaders.

**Acceptance criteria:**
- [x] `preparePreviewData` unit tests (postal alias + opt-out).
- [x] README documents real-record preview seam.
- [ ] Host proof: live invoice record on canvas (host repo).

**Commit(s):**
```txt
feat(editor): add preparePreviewData for real-record hydrate
```
