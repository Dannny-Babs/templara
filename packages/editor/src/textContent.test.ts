import { describe, expect, it } from "vitest";
import {
  insertBindingToken,
  parseInlineContent,
  serializeInlineContent,
} from "./textContent";

describe("parseInlineContent", () => {
  it("returns an empty array for empty input", () => {
    expect(parseInlineContent("")).toEqual([]);
  });

  it("parses a whole-string binding into a single field run", () => {
    expect(parseInlineContent("{{invoice.number}}")).toEqual([
      { kind: "field", label: "invoice.number", binding: { path: "invoice.number" } },
    ]);
  });

  it("parses mixed text and field runs preserving order", () => {
    expect(parseInlineContent("Hello {{customer.name}}!")).toEqual([
      { kind: "text", text: "Hello " },
      { kind: "field", label: "customer.name", binding: { path: "customer.name" } },
      { kind: "text", text: "!" },
    ]);
  });

  it("round-trips through serialize", () => {
    const value = "Ship to {{delivery.name}} on {{invoice.date}}.";
    expect(serializeInlineContent(parseInlineContent(value))).toBe(value);
  });
});

describe("insertBindingToken", () => {
  it("inserts at the caret with no padding at boundaries", () => {
    const result = insertBindingToken("", "invoice.number", 0);
    expect(result.value).toBe("{{invoice.number}}");
    expect(result.caret).toBe(result.value.length);
  });

  it("pads with a leading space when following a word", () => {
    const result = insertBindingToken("Total", "invoice.total", 5);
    expect(result.value).toBe("Total {{invoice.total}}");
    expect(result.caret).toBe(result.value.length);
  });

  it("pads on both sides when inserting between words", () => {
    const value = "abcdef";
    const result = insertBindingToken(value, "x.y", 3);
    expect(result.value).toBe("abc {{x.y}} def");
    // caret should sit right after the inserted token, before the trailing space
    expect(result.value.slice(0, result.caret)).toBe("abc {{x.y}}");
  });

  it("does not add a leading space when caret follows whitespace", () => {
    const result = insertBindingToken("Total ", "invoice.total", 6);
    expect(result.value).toBe("Total {{invoice.total}}");
  });

  it("clamps an out-of-range caret to the end", () => {
    const result = insertBindingToken("hi", "x", 99);
    expect(result.value).toBe("hi {{x}}");
  });
});
