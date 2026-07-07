import type {
  ExpressionOperator,
  ExpressionRef,
  FieldFormat,
  FormulaExpression,
  FormulaOperand,
} from "./index.js";

/**
 * Human-readable descriptions and a lightweight preview evaluator for the
 * structured logic language. These power the visual logic builders: they turn
 * an {@link ExpressionRef}, {@link FormulaExpression}, or {@link FieldFormat}
 * into plain English, and let the editor show whether a rule passes against
 * sample data without pulling in the renderer.
 */

const OPERATOR_PHRASES: Record<ExpressionOperator, string> = {
  truthy: "is set",
  falsy: "is empty",
  exists: "exists",
  notExists: "does not exist",
  equals: "equals",
  notEquals: "does not equal",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  contains: "contains",
  notContains: "does not contain",
};

const UNARY_OPERATORS = new Set<ExpressionOperator>([
  "truthy",
  "falsy",
  "exists",
  "notExists",
]);

export function describeExpression(expression: ExpressionRef): string {
  const operator = expression.operator ?? "truthy";
  const phrase = OPERATOR_PHRASES[operator];
  const source = expression.source || "(field)";

  if (UNARY_OPERATORS.has(operator)) {
    return `${source} ${phrase}`;
  }

  const comparison = expression.compareSource
    ? expression.compareSource
    : formatComparisonValue(expression.value);

  return `${source} ${phrase} ${comparison}`;
}

function formatComparisonValue(value: unknown): string {
  if (value == null) {
    return "(empty)";
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  return String(value);
}

export function describeFormula(formula: FormulaExpression): string {
  switch (formula.op) {
    case "sum":
      return `sum of ${formula.path}`;
    case "count":
      return `count of ${formula.path}`;
    case "add":
      return `${describeOperand(formula.left)} + ${describeOperand(formula.right)}`;
    case "subtract":
      return `${describeOperand(formula.left)} − ${describeOperand(formula.right)}`;
    case "multiply":
      return `${describeOperand(formula.left)} × ${describeOperand(formula.right)}`;
    case "divide":
      return `${describeOperand(formula.left)} ÷ ${describeOperand(formula.right)}`;
    case "concat":
      return `join(${formula.parts.map(describeOperand).join(", ")})`;
    default:
      return "(formula)";
  }
}

function describeOperand(operand: FormulaOperand): string {
  if (operand.kind === "literal") {
    return typeof operand.value === "string" ? `"${operand.value}"` : String(operand.value);
  }

  if (operand.kind === "variable") {
    return `variables.${operand.id}`;
  }

  return operand.path;
}

export function describeFormat(format: FieldFormat): string {
  switch (format.type) {
    case "currency":
      return `Currency (${format.currency})`;
    case "date":
      return `Date (${format.dateStyle ?? "medium"})`;
    case "number": {
      const min = format.minimumFractionDigits;
      const max = format.maximumFractionDigits;
      if (min == null && max == null) {
        return "Number";
      }
      return `Number (${min ?? 0}–${max ?? Math.max(min ?? 0, 0)} decimals)`;
    }
    case "text":
      return format.transform && format.transform !== "none"
        ? `Text (${format.transform})`
        : "Text";
    default:
      return "Value";
  }
}

/**
 * Evaluate an expression against a plain data object for editor previews. This
 * mirrors the renderer's operator semantics but resolves only own, non-dangerous
 * properties from the supplied data (no variables/scope). Intended as a design-time
 * aid — the renderer remains the source of truth at export time.
 */
export function evaluateExpressionPreview(
  expression: ExpressionRef,
  data: Record<string, unknown>,
): boolean {
  const value = readPath(data, expression.source);
  const comparison = expression.compareSource
    ? readPath(data, expression.compareSource)
    : expression.value;

  switch (expression.operator ?? "truthy") {
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    case "exists":
      return value != null && value !== "";
    case "notExists":
      return value == null || value === "";
    case "equals":
      return valuesEqual(value, comparison);
    case "notEquals":
      return !valuesEqual(value, comparison);
    case "greaterThan":
      return compareNumbers(value, comparison, (a, b) => a > b);
    case "greaterThanOrEqual":
      return compareNumbers(value, comparison, (a, b) => a >= b);
    case "lessThan":
      return compareNumbers(value, comparison, (a, b) => a < b);
    case "lessThanOrEqual":
      return compareNumbers(value, comparison, (a, b) => a <= b);
    case "contains":
      return valueContains(value, comparison);
    case "notContains":
      return !valueContains(value, comparison);
    default:
      return false;
  }
}

const UNSAFE_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function readPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !UNSAFE_SEGMENTS.has(part));

  let current: unknown = data;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      current = current[Number(part)];
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (isNumericLike(left) && isNumericLike(right)) {
    return Number(left) === Number(right);
  }

  return false;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim() !== "" && Number.isFinite(Number(value));
  }

  return false;
}

function compareNumbers(
  left: unknown,
  right: unknown,
  predicate: (a: number, b: number) => boolean,
): boolean {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && predicate(a, b);
}

function valueContains(value: unknown, needle: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(String(needle ?? ""));
  }

  if (Array.isArray(value)) {
    return value.some((item) => valuesEqual(item, needle));
  }

  return false;
}
