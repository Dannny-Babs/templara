/**
 * Golden: extractBindings(invoiceTemplate) — Stream A (ticket A1) on integration.
 */
import { extractBindings } from "@templara/core";
import { invoiceTemplate } from "@templara/templates";
import { describe, expect, it } from "vitest";

describe("extractBindings(invoiceTemplate) golden", () => {
  it("returns a non-empty sorted unique path list", () => {
    const paths = extractBindings(invoiceTemplate);

    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toEqual([...paths].sort());
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    }
  });
});
