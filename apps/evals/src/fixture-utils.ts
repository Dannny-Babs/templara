import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Absolute path to a file under `apps/evals/fixtures/`. */
export function fixturePath(...parts: string[]): string {
  return join(packageRoot, "fixtures", ...parts);
}

/** Read and parse a JSON fixture. */
export function loadJsonFixture<T = unknown>(...parts: string[]): T {
  const raw = readFileSync(fixturePath(...parts), "utf8");
  return JSON.parse(raw) as T;
}

/** Resolve a dotted path against a plain object (e.g. `record.total.withDecimalsAndCurrencyCode`). */
export function getAtPath(root: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Depth-first walk; yields dotted paths whose final segment equals `leafKey`.
 * Array indices are included as numeric path segments.
 */
export function findPathsEndingWith(root: unknown, leafKey: string, prefix = ""): string[] {
  const found: string[] = [];

  function visit(value: unknown, path: string): void {
    if (value === null || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, path ? `${path}.${index}` : String(index)));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      if (key === leafKey && typeof child === "string") {
        found.push(next);
      }
      visit(child, next);
    }
  }

  visit(root, prefix);
  return found;
}
