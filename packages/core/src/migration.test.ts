import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "./index";
import type { DocumentTemplate } from "./index";
import {
  CURRENT_TEMPLATE_VERSION,
  compareVersions,
  migrateTemplate,
  needsMigration,
} from "./migration";

function template(version: string): DocumentTemplate {
  return {
    id: "tpl",
    version,
    unit: "px",
    pages: [
      {
        id: "page-1",
        size: PAGE_PRESETS.letter,
        layers: [],
      },
    ],
  };
}

describe("compareVersions", () => {
  it("orders versions numerically", () => {
    expect(compareVersions("0.0.1", "0.0.2")).toBeLessThan(0);
    expect(compareVersions("0.1.0", "0.0.9")).toBeGreaterThan(0);
    expect(compareVersions("0.0.1", "0.0.1")).toBe(0);
  });

  it("treats missing segments as zero", () => {
    expect(compareVersions("1", "1.0.0")).toBe(0);
  });
});

describe("needsMigration", () => {
  it("is false for a current template", () => {
    expect(needsMigration(template(CURRENT_TEMPLATE_VERSION))).toBe(false);
  });

  it("is true for an older template", () => {
    expect(needsMigration(template("0.0.0"))).toBe(true);
  });
});

describe("migrateTemplate", () => {
  it("returns a current template untouched (no version change)", () => {
    const result = migrateTemplate(template(CURRENT_TEMPLATE_VERSION));
    expect(result.migrated).toBe(false);
    expect(result.toVersion).toBe(CURRENT_TEMPLATE_VERSION);
    expect(result.applied).toEqual([]);
  });

  it("normalizes an unversioned template to the current version", () => {
    const input = template("");
    const result = migrateTemplate(input);
    expect(result.toVersion).toBe(CURRENT_TEMPLATE_VERSION);
    expect(result.migrated).toBe(true);
  });

  it("does not mutate the input template", () => {
    const input = template("");
    migrateTemplate(input);
    expect(input.version).toBe("");
  });
});
