import type {
  DocumentTemplate,
  DynamicValue,
  ExpressionRef,
  FormulaExpression,
  FormulaOperand,
  InlineContent,
  ImageSource,
} from "./index.js";
import { forEachNode, type AnyNode } from "./walk.js";

/**
 * Collect every binding path referenced by a template.
 *
 * Paths are unique and sorted with the default UTF-16 string order
 * (`Array.prototype.sort` / `localeCompare` not applied). An empty or
 * path-free template returns `[]`.
 */
export function extractBindings(template: DocumentTemplate): string[] {
  const paths = new Set<string>();
  const add = (path: string | undefined | null): void => {
    if (path) {
      paths.add(path);
    }
  };

  for (const page of template.pages ?? []) {
    for (const layer of page.layers ?? []) {
      forEachNode(layer.nodes ?? [], (node) => {
        collectFromNode(node, add);
      });
    }
  }

  for (const variable of template.variables ?? []) {
    collectFromDynamicValue(variable.value, add);
  }

  return [...paths].sort();
}

/**
 * Map Templara binding paths to the form expected by a host `buildRecordContext`.
 *
 * Aligned with Doc Builder 1 P3 `normalizeRecordPaths`: keep only paths that
 * start with the exact prefix `record.` (case-sensitive), then strip that
 * prefix. This helper additionally collapses duplicates, sorts (same policy
 * as {@link extractBindings}), and drops empty strings (e.g. bare `"record."`).
 *
 * Host templates / bindings intended for Rose Rocket context must use
 * `record.*` (and separately `org.*` / `document.*`) path prefixes.
 * `org.*` and `document.*` are sourced separately by the host and are dropped
 * here. Demo/sample templates that use domains like `invoice.*` / `business.*`
 * correctly yield `[]` until paths are remapped by a host adapter.
 *
 * @see docs/discovery/P3-context-builder.md §2c
 */
export function toRecordContextPaths(paths: string[]): string[] {
  const prefix = "record.";
  const normalized = new Set<string>();

  for (const path of paths) {
    if (!path.startsWith(prefix)) {
      continue;
    }

    const stripped = path.slice(prefix.length);
    if (!stripped) {
      continue;
    }

    normalized.add(stripped);
  }

  return [...normalized].sort();
}

function collectFromNode(node: AnyNode, add: (path: string | undefined | null) => void): void {
  if (node.logic?.visibleIf) {
    collectFromExpression(node.logic.visibleIf, add);
  }
  if (node.logic?.repeatItemIf) {
    collectFromExpression(node.logic.repeatItemIf, add);
  }

  switch (node.type) {
    case "text":
      collectFromInlineContent(node.content, add);
      break;
    case "image":
      collectFromImageSource(node.source, add);
      break;
    case "barcode":
    case "qr":
      collectFromDynamicValue(node.value, add);
      break;
    case "repeat":
      add(node.binding?.path);
      break;
    case "conditional":
      collectFromExpression(node.condition, add);
      break;
    case "grid":
      add(node.binding?.path);
      break;
    default:
      break;
  }
}

function collectFromExpression(
  expression: ExpressionRef,
  add: (path: string | undefined | null) => void,
): void {
  add(expression.source);
  add(expression.compareSource);
}

function collectFromInlineContent(
  content: InlineContent[] | undefined,
  add: (path: string | undefined | null) => void,
): void {
  for (const part of content ?? []) {
    if (part.kind === "field") {
      add(part.binding.path);
    }
  }
}

function collectFromImageSource(
  source: ImageSource,
  add: (path: string | undefined | null) => void,
): void {
  if (source.kind === "binding") {
    add(source.binding.path);
  }
}

function collectFromDynamicValue(
  value: DynamicValue,
  add: (path: string | undefined | null) => void,
): void {
  switch (value.kind) {
    case "binding":
      add(value.binding.path);
      break;
    case "template":
      collectFromInlineContent(value.parts, add);
      break;
    case "formula":
      collectFromFormula(value.formula, add);
      break;
    default:
      break;
  }
}

function collectFromFormula(
  formula: FormulaExpression,
  add: (path: string | undefined | null) => void,
): void {
  if (formula.op === "sum" || formula.op === "count") {
    add(formula.path);
    return;
  }

  if (formula.op === "concat") {
    for (const part of formula.parts) {
      collectFromOperand(part, add);
    }
    return;
  }

  collectFromOperand(formula.left, add);
  collectFromOperand(formula.right, add);
}

function collectFromOperand(
  operand: FormulaOperand,
  add: (path: string | undefined | null) => void,
): void {
  if (operand.kind === "path") {
    add(operand.path);
  }
}
