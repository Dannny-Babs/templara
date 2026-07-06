import { migrateTemplate, validateTemplate } from "@templara/core";
import type { DocumentTemplate, ValidationIssue } from "@templara/core";

export interface TemplaraProject {
  id: string;
  name: string;
  template: DocumentTemplate;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastSavedAt: string;
  sourceTemplateId: string;
}

export interface TemplaraProjectStore {
  version: 1;
  selectedProjectId: string;
  projects: TemplaraProject[];
}

export interface TemplateSeed {
  id: string;
  label: string;
  template: DocumentTemplate;
  data: Record<string, unknown>;
}

export interface ProjectImportResult {
  project: TemplaraProject;
  migrated: boolean;
  warnings: ValidationIssue[];
}

export interface ProjectStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORE_KEY = "templara.studio.projects.v1";
const PROJECT_BUNDLE_KIND = "templara.project";
const PROJECT_BUNDLE_VERSION = 1;

export function createProjectFromSeed(
  seed: TemplateSeed,
  options: { id?: string; name?: string; now?: string } = {},
): TemplaraProject {
  const now = options.now ?? new Date().toISOString();
  const template = cloneJson(seed.template);
  const name = options.name ?? seed.label;

  template.metadata = {
    ...template.metadata,
    name,
  };

  return {
    id: options.id ?? createProjectId(seed.id),
    name,
    template,
    data: cloneJson(seed.data),
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
    sourceTemplateId: seed.id,
  };
}

export function createInitialProjectStore(seeds: TemplateSeed[]): TemplaraProjectStore {
  const blankSeed = seeds[0];

  if (!blankSeed) {
    throw new Error("At least one template seed is required.");
  }

  const project = createProjectFromSeed(blankSeed, {
    id: "project-blank",
    name: "Blank",
  });

  return {
    version: 1,
    selectedProjectId: project.id,
    projects: [project],
  };
}

export function loadProjectStore(
  storage: ProjectStorageLike | undefined,
  seeds: TemplateSeed[],
): TemplaraProjectStore {
  if (!storage) {
    return createInitialProjectStore(seeds);
  }

  const raw = storage.getItem(STORE_KEY);

  if (!raw) {
    return createInitialProjectStore(seeds);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const store = normalizeProjectStore(parsed);

    if (store.projects.length === 0) {
      return createInitialProjectStore(seeds);
    }

    return store;
  } catch {
    storage.removeItem(STORE_KEY);
    return createInitialProjectStore(seeds);
  }
}

export function saveProjectStore(
  storage: ProjectStorageLike | undefined,
  store: TemplaraProjectStore,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(STORE_KEY, JSON.stringify(store));
}

export function serializeProjectBundle(project: TemplaraProject): string {
  return JSON.stringify(
    {
      kind: PROJECT_BUNDLE_KIND,
      version: PROJECT_BUNDLE_VERSION,
      project,
    },
    null,
    2,
  );
}

export function importProjectBundle(
  input: string,
  options: { now?: string } = {},
): ProjectImportResult {
  const parsed = JSON.parse(input) as unknown;
  const bundle = parsed as {
    kind?: unknown;
    version?: unknown;
    project?: unknown;
  };

  if (bundle.kind !== PROJECT_BUNDLE_KIND || bundle.version !== PROJECT_BUNDLE_VERSION) {
    throw new Error("This file is not a Templara project bundle.");
  }

  const project = normalizeProject(bundle.project, options.now);
  const migration = migrateTemplate(project.template);
  const validation = validateTemplate(migration.template);

  if (!validation.valid) {
    throw new Error(validation.errors[0]?.message ?? "Imported template is invalid.");
  }

  project.template = migration.template;

  return {
    project,
    migrated: migration.migrated,
    warnings: validation.warnings,
  };
}

export function markProjectSaved(
  project: TemplaraProject,
  options: { now?: string } = {},
): TemplaraProject {
  const now = options.now ?? new Date().toISOString();

  return {
    ...cloneProject(project),
    updatedAt: now,
    lastSavedAt: now,
  };
}

export function cloneProject(project: TemplaraProject): TemplaraProject {
  return {
    ...project,
    template: cloneJson(project.template),
    data: cloneJson(project.data),
  };
}

export function projectSignature(project: Pick<TemplaraProject, "name" | "template" | "data">): string {
  return stableStringify({
    name: project.name,
    template: project.template,
    data: project.data,
  });
}

export function isProjectDirty(current: TemplaraProject, saved?: TemplaraProject): boolean {
  if (!saved) {
    return true;
  }

  return projectSignature(current) !== projectSignature(saved);
}

export function safeProjectFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "templara-project"}.templara.json`;
}

function normalizeProjectStore(input: unknown): TemplaraProjectStore {
  const value = input as Partial<TemplaraProjectStore>;

  if (value.version !== 1 || !Array.isArray(value.projects)) {
    throw new Error("Unsupported project store.");
  }

  const projects = value.projects.map((project) => normalizeProject(project));
  const selectedProjectId =
    typeof value.selectedProjectId === "string" &&
    projects.some((project) => project.id === value.selectedProjectId)
      ? value.selectedProjectId
      : projects[0]?.id ?? "";

  return {
    version: 1,
    selectedProjectId,
    projects,
  };
}

function normalizeProject(input: unknown, now = new Date().toISOString()): TemplaraProject {
  const value = input as Partial<TemplaraProject>;

  if (!value || typeof value !== "object") {
    throw new Error("Project is missing.");
  }

  if (!value.template || !Array.isArray(value.template.pages)) {
    throw new Error("Project template is missing.");
  }

  return {
    id: typeof value.id === "string" && value.id ? value.id : createProjectId("project"),
    name:
      typeof value.name === "string" && value.name
        ? value.name
        : String(value.template.metadata?.name ?? value.template.id ?? "Untitled"),
    template: cloneJson(value.template),
    data: isRecord(value.data) ? cloneJson(value.data) : {},
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
    lastSavedAt: typeof value.lastSavedAt === "string" ? value.lastSavedAt : now,
    sourceTemplateId:
      typeof value.sourceTemplateId === "string" && value.sourceTemplateId
        ? value.sourceTemplateId
        : String(value.template.id ?? "unknown"),
  };
}

function createProjectId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${suffix}`;
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }

  return value;
}
