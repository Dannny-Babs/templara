import { describe, expect, it } from "vitest";
import type { DocumentTemplate, TextNode } from "@templara/core";
import type { EditorNodeItem } from "./editorModel";
import { createEditorClipboard, pasteEditorClipboardNodes } from "./editorClipboard";

const textNode: TextNode = {
  id: "customer-name",
  type: "text",
  frame: { x: 10, y: 20, width: 120, height: 24 },
  content: [{ kind: "text", text: "Customer" }],
  style: { fontFamily: "Geist", fontSize: 12 },
};

function templateWithNode(node: TextNode = textNode): DocumentTemplate {
  return {
    id: "clipboard-test",
    version: "0.0.1",
    unit: "px",
    pages: [
      {
        id: "page-1",
        size: { width: 816, height: 1056 },
        layers: [{ id: "fixed", kind: "fixed", nodes: [structuredClone(node)] }],
      },
    ],
  };
}

function item(node: TextNode, absoluteFrame = node.frame): EditorNodeItem {
  return {
    id: node.id,
    type: node.type,
    label: node.id,
    depth: 0,
    pageId: "page-1",
    layerId: "fixed",
    layerKind: "fixed",
    path: `page-1.fixed.${node.id}`,
    frame: node.frame,
    absoluteFrame,
    node,
  };
}

describe("editor clipboard", () => {
  it("copies absolute visual frames for pasted top-level nodes", () => {
    const clipboard = createEditorClipboard([
      item(textNode, { x: 80, y: 90, width: 120, height: 24 }),
    ]);

    expect(clipboard?.nodes[0]?.node.frame).toMatchObject({ x: 80, y: 90 });
  });

  it("pastes nodes with fresh ids and offset positions", () => {
    const template = templateWithNode();
    const clipboard = createEditorClipboard([item(textNode)]);

    if (!clipboard) throw new Error("Expected clipboard");

    const pasted = pasteEditorClipboardNodes(template, clipboard, 24);

    expect(pasted.ids).toEqual(["customer-name-copy"]);
    expect(pasted.nodes[0]).toMatchObject({
      id: "customer-name-copy",
      frame: { x: 34, y: 44, width: 120, height: 24 },
    });
    expect(textNode.id).toBe("customer-name");
  });

  it("returns undefined for an empty selection", () => {
    expect(createEditorClipboard([])).toBeUndefined();
  });
});
