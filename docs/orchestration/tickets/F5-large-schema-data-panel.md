### TASK F5 — Large schema / data panel search & scale
**Status:** done (Wave 5 — search + usable browse; not full virtualization)  
**Stream:** F — Editor UX   **Depends on:** F1  
**Field-test:** §3.1, §3.7, §1.11 (data side)  
**Branch:** `integration/rr-doc-builder-2-wave5`

**Context (why):**  
Order schema ~3k fields overwhelms the data panel. Search existed but dropped ancestors, expanded everything by default, and showed `$` system keys.

**Shipped:**
1. Hide `$…` / `_note` system paths by default (`hideSystemFields`).
2. Search retains ancestor chain for matched leaves.
3. Auto-collapse parent rows when field count ≥ 80.
4. `dataFieldsFromLabelMap` + fixture test against `docs/fixtures/order-schema-sample.json` (build + search latency budget).

**Deferred:**
- True windowed virtualization for 3k+ fully expanded trees.
- Connection sub-object grouping UX beyond collapse/search.
- Binding UX overhaul (out of AC).

**Acceptance:**
- [x] Searchable browse against large schema fixture.
- [x] System fields hidden by default.
- [x] Perf smoke on fixture build+search (&lt;250ms in unit test).
- [ ] Full list virtualization (follow-up if hosts still hitch when expanding everything).
