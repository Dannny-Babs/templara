import { describe, expect, it } from "vitest";
import type { DocumentTemplate } from "@templara/core";
import {
  createInitialProjectStore,
  createProjectFromSeed,
  importProjectBundle,
  isProjectDirty,
  loadProjectStore,
  markProjectSaved,
  safeProjectFileName,
  saveProjectStore,
  serializeProjectBundle,
} from "./projects";
import type { ProjectStorageLike, TemplateSeed } from "./projects";

const baseTemplate: DocumentTemplate = {
  id: "blank",
  version: "0.0.1",
  unit: "px",
  metadata: { name: "Blank" },
  pages: [
    {
      id: "page-1",
      size: { width: 816, height: 1056 },
      layers: [{ id: "fixed", kind: "fixed", nodes: [] }],
    },
  ],
};

const seed: TemplateSeed = {
  id: "blank",
  label: "Blank",
  template: baseTemplate,
  data: { customer: { name: "Ada" } },
};

class MemoryStorage implements ProjectStorageLike {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("studio project persistence", () => {
  it("creates an initial blank project store", () => {
    const store = createInitialProjectStore([seed]);

    expect(store.projects).toHaveLength(1);
    expect(store.selectedProjectId).toBe("project-blank");
    expect(store.projects[0]?.template.metadata?.name).toBe("Blank");
  });

  it("clones starter templates before editing", () => {
    const project = createProjectFromSeed(seed, { id: "project-a", now: "2026-01-01T00:00:00.000Z" });

    project.template.metadata = { name: "Edited" };
    project.data.customer = { name: "Grace" };

    expect(seed.template.metadata?.name).toBe("Blank");
    expect(seed.data).toEqual({ customer: { name: "Ada" } });
  });

  it("saves and loads a project store", () => {
    const storage = new MemoryStorage();
    const store = createInitialProjectStore([seed]);

    saveProjectStore(storage, store);

    expect(loadProjectStore(storage, [seed])).toEqual(store);
  });

  it("falls back to a blank project and clears malformed local storage", () => {
    const storage = new MemoryStorage();

    storage.setItem("templara.studio.projects.v1", "{broken");
    const store = loadProjectStore(storage, [seed]);

    expect(store.selectedProjectId).toBe("project-blank");
    expect(storage.getItem("templara.studio.projects.v1")).toBeNull();
  });

  it("round-trips project import and export with validation", () => {
    const project = createProjectFromSeed(seed, { id: "project-a", now: "2026-01-01T00:00:00.000Z" });

    const result = importProjectBundle(serializeProjectBundle(project), {
      now: "2026-01-02T00:00:00.000Z",
    });

    expect(result.project).toEqual(project);
    expect(result.warnings).toEqual([]);
  });

  it("rejects invalid project bundles", () => {
    const project = createProjectFromSeed(seed, { id: "project-a" });
    project.template.pages = [];

    expect(() => importProjectBundle(serializeProjectBundle(project))).toThrow(
      "Template has no pages.",
    );
  });

  it("tracks dirty state using template, data, and name", () => {
    const saved = createProjectFromSeed(seed, { id: "project-a", now: "2026-01-01T00:00:00.000Z" });
    const current = markProjectSaved(saved, { now: "2026-01-02T00:00:00.000Z" });

    expect(isProjectDirty(current, saved)).toBe(false);

    current.data.customer = { name: "Grace" };

    expect(isProjectDirty(current, saved)).toBe(true);
  });

  it("builds safe export filenames", () => {
    expect(safeProjectFileName("Shipment BOL Template")).toBe("shipment-bol-template.templara.json");
    expect(safeProjectFileName("   ")).toBe("templara-project.templara.json");
  });
});
