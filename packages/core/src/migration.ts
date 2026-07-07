import type { DocumentTemplate } from "./index.js";

/**
 * The template schema version this build of `@templara/core` authors and
 * renders. Bump this whenever a breaking structural change ships and add a
 * matching migration to `TEMPLATE_MIGRATIONS`.
 */
export const CURRENT_TEMPLATE_VERSION = "0.0.1";

const FALLBACK_VERSION = "0.0.0";

export interface TemplateMigration {
  from: string;
  to: string;
  description: string;
  migrate: (template: DocumentTemplate) => DocumentTemplate;
}

/**
 * Ordered list of structural migrations. Each entry upgrades a template from
 * `from` to `to`. There are no breaking versions yet, so the registry is empty;
 * the runner below is the stable seam future migrations plug into.
 */
export const TEMPLATE_MIGRATIONS: TemplateMigration[] = [];

export interface MigrationResult {
  template: DocumentTemplate;
  migrated: boolean;
  fromVersion: string;
  toVersion: string;
  applied: string[];
}

export function templateVersion(template: DocumentTemplate): string {
  return template.version || FALLBACK_VERSION;
}

export function needsMigration(template: DocumentTemplate): boolean {
  return compareVersions(templateVersion(template), CURRENT_TEMPLATE_VERSION) < 0;
}

/**
 * Brings a template up to {@link CURRENT_TEMPLATE_VERSION} by applying every
 * registered migration whose `from` matches the working version, in order. If
 * no migration path exists but the template is still behind, the version is
 * normalized (stamped) to the current version so downstream code has a single
 * source of truth. Never mutates the input.
 */
export function migrateTemplate(template: DocumentTemplate): MigrationResult {
  const fromVersion = templateVersion(template);
  let working: DocumentTemplate = structuredCloneTemplate(template);
  const applied: string[] = [];

  let guard = 0;
  while (compareVersions(working.version || FALLBACK_VERSION, CURRENT_TEMPLATE_VERSION) < 0) {
    const currentVersion = working.version || FALLBACK_VERSION;
    const migration = TEMPLATE_MIGRATIONS.find((entry) => entry.from === currentVersion);

    if (!migration) {
      break;
    }

    working = migration.migrate(working);
    working.version = migration.to;
    applied.push(`${migration.from}->${migration.to}`);

    guard += 1;
    if (guard > TEMPLATE_MIGRATIONS.length + 1) {
      break;
    }
  }

  if (compareVersions(working.version || FALLBACK_VERSION, CURRENT_TEMPLATE_VERSION) !== 0) {
    working.version = CURRENT_TEMPLATE_VERSION;
  }

  return {
    template: working,
    migrated: applied.length > 0 || fromVersion !== working.version,
    fromVersion,
    toVersion: working.version,
    applied,
  };
}

/**
 * Compares two dot-separated numeric versions. Returns a negative number when
 * `a < b`, zero when equal, positive when `a > b`. Non-numeric segments are
 * treated as 0.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const aValue = aParts[index] ?? 0;
    const bValue = bParts[index] ?? 0;

    if (aValue !== bValue) {
      return aValue < bValue ? -1 : 1;
    }
  }

  return 0;
}

function parseVersion(version: string): number[] {
  return String(version)
    .split(".")
    .map((segment) => {
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

function structuredCloneTemplate(template: DocumentTemplate): DocumentTemplate {
  if (typeof structuredClone === "function") {
    return structuredClone(template);
  }

  return JSON.parse(JSON.stringify(template)) as DocumentTemplate;
}
