import { describe, expect, it } from "vitest";
import type { DocumentTemplate } from "@templara/core";
import type { RenderDocumentResult } from "@templara/renderer";
import { buildEditorDiagnostics } from "./diagnostics";

const template: DocumentTemplate = {
  id: "diagnostics-test",
  version: "0.0.1",
  unit: "px",
  pages: [
    {
      id: "page-1",
      size: { width: 816, height: 1056 },
      layers: [
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            {
              id: "customer-name",
              type: "text",
              frame: { x: 40, y: 40, width: 160, height: 20 },
              content: [{ kind: "field", label: "Customer", binding: { path: "" } }],
              style: { fontFamily: "Geist", fontSize: 12, lineHeight: 1.2 },
            },
          ],
        },
      ],
    },
  ],
};

function renderResult(overrides: Partial<RenderDocumentResult> = {}): RenderDocumentResult {
  return {
    pages: [{ id: "page-1", width: 816, height: 1056, children: [], debugBoxes: [] }],
    warnings: [],
    repeatAnalyses: [],
    fonts: [],
    ...overrides,
  };
}

describe("buildEditorDiagnostics", () => {
  it("combines validation, renderer, and export diagnostics", () => {
    const diagnostics = buildEditorDiagnostics(
      template,
      renderResult({
        warnings: [{ code: "binding.missing", message: "Missing binding.", nodeId: "customer-name", pageId: "page-1" }],
        pages: [
          {
            id: "page-1",
            width: 816,
            height: 1056,
            debugBoxes: [],
            children: [
              {
                id: "logo-render",
                sourceNodeId: "logo",
                type: "image",
                frame: { x: 0, y: 0, width: 80, height: 40 },
                src: "",
                placeholder: "{{business.logo}}",
              },
            ],
          },
        ],
      }),
    );

    expect(diagnostics.warningCount).toBeGreaterThanOrEqual(3);
    expect(diagnostics.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["text.empty_field_binding", "binding.missing", "export.unresolved_image"]),
    );
  });

  it("classifies blocking export diagnostics above warnings", () => {
    const diagnostics = buildEditorDiagnostics(
      template,
      renderResult({
        warnings: [{ code: "layout.unbreakable_overflow", message: "Too tall.", nodeId: "box", pageId: "page-1" }],
      }),
    );

    expect(diagnostics.blockingCount).toBe(1);
    expect(diagnostics.diagnostics[0]).toMatchObject({
      code: "layout.unbreakable_overflow",
      severity: "blocking",
    });
  });
});
