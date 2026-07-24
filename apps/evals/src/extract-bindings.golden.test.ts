/**
 * Golden: extractBindings(invoiceTemplate) — depends on Stream A (ticket A1).
 *
 * Conditionally skipped until `@templara/core` exports `extractBindings`.
 * Do not reimplement extraction here; enable this suite once A1 merges onto
 * the same integration branch.
 */
import * as core from "@templara/core";
import { invoiceTemplate } from "@templara/templates";
import { describe, expect, it } from "vitest";

type ExtractBindings = (template: typeof invoiceTemplate) => string[];

const maybeExtract = (core as unknown as { extractBindings?: unknown }).extractBindings;
const extractBindings: ExtractBindings | undefined =
  typeof maybeExtract === "function" ? (maybeExtract as ExtractBindings) : undefined;

describe("extractBindings(invoiceTemplate) golden [post-A1]", () => {
  it.skipIf(!extractBindings)(
    "returns a non-empty sorted unique path list",
    () => {
      // TODO(A1): remove skip once extractBindings is exported from @templara/core
      const paths = extractBindings!(invoiceTemplate);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths).toEqual([...paths].sort());
      expect(new Set(paths).size).toBe(paths.length);
      for (const path of paths) {
        expect(typeof path).toBe("string");
        expect(path.length).toBeGreaterThan(0);
      }
    },
  );

  it("documents A1 dependency when extractBindings is missing", () => {
    if (extractBindings) {
      expect(extractBindings).toBeTypeOf("function");
      return;
    }
    // Soft signal in reports: suite stays green; golden above is skipped until A1.
    expect(extractBindings).toBeUndefined();
  });
});
