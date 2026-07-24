import { describe, expect, it } from "vitest";
import type { GridNode, TextNode } from "./index";
import { childCollections, forEachNode } from "./walk";

const frame = { x: 0, y: 0, width: 100, height: 20 };
const textStyle = { fontFamily: "Geist", fontSize: 12 };

function textNode(id: string, path?: string): TextNode {
  return {
    id,
    type: "text",
    frame,
    content: path
      ? [{ kind: "field", label: id, binding: { path } }]
      : [{ kind: "text", text: id }],
    style: textStyle,
  };
}

function cell(columnId: string, ...content: TextNode[]) {
  return { columnId, content };
}

describe("childCollections / forEachNode — grid effective children", () => {
  it("walks row only when binding is set (ignores leftover staticRows)", () => {
    const staticCell = textNode("static-cell", "invoice.taxLabel");
    const rowCell = textNode("row-cell", "charge.amount");
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      binding: { path: "invoice.charges" },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      row: { cells: [cell("c1", rowCell)] },
      staticRows: [{ cells: [cell("c1", staticCell)] }],
    };

    const visited: string[] = [];
    forEachNode([grid], (node) => {
      if (node.type === "text") {
        visited.push(node.id);
      }
    });

    expect(visited).toEqual(["row-cell"]);
    expect(childCollections(grid)).toHaveLength(1);
  });

  it("walks staticRows only when unbound (not row separately)", () => {
    const rowA = textNode("row-a", "invoice.a");
    const rowB = textNode("row-b", "invoice.b");
    const aliased = { cells: [cell("c1", rowA)] };
    const second = { cells: [cell("c1", rowB)] };
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      // Editor alias: row points at staticRows[0]
      row: aliased,
      staticRows: [aliased, second],
    };

    const visited: string[] = [];
    forEachNode([grid], (node) => {
      if (node.type === "text") {
        visited.push(node.id);
      }
    });

    expect(visited).toEqual(["row-a", "row-b"]);
  });

  it("walks header and footer alongside effective body rows", () => {
    const header = textNode("header-cell");
    const body = textNode("body-cell");
    const footer = textNode("footer-cell");
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      binding: { path: "items" },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      header: { cells: [cell("c1", header)] },
      row: { cells: [cell("c1", body)] },
      footer: { cells: [cell("c1", footer)] },
      staticRows: [{ cells: [cell("c1", textNode("ignored"))] }],
    };

    const visited: string[] = [];
    forEachNode([grid], (node) => {
      if (node.type === "text") {
        visited.push(node.id);
      }
    });

    expect(visited).toEqual(["header-cell", "body-cell", "footer-cell"]);
  });

  it("falls back to row when unbound and staticRows is empty", () => {
    const body = textNode("solo-row");
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      row: { cells: [cell("c1", body)] },
      staticRows: [],
    };

    const visited: string[] = [];
    forEachNode([grid], (node) => {
      if (node.type === "text") {
        visited.push(node.id);
      }
    });

    expect(visited).toEqual(["solo-row"]);
  });
});
