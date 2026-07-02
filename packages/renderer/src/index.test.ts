import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "@templara/core";
import type { DocumentTemplate } from "@templara/core";
import { renderDocument } from "./index";

const template: DocumentTemplate = {
  id: "test-invoice",
  version: "0.0.1",
  unit: "px",
  fonts: [
    {
      id: "inter",
      family: "Inter",
      source: { kind: "system" },
      fallback: "ui-sans-serif, system-ui, sans-serif"
    },
    {
      id: "roboto-mono",
      family: "Roboto Mono",
      source: { kind: "google-font", family: "Roboto Mono", weights: [400, 700], display: "swap" },
      fallback: "ui-monospace, SFMono-Regular, Menlo, monospace"
    }
  ],
  pages: [
    {
      id: "page-1",
      size: PAGE_PRESETS.letter,
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      layers: [
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            {
              id: "title",
              type: "text",
              frame: { x: 40, y: 40, width: 200, height: 24 },
              content: [{ kind: "text", text: "Invoice " }, { kind: "field", label: "Invoice Number", binding: { path: "invoice.number" } }],
              style: { fontFamily: "Inter", fontSize: 16, lineHeight: 1.2 }
            },
            {
              id: "date",
              type: "text",
              frame: { x: 40, y: 68, width: 200, height: 20 },
              content: [
                {
                  kind: "field",
                  label: "Invoice Date",
                  binding: { path: "invoice.date" },
                  format: { type: "date", dateStyle: "medium" }
                }
              ],
              style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
            }
          ]
        },
        {
          id: "flow",
          kind: "flow",
          nodes: [
            {
              id: "body",
              type: "flowRegion",
              frame: { x: 40, y: 100, width: 240, height: 90 },
              children: [
                {
                  id: "items",
                  type: "repeat",
                  frame: { x: 0, y: 0, width: 240, height: 30 },
                  binding: { path: "invoice.items" },
                  itemAlias: "item",
                  layout: { direction: "vertical", gap: 0 },
                  children: [
                    {
                      id: "row-bg",
                      type: "shape",
                      shape: "rectangle",
                      frame: { x: 0, y: 0, width: 240, height: 30 },
                      style: { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 }
                    },
                    {
                      id: "row-name",
                      type: "text",
                      frame: { x: 8, y: 8, width: 120, height: 14 },
                      content: [{ kind: "field", label: "Item Name", binding: { path: "item.name" } }],
                      style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
                    },
                    {
                      id: "row-total",
                      type: "text",
                      frame: { x: 160, y: 8, width: 72, height: 14 },
                      content: [
                        {
                          kind: "field",
                          label: "Item Total",
                          binding: { path: "item.total" },
                          format: { type: "currency", currency: "USD" }
                        }
                      ],
                      style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

describe("renderDocument", () => {
  it("resolves fixed text bindings", () => {
    const result = renderDocument({
      template,
      data: {
        invoice: {
          number: "INV-1",
          date: "2026-07-01",
          items: []
        }
      }
    });

    expect(result.pages[0].children.some((node) => node.type === "text" && node.text === "Invoice INV-1")).toBe(true);
    expect(result.pages[0].children.some((node) => node.type === "text" && node.text === "Jul 1, 2026")).toBe(true);
  });

  it("renders binding placeholders in template mode while using data for repeat structure", () => {
    const templateModeTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = templateModeTemplate.pages[0].layers[0];

    fixedLayer.nodes.push(
      {
        id: "tracking-code",
        type: "barcode",
        format: "code128",
        frame: { x: 300, y: 40, width: 160, height: 40 },
        value: { kind: "binding", binding: { path: "shipment.proNumber" } }
      },
      {
        id: "tracking-qr",
        type: "qr",
        frame: { x: 470, y: 40, width: 64, height: 64 },
        value: {
          kind: "template",
          parts: [
            { kind: "text", text: "https://track.example/" },
            { kind: "field", label: "PRO Number", binding: { path: "shipment.proNumber" } }
          ]
        }
      }
    );

    const result = renderDocument({
      template: templateModeTemplate,
      mode: "template",
      data: {
        invoice: {
          number: "INV-2",
          date: "2026-07-01",
          items: [
            { name: "Alpha", total: 10 },
            { name: "Beta", total: 20 }
          ]
        },
        shipment: {
          proNumber: "NSF-984421"
        }
      }
    });

    const text = result.pages.flatMap((page) => page.children).filter((node) => node.type === "text").map((node) => node.text);
    const barcode = result.pages[0].children.find((node) => node.type === "barcode" && node.sourceNodeId === "tracking-code");
    const qr = result.pages[0].children.find((node) => node.type === "qr" && node.sourceNodeId === "tracking-qr");

    if (!barcode || barcode.type !== "barcode") {
      throw new Error("Expected rendered barcode node.");
    }

    if (!qr || qr.type !== "qr") {
      throw new Error("Expected rendered QR node.");
    }

    expect(text).toContain("Invoice {{invoice.number}}");
    expect(text).toContain("{{invoice.date}}");
    expect(text.filter((value) => value === "{{item.name}}")).toHaveLength(2);
    expect(text.filter((value) => value === "{{item.total}}")).toHaveLength(2);
    expect(barcode.value).toBe("{{shipment.proNumber}}");
    expect(barcode.placeholder).toBe("{{shipment.proNumber}}");
    expect(qr.value).toBe("https://track.example/{{shipment.proNumber}}");
    expect(qr.placeholder).toBe("https://track.example/{{shipment.proNumber}}");
    expect(result.warnings.some((warning) => warning.code === "binding.missing")).toBe(false);
  });

  it("expands repeat rows with scoped bindings and formatting", () => {
    const result = renderDocument({
      template,
      data: {
        invoice: {
          number: "INV-2",
          date: "2026-07-01",
          items: [
            { name: "Alpha", total: 10 },
            { name: "Beta", total: 20 }
          ]
        }
      }
    });

    const text = result.pages.flatMap((page) => page.children).filter((node) => node.type === "text").map((node) => node.text);

    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).toContain("$10.00");
    expect(text).toContain("$20.00");
  });

  it("creates continuation pages and debug boxes for repeat overflow", () => {
    const result = renderDocument({
      template,
      data: {
        invoice: {
          number: "INV-3",
          date: "2026-07-01",
          items: Array.from({ length: 8 }, (_, index) => ({
            name: `Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.warnings.some((warning) => warning.code === "layout.page_break")).toBe(true);
    expect(result.pages.some((page) => page.debugBoxes.some((box) => box.kind === "repeat-row"))).toBe(true);
    expect(result.pages.some((page) => page.debugBoxes.some((box) => box.kind === "flow-region"))).toBe(true);
  });

  it("reports repeat fit analysis before laying out continuation rows", () => {
    const result = renderDocument({
      template,
      data: {
        invoice: {
          number: "INV-4",
          date: "2026-07-01",
          items: Array.from({ length: 8 }, (_, index) => ({
            name: `Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    expect(result.repeatAnalyses).toHaveLength(1);
    expect(result.repeatAnalyses[0]).toMatchObject({
      bindingPath: "invoice.items",
      itemCount: 8,
      spaceLeftOnStartPage: 90,
      rowsFitOnStartPage: 3,
      overflowItemCount: 5,
      estimatedTotalPages: 2
    });
    expect(result.repeatAnalyses[0].pagePlan.map((page) => page.itemCount)).toEqual([3, 5]);
    expect(result.repeatAnalyses[0].remainingSpaceOnStartPage).toBe(0);
  });

  it("can use the page margin as the first-page flow boundary", () => {
    const pageBoundaryTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = pageBoundaryTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 90;
    flowRegion.flowBoundary = "page-margin";

    const result = renderDocument({
      template: pageBoundaryTemplate,
      data: {
        invoice: {
          number: "INV-4B",
          date: "2026-07-01",
          items: Array.from({ length: 40 }, (_, index) => ({
            name: `Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    const firstPageFlowRegion = result.pages[0].debugBoxes.find((box) => box.kind === "flow-region");

    expect(result.repeatAnalyses[0]).toMatchObject({
      bindingPath: "invoice.items",
      itemCount: 40,
      spaceLeftOnStartPage: 916,
      rowsFitOnStartPage: 30,
      overflowItemCount: 10
    });
    expect(firstPageFlowRegion?.frame.height).toBe(916);
    expect(firstPageFlowRegion?.label).toBe("flow to page margin");
  });

  it("can compact repeat rows to use partial leftover space", () => {
    const compactTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = compactTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 100;
    const repeat = flowRegion.children[0];

    if (repeat.type !== "repeat") {
      throw new Error("Expected repeat test fixture.");
    }

    repeat.frame.height = 34;
    repeat.layout.rowSizing = "compact";
    repeat.layout.minRowHeight = 32;
    repeat.layout.maxCompressionRatio = 0.08;
    repeat.layout.fillAvailableSpace = true;

    const background = repeat.children[0];

    if (background.type !== "shape") {
      throw new Error("Expected row background test fixture.");
    }

    background.frame.height = 34;

    const result = renderDocument({
      template: compactTemplate,
      data: {
        invoice: {
          number: "INV-5",
          date: "2026-07-01",
          items: Array.from({ length: 5 }, (_, index) => ({
            name: `Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    expect(result.repeatAnalyses[0].compacted).toBe(true);
    expect(result.repeatAnalyses[0].filledStartPage).toBe(true);
    expect(result.repeatAnalyses[0].rowsFitOnStartPage).toBe(3);
    expect(result.repeatAnalyses[0].additionalRowsFitOnStartPage).toBe(1);
    expect(result.repeatAnalyses[0].fixedRowHeight).toBe(34);
    expect(result.repeatAnalyses[0].plannedRowHeight).toBeCloseTo(33.333, 3);
    expect(result.repeatAnalyses[0].remainingSpaceOnStartPage).toBeCloseTo(0, 6);
    expect(result.repeatAnalyses[0].startPageUtilization).toBe(1);
  });

  it("can fill first-page leftover space when another row cannot safely fit", () => {
    const fillTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = fillTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 75;
    const repeat = flowRegion.children[0];

    if (repeat.type !== "repeat") {
      throw new Error("Expected repeat test fixture.");
    }

    repeat.frame.height = 34;
    repeat.layout.rowSizing = "compact";
    repeat.layout.minRowHeight = 32;
    repeat.layout.maxCompressionRatio = 0.02;
    repeat.layout.fillAvailableSpace = true;

    const background = repeat.children[0];

    if (background.type !== "shape") {
      throw new Error("Expected row background test fixture.");
    }

    background.frame.height = 34;

    const result = renderDocument({
      template: fillTemplate,
      data: {
        invoice: {
          number: "INV-6",
          date: "2026-07-01",
          items: Array.from({ length: 4 }, (_, index) => ({
            name: `Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    expect(result.repeatAnalyses[0].compacted).toBe(false);
    expect(result.repeatAnalyses[0].filledStartPage).toBe(true);
    expect(result.repeatAnalyses[0].rowsFitOnStartPage).toBe(2);
    expect(result.repeatAnalyses[0].plannedRowHeight).toBeCloseTo(37.5, 6);
    expect(result.repeatAnalyses[0].remainingSpaceOnStartPage).toBeCloseTo(0, 6);
    expect(result.repeatAnalyses[0].startPageUtilization).toBe(1);
  });

  it("applies selected fonts through renderer output and font import metadata", () => {
    const result = renderDocument({
      template,
      data: {
        invoice: {
          number: "INV-7",
          date: "2026-07-01",
          items: []
        }
      },
      fontFamily: "Roboto Mono"
    });

    const title = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "title");

    expect(result.selectedFontFamily).toBe("Roboto Mono");
    expect(result.fonts.find((font) => font.id === "roboto-mono")?.cssUrl).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap"
    );
    if (!title || title.type !== "text") {
      throw new Error("Expected rendered title text node.");
    }

    expect(title.style.fontFamily).toBe('"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace');
  });

  it("resolves generated barcode and QR node values", () => {
    const generatedTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = generatedTemplate.pages[0].layers[0];

    fixedLayer.nodes.push(
      {
        id: "tracking-code",
        type: "barcode",
        format: "code128",
        frame: { x: 300, y: 40, width: 160, height: 40 },
        value: { kind: "binding", binding: { path: "shipment.proNumber" } }
      },
      {
        id: "tracking-qr",
        type: "qr",
        frame: { x: 470, y: 40, width: 64, height: 64 },
        value: {
          kind: "template",
          parts: [
            { kind: "text", text: "https://track.example/" },
            { kind: "field", label: "PRO Number", binding: { path: "shipment.proNumber" } }
          ]
        }
      }
    );

    const result = renderDocument({
      template: generatedTemplate,
      data: {
        invoice: {
          number: "INV-8",
          date: "2026-07-01",
          items: []
        },
        shipment: {
          proNumber: "NSF-984421"
        }
      }
    });

    const barcode = result.pages[0].children.find((node) => node.type === "barcode" && node.sourceNodeId === "tracking-code");
    const qr = result.pages[0].children.find((node) => node.type === "qr" && node.sourceNodeId === "tracking-qr");

    if (!barcode || barcode.type !== "barcode") {
      throw new Error("Expected rendered barcode node.");
    }

    if (!qr || qr.type !== "qr") {
      throw new Error("Expected rendered QR node.");
    }

    expect(barcode.value).toBe("NSF-984421");
    expect(barcode.format).toBe("code128");
    expect(qr.value).toBe("https://track.example/NSF-984421");
  });
});
