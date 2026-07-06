import { describe, expect, it } from "vitest";
import type { GridNode, TextNode } from "@templara/core";
import {
  addGridStaticRow,
  addGridColumn,
  bindGridColumn,
  removeGridColumn,
  removeGridStaticRow,
  setGridCellPadding,
  setGridCellStyle,
  setGridAllowRowSplit,
  setGridColumnLabel,
  setGridColumnWidth,
  setGridFooterEnabled,
  setGridHeaderEnabled,
  setGridRepeatHeaderOnBreak,
} from "./gridModel";

const textStyle = { fontFamily: "Geist", fontSize: 11, lineHeight: 1.2 };

function fixtureGrid(): GridNode {
  return {
    id: "handling-units-table",
    type: "grid",
    frame: { x: 40, y: 120, width: 280, height: 120 },
    binding: { path: "shipment.handlingUnits" },
    columns: [
      { id: "quantity", label: "Qty", width: 80 },
      { id: "description", label: "Description", width: 200 },
    ],
    rowHeight: 28,
    header: {
      cells: [
        { columnId: "quantity", content: [cellText("header-quantity", "Qty")] },
        { columnId: "description", content: [cellText("header-description", "Description")] },
      ],
    },
    row: {
      cells: [
        { columnId: "quantity", content: [fieldText("row-quantity", "item.quantity")] },
        { columnId: "description", content: [fieldText("row-description", "item.description")] },
      ],
    },
  };
}

function cellText(id: string, text: string): TextNode {
  return {
    id,
    type: "text",
    frame: { x: 8, y: 8, width: 64, height: 14 },
    content: [{ kind: "text", text }],
    style: textStyle,
  };
}

function fieldText(id: string, path: string): TextNode {
  return {
    ...cellText(id, path),
    content: [{ kind: "field", label: path, binding: { path } }],
  };
}

function firstCellText(grid: GridNode, row: "header" | "row" | "footer", columnId: string): TextNode {
  const rowTemplate = row === "header" ? grid.header : row === "footer" ? grid.footer : grid.row;
  const node = rowTemplate?.cells.find((cell) => cell.columnId === columnId)?.content[0];
  expect(node?.type).toBe("text");
  return node as TextNode;
}

describe("grid model helpers", () => {
  it("adds a column across header, body, and footer templates and syncs frame width", () => {
    const grid = fixtureGrid();
    setGridFooterEnabled(grid, true);

    const id = addGridColumn(grid, { id: "weight", label: "Weight", width: 96 });

    expect(id).toBe("weight");
    expect(grid.columns.map((column) => column.id)).toEqual(["quantity", "description", "weight"]);
    expect(grid.header?.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description", "weight"]);
    expect(grid.row.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description", "weight"]);
    expect(grid.footer?.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description", "weight"]);
    expect(grid.frame.width).toBe(376);
    expect(firstCellText(grid, "row", "weight").id).toBe("handling-units-table-row-weight-text");
    expect(firstCellText(grid, "row", "weight").content).toEqual([
      { kind: "field", label: "Weight", binding: { path: "item.weight" } },
    ]);
  });

  it("generates unique column ids from duplicate labels", () => {
    const grid = fixtureGrid();

    const id = addGridColumn(grid, { id: "description", label: "Description" });

    expect(id).toBe("description-2");
    expect(grid.columns.at(-1)).toMatchObject({ id: "description-2", label: "Description" });
  });

  it("removes a column from every row template but refuses to remove the last column", () => {
    const grid = fixtureGrid();

    expect(removeGridColumn(grid, "quantity")).toBe(true);
    expect(grid.columns.map((column) => column.id)).toEqual(["description"]);
    expect(grid.header?.cells.map((cell) => cell.columnId)).toEqual(["description"]);
    expect(grid.row.cells.map((cell) => cell.columnId)).toEqual(["description"]);
    expect(grid.frame.width).toBe(200);
    expect(removeGridColumn(grid, "description")).toBe(false);
    expect(grid.columns).toHaveLength(1);
  });

  it("updates column width, child text width, and frame width together", () => {
    const grid = fixtureGrid();

    expect(setGridColumnWidth(grid, "description", 144)).toBe(true);

    expect(grid.columns.find((column) => column.id === "description")?.width).toBe(144);
    expect(firstCellText(grid, "row", "description").frame.width).toBe(128);
    expect(grid.frame.width).toBe(224);
  });

  it("updates header labels without clobbering body bindings", () => {
    const grid = fixtureGrid();

    expect(setGridColumnLabel(grid, "description", "Commodity")).toBe(true);

    expect(grid.columns.find((column) => column.id === "description")?.label).toBe("Commodity");
    expect(firstCellText(grid, "header", "description").content).toEqual([{ kind: "text", text: "Commodity" }]);
    expect(firstCellText(grid, "row", "description").content).toEqual([
      { kind: "field", label: "item.description", binding: { path: "item.description" } },
    ]);
  });

  it("toggles header and footer templates using the current columns", () => {
    const grid = fixtureGrid();

    setGridHeaderEnabled(grid, false);
    setGridFooterEnabled(grid, true);

    expect(grid.header).toBeUndefined();
    expect(grid.footer?.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description"]);

    setGridHeaderEnabled(grid, true);

    expect(grid.header?.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description"]);
    expect(firstCellText(grid, "header", "quantity").content).toEqual([{ kind: "text", text: "Qty" }]);
  });

  it("stores only enabled renderer-backed behavior flags", () => {
    const grid = fixtureGrid();

    setGridRepeatHeaderOnBreak(grid, true);
    setGridAllowRowSplit(grid, true);
    expect(grid.behavior).toEqual({ repeatHeaderOnPageBreak: true, allowRowSplit: true });

    setGridRepeatHeaderOnBreak(grid, false);
    setGridAllowRowSplit(grid, false);
    expect(grid.behavior).toBeUndefined();
  });

  it("adds and removes static rows for unbound tables without losing the primary row", () => {
    const grid = fixtureGrid();
    delete grid.binding;

    expect(addGridStaticRow(grid)).toBe(true);
    expect(grid.staticRows).toHaveLength(2);
    expect(grid.staticRows?.[0]).toBe(grid.row);
    expect(grid.staticRows?.[1]?.cells.map((cell) => cell.columnId)).toEqual(["quantity", "description"]);
    expect(firstCellText(grid, "row", "description").id).toBe("row-description");
    expect(grid.staticRows?.[1]?.cells[1]?.content[0]?.id).toBe("handling-units-table-row-1-description-text");

    expect(removeGridStaticRow(grid, 1)).toBe(true);
    expect(grid.staticRows).toHaveLength(1);
    expect(removeGridStaticRow(grid, 0)).toBe(false);
  });

  it("does not add static rows to bound tables", () => {
    const grid = fixtureGrid();

    expect(addGridStaticRow(grid)).toBe(false);
    expect(grid.staticRows).toBeUndefined();
  });

  it("updates cell style and padding while preserving child content", () => {
    const grid = fixtureGrid();

    expect(setGridCellStyle(grid, "row", "description", { fill: "#f8fafc", stroke: "#111827", strokeWidth: 2 })).toBe(true);
    expect(setGridCellPadding(grid, "row", "description", 12)).toBe(true);

    const cell = grid.row.cells.find((entry) => entry.columnId === "description");
    const text = firstCellText(grid, "row", "description");

    expect(cell?.style).toMatchObject({ fill: "#f8fafc", stroke: "#111827", strokeWidth: 2 });
    expect(text.frame.x).toBe(12);
    expect(text.frame.y).toBe(12);
    expect(text.frame.width).toBe(176);
    expect(text.content).toEqual([{ kind: "field", label: "item.description", binding: { path: "item.description" } }]);
  });

  it("binds a column by updating existing text children", () => {
    const grid = fixtureGrid();

    expect(bindGridColumn(grid, "description", "item.freightClass")).toBe(true);

    expect(firstCellText(grid, "row", "description").content).toEqual([
      { kind: "field", label: "Description", binding: { path: "item.freightClass" } },
    ]);
  });
});
