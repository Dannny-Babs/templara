### TASK A2 — `toRecordContextPaths` aligned with P3 `normalizeRecordPaths`
**Stream:** A — Data binding   **Depends on:** A1   **Model tier:** executor  
**Branch:** `feat/binding-path-extractor` (same stream branch as A1)

**Context (why):**  
Host materialization only uses **record** paths. P3 `normalizeRecordPaths` filters to `record.`-prefixed paths and strips the prefix before `buildRecordContext` ([P3-context-builder.md](../../discovery/P3-context-builder.md) §2c):

```ts
// platform-model templateVisitor.helpers.ts (verbatim semantics)
normalizeRecordPaths(paths) =
  paths.filter(p => p.startsWith("record.")).map(p => p.slice("record.".length))
```

`org.*` and `document.*` are sourced separately. Templara must expose a **pure** helper so host adapters can hand paths to `buildRecordContext` without copying Rose Rocket code into this repo.

**Scope (do exactly this):**
1. In `@templara/core` (same module family as A1, e.g. `extractBindings.ts` or `recordPaths.ts`), implement:
   - `toRecordContextPaths(paths: string[]): string[]`
2. **Required semantics (match P3 `normalizeRecordPaths`):**
   - Keep only paths that start with `record.` (exact prefix; case-sensitive).
   - Strip the `record.` prefix from kept paths.
   - Return unique paths (Set) in **sorted** order (same sort policy as `extractBindings`).
   - Drop `org.*`, `document.*`, and any path that does not start with `record.`.
3. Document in a short JSDoc:
   - Host templates / bindings intended for Rose Rocket context must use `record.*` (and separately `org.*` / `document.*`) path prefixes.
   - Demo/sample templates that use domains like `invoice.*` / `business.*` will correctly yield `[]` from this helper until paths are remapped by a host adapter (out of scope for A2).
4. Unit tests in `packages/core`:
   - Input `["record.total.withDecimalsAndCurrencyCode", "org.logoUrl", "document.shortDate", "record.invoiceDate.dateTimeInLocation.shortDate"]` → sorted `["invoiceDate.dateTimeInLocation.shortDate", "total.withDecimalsAndCurrencyCode"]` (order per sort).
   - Duplicates collapsed.
   - Empty input → `[]`.
   - Paths that are only `"record"` or `"record."` — define explicitly: `"record"` does **not** start with `"record."` → drop; `"record."` → strip to `""` and either drop empty string or keep — **prefer drop empty strings** and note in JSDoc.
5. Export from package `index.ts`.
6. Update Changeset: if A1 already added a changeset on this branch, amend the changeset summary to mention both exports **only if** the changeset file is still unreleased on the branch; otherwise add a second changeset. Do not amend git commits.

**What NOT to touch:**
- Do not implement `stripFormattingPathSuffix` / `excludeInvalidPaths` / ORM tip checks (those stay on the host; optional later ticket).
- Do not import platform-model.
- Do not change money/date formatting (Stream C).
- Do not rewrite sample `invoiceTemplate` paths to `record.*` in this ticket.

**Inputs / references:**
- [P3 §2c `normalizeRecordPaths`](../../discovery/P3-context-builder.md)
- A1 `extractBindings` output as typical input
- Discovery §6 item 3 (path-driven context)

**Best-practice research:**  
Web-search not critical; mirror the audited 8-line function. Optionally search “pure path prefix normalize unit test table-driven” for test style.

**Acceptance criteria (testable):**
- [ ] `toRecordContextPaths` matches P3 filter+strip semantics for `record.` paths.
- [ ] Non-record prefixes dropped; uniqueness + sort verified by tests.
- [ ] Exported from `@templara/core` with JSDoc linking P3 behavior.
- [ ] Changeset covers the new export.
- [ ] `pnpm typecheck && pnpm test && pnpm build` green.

**Tests to write:**
- Table-driven unit tests co-located in core (extend `extractBindings.test.ts` or new `toRecordContextPaths.test.ts`).

**Commit(s):**
```txt
feat(core): map record.* bindings to buildRecordContext path form

Align toRecordContextPaths with P3 normalizeRecordPaths (filter + strip).

Refs: A2
```

**Definition of done:** all acceptance criteria + Verifier sign-off + merged into `integration/rr-doc-builder-2`.
