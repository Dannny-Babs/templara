import { describe, expect, it } from "vitest";
import {
  describeExpression,
  describeFormat,
  describeFormula,
  evaluateExpressionPreview,
} from "./logic";

describe("describeExpression", () => {
  it("describes unary operators without a comparison value", () => {
    expect(describeExpression({ source: "customer.email", operator: "exists" })).toBe(
      "customer.email exists",
    );
    expect(describeExpression({ source: "invoice.paid", operator: "truthy" })).toBe(
      "invoice.paid is set",
    );
  });

  it("describes binary operators with literal and field comparisons", () => {
    expect(
      describeExpression({ source: "invoice.total", operator: "greaterThan", value: 0 }),
    ).toBe("invoice.total is greater than 0");
    expect(
      describeExpression({ source: "item.status", operator: "equals", value: "shipped" }),
    ).toBe('item.status equals "shipped"');
    expect(
      describeExpression({
        source: "invoice.total",
        operator: "greaterThan",
        compareSource: "invoice.credit",
      }),
    ).toBe("invoice.total is greater than invoice.credit");
  });
});

describe("describeFormula", () => {
  it("describes aggregate and arithmetic formulas", () => {
    expect(describeFormula({ op: "sum", path: "invoice.items.amount" })).toBe(
      "sum of invoice.items.amount",
    );
    expect(
      describeFormula({
        op: "subtract",
        left: { kind: "path", path: "pay.gross" },
        right: { kind: "variable", id: "totalDeductions" },
      }),
    ).toBe("pay.gross − variables.totalDeductions");
    expect(
      describeFormula({
        op: "concat",
        parts: [
          { kind: "path", path: "customer.first" },
          { kind: "literal", value: " " },
          { kind: "path", path: "customer.last" },
        ],
      }),
    ).toBe('join(customer.first, " ", customer.last)');
  });
});

describe("describeFormat", () => {
  it("summarizes each format kind", () => {
    expect(describeFormat({ type: "currency", currency: "USD" })).toBe("Currency (USD)");
    expect(describeFormat({ type: "date", dateStyle: "long" })).toBe("Date (long)");
    expect(describeFormat({ type: "text", transform: "uppercase" })).toBe("Text (uppercase)");
    expect(describeFormat({ type: "number" })).toBe("Number");
  });
});

describe("evaluateExpressionPreview", () => {
  const data = {
    invoice: { total: 120, terms: 30, tags: ["net30", "priority"], note: "" },
    customer: { email: "a@b.co" },
  };

  it("evaluates comparisons the way the renderer does", () => {
    expect(evaluateExpressionPreview({ source: "invoice.total", operator: "greaterThan", value: 100 }, data)).toBe(true);
    expect(evaluateExpressionPreview({ source: "invoice.terms", operator: "equals", value: "30" }, data)).toBe(true);
    expect(evaluateExpressionPreview({ source: "customer.email", operator: "exists" }, data)).toBe(true);
    expect(evaluateExpressionPreview({ source: "invoice.note", operator: "exists" }, data)).toBe(false);
    expect(evaluateExpressionPreview({ source: "invoice.tags", operator: "contains", value: "priority" }, data)).toBe(true);
    expect(evaluateExpressionPreview({ source: "invoice.tags", operator: "contains", value: "missing" }, data)).toBe(false);
  });

  it("returns undefined-safe results for prototype-pollution paths", () => {
    expect(evaluateExpressionPreview({ source: "invoice.__proto__.polluted", operator: "exists" }, data)).toBe(false);
  });
});
