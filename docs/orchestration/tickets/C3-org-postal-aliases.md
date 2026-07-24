### TASK C3 — Org address `postal` vs `postalCode` adapter aliases
**Status:** done (Wave 3)  
**Stream:** C — Value adapter   **Depends on:** C2   **Model tier:** executor  
**Branch:** `integration/rr-doc-builder-2-wave3`

**Context (why):**  
Live DB1 bug ([P3](../../discovery/P3-context-builder.md) §0 / §5.4, [P4](../../discovery/P4-real-templates-invoice-chain.md)): `getOrgAddress` emits `postal` on `org.orgAddress` / `org.remitToAddress`, but invoice/payStub templates read `postalCode` → org postal renders blank. Record addresses correctly use `postalCode`. In the Templara repo this is an **adapter helper / path alias map for hosts**, not a Rose Rocket platform-model fix.

**Scope (do exactly this):**
1. Add `packages/core/src/orgAddressPathAliases.ts` exporting:
   - `ORG_ADDRESS_PATH_ALIASES` — bidirectional map documenting `org.orgAddress.postalCode` ↔ `org.orgAddress.postal` (and remitToAddress).
   - `ORG_ADDRESS_OBJECT_KEYS` — `["orgAddress", "remitToAddress"]`.
   - `mirrorOrgAddressPostalKeys(address)` — copy non-empty `postal` ↔ `postalCode` when only one is set; if both set, leave both.
   - `aliasOrgAddressPaths(context)` — shallow-copy `{ org }` and mirror those address objects; **do not** mutate `record.*` addresses.
2. Unit tests in `packages/core/src/orgAddressPathAliases.test.ts`.
3. Evals: assert fixture `invoice-context.json` gains `org.orgAddress.postalCode` after alias (may share G2 file).
4. Changeset: `@templara/core` **minor**.
5. Export from `packages/core/src/index.ts`.

**What NOT to touch:**
- Do not patch Rose Rocket `getOrgAddress` / invent platform-model POSTs.
- Do not rewrite discovery fixtures’ `_note` (keep evidence of the live bug).
- Do not alias record `invoiceToAddress` / stop `location` (already `postalCode`).

**Inputs / references:**
- P3 §5.4; `apps/evals/fixtures/invoice-context.json` (`postal` on org, `postalCode` on record).

**Best-practice research:**  
Adapter aliases at the host boundary; keep core helpers pure and documented so weak executors do not “fix” the wrong system.

**Acceptance criteria (testable):**
- [x] Aliases + helpers exported from `@templara/core`.
- [x] Unit tests cover mirror / org-only / passthrough.
- [x] Evals prove fixture postalCode fill without touching record addresses.
- [x] Changeset present.

**Tests to write:** core unit + evals fixture alias check.

**Commit(s):**
```txt
feat(core): add org address postal ↔ postalCode adapter aliases

Refs: C3
```

**Definition of done:** acceptance criteria + Verifier + Wave 3 merge.
