import { describe, expect, it } from "vitest";
import { filterLayerTreeRows } from "./layerTree.js";

describe("filterLayerTreeRows", () => {
  const rows = [
    { label: "Page 1", type: "page" },
    { label: "Company header", type: "frame", nodeId: "frame-1" },
    { label: "Invoice total", type: "text", nodeId: "text-total" },
    { label: "Line items", type: "repeat", nodeId: "repeat-lines" },
  ];

  it("returns all rows for empty query", () => {
    expect(filterLayerTreeRows(rows, "")).toEqual(rows);
    expect(filterLayerTreeRows(rows, "   ")).toEqual(rows);
  });

  it("matches label case-insensitively", () => {
    expect(filterLayerTreeRows(rows, "invoice")).toEqual([
      { label: "Invoice total", type: "text", nodeId: "text-total" },
    ]);
  });

  it("matches type and node id", () => {
    expect(filterLayerTreeRows(rows, "repeat")).toHaveLength(1);
    expect(filterLayerTreeRows(rows, "text-total")).toHaveLength(1);
  });
});
