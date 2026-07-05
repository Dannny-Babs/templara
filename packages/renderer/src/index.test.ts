import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "@templara/core";
import type { ConditionalNode, DocumentTemplate, GridNode, SectionNode, StackNode } from "@templara/core";
import { renderDocument, sanitizeImageUrl } from "./index";

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

function createItemsGrid(overrides: Partial<Pick<GridNode, "rowHeight" | "behavior">> = {}): GridNode {
  const columns = [
    { id: "name", label: "NAME", width: 150 },
    { id: "total", label: "TOTAL", width: 90 }
  ];

  return {
    id: "items-grid",
    type: "grid",
    frame: { x: 0, y: 0, width: 240, height: 48 },
    binding: { path: "invoice.items" },
    columns,
    rowHeight: overrides.rowHeight ?? 24,
    header: {
      cells: columns.map((column) => ({
        columnId: column.id,
        style: { fill: "#f8fafc", stroke: "#d1d5db", strokeWidth: 1 },
        content: [
          {
            id: `grid-${column.id}-header`,
            type: "text",
            frame: { x: 8, y: 7, width: column.width - 16, height: 12 },
            content: [{ kind: "text", text: column.label ?? column.id.toUpperCase() }],
            style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
          }
        ]
      }))
    },
    row: {
      cells: [
        {
          columnId: "name",
          style: { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 },
          content: [
            {
              id: "grid-name-cell",
              type: "text",
              frame: { x: 8, y: 7, width: 134, height: 12 },
              content: [{ kind: "field", label: "Item Name", binding: { path: "item.name" } }],
              style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
            }
          ]
        },
        {
          columnId: "total",
          style: { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 },
          content: [
            {
              id: "grid-total-cell",
              type: "text",
              frame: { x: 8, y: 7, width: 74, height: 12 },
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
    },
    behavior: overrides.behavior
  };
}

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

  it("renders semantic grid rows with scoped bindings and cell styling", () => {
    const gridTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = gridTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 160;
    flowRegion.children = [createItemsGrid()];

    const result = renderDocument({
      template: gridTemplate,
      data: {
        invoice: {
          number: "INV-7",
          date: "2026-07-01",
          items: [
            { name: "Alpha", total: 10 },
            { name: "Beta", total: 20 }
          ]
        }
      }
    });

    const text = result.pages.flatMap((page) => page.children).filter((node) => node.type === "text").map((node) => node.text);
    const gridShapes = result.pages[0].children.filter((node) => node.type === "shape" && node.sourceNodeId === "items-grid");

    expect(text).toContain("NAME");
    expect(text).toContain("TOTAL");
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).toContain("$10.00");
    expect(text).toContain("$20.00");
    expect(gridShapes).toHaveLength(6);
    expect(result.warnings.some((warning) => warning.code === "flow.grid_not_implemented")).toBe(false);
  });

  it("paginates semantic grids and repeats headers on continuation pages", () => {
    const gridTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = gridTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 72;
    flowRegion.children = [createItemsGrid({ behavior: { repeatHeaderOnPageBreak: true } })];

    const result = renderDocument({
      template: gridTemplate,
      data: {
        invoice: {
          number: "INV-8",
          date: "2026-07-01",
          items: Array.from({ length: 6 }, (_, index) => ({
            name: `Grid Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    const headerCountsByPage = result.pages.map((page) => {
      return page.children.filter((node) => node.type === "text" && node.sourceNodeId === "grid-name-header").length;
    });
    const pageTexts = result.pages.map((page) => {
      return page.children.filter((node) => node.type === "text").map((node) => node.text);
    });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(headerCountsByPage[0]).toBe(1);
    expect(headerCountsByPage[1]).toBe(1);
    expect(pageTexts[0]).toContain("Grid Item 2");
    expect(pageTexts[1]).toContain("Grid Item 3");
    expect(result.warnings.some((warning) => warning.code === "layout.page_break")).toBe(true);
  });

  it("omits repeated grid headers when the header and next row cannot fit together", () => {
    const gridTemplate: DocumentTemplate = {
      id: "grid-tight-continuation",
      version: "0.0.1",
      unit: "px",
      pages: [
        {
          id: "page-1",
          size: { width: 300, height: 180 },
          margin: { top: 50, right: 20, bottom: 50, left: 20 },
          layers: [
            {
              id: "flow",
              kind: "flow",
              nodes: [
                {
                  id: "body",
                  type: "flowRegion",
                  frame: { x: 20, y: 20, width: 260, height: 140 },
                  children: [
                    createItemsGrid({
                      rowHeight: 70,
                      behavior: { repeatHeaderOnPageBreak: true }
                    })
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = renderDocument({
      template: gridTemplate,
      data: {
        invoice: {
          items: Array.from({ length: 3 }, (_, index) => ({
            name: `Grid Item ${index + 1}`,
            total: index + 1
          }))
        }
      }
    });

    const pageTexts = result.pages.map((page) =>
      page.children.filter((node) => node.type === "text").map((node) => node.text)
    );

    expect(result.pages.length).toBeGreaterThan(1);
    expect(pageTexts[0]).toContain("NAME");
    expect(pageTexts[0]).toContain("Grid Item 1");
    expect(pageTexts.slice(1).every((texts) => !texts.includes("NAME"))).toBe(true);
    expect(pageTexts.slice(1).every((texts) => texts.some((text) => /^Grid Item /.test(text)))).toBe(true);
  });

  it("keeps semantic sections together when they do not fit the remaining flow space", () => {
    const sectionTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = sectionTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const section = {
      id: "charges-section",
      type: "section",
      name: "Charges",
      frame: { x: 5, y: 0, width: 230, height: 48 },
      layout: {
        gap: 4,
        padding: { top: 6, right: 10, bottom: 6, left: 10 }
      },
      behavior: { keepTogether: true },
      style: { fill: "#f8fafc", stroke: "#d1d5db", strokeWidth: 1, radius: 4 },
      children: [
        {
          id: "charges-title",
          type: "text",
          frame: { x: 0, y: 0, width: 140, height: 16 },
          content: [{ kind: "text", text: "Charges" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        },
        {
          id: "charges-total",
          type: "text",
          frame: { x: 0, y: 0, width: 140, height: 16 },
          content: [{ kind: "field", label: "Subtotal", binding: { path: "invoice.subtotal" }, format: { type: "currency", currency: "USD" } }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        }
      ]
    } satisfies SectionNode;

    flowRegion.frame.height = 44;
    flowRegion.children = [section];

    const result = renderDocument({
      template: sectionTemplate,
      data: {
        invoice: {
          number: "INV-9",
          date: "2026-07-01",
          subtotal: 42,
          items: []
        }
      }
    });

    const firstPageTexts = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);
    const continuationTexts = result.pages[1]?.children.filter((node) => node.type === "text").map((node) => node.text) ?? [];
    const sectionFrame = result.pages[1]?.children.find((node) => node.type === "shape" && node.sourceNodeId === "charges-section");
    const title = result.pages[1]?.children.find((node) => node.type === "text" && node.sourceNodeId === "charges-title");

    if (!sectionFrame || sectionFrame.type !== "shape") {
      throw new Error("Expected rendered section frame.");
    }

    if (!title || title.type !== "text") {
      throw new Error("Expected rendered section title.");
    }

    expect(result.pages.length).toBeGreaterThan(1);
    expect(firstPageTexts).not.toContain("Charges");
    expect(continuationTexts).toContain("Charges");
    expect(continuationTexts).toContain("$42.00");
    expect(sectionFrame.frame).toMatchObject({ x: 45, y: 40, width: 230, height: 48 });
    expect(title.frame).toMatchObject({ x: 55, y: 46 });
    expect(result.warnings.some((warning) => warning.code === "layout.page_break" && warning.nodeId === "charges-section")).toBe(true);
  });

  it("draws a section frame fragment on every page a split section spans", () => {
    const sectionTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = sectionTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const section = {
      id: "split-section",
      type: "section",
      name: "Split",
      // No keepTogether: the section is allowed to break across pages.
      frame: { x: 0, y: 0, width: 230, height: 120 },
      style: { fill: "#eef2ff", stroke: "#a5b4fc", strokeWidth: 1 },
      children: [
        {
          id: "split-top",
          type: "text",
          frame: { x: 0, y: 0, width: 200, height: 40 },
          content: [{ kind: "text", text: "SECTION TOP" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        },
        {
          id: "split-bottom",
          type: "text",
          frame: { x: 0, y: 0, width: 200, height: 40 },
          content: [{ kind: "text", text: "SECTION BOTTOM" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        }
      ]
    } satisfies SectionNode;

    // Region only has room for the first child; the second is forced to page 2.
    flowRegion.frame.height = 60;
    flowRegion.flowBoundary = "frame";
    flowRegion.children = [section];

    const result = renderDocument({ template: sectionTemplate, data: {} });

    const framesByPage = result.pages.map((page) =>
      page.children.filter((node) => node.type === "shape" && node.sourceNodeId === "split-section").length
    );
    const textsByPage = result.pages.map((page) =>
      page.children.filter((node) => node.type === "text").map((node) => (node.type === "text" ? node.text : ""))
    );
    const firstFrameIndex = result.pages[0].children.findIndex(
      (node) => node.type === "shape" && node.sourceNodeId === "split-section"
    );
    const firstTopIndex = result.pages[0].children.findIndex(
      (node) => node.type === "text" && node.sourceNodeId === "split-top"
    );

    expect(result.pages.length).toBe(2);
    expect(textsByPage[0]).toContain("SECTION TOP");
    expect(textsByPage[1]).toContain("SECTION BOTTOM");
    // A frame fragment is drawn on BOTH pages, not just the start page.
    expect(framesByPage[0]).toBe(1);
    expect(framesByPage[1]).toBe(1);
    // The frame paints behind its content (lower z-index than the text it wraps).
    expect(firstFrameIndex).toBeGreaterThanOrEqual(0);
    expect(firstFrameIndex).toBeLessThan(firstTopIndex);
  });

  it("evaluates equals across numeric strings and numbers consistently with numeric operators", () => {
    function conditionTemplate(operator: string, value: unknown, source: string): DocumentTemplate {
      const conditionalTemplate = structuredClone(template) as DocumentTemplate;
      const flowRegion = conditionalTemplate.pages[0].layers[1].nodes[0];

      if (flowRegion.type !== "flowRegion") {
        throw new Error("Expected flow region test fixture.");
      }

      flowRegion.frame.height = 200;
      flowRegion.children = [
        {
          id: "cond",
          type: "conditional",
          frame: { x: 0, y: 0, width: 200, height: 20 },
          condition: { source, operator, value } as ConditionalNode["condition"],
          children: [
            {
              id: "cond-shown",
              type: "text",
              frame: { x: 0, y: 0, width: 200, height: 16 },
              content: [{ kind: "text", text: "MATCHED" }],
              style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
            }
          ]
        }
      ];

      return conditionalTemplate;
    }

    const data = { invoice: { terms: "30", note: "" } };

    const matchedTexts = (result: ReturnType<typeof renderDocument>) =>
      result.pages.flatMap((page) => page.children).filter((node) => node.type === "text").map((node) => (node.type === "text" ? node.text : ""));

    // numeric-looking string equals its number
    expect(matchedTexts(renderDocument({ template: conditionTemplate("equals", 30, "invoice.terms"), data }))).toContain("MATCHED");
    // notEquals is the inverse
    expect(matchedTexts(renderDocument({ template: conditionTemplate("notEquals", 30, "invoice.terms"), data }))).not.toContain("MATCHED");
    // guard: empty string does NOT collapse to 0
    expect(matchedTexts(renderDocument({ template: conditionTemplate("equals", 0, "invoice.note"), data }))).not.toContain("MATCHED");
  });

  it("renders horizontal stacks as one flow row with left-to-right children", () => {
    const stackTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = stackTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const stack = {
      id: "summary-row",
      type: "stack",
      direction: "horizontal",
      gap: 12,
      frame: { x: 0, y: 0, width: 240, height: 40 },
      children: [
        {
          id: "stack-left",
          type: "text",
          frame: { x: 0, y: 0, width: 60, height: 16 },
          content: [{ kind: "text", text: "Left" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        },
        {
          id: "stack-right",
          type: "text",
          frame: { x: 0, y: 2, width: 70, height: 16 },
          content: [{ kind: "text", text: "Right" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
        }
      ]
    } satisfies StackNode;

    flowRegion.frame.height = 120;
    flowRegion.children = [
      stack,
      {
        id: "after-stack",
        type: "text",
        frame: { x: 0, y: 0, width: 120, height: 16 },
        content: [{ kind: "text", text: "After" }],
        style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
      }
    ];

    const result = renderDocument({
      template: stackTemplate,
      data: {
        invoice: {
          number: "INV-10",
          date: "2026-07-01",
          items: []
        }
      }
    });

    const left = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "stack-left");
    const right = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "stack-right");
    const after = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "after-stack");

    if (!left || left.type !== "text" || !right || right.type !== "text" || !after || after.type !== "text") {
      throw new Error("Expected rendered horizontal stack text nodes.");
    }

    expect(left.frame).toMatchObject({ x: 40, y: 100 });
    expect(right.frame).toMatchObject({ x: 112, y: 102 });
    expect(after.frame).toMatchObject({ x: 40, y: 140 });
    expect(result.warnings.some((warning) => warning.code === "flow.horizontal_stack_not_implemented")).toBe(false);
  });

  it("evaluates conditional operators and renders the selected branch", () => {
    const conditionalTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = conditionalTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const conditional = {
      id: "hazmat-note",
      type: "conditional",
      frame: { x: 6, y: 4, width: 180, height: 20 },
      condition: { source: "shipment.hazmat", operator: "equals", value: true },
      children: [
        {
          id: "hazmat-yes",
          type: "text",
          frame: { x: 4, y: 2, width: 120, height: 14 },
          content: [{ kind: "text", text: "HAZMAT" }],
          style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
        }
      ],
      fallback: [
        {
          id: "hazmat-no",
          type: "text",
          frame: { x: 4, y: 2, width: 120, height: 14 },
          content: [{ kind: "text", text: "Standard freight" }],
          style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
        }
      ]
    } satisfies ConditionalNode;

    flowRegion.frame.height = 120;
    flowRegion.children = [conditional];

    const result = renderDocument({
      template: conditionalTemplate,
      data: {
        invoice: {
          number: "INV-11",
          date: "2026-07-01",
          items: []
        },
        shipment: {
          hazmat: false
        }
      }
    });

    const renderedText = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);
    const fallback = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "hazmat-no");

    if (!fallback || fallback.type !== "text") {
      throw new Error("Expected rendered conditional fallback.");
    }

    expect(renderedText).toContain("Standard freight");
    expect(renderedText).not.toContain("HAZMAT");
    expect(fallback.frame).toMatchObject({ x: 50, y: 106 });
  });

  it("compares conditional values against another data path", () => {
    const conditionalTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = conditionalTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    flowRegion.frame.height = 120;
    flowRegion.children = [
      {
        id: "threshold-note",
        type: "conditional",
        frame: { x: 0, y: 0, width: 180, height: 20 },
        condition: { source: "invoice.total", operator: "greaterThanOrEqual", compareSource: "invoice.approvalThreshold" },
        children: [
          {
            id: "approval-required",
            type: "text",
            frame: { x: 0, y: 0, width: 120, height: 14 },
            content: [{ kind: "text", text: "Approval required" }],
            style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
          }
        ],
        fallback: [
          {
            id: "approval-not-required",
            type: "text",
            frame: { x: 0, y: 0, width: 120, height: 14 },
            content: [{ kind: "text", text: "Auto-approved" }],
            style: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.2 }
          }
        ]
      } satisfies ConditionalNode
    ];

    const result = renderDocument({
      template: conditionalTemplate,
      data: {
        invoice: {
          number: "INV-12",
          date: "2026-07-01",
          items: [],
          total: 1250,
          approvalThreshold: 1000
        }
      }
    });

    const renderedText = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);

    expect(renderedText).toContain("Approval required");
    expect(renderedText).not.toContain("Auto-approved");
  });

  it("applies node-level visibleIf logic in preview while keeping template mode editable", () => {
    const logicTemplate = structuredClone(template) as DocumentTemplate;
    const dateNode = logicTemplate.pages[0].layers[0].nodes.find((node) => node.id === "date");

    if (!dateNode || dateNode.type !== "text") {
      throw new Error("Expected date text fixture.");
    }

    dateNode.logic = {
      visibleIf: { source: "invoice.showDate", operator: "equals", value: true }
    };

    const previewResult = renderDocument({
      template: logicTemplate,
      data: {
        invoice: {
          number: "INV-13",
          date: "2026-07-01",
          showDate: false,
          items: []
        }
      }
    });

    const templateResult = renderDocument({
      template: logicTemplate,
      mode: "template",
      data: {
        invoice: {
          number: "INV-13",
          date: "2026-07-01",
          showDate: false,
          items: []
        }
      }
    });

    expect(previewResult.pages[0].children.some((node) => node.sourceNodeId === "date")).toBe(false);
    expect(templateResult.pages[0].children.some((node) => node.sourceNodeId === "date")).toBe(true);
  });

  it("evaluates node-level visibleIf logic against the current repeat row scope", () => {
    const logicTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = logicTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const repeat = flowRegion.children[0];

    if (repeat.type !== "repeat") {
      throw new Error("Expected repeat test fixture.");
    }

    const rowName = repeat.children.find((node) => node.id === "row-name");

    if (!rowName || rowName.type !== "text") {
      throw new Error("Expected row-name test fixture.");
    }

    rowName.logic = {
      visibleIf: { source: "item.hazmat", operator: "equals", value: true }
    };

    const result = renderDocument({
      template: logicTemplate,
      data: {
        invoice: {
          number: "INV-14",
          date: "2026-07-01",
          items: [
            { name: "Standard", total: 10, hazmat: false },
            { name: "Hazmat", total: 20, hazmat: true }
          ]
        }
      }
    });

    const rowNameText = result.pages[0].children
      .filter((node) => node.type === "text" && node.sourceNodeId === "row-name")
      .map((node) => (node.type === "text" ? node.text : ""));

    expect(rowNameText).toEqual(["Hazmat"]);
  });

  it("filters repeat rows with repeatItemIf before diagnostics and pagination", () => {
    const logicTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = logicTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const repeat = flowRegion.children[0];

    if (repeat.type !== "repeat") {
      throw new Error("Expected repeat test fixture.");
    }

    repeat.logic = {
      repeatItemIf: { source: "item.billable", operator: "equals", value: true }
    };

    const result = renderDocument({
      template: logicTemplate,
      data: {
        invoice: {
          number: "INV-15",
          date: "2026-07-01",
          items: [
            { name: "Billable A", total: 10, billable: true },
            { name: "No Charge", total: 0, billable: false },
            { name: "Billable B", total: 20, billable: true }
          ]
        }
      }
    });

    const rowNames = result.pages.flatMap((page) => page.children)
      .filter((node) => node.type === "text" && node.sourceNodeId === "row-name")
      .map((node) => (node.type === "text" ? node.text : ""));

    expect(rowNames).toEqual(["Billable A", "Billable B"]);
    expect(result.repeatAnalyses[0]?.itemCount).toBe(2);
  });

  it("renders text fallback and field formatting rules", () => {
    const valueTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = valueTemplate.pages[0].layers[0];

    fixedLayer.nodes.push(
      {
        id: "missing-fallback",
        type: "text",
        frame: { x: 40, y: 96, width: 200, height: 20 },
        content: [{ kind: "field", label: "Missing", binding: { path: "invoice.missing" }, fallback: "Not provided" }],
        style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
      },
      {
        id: "uppercase-customer",
        type: "text",
        frame: { x: 40, y: 120, width: 200, height: 20 },
        content: [{ kind: "field", label: "Customer", binding: { path: "invoice.customerName" }, format: { type: "text", transform: "uppercase" } }],
        style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
      }
    );

    const result = renderDocument({
      template: valueTemplate,
      data: {
        invoice: {
          number: "INV-16",
          date: "2026-07-01",
          customerName: "Acme Logistics",
          items: []
        }
      }
    });

    const text = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);

    expect(text).toContain("Not provided");
    expect(text).toContain("ACME LOGISTICS");
  });

  it("resolves template variables through direct and namespaced bindings", () => {
    const variableTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = variableTemplate.pages[0].layers[0];

    variableTemplate.variables = [
      {
        id: "totalLabel",
        name: "Total Label",
        category: "computed",
        value: {
          kind: "template",
          parts: [
            { kind: "text", text: "Total due: " },
            {
              kind: "field",
              label: "Total",
              binding: { path: "invoice.total" },
              format: { type: "currency", currency: "USD" }
            }
          ]
        }
      }
    ];

    fixedLayer.nodes.push(
      {
        id: "direct-variable",
        type: "text",
        frame: { x: 40, y: 96, width: 200, height: 20 },
        content: [{ kind: "field", label: "Total Label", binding: { path: "totalLabel" } }],
        style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
      },
      {
        id: "namespaced-variable",
        type: "text",
        frame: { x: 40, y: 120, width: 200, height: 20 },
        content: [{ kind: "field", label: "Total Label", binding: { path: "variables.totalLabel" } }],
        style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
      }
    );

    const result = renderDocument({
      template: variableTemplate,
      data: {
        invoice: {
          number: "INV-13",
          date: "2026-07-01",
          total: 514.15,
          items: []
        }
      }
    });

    const text = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);

    expect(text.filter((value) => value === "Total due: $514.15")).toHaveLength(2);
  });

  it("resolves variables against the current repeat row scope", () => {
    const variableTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = variableTemplate.pages[0].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const repeat = flowRegion.children[0];

    if (repeat.type !== "repeat") {
      throw new Error("Expected repeat test fixture.");
    }

    variableTemplate.variables = [
      {
        id: "itemLine",
        name: "Item Line",
        category: "computed",
        value: {
          kind: "template",
          parts: [
            { kind: "field", label: "Item", binding: { path: "item.name" } },
            { kind: "text", text: " / " },
            {
              kind: "field",
              label: "Total",
              binding: { path: "item.total" },
              format: { type: "currency", currency: "USD" }
            }
          ]
        }
      }
    ];

    const rowName = repeat.children.find((node) => node.id === "row-name");

    if (!rowName || rowName.type !== "text") {
      throw new Error("Expected row-name test fixture.");
    }

    rowName.content = [{ kind: "field", label: "Item Line", binding: { path: "itemLine" } }];

    const result = renderDocument({
      template: variableTemplate,
      data: {
        invoice: {
          number: "INV-14",
          date: "2026-07-01",
          items: [
            { name: "Alpha", total: 10 },
            { name: "Beta", total: 20 }
          ]
        }
      }
    });

    const text = result.pages.flatMap((page) => page.children).filter((node) => node.type === "text").map((node) => node.text);

    expect(text).toContain("Alpha / $10.00");
    expect(text).toContain("Beta / $20.00");
  });

  it("resolves formula variables for aggregates, arithmetic, concat, paths, and variable operands", () => {
    const formulaTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = formulaTemplate.pages[0].layers[0];

    formulaTemplate.variables = [
      {
        id: "itemCount",
        name: "Item Count",
        category: "computed",
        value: { kind: "formula", formula: { op: "count", path: "invoice.items" } }
      },
      {
        id: "computedSubtotal",
        name: "Computed Subtotal",
        category: "computed",
        value: { kind: "formula", formula: { op: "sum", path: "invoice.items.total" } }
      },
      {
        id: "totalWithFee",
        name: "Total With Fee",
        category: "computed",
        value: {
          kind: "formula",
          formula: {
            op: "add",
            left: { kind: "variable", id: "computedSubtotal" },
            right: { kind: "path", path: "invoice.fee" }
          }
        }
      },
      {
        id: "summaryLabel",
        name: "Summary Label",
        category: "computed",
        value: {
          kind: "formula",
          formula: {
            op: "concat",
            parts: [
              { kind: "literal", value: "Items: " },
              { kind: "variable", id: "itemCount" },
              { kind: "literal", value: " / Total: " },
              { kind: "variable", id: "totalWithFee" }
            ]
          }
        }
      }
    ];

    fixedLayer.nodes.push({
      id: "summary-label",
      type: "text",
      frame: { x: 40, y: 96, width: 260, height: 20 },
      content: [{ kind: "field", label: "Summary", binding: { path: "summaryLabel" } }],
      style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
    });

    const result = renderDocument({
      template: formulaTemplate,
      data: {
        invoice: {
          number: "INV-17",
          date: "2026-07-01",
          fee: 5,
          items: [
            { name: "Alpha", total: 10 },
            { name: "Beta", total: 20 }
          ]
        }
      }
    });

    const text = result.pages[0].children.filter((node) => node.type === "text").map((node) => node.text);

    expect(text).toContain("Items: 2 / Total: 35");
  });

  it("warns and recovers from formula variable cycles", () => {
    const formulaTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = formulaTemplate.pages[0].layers[0];

    formulaTemplate.variables = [
      {
        id: "a",
        name: "A",
        value: { kind: "formula", formula: { op: "add", left: { kind: "variable", id: "b" }, right: { kind: "literal", value: 1 } } }
      },
      {
        id: "b",
        name: "B",
        value: { kind: "formula", formula: { op: "add", left: { kind: "variable", id: "a" }, right: { kind: "literal", value: 1 } } }
      }
    ];

    fixedLayer.nodes.push({
      id: "cycle",
      type: "text",
      frame: { x: 40, y: 96, width: 200, height: 20 },
      content: [{ kind: "field", label: "A", binding: { path: "a" }, fallback: "cycle" }],
      style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
    });

    const result = renderDocument({
      template: formulaTemplate,
      data: {
        invoice: {
          number: "INV-18",
          date: "2026-07-01",
          items: []
        }
      }
    });

    expect(result.warnings.some((warning) => warning.code === "variable.cycle")).toBe(true);
  });

  it("does not silently treat a failed formula operand as zero", () => {
    const formulaTemplate = structuredClone(template) as DocumentTemplate;
    const fixedLayer = formulaTemplate.pages[0].layers[0];

    formulaTemplate.variables = [
      {
        id: "ratio",
        name: "Ratio",
        value: { kind: "formula", formula: { op: "divide", left: { kind: "literal", value: 10 }, right: { kind: "literal", value: 0 } } }
      },
      {
        id: "ratioPlusFive",
        name: "Ratio Plus Five",
        value: { kind: "formula", formula: { op: "add", left: { kind: "variable", id: "ratio" }, right: { kind: "literal", value: 5 } } }
      }
    ];

    fixedLayer.nodes.push({
      id: "ratio-plus-five",
      type: "text",
      frame: { x: 40, y: 96, width: 200, height: 20 },
      content: [{ kind: "field", label: "Ratio", binding: { path: "ratioPlusFive" }, fallback: "n/a" }],
      style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
    });

    const result = renderDocument({
      template: formulaTemplate,
      data: { invoice: { number: "INV-19", date: "2026-07-01", items: [] } }
    });

    const text = result.pages[0].children.find((node) => node.type === "text" && node.sourceNodeId === "ratio-plus-five");

    if (!text || text.type !== "text") {
      throw new Error("Expected rendered ratio text node.");
    }

    // The divide-by-zero failure must not collapse to 0 and yield "5".
    expect(text.text).not.toBe("5");
    expect(result.warnings.some((warning) => warning.code === "formula.divide_by_zero")).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "formula.invalid_number")).toBe(true);
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

describe("security", () => {
  it("allows safe image url schemes and rejects executable ones", () => {
    expect(sanitizeImageUrl("https://cdn.example/logo.png")).toBe("https://cdn.example/logo.png");
    expect(sanitizeImageUrl("http://cdn.example/logo.png")).toBe("http://cdn.example/logo.png");
    expect(sanitizeImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(sanitizeImageUrl("/assets/logo.png")).toBe("/assets/logo.png");
    expect(sanitizeImageUrl("logo.png")).toBe("logo.png");

    expect(sanitizeImageUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeImageUrl("  javascript:alert(1)")).toBe("");
    expect(sanitizeImageUrl("vbscript:msgbox(1)")).toBe("");
    expect(sanitizeImageUrl("file:///etc/passwd")).toBe("");
    expect(sanitizeImageUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
  });

  it("strips an unsafe bound image source and records a warning", () => {
    const imageTemplate: DocumentTemplate = {
      id: "img-security",
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
                  id: "logo",
                  type: "image",
                  frame: { x: 40, y: 40, width: 80, height: 40 },
                  source: { kind: "binding", binding: { path: "brand.logo" } }
                }
              ]
            }
          ]
        }
      ]
    };

    const result = renderDocument({
      template: imageTemplate,
      data: { brand: { logo: "javascript:alert(document.cookie)" } }
    });

    const image = result.pages[0].children.find((child) => child.type === "image");

    if (!image || image.type !== "image") {
      throw new Error("Expected rendered image node.");
    }

    expect(image.src).toBe("");
    expect(result.warnings.some((warning) => warning.code === "image.unsafe-url")).toBe(true);
  });

  it("does not traverse prototype-pollution paths from data bindings", () => {
    const pathTemplate: DocumentTemplate = {
      id: "path-security",
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
                  id: "danger",
                  type: "text",
                  frame: { x: 40, y: 40, width: 200, height: 20 },
                  content: [{ kind: "field", label: "Danger", binding: { path: "record.__proto__.polluted" } }],
                  style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 }
                }
              ]
            }
          ]
        }
      ]
    };

    const result = renderDocument({
      template: pathTemplate,
      data: { record: { name: "ok", polluted: "wrong alias" } }
    });

    const text = result.pages[0].children.find((child) => child.type === "text");

    if (!text || text.type !== "text") {
      throw new Error("Expected rendered text node.");
    }

    expect(text.text).toBe("");
    expect(result.warnings.some((warning) => warning.code === "binding.unsafe_path")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("repeat headers and keep-together", () => {
  function repeatHeaderTemplate(options: {
    repeatHeaderOnPageBreak?: boolean;
    keepTogether?: boolean;
    spacerHeight?: number;
  }): DocumentTemplate {
    const spacer =
      options.spacerHeight && options.spacerHeight > 0
        ? [
            {
              id: "spacer",
              type: "shape" as const,
              shape: "rectangle" as const,
              frame: { x: 0, y: 0, width: 480, height: options.spacerHeight },
              style: { fill: "#eef2ff" }
            }
          ]
        : [];

    return {
      id: "repeat-header",
      version: "0.0.1",
      unit: "px",
      pages: [
        {
          id: "page-1",
          size: PAGE_PRESETS.letter,
          margin: { top: 40, right: 40, bottom: 40, left: 40 },
          layers: [
            {
              id: "flow",
              kind: "flow",
              nodes: [
                {
                  id: "body",
                  type: "flowRegion",
                  frame: { x: 40, y: 40, width: 480, height: 900 },
                  flowBoundary: "page-margin",
                  children: [
                    ...spacer,
                    {
                      id: "rows",
                      type: "repeat",
                      frame: { x: 0, y: 0, width: 480, height: 40 },
                      binding: { path: "list" },
                      itemAlias: "item",
                      layout: {
                        direction: "vertical",
                        gap: 0,
                        repeatHeaderOnPageBreak: options.repeatHeaderOnPageBreak,
                        keepTogether: options.keepTogether
                      },
                      header: [
                        {
                          id: "hdr",
                          type: "text",
                          frame: { x: 0, y: 0, width: 480, height: 24 },
                          content: [{ kind: "text", text: "COLUMN HEADER" }],
                          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1 }
                        }
                      ],
                      children: [
                        {
                          id: "row-label",
                          type: "text",
                          frame: { x: 0, y: 0, width: 480, height: 40 },
                          content: [{ kind: "field", label: "Row", binding: { path: "item.label" } }],
                          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1 }
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
  }

  function countHeaderPages(result: ReturnType<typeof renderDocument>): number {
    return result.pages.filter((page) =>
      page.children.some((child) => child.type === "text" && child.text === "COLUMN HEADER")
    ).length;
  }

  const manyRows = { list: Array.from({ length: 60 }, (_, index) => ({ label: `Row ${index + 1}` })) };

  it("repeats the header on every continuation page when enabled", () => {
    const result = renderDocument({
      template: repeatHeaderTemplate({ repeatHeaderOnPageBreak: true }),
      data: manyRows
    });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(countHeaderPages(result)).toBe(result.pages.length);
  });

  it("draws the header only once when repeat-on-break is off", () => {
    const result = renderDocument({
      template: repeatHeaderTemplate({}),
      data: manyRows
    });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(countHeaderPages(result)).toBe(1);
  });

  it("keeps a small repeat block together on a fresh page", () => {
    // A tall spacer before the repeat means it cannot fit at the bottom.
    const template = repeatHeaderTemplate({ keepTogether: true, spacerHeight: 860 });

    const result = renderDocument({
      template,
      data: { list: Array.from({ length: 4 }, (_, index) => ({ label: `Row ${index + 1}` })) }
    });

    expect(result.pages.length).toBe(2);
    // All four rows land on page 2 together rather than splitting across pages.
    const page2Rows = result.pages[1].children.filter(
      (child) => child.type === "text" && /^Row /.test(child.text)
    );
    expect(page2Rows).toHaveLength(4);
  });

  it("omits repeated continuation headers when the header and next row cannot fit together", () => {
    const template: DocumentTemplate = {
      id: "repeat-header-tight-continuation",
      version: "0.0.1",
      unit: "px",
      pages: [
        {
          id: "page-1",
          size: { width: 300, height: 180 },
          margin: { top: 50, right: 20, bottom: 50, left: 20 },
          layers: [
            {
              id: "flow",
              kind: "flow",
              nodes: [
                {
                  id: "body",
                  type: "flowRegion",
                  frame: { x: 20, y: 20, width: 260, height: 140 },
                  children: [
                    {
                      id: "rows",
                      type: "repeat",
                      frame: { x: 0, y: 0, width: 260, height: 70 },
                      binding: { path: "list" },
                      itemAlias: "item",
                      layout: {
                        direction: "vertical",
                        gap: 0,
                        repeatHeaderOnPageBreak: true
                      },
                      header: [
                        {
                          id: "hdr",
                          type: "text",
                          frame: { x: 0, y: 0, width: 260, height: 40 },
                          content: [{ kind: "text", text: "COLUMN HEADER" }],
                          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1 }
                        }
                      ],
                      children: [
                        {
                          id: "row-label",
                          type: "text",
                          frame: { x: 0, y: 0, width: 260, height: 70 },
                          content: [{ kind: "field", label: "Row", binding: { path: "item.label" } }],
                          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1 }
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

    const result = renderDocument({
      template,
      data: { list: Array.from({ length: 3 }, (_, index) => ({ label: `Row ${index + 1}` })) }
    });

    const pageTexts = result.pages.map((page) =>
      page.children.filter((node) => node.type === "text").map((node) => node.text)
    );

    expect(result.pages.length).toBeGreaterThan(1);
    expect(pageTexts[0]).toContain("COLUMN HEADER");
    expect(pageTexts[0]).toContain("Row 1");
    expect(pageTexts.slice(1).every((texts) => !texts.includes("COLUMN HEADER"))).toBe(true);
    expect(pageTexts.slice(1).every((texts) => texts.some((text) => /^Row /.test(text)))).toBe(true);
  });
});
