import { describe, expect, it } from "vitest";
import type { BarcodeNode, DocumentTemplate, ImageNode, QrNode, RepeatNode, TextNode } from "@templara/core";
import {
  addDefaultVariableToInspectorTemplate,
  applyBindingPathToInspectorNode,
  applyRepeatItemExpressionToInspectorNode,
  applyTextValueRulesToInspectorNode,
  applyVisibleExpressionToInspectorNode,
  getInspectorMetadata,
  initialInspectorUiState,
  inspectorUiReducer,
  setInspectorMetadataValue
} from "./index";

describe("inspector UI reducer", () => {
  it("preserves tab and collapse state per target", () => {
    const withTextTab = inspectorUiReducer(initialInspectorUiState, {
      type: "set-tab",
      targetId: "node:text-1",
      tab: "logic"
    });
    const withPageTab = inspectorUiReducer(withTextTab, {
      type: "set-tab",
      targetId: "page:page-1",
      tab: "advanced"
    });
    const collapsed = inspectorUiReducer(withPageTab, {
      type: "toggle-section",
      targetId: "node:text-1",
      sectionId: "typography"
    });

    expect(collapsed.activeTabByTarget["node:text-1"]).toBe("logic");
    expect(collapsed.activeTabByTarget["page:page-1"]).toBe("advanced");
    expect(collapsed.collapsedSectionsByTarget["node:text-1"]?.typography).toBe(true);
    expect(collapsed.collapsedSectionsByTarget["page:page-1"]?.typography).toBeUndefined();
  });

  it("garbage-collects stale node targets", () => {
    const state = inspectorUiReducer(
      inspectorUiReducer(initialInspectorUiState, { type: "set-tab", targetId: "node:deleted", tab: "data" }),
      { type: "toggle-section", targetId: "node:deleted", sectionId: "layout" }
    );
    const next = inspectorUiReducer(state, { type: "garbage-collect", targetIds: ["page:page-1"] });

    expect(next.activeTabByTarget["node:deleted"]).toBeUndefined();
    expect(next.collapsedSectionsByTarget["node:deleted"]).toBeUndefined();
  });
});

describe("inspector logic helpers", () => {
  it("updates visibleIf and repeatItemIf as real node logic", () => {
    const text: TextNode = {
      id: "text",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "text", text: "Hello" }],
      style: { fontFamily: "Inter", fontSize: 12 }
    };
    const repeat: RepeatNode = {
      id: "repeat",
      type: "repeat",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      binding: { path: "shipment.items" },
      itemAlias: "item",
      layout: { direction: "vertical", gap: 0 },
      children: []
    };

    applyVisibleExpressionToInspectorNode(text, { source: "shipment.ready", operator: "equals", value: true });
    applyRepeatItemExpressionToInspectorNode(repeat, { source: "item.billable", operator: "equals", value: true });

    expect(text.logic?.visibleIf).toEqual({ source: "shipment.ready", operator: "equals", value: true });
    expect(repeat.logic?.repeatItemIf).toEqual({ source: "item.billable", operator: "equals", value: true });

    applyVisibleExpressionToInspectorNode(text, undefined);
    applyRepeatItemExpressionToInspectorNode(repeat, undefined);

    expect(text.logic).toBeUndefined();
    expect(repeat.logic).toBeUndefined();
  });

  it("updates text fallback and field format", () => {
    const text: TextNode = {
      id: "text",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "field", label: "Total", binding: { path: "invoice.total" } }],
      style: { fontFamily: "Inter", fontSize: 12 }
    };

    applyTextValueRulesToInspectorNode(text, {
      fallback: "0",
      format: { type: "currency", currency: "USD" }
    });

    expect(text.content[0]).toMatchObject({
      kind: "field",
      fallback: "0",
      format: { type: "currency", currency: "USD" }
    });
  });

  it("adds a real computed variable to the template", () => {
    const template: DocumentTemplate = {
      id: "test",
      version: "0.0.1",
      unit: "px",
      pages: [],
      dataSchema: {
        fields: [{ path: "invoice.items", label: "Items", kind: "array" }]
      }
    };

    const variable = addDefaultVariableToInspectorTemplate(template);

    expect(template.variables).toHaveLength(1);
    expect(variable).toMatchObject({
      id: "computedValue",
      category: "computed",
      value: { kind: "formula", formula: { op: "count", path: "invoice.items" } }
    });
  });
});

describe("inspector metadata helpers", () => {
  it("stores editor-only metadata without clobbering existing metadata", () => {
    const node: TextNode = {
      id: "title",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "text", text: "Hello" }],
      style: { fontFamily: "Inter", fontSize: 12 },
      metadata: { conditions: [{ id: "condition-1" }] }
    };

    setInspectorMetadataValue(node, "alias", "title-node");
    setInspectorMetadataValue(node, "anchor", 4);

    expect(node.metadata?.conditions).toEqual([{ id: "condition-1" }]);
    expect(getInspectorMetadata(node)).toMatchObject({ alias: "title-node", anchor: 4 });
  });
});

describe("inspector binding helper", () => {
  it("updates text, repeat, image, barcode, and QR bindings", () => {
    const text: TextNode = {
      id: "text",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "text", text: "Hello" }],
      style: { fontFamily: "Inter", fontSize: 12 }
    };
    const repeat: RepeatNode = {
      id: "repeat",
      type: "repeat",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      binding: { path: "items" },
      itemAlias: "item",
      layout: { direction: "vertical", gap: 0 },
      children: []
    };
    const image: ImageNode = {
      id: "image",
      type: "image",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      source: { kind: "url", url: "" }
    };
    const barcode: BarcodeNode = {
      id: "barcode",
      type: "barcode",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      format: "code128",
      value: { kind: "literal", value: "" }
    };
    const qr: QrNode = {
      id: "qr",
      type: "qr",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      value: { kind: "literal", value: "" }
    };

    applyBindingPathToInspectorNode(text, "shipment.name");
    applyBindingPathToInspectorNode(repeat, "shipment.items");
    applyBindingPathToInspectorNode(image, "business.logo");
    applyBindingPathToInspectorNode(barcode, "shipment.bolNumber");
    applyBindingPathToInspectorNode(qr, "shipment.trackingUrl");

    expect(text.content).toEqual([{ kind: "field", label: "shipment.name", binding: { path: "shipment.name" } }]);
    expect(repeat.binding.path).toBe("shipment.items");
    expect(image.source).toEqual({ kind: "binding", binding: { path: "business.logo" } });
    expect(barcode.value).toEqual({ kind: "binding", binding: { path: "shipment.bolNumber" } });
    expect(qr.value).toEqual({ kind: "binding", binding: { path: "shipment.trackingUrl" } });
  });
});
