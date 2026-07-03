import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "@templara/core";
import type {
  DocumentTemplate,
  SectionNode,
  StackNode,
  TextNode,
  TextStyle,
} from "@templara/core";
import {
  buildEditorPageModel,
  getAlignmentFramePatches,
  updateNodeById,
} from "./editorModel";

const template: DocumentTemplate = {
  id: "editor-model-test",
  version: "0.0.1",
  unit: "px",
  pages: [
    {
      id: "page-1",
      name: "Page One",
      size: PAGE_PRESETS.letter,
      layers: [
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            {
              id: "title",
              type: "text",
              frame: { x: 40, y: 40, width: 220, height: 24 },
              content: [
                {
                  kind: "field",
                  label: "Customer",
                  binding: { path: "customer.name" },
                },
              ],
              style: { fontFamily: "Inter", fontSize: 16, lineHeight: 1.2 },
            },
          ],
        },
      ],
    },
    {
      id: "page-2",
      name: "Page Two",
      size: PAGE_PRESETS.letter,
      layers: [
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            {
              id: "page-two-title",
              type: "text",
              frame: { x: 80, y: 80, width: 220, height: 24 },
              content: [{ kind: "text", text: "Second page" }],
              style: { fontFamily: "Inter", fontSize: 16, lineHeight: 1.2 },
            },
          ],
        },
        {
          id: "flow",
          kind: "flow",
          nodes: [
            {
              id: "body",
              type: "flowRegion",
              frame: { x: 40, y: 120, width: 300, height: 80 },
              children: [
                {
                  id: "section-title",
                  type: "text",
                  frame: { x: 0, y: 0, width: 200, height: 20 },
                  content: [{ kind: "text", text: "Items" }],
                  style: { fontFamily: "Inter", fontSize: 14, lineHeight: 1.2 },
                },
                {
                  id: "items-repeat",
                  type: "repeat",
                  frame: { x: 0, y: 8, width: 300, height: 30 },
                  binding: { path: "items" },
                  itemAlias: "item",
                  layout: { direction: "vertical", gap: 0 },
                  children: [
                    {
                      id: "row-bg",
                      type: "shape",
                      shape: "rectangle",
                      frame: { x: 0, y: 0, width: 300, height: 30 },
                      style: {
                        fill: "#ffffff",
                        stroke: "#d8dee8",
                        strokeWidth: 1,
                      },
                    },
                    {
                      id: "row-name",
                      type: "text",
                      frame: { x: 8, y: 8, width: 140, height: 14 },
                      content: [
                        {
                          kind: "field",
                          label: "Item",
                          binding: { path: "item.name" },
                        },
                      ],
                      style: {
                        fontFamily: "Inter",
                        fontSize: 10,
                        lineHeight: 1.2,
                      },
                    },
                  ],
                },
                {
                  id: "after-repeat",
                  type: "text",
                  frame: { x: 0, y: 12, width: 200, height: 18 },
                  content: [{ kind: "text", text: "After repeat" }],
                  style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 },
                },
                {
                  id: "tracking-code",
                  type: "barcode",
                  format: "code128",
                  frame: { x: 0, y: 12, width: 180, height: 42 },
                  value: {
                    kind: "binding",
                    binding: { path: "shipment.proNumber" },
                  },
                },
                {
                  id: "tracking-qr",
                  type: "qr",
                  frame: { x: 190, y: 12, width: 54, height: 54 },
                  value: {
                    kind: "binding",
                    binding: { path: "shipment.trackingUrl" },
                  },
                },
                {
                  id: "logo",
                  type: "image",
                  frame: { x: 250, y: 12, width: 44, height: 44 },
                  source: {
                    kind: "binding",
                    binding: { path: "business.logoUrl" },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("editor page model", () => {
  it("returns only the active page", () => {
    const page = buildEditorPageModel(template, "page-2");

    expect(page.id).toBe("page-2");
    expect(page.nodes.some((node) => node.sourceNodeId === "title")).toBe(
      false,
    );
    expect(
      page.nodes.some((node) => node.sourceNodeId === "page-two-title"),
    ).toBe(true);
  });

  it("renders one editable repeat row instead of expanded repeated output", () => {
    const page = buildEditorPageModel(template, "page-2");

    expect(
      page.nodes.filter((node) => node.sourceNodeId === "items-repeat"),
    ).toHaveLength(1);
    expect(
      page.nodes.filter((node) => node.sourceNodeId === "row-name"),
    ).toHaveLength(1);
    expect(
      page.nodes.find((node) => node.sourceNodeId === "items-repeat")?.visual,
    ).toMatchObject({
      kind: "container",
      label: "Repeat: items",
    });
  });

  it("stacks flow children on one editor page without pagination", () => {
    const page = buildEditorPageModel(template, "page-2");
    const repeat = page.nodes.find(
      (node) => node.sourceNodeId === "items-repeat",
    );
    const afterRepeat = page.nodes.find(
      (node) => node.sourceNodeId === "after-repeat",
    );

    expect(repeat?.frame.y).toBe(148);
    expect(repeat?.frame.height).toBe(122);
    expect(afterRepeat?.frame.y).toBe(282);
    expect(page.nodes.some((node) => node.id.includes("page-2-2"))).toBe(false);
  });

  it("renders text, generated code, and image bindings as handlebars", () => {
    const firstPage = buildEditorPageModel(template, "page-1");
    const secondPage = buildEditorPageModel(template, "page-2");
    const title = firstPage.nodes.find((node) => node.sourceNodeId === "title");
    const barcode = secondPage.nodes.find(
      (node) => node.sourceNodeId === "tracking-code",
    );
    const qr = secondPage.nodes.find(
      (node) => node.sourceNodeId === "tracking-qr",
    );
    const logo = secondPage.nodes.find((node) => node.sourceNodeId === "logo");

    expect(title?.visual).toMatchObject({
      kind: "text",
      text: "{{customer.name}}",
    });
    expect(barcode?.visual).toMatchObject({
      kind: "code",
      placeholder: "{{shipment.proNumber}}",
    });
    expect(qr?.visual).toMatchObject({
      kind: "code",
      placeholder: "{{shipment.trackingUrl}}",
    });
    expect(logo?.visual).toMatchObject({
      kind: "image",
      placeholder: "{{business.logoUrl}}",
    });
  });

  it("renders semantic sections as one authored container with padded flow children", () => {
    const sectionTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = sectionTemplate.pages[1].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const section = {
      id: "summary-section",
      type: "section",
      name: "Summary",
      frame: { x: 10, y: 4, width: 260, height: 56 },
      layout: {
        gap: 6,
        padding: { top: 8, right: 12, bottom: 8, left: 12 },
      },
      behavior: { keepTogether: true },
      style: { fill: "#f8fafc", stroke: "#d1d5db", strokeWidth: 1 },
      children: [
        {
          id: "summary-title",
          type: "text",
          frame: { x: 0, y: 0, width: 120, height: 16 },
          content: [{ kind: "text", text: "Summary" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 },
        },
        {
          id: "summary-total",
          type: "text",
          frame: { x: 0, y: 0, width: 120, height: 16 },
          content: [
            { kind: "field", label: "Total", binding: { path: "total" } },
          ],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 },
        },
      ],
    } satisfies SectionNode;

    flowRegion.children = [section];

    const page = buildEditorPageModel(sectionTemplate, "page-2");
    const sectionNode = page.nodes.find(
      (node) => node.sourceNodeId === "summary-section",
    );
    const title = page.nodes.find(
      (node) => node.sourceNodeId === "summary-title",
    );
    const total = page.nodes.find(
      (node) => node.sourceNodeId === "summary-total",
    );

    expect(sectionNode?.visual).toMatchObject({
      kind: "container",
      label: "Summary",
      tone: "section",
    });
    expect(sectionNode?.frame).toMatchObject({ x: 50, y: 124, height: 56 });
    expect(title?.frame).toMatchObject({ x: 62, y: 132 });
    expect(total?.frame).toMatchObject({ x: 62, y: 154 });
    expect(total?.visual).toMatchObject({ kind: "text", text: "{{total}}" });
  });

  it("renders horizontal stacks with left-to-right authored child positions", () => {
    const stackTemplate = structuredClone(template) as DocumentTemplate;
    const flowRegion = stackTemplate.pages[1].layers[1].nodes[0];

    if (flowRegion.type !== "flowRegion") {
      throw new Error("Expected flow region test fixture.");
    }

    const stack = {
      id: "party-row",
      type: "stack",
      direction: "horizontal",
      gap: 10,
      frame: { x: 10, y: 4, width: 180, height: 32 },
      children: [
        {
          id: "shipper-box",
          type: "text",
          frame: { x: 0, y: 0, width: 80, height: 16 },
          content: [{ kind: "text", text: "Shipper" }],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 },
        },
        {
          id: "recipient-box",
          type: "text",
          frame: { x: 0, y: 2, width: 90, height: 16 },
          content: [
            {
              kind: "field",
              label: "Recipient",
              binding: { path: "recipient.name" },
            },
          ],
          style: { fontFamily: "Inter", fontSize: 12, lineHeight: 1.2 },
        },
      ],
    } satisfies StackNode;

    flowRegion.children = [stack];

    const page = buildEditorPageModel(stackTemplate, "page-2");
    const stackNode = page.nodes.find(
      (node) => node.sourceNodeId === "party-row",
    );
    const shipper = page.nodes.find(
      (node) => node.sourceNodeId === "shipper-box",
    );
    const recipient = page.nodes.find(
      (node) => node.sourceNodeId === "recipient-box",
    );

    expect(stackNode?.visual).toMatchObject({
      kind: "container",
      label: "Horizontal stack",
      tone: "stack",
    });
    expect(stackNode?.frame).toMatchObject({
      x: 50,
      y: 124,
      width: 180,
      height: 32,
    });
    expect(shipper?.frame).toMatchObject({ x: 50, y: 124 });
    expect(recipient?.frame).toMatchObject({ x: 140, y: 126 });
    expect(recipient?.visual).toMatchObject({
      kind: "text",
      text: "{{recipient.name}}",
    });
  });
});

describe("updateNodeById isolation", () => {
  function buildSharedStyleTemplate(): {
    template: DocumentTemplate;
    sharedStyle: TextStyle;
  } {
    const sharedStyle: TextStyle = {
      fontFamily: "Inter",
      fontSize: 12,
      lineHeight: 1.2,
      color: "#111827",
    };

    return {
      sharedStyle,
      template: {
        id: "shared-style",
        version: "0.0.1",
        unit: "px",
        pages: [
          {
            id: "page-1",
            name: "Page One",
            size: PAGE_PRESETS.letter,
            layers: [
              {
                id: "fixed",
                kind: "fixed",
                nodes: [
                  {
                    id: "alpha",
                    type: "text",
                    frame: { x: 0, y: 0, width: 100, height: 20 },
                    content: [{ kind: "text", text: "Alpha" }],
                    style: sharedStyle,
                  },
                  {
                    id: "beta",
                    type: "text",
                    frame: { x: 0, y: 30, width: 100, height: 20 },
                    content: [{ kind: "text", text: "Beta" }],
                    style: sharedStyle,
                  },
                ],
              },
            ],
          },
        ],
      },
    };
  }

  it("does not leak an in-place style edit into siblings that share the same style object", () => {
    const { template } = buildSharedStyleTemplate();
    // Mirror the editor commit pipeline: deep clone (which preserves aliasing), then mutate one node.
    const next = structuredClone(template);

    updateNodeById(next, "alpha", (node) => {
      if (node.type === "text") {
        node.style.fontSize = 48;
        node.style.color = "#ff0000";
      }
    });

    const alpha = next.pages[0].layers[0].nodes[0] as TextNode;
    const beta = next.pages[0].layers[0].nodes[1] as TextNode;

    expect(alpha.style.fontSize).toBe(48);
    expect(alpha.style.color).toBe("#ff0000");
    expect(beta.style.fontSize).toBe(12);
    expect(beta.style.color).toBe("#111827");
    expect(alpha.style).not.toBe(beta.style);
  });

  it("leaves the source template untouched when editing a clone", () => {
    const { template, sharedStyle } = buildSharedStyleTemplate();
    const next = structuredClone(template);

    updateNodeById(next, "beta", (node) => {
      if (node.type === "text") {
        node.style.fontSize = 99;
      }
    });

    expect(sharedStyle.fontSize).toBe(12);
    expect(
      (template.pages[0].layers[0].nodes[1] as TextNode).style.fontSize,
    ).toBe(12);
  });
});

describe("alignment patches", () => {
  const subjects = [
    {
      id: "a",
      frame: { x: 20, y: 20, width: 50, height: 40 },
      absoluteFrame: { x: 20, y: 20, width: 50, height: 40 },
    },
    {
      id: "b",
      frame: { x: 120, y: 80, width: 60, height: 40 },
      absoluteFrame: { x: 120, y: 80, width: 60, height: 40 },
    },
    {
      id: "c",
      frame: { x: 260, y: 140, width: 40, height: 40 },
      absoluteFrame: { x: 260, y: 140, width: 40, height: 40 },
    },
  ];

  it("aligns a single node against page bounds", () => {
    expect(
      getAlignmentFramePatches(subjects, ["a"], "align-right", {
        width: 300,
        height: 200,
      }),
    ).toEqual({
      a: { x: 250 },
    });
  });

  it("aligns multiple nodes against selection bounds", () => {
    expect(
      getAlignmentFramePatches(subjects, ["a", "b"], "align-left", {
        width: 300,
        height: 200,
      }),
    ).toEqual({
      a: { x: 20 },
      b: { x: 20 },
    });
  });

  it("distributes only when three or more nodes are selected", () => {
    expect(
      getAlignmentFramePatches(subjects, ["a", "b"], "distribute-x", {
        width: 300,
        height: 200,
      }),
    ).toEqual({});
    expect(
      getAlignmentFramePatches(subjects, ["a", "b", "c"], "distribute-x", {
        width: 300,
        height: 200,
      }),
    ).toEqual({
      a: { x: 20 },
      b: { x: 135 },
      c: { x: 260 },
    });
  });
});
