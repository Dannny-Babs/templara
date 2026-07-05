import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "./index";
import type { DocumentTemplate } from "./index";
import { validateTemplate } from "./validation";

function baseTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: "tpl",
    version: "0.0.1",
    unit: "px",
    pages: [
      {
        id: "page-1",
        size: PAGE_PRESETS.letter,
        layers: [
          {
            id: "fixed",
            kind: "fixed",
            nodes: [
              {
                id: "title",
                type: "text",
                frame: { x: 0, y: 0, width: 100, height: 20 },
                content: [{ kind: "text", text: "Hello" }],
                style: { fontFamily: "Geist", fontSize: 12 },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("validateTemplate", () => {
  it("passes a well-formed template", () => {
    const result = validateTemplate(baseTemplate());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags a missing id and no pages as errors", () => {
    const result = validateTemplate(baseTemplate({ id: "", pages: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["template.missing_id", "template.no_pages"]),
    );
  });

  it("detects duplicate node ids across layers", () => {
    const template = baseTemplate();
    template.pages[0].layers[0].nodes.push({
      id: "title",
      type: "text",
      frame: { x: 0, y: 40, width: 100, height: 20 },
      content: [{ kind: "text", text: "Dupe" }],
      style: { fontFamily: "Geist", fontSize: 12 },
    });

    const result = validateTemplate(template);
    expect(result.errors.some((issue) => issue.code === "node.duplicate_id")).toBe(true);
  });

  it("detects duplicate node ids nested inside containers", () => {
    const template = baseTemplate();
    template.pages[0].layers.push({
      id: "flow",
      kind: "flow",
      nodes: [
        {
          id: "region",
          type: "flowRegion",
          frame: { x: 0, y: 0, width: 100, height: 100 },
          children: [
            {
              id: "title",
              type: "text",
              frame: { x: 0, y: 0, width: 100, height: 20 },
              content: [],
              style: { fontFamily: "Geist", fontSize: 12 },
            },
          ],
        },
      ],
    });

    const result = validateTemplate(template);
    expect(result.errors.some((issue) => issue.code === "node.duplicate_id")).toBe(true);
  });

  it("warns on empty text field bindings", () => {
    const template = baseTemplate();
    template.pages[0].layers[0].nodes[0] = {
      id: "bound",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "field", label: "x", binding: { path: "" } }],
      style: { fontFamily: "Geist", fontSize: 12 },
    };

    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((issue) => issue.code === "text.empty_field_binding")).toBe(true);
  });

  it("detects variable dependency cycles", () => {
    const template = baseTemplate({
      variables: [
        {
          id: "a",
          name: "A",
          value: {
            kind: "formula",
            formula: {
              op: "add",
              left: { kind: "variable", id: "b" },
              right: { kind: "literal", value: 1 },
            },
          },
        },
        {
          id: "b",
          name: "B",
          value: {
            kind: "formula",
            formula: {
              op: "add",
              left: { kind: "variable", id: "a" },
              right: { kind: "literal", value: 1 },
            },
          },
        },
      ],
    });

    const result = validateTemplate(template);
    expect(result.errors.some((issue) => issue.code === "variable.cycle")).toBe(true);
  });

  it("flags an invalid frame", () => {
    const template = baseTemplate();
    template.pages[0].layers[0].nodes[0].frame = {
      x: Number.NaN,
      y: 0,
      width: 10,
      height: 10,
    };

    const result = validateTemplate(template);
    expect(result.errors.some((issue) => issue.code === "node.invalid_frame")).toBe(true);
  });
});
