import { describe, expect, it } from "vitest";
import type { RenderDocumentResult } from "@templara/renderer";
import {
  buildExportFileName,
  buildExportFontCss,
  collectExportDiagnostics,
} from "./index";

function baseDocument(
  overrides: Partial<RenderDocumentResult> = {},
): RenderDocumentResult {
  return {
    pages: [{ id: "page-1", width: 816, height: 1056, children: [], debugBoxes: [] }],
    warnings: [],
    repeatAnalyses: [],
    fonts: [],
    ...overrides,
  };
}

describe("collectExportDiagnostics", () => {
  it("reports an empty document as a blocking error", () => {
    const preflight = collectExportDiagnostics(baseDocument({ pages: [] }));

    expect(preflight.ok).toBe(false);
    expect(preflight.errorCount).toBe(1);
    expect(preflight.pageCount).toBe(0);
    expect(preflight.diagnostics[0].code).toBe("export.empty_document");
  });

  it("passes preflight for a clean document", () => {
    const preflight = collectExportDiagnostics(baseDocument());

    expect(preflight.ok).toBe(true);
    expect(preflight.errorCount).toBe(0);
    expect(preflight.warningCount).toBe(0);
    expect(preflight.pageCount).toBe(1);
  });

  it("classifies overflow warnings as blocking errors", () => {
    const preflight = collectExportDiagnostics(
      baseDocument({
        warnings: [
          {
            code: "layout.unbreakable_overflow",
            message: "Node overflows the page.",
            nodeId: "big-block",
          },
        ],
      }),
    );

    expect(preflight.ok).toBe(false);
    expect(preflight.errorCount).toBe(1);
    expect(preflight.diagnostics[0]).toMatchObject({
      code: "layout.unbreakable_overflow",
      severity: "error",
      nodeId: "big-block",
    });
  });

  it("treats other renderer warnings as non-blocking", () => {
    const preflight = collectExportDiagnostics(
      baseDocument({
        warnings: [
          { code: "binding.missing", message: "Missing customer.name." },
        ],
      }),
    );

    expect(preflight.ok).toBe(true);
    expect(preflight.warningCount).toBe(1);
    expect(preflight.diagnostics[0].severity).toBe("warning");
  });

  it("flags unresolved codes and images as warnings", () => {
    const preflight = collectExportDiagnostics(
      baseDocument({
        pages: [
          {
            id: "page-1",
            width: 816,
            height: 1056,
            debugBoxes: [],
            children: [
              {
                id: "r1",
                sourceNodeId: "qr-node",
                type: "qr",
                frame: { x: 0, y: 0, width: 40, height: 40 },
                value: "",
                placeholder: "{{shipment.trackingUrl}}",
              },
              {
                id: "r2",
                sourceNodeId: "logo",
                type: "image",
                frame: { x: 0, y: 0, width: 40, height: 40 },
                src: "",
                placeholder: "{{business.logoUrl}}",
              },
            ],
          },
        ],
      }),
    );

    expect(preflight.ok).toBe(true);
    expect(preflight.warningCount).toBe(2);
    expect(preflight.diagnostics.map((d) => d.code)).toEqual([
      "export.unresolved_code",
      "export.unresolved_image",
    ]);
  });
});

describe("buildExportFontCss", () => {
  it("emits deduplicated @import declarations", () => {
    const css = buildExportFontCss(
      baseDocument({
        fonts: [
          { id: "a", family: "Geist", cssUrl: "https://fonts/geist.css" },
          { id: "b", family: "Geist Mono", cssUrl: "https://fonts/geist.css" },
          { id: "c", family: "Local", cssUrl: undefined },
        ],
      }),
    );

    expect(css).toBe('@import url("https://fonts/geist.css");');
  });
});

describe("buildExportFileName", () => {
  it("slugifies a title into a safe pdf filename", () => {
    expect(buildExportFileName("Shipment BOL Template")).toBe(
      "shipment-bol-template.pdf",
    );
    expect(buildExportFileName("   ")).toBe("document.pdf");
  });
});
