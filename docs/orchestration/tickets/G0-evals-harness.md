### TASK G0 — Stand up `apps/evals` package + Vitest
**Stream:** G — Docs, fixtures & evals   **Depends on:** none   **Model tier:** executor  
**Branch:** `chore/eval-harness-setup` (cut from `integration/rr-doc-builder-2`)

**Context (why):**  
Nothing merges without gates ([orchestration-plan.md](../../orchestration-plan.md) §5, §10). Wave 1 needs a private eval app that can load discovery fixtures and later assert binding extraction / SSR fidelity. Discovery fixtures live at [docs/discovery/fixtures/](../../discovery/fixtures/) and are the source of truth ([00-DISCOVERY-REPORT.md](../../discovery/00-DISCOVERY-REPORT.md)).

**Scope (do exactly this):**
1. Create `apps/evals/` as a **private** workspace package (`"private": true`, name `@templara/evals`).
2. Add `package.json` with:
   - `"type": "module"`
   - scripts: `"test": "vitest run"`, `"typecheck": "tsc -p tsconfig.json --noEmit"` (and `"build": "echo 'no build'"` or equivalent no-op if workspace `pnpm -r build` requires it — mirror other apps that skip a real build, or omit build only if recursive build already skips packages without a build script; prefer a no-op `build` script if needed for green CI).
   - dependencies: `@templara/core` and `@templara/templates` as `workspace:*`.
   - Do **not** add `@templara/renderer` / `@templara/react-renderer` yet (that is G2 / Stream B).
3. Add `tsconfig.json` consistent with other apps (e.g. `apps/playground`); target ESM; include `src` and `fixtures` as needed.
4. Add a minimal `vitest.config.ts` (or vitest section) so `pnpm --filter @templara/evals test` works. Prefer inheriting root Vitest if that is the repo pattern; otherwise a local config is fine.
5. Add `apps/evals/README.md` stating:
   - Purpose: contract / golden tests for Rose Rocket integration.
   - Fixture provenance: `apps/evals/fixtures/` is a **copy** of `docs/discovery/fixtures/`; discovery folder remains source of truth — update docs first, then re-copy.
6. **Copy** (not symlink) these files into `apps/evals/fixtures/`:
   - `invoice-context.json`
   - `invoice-record.serialized.json`
   - `invoice-Invoice.handlebars`
   - `invoice-rendered.html`
   - (optional for G0: other handlebars fixtures — include at least the invoice set above)
7. Add one smoke test `apps/evals/src/fixtures-load.test.ts` that:
   - Reads/parses `fixtures/invoice-context.json` as JSON.
   - Asserts it is a non-null object.
8. Wire into workspace: `pnpm-workspace.yaml` already includes `apps/*` — no change needed if that is true. Run `pnpm install` from repo root if the lockfile must update.
9. Confirm root `pnpm test` invokes the new package (recursive `-r test`).

**What NOT to touch:**
- Do not implement `extractBindings` (A1).
- Do not add SSR / HTML comparison tests (G2).
- Do not modify `docs/discovery/fixtures/` contents.
- Do not publish `@templara/evals`.
- Do not add husky/commitlint.

**Inputs / references:**
- [docs/discovery/fixtures/](../../discovery/fixtures/)
- Root [package.json](../../../package.json) scripts (`test`, `typecheck`)
- Sibling app patterns: `apps/playground/package.json`

**Best-practice research:**  
Web-search: “Vitest monorepo workspace package setup 2025” / “pnpm workspace private package vitest” — confirm current Vitest config defaults for ESM packages.

**Acceptance criteria (testable):**
- [ ] `apps/evals` exists with `package.json`, README, copied invoice fixtures, smoke test.
- [ ] `pnpm --filter @templara/evals test` passes.
- [ ] `pnpm typecheck && pnpm test && pnpm build` green from repo root.
- [ ] README documents fixture copy provenance.

**Tests to write:**
- Unit/smoke: `fixtures-load.test.ts` (JSON parse).
- No integration tests beyond package wiring.

**Commit(s):**
```txt
chore(evals): add apps/evals Vitest harness with invoice fixtures

Refs: G0
```

**Definition of done:** all acceptance criteria + Verifier sign-off + merged into `integration/rr-doc-builder-2`.
