### TASK A1 — `extractBindings` in `@templara/core`
**Status:** done (merged into `integration/rr-doc-builder-2`)  
**Stream:** A — Data binding   **Depends on:** none (parallel with G0)   **Model tier:** executor  
**Branch:** `feat/binding-path-extractor` (cut from `integration/rr-doc-builder-2`)

**Context (why):**  
Host context is path-driven: `extractTemplatePaths` → `normalizeRecordPaths` → `buildRecordContext` ([P3-context-builder.md](../../discovery/P3-context-builder.md), [00-DISCOVERY-REPORT.md](../../discovery/00-DISCOVERY-REPORT.md) §6.3). Templara must expose an equivalent “which paths does this template reference?” API so the host can hydrate real records without a Handlebars string walk. Binding extraction is an **adapter/core concern**, not a renderer feature ([architecture.md](../../architecture.md)).

**Scope (do exactly this):**
1. Add a public API in `packages/core/src/` (new file e.g. `extractBindings.ts` or `bindings.ts`):
   - `extractBindings(template: DocumentTemplate): string[]`
   - Returns **unique**, **sorted** (localeCompare / UTF-16 default sort is fine; document the choice) binding **path strings**.
2. Walk **all** path-bearing shapes. Prefer lifting/generalizing the private walker in [`packages/core/src/validation.ts`](../../../packages/core/src/validation.ts) (`forEachNode` / `childCollections`) so validation and extraction share one walk — either export a shared internal walker module or duplicate the child recursion carefully and keep both in sync (prefer shared).
3. Collect paths from at least:
   - `FieldRun.binding.path`
   - Image / barcode / QR `DynamicValue` when `kind === "binding"` → `binding.path`
   - `DynamicValue` `kind === "template"` → recurse `parts` (FieldRuns)
   - `DynamicValue` `kind === "formula"` → `formula.path` for `sum`/`count`; recurse operands for arithmetic/concat when operand is binding/path-bearing
   - `RepeatNode.binding.path`
   - `GridNode.binding?.path`
   - Grid `header` / `row` / `footer` / `staticRows` cell content (via normal node walk)
   - `ExpressionRef.source` and `ExpressionRef.compareSource` on conditionals and on `NodeLogic.visibleIf` / `repeatItemIf`
   - `variables[].value` when the variable value is path-bearing (`DynamicValue` / binding)
   - Any other `BindingRef` reachable from the template tree / schema fields already used by validation
4. Export `extractBindings` from `packages/core/src/index.ts` (public package surface).
5. Optionally add `extractBindingsDetailed` **only if** tests need kind tags; keep the public surface minimal — default is paths-only.
6. Unit tests in `packages/core/src/extractBindings.test.ts` (or `bindings.test.ts`):
   - Inline mini-templates covering: field binding, repeat binding, conditional `source`, `visibleIf`, formula `sum` path, image binding.
   - Assert uniqueness + sorted order.
   - Prefer **self-contained** fixtures in core tests (do not make `@templara/core` depend on `@templara/templates` at runtime). Golden coverage of `invoiceTemplate` belongs in `apps/evals` (G1 follow-up), not as a core production dependency.
7. Add a Changeset for `@templara/core` (`minor` or `patch` — prefer **minor** if this is a new public export on `0.1.x`).

**What NOT to touch:**
- Do not implement `toRecordContextPaths` here if it can be a separate commit — that is **A2** (may land on the same branch after A1).
- Do not import Rose Rocket / platform-model code.
- Do not change renderer or editor packages.
- Do not add Handlebars parsing.
- Do not change validation behavior except shared walker extraction.

**Inputs / references:**
- Types: [`packages/core/src/index.ts`](../../../packages/core/src/index.ts) — `DocumentTemplate`, `BindingRef`, `DynamicValue`, `ExpressionRef`, `RepeatNode`, `GridNode`, etc.
- Walker: [`packages/core/src/validation.ts`](../../../packages/core/src/validation.ts) `forEachNode` / `childCollections`
- Audit: [P3](../../discovery/P3-context-builder.md), discovery §6 item 3

**Best-practice research:**  
Web-search: “AST visitor pattern TypeScript collect unique paths” / “tree walk visitor share validation and extraction” — prefer a single visitor over copy-paste.

**Acceptance criteria (testable):**
- [x] `extractBindings` exported from `@templara/core`.
- [x] Unit tests cover the node kinds listed above (at least field, repeat, conditional/visibleIf, formula path, image binding).
- [x] Output is unique and sorted; empty template → `[]`.
- [x] Changeset present for `@templara/core`.
- [x] `pnpm typecheck && pnpm test && pnpm build` green.
- [x] `pnpm run release:check` green if that is the publishable-package gate used in this repo.

**Tests to write:**
- Core unit: `extractBindings.test.ts` with inline templates.
- Integration (Verifier / G1): evals can call `extractBindings(invoiceTemplate)` once A1 is on integration.

**Commit(s):**
```txt
feat(core): extract unique sorted binding paths from DocumentTemplate

Refs: A1
```

**Definition of done:** all acceptance criteria + Verifier sign-off + merged into `integration/rr-doc-builder-2`.
