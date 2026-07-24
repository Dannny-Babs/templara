import type {
  DocumentTemplate,
  FormulaExpression,
  FormulaOperand,
  VariableDefinition,
} from "./index.js";
import { forEachNode, type AnyNode } from "./walk.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  /** Dotted location such as `pages[0].layers[1].node:title`. */
  path?: string;
  nodeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

type AnyNode = DocNode | FlowNode;

/**
 * Structurally validates a template before it is rendered or persisted. This is
 * intentionally conservative: errors mean "will not render correctly", warnings
 * mean "likely authoring mistake". It never throws.
 */
export function validateTemplate(template: DocumentTemplate): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (issue: ValidationIssue): void => {
    issues.push(issue);
  };

  if (!template.id) {
    push({
      code: "template.missing_id",
      severity: "error",
      message: "Template is missing an id.",
    });
  }

  if (!template.version) {
    push({
      code: "template.missing_version",
      severity: "warning",
      message: "Template has no version; migrations cannot be applied safely.",
    });
  }

  if (!Array.isArray(template.pages) || template.pages.length === 0) {
    push({
      code: "template.no_pages",
      severity: "error",
      message: "Template has no pages.",
    });
  }

  const seenPageIds = new Set<string>();
  const seenNodeIds = new Set<string>();

  template.pages?.forEach((page, pageIndex) => {
    const pagePath = `pages[${pageIndex}]`;

    if (!page.id) {
      push({
        code: "page.missing_id",
        severity: "error",
        message: `Page at ${pagePath} is missing an id.`,
        path: pagePath,
      });
    } else if (seenPageIds.has(page.id)) {
      push({
        code: "page.duplicate_id",
        severity: "error",
        message: `Duplicate page id "${page.id}".`,
        path: pagePath,
      });
    } else {
      seenPageIds.add(page.id);
    }

    if (
      !page.size ||
      !isPositiveFinite(page.size.width) ||
      !isPositiveFinite(page.size.height)
    ) {
      push({
        code: "page.invalid_size",
        severity: "error",
        message: `Page "${page.id || pageIndex}" has an invalid size.`,
        path: pagePath,
      });
    }

    page.layers?.forEach((layer, layerIndex) => {
      const layerPath = `${pagePath}.layers[${layerIndex}]`;

      if (
        layer.kind !== "background" &&
        layer.kind !== "fixed" &&
        layer.kind !== "flow"
      ) {
        push({
          code: "layer.invalid_kind",
          severity: "error",
          message: `Layer "${layer.id}" has invalid kind "${String(layer.kind)}".`,
          path: layerPath,
        });
      }

      forEachNode(layer.nodes ?? [], (node, nodePath) => {
        validateNode(node, `${layerPath}.${nodePath}`, seenNodeIds, push);
      });
    });
  });

  validateVariables(template.variables ?? [], push);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

function validateNode(
  node: AnyNode,
  path: string,
  seenNodeIds: Set<string>,
  push: (issue: ValidationIssue) => void,
): void {
  if (!node.id) {
    push({
      code: "node.missing_id",
      severity: "error",
      message: `A ${node.type} node is missing an id.`,
      path,
    });
  } else if (seenNodeIds.has(node.id)) {
    push({
      code: "node.duplicate_id",
      severity: "error",
      message: `Duplicate node id "${node.id}".`,
      path,
      nodeId: node.id,
    });
  } else {
    seenNodeIds.add(node.id);
  }

  if (!node.frame || !isFiniteFrame(node.frame)) {
    push({
      code: "node.invalid_frame",
      severity: "error",
      message: `Node "${node.id}" has an invalid frame.`,
      path,
      nodeId: node.id,
    });
  }

  if (
    (node.type === "repeat" || node.type === "grid") &&
    node.binding != null &&
    !node.binding.path
  ) {
    push({
      code: "node.empty_binding",
      severity: "warning",
      message: `Node "${node.id}" has an empty binding path.`,
      path,
      nodeId: node.id,
    });
  }

  if (node.type === "repeat" && (!node.binding || !node.binding.path)) {
    push({
      code: "repeat.missing_binding",
      severity: "warning",
      message: `Repeat "${node.id}" has no data binding.`,
      path,
      nodeId: node.id,
    });
  }

  if (node.type === "text") {
    for (const part of node.content ?? []) {
      if (part.kind === "field" && !part.binding.path) {
        push({
          code: "text.empty_field_binding",
          severity: "warning",
          message: `Text node "${node.id}" has a field run with no binding path.`,
          path,
          nodeId: node.id,
        });
      }
    }
  }
}

function validateVariables(
  variables: VariableDefinition[],
  push: (issue: ValidationIssue) => void,
): void {
  const seen = new Set<string>();
  const byId = new Map<string, VariableDefinition>();

  for (const variable of variables) {
    if (!variable.id) {
      push({
        code: "variable.missing_id",
        severity: "error",
        message: `Variable "${variable.name ?? "unknown"}" is missing an id.`,
      });
      continue;
    }

    if (seen.has(variable.id)) {
      push({
        code: "variable.duplicate_id",
        severity: "error",
        message: `Duplicate variable id "${variable.id}".`,
      });
      continue;
    }

    seen.add(variable.id);
    byId.set(variable.id, variable);
  }

  for (const variable of byId.values()) {
    const cycle = findVariableCycle(variable.id, byId, new Set(), []);

    if (cycle) {
      push({
        code: "variable.cycle",
        severity: "error",
        message: `Variable "${variable.id}" is part of a dependency cycle: ${cycle.join(" -> ")}.`,
      });
    }
  }
}

function findVariableCycle(
  id: string,
  byId: Map<string, VariableDefinition>,
  visiting: Set<string>,
  trail: string[],
): string[] | null {
  if (visiting.has(id)) {
    return [...trail, id];
  }

  const variable = byId.get(id);

  if (!variable) {
    return null;
  }

  visiting.add(id);
  const nextTrail = [...trail, id];

  for (const dependencyId of variableDependencies(variable)) {
    if (!byId.has(dependencyId)) {
      continue;
    }

    const cycle = findVariableCycle(dependencyId, byId, visiting, nextTrail);

    if (cycle) {
      return cycle;
    }
  }

  visiting.delete(id);
  return null;
}

function variableDependencies(variable: VariableDefinition): string[] {
  if (variable.value.kind !== "formula") {
    return [];
  }

  return formulaVariableRefs(variable.value.formula);
}

function formulaVariableRefs(formula: FormulaExpression): string[] {
  if (formula.op === "concat") {
    return operandVariableIds(formula.parts);
  }

  if (
    formula.op === "add" ||
    formula.op === "subtract" ||
    formula.op === "multiply" ||
    formula.op === "divide"
  ) {
    return operandVariableIds([formula.left, formula.right]);
  }

  return [];
}

function operandVariableIds(operands: FormulaOperand[]): string[] {
  const ids: string[] = [];

  for (const operand of operands) {
    if (operand.kind === "variable") {
      ids.push(operand.id);
    }
  }

  return ids;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isFiniteFrame(frame: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  return (
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) &&
    Number.isFinite(frame.height)
  );
}
