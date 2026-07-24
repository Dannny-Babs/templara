import { describe, expect, it } from "vitest";
import type {
  DocumentTemplate,
  FlowNode,
  GridNode,
  ImageNode,
  RepeatNode,
  TextNode,
} from "./index";
import { PAGE_PRESETS } from "./index";
import { extractBindings } from "./extractBindings";

const frame = { x: 0, y: 0, width: 100, height: 20 };
const textStyle = { fontFamily: "Geist", fontSize: 12 };

function emptyTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: "tpl",
    version: "0.0.1",
    unit: "px",
    pages: [
      {
        id: "page-1",
        size: PAGE_PRESETS.letter,
        layers: [{ id: "fixed", kind: "fixed", nodes: [] }],
      },
    ],
    ...overrides,
  };
}

function withNodes(...nodes: DocumentTemplate["pages"][0]["layers"][0]["nodes"]): DocumentTemplate {
  return emptyTemplate({
    pages: [
      {
        id: "page-1",
        size: PAGE_PRESETS.letter,
        layers: [{ id: "fixed", kind: "fixed", nodes }],
      },
    ],
  });
}

describe("extractBindings", () => {
  it("returns [] for an empty template", () => {
    expect(extractBindings(emptyTemplate())).toEqual([]);
  });

  it("collects field bindings and sorts uniquely", () => {
    const text: TextNode = {
      id: "t1",
      type: "text",
      frame,
      content: [
        { kind: "field", label: "Total", binding: { path: "invoice.total" } },
        { kind: "text", text: " / " },
        { kind: "field", label: "Total again", binding: { path: "invoice.total" } },
        { kind: "field", label: "Date", binding: { path: "invoice.date" } },
      ],
      style: textStyle,
    };

    expect(extractBindings(withNodes(text))).toEqual(["invoice.date", "invoice.total"]);
  });

  it("collects repeat bindings and nested field paths", () => {
    const repeat: RepeatNode = {
      id: "lines",
      type: "repeat",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      binding: { path: "invoice.lineItems" },
      itemAlias: "item",
      layout: { direction: "vertical", gap: 4 },
      children: [
        {
          id: "desc",
          type: "text",
          frame,
          content: [{ kind: "field", label: "Desc", binding: { path: "item.description" } }],
          style: textStyle,
        },
      ],
    };

    expect(extractBindings(withNodes(repeat))).toEqual([
      "invoice.lineItems",
      "item.description",
    ]);
  });

  it("collects conditional source and visibleIf / repeatItemIf", () => {
    const node: FlowNode = {
      id: "cond",
      type: "conditional",
      frame: { x: 0, y: 0, width: 200, height: 100 },
      condition: {
        source: "invoice.isPaid",
        operator: "equals",
        compareSource: "invoice.paidFlag",
      },
      children: [
        {
          id: "paid",
          type: "text",
          frame,
          content: [{ kind: "text", text: "Paid" }],
          style: textStyle,
          logic: {
            visibleIf: { source: "invoice.showPaidBadge", operator: "truthy" },
            repeatItemIf: {
              source: "item.active",
              operator: "equals",
              compareSource: "item.enabled",
            },
          },
        },
      ],
    };

    expect(extractBindings(withNodes(node))).toEqual([
      "invoice.isPaid",
      "invoice.paidFlag",
      "invoice.showPaidBadge",
      "item.active",
      "item.enabled",
    ]);
  });

  it("collects formula sum/count paths and path operands", () => {
    const template = emptyTemplate({
      variables: [
        {
          id: "line-sum",
          name: "Line sum",
          value: {
            kind: "formula",
            formula: { op: "sum", path: "invoice.lineItems.amount" },
          },
        },
        {
          id: "line-count",
          name: "Line count",
          value: {
            kind: "formula",
            formula: { op: "count", path: "invoice.lineItems" },
          },
        },
        {
          id: "label",
          name: "Label",
          value: {
            kind: "formula",
            formula: {
              op: "concat",
              parts: [
                { kind: "literal", value: "Total: " },
                { kind: "path", path: "invoice.currency" },
              ],
            },
          },
        },
        {
          id: "bound",
          name: "Bound",
          value: { kind: "binding", binding: { path: "invoice.notes" } },
        },
      ],
    });

    expect(extractBindings(template)).toEqual([
      "invoice.currency",
      "invoice.lineItems",
      "invoice.lineItems.amount",
      "invoice.notes",
    ]);
  });

  it("collects arithmetic formula left/right path operands", () => {
    const template = emptyTemplate({
      variables: [
        {
          id: "add",
          name: "Add",
          value: {
            kind: "formula",
            formula: {
              op: "add",
              left: { kind: "path", path: "invoice.subtotal" },
              right: { kind: "path", path: "invoice.tax" },
            },
          },
        },
        {
          id: "subtract",
          name: "Subtract",
          value: {
            kind: "formula",
            formula: {
              op: "subtract",
              left: { kind: "path", path: "invoice.total" },
              right: { kind: "path", path: "invoice.discount" },
            },
          },
        },
        {
          id: "multiply",
          name: "Multiply",
          value: {
            kind: "formula",
            formula: {
              op: "multiply",
              left: { kind: "path", path: "item.quantity" },
              right: { kind: "path", path: "item.unitPrice" },
            },
          },
        },
        {
          id: "divide",
          name: "Divide",
          value: {
            kind: "formula",
            formula: {
              op: "divide",
              left: { kind: "path", path: "invoice.total" },
              right: { kind: "literal", value: 2 },
            },
          },
        },
      ],
    });

    expect(extractBindings(template)).toEqual([
      "invoice.discount",
      "invoice.subtotal",
      "invoice.tax",
      "invoice.total",
      "item.quantity",
      "item.unitPrice",
    ]);
  });

  it("collects image and barcode/qr binding paths", () => {
    const image: ImageNode = {
      id: "logo",
      type: "image",
      frame: { x: 0, y: 0, width: 80, height: 80 },
      source: { kind: "binding", binding: { path: "business.logoUrl" } },
    };
    const barcode: FlowNode = {
      id: "bc",
      type: "barcode",
      frame,
      format: "code128",
      value: { kind: "binding", binding: { path: "invoice.barcode" } },
    };
    const qr: FlowNode = {
      id: "qr",
      type: "qr",
      frame,
      value: {
        kind: "template",
        parts: [
          { kind: "text", text: "https://pay/" },
          { kind: "field", label: "Id", binding: { path: "invoice.id" } },
        ],
      },
    };

    expect(extractBindings(withNodes(image, barcode, qr))).toEqual([
      "business.logoUrl",
      "invoice.barcode",
      "invoice.id",
    ]);
  });

  it("collects bound grid paths from row (and header/footer), not unused staticRows", () => {
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      binding: { path: "invoice.charges" },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      header: {
        cells: [
          {
            columnId: "c1",
            content: [
              {
                id: "header-cell",
                type: "text",
                frame,
                content: [
                  { kind: "field", label: "Hdr", binding: { path: "invoice.headerLabel" } },
                ],
                style: textStyle,
              },
            ],
          },
        ],
      },
      row: {
        cells: [
          {
            columnId: "c1",
            content: [
              {
                id: "row-cell",
                type: "text",
                frame,
                content: [
                  { kind: "field", label: "Amt", binding: { path: "charge.amount" } },
                ],
                style: textStyle,
              },
            ],
          },
        ],
      },
      footer: {
        cells: [
          {
            columnId: "c1",
            content: [
              {
                id: "footer-cell",
                type: "text",
                frame,
                content: [
                  { kind: "field", label: "Tot", binding: { path: "invoice.footerTotal" } },
                ],
                style: textStyle,
              },
            ],
          },
        ],
      },
      staticRows: [
        {
          cells: [
            {
              columnId: "c1",
              content: [
                {
                  id: "static-cell",
                  type: "text",
                  frame,
                  content: [
                    {
                      kind: "field",
                      label: "Tax",
                      binding: { path: "invoice.taxLabel" },
                    },
                  ],
                  style: textStyle,
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractBindings(withNodes(grid))).toEqual([
      "charge.amount",
      "invoice.charges",
      "invoice.footerTotal",
      "invoice.headerLabel",
    ]);
  });

  it("collects unbound grid paths from staticRows without double-counting row alias", () => {
    const sharedCell: TextNode = {
      id: "shared-cell",
      type: "text",
      frame,
      content: [{ kind: "field", label: "A", binding: { path: "invoice.rowA" } }],
      style: textStyle,
    };
    const aliasedRow = {
      cells: [{ columnId: "c1", content: [sharedCell] }],
    };
    const secondRow = {
      cells: [
        {
          columnId: "c1",
          content: [
            {
              id: "second-cell",
              type: "text" as const,
              frame,
              content: [
                { kind: "field" as const, label: "B", binding: { path: "invoice.rowB" } },
              ],
              style: textStyle,
            },
          ],
        },
      ],
    };
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 400, height: 200 },
      columns: [{ id: "c1", width: 200 }],
      rowHeight: 24,
      row: aliasedRow,
      staticRows: [aliasedRow, secondRow],
    };

    expect(extractBindings(withNodes(grid))).toEqual(["invoice.rowA", "invoice.rowB"]);
  });

  it("skips empty binding paths", () => {
    const text: TextNode = {
      id: "t1",
      type: "text",
      frame,
      content: [{ kind: "field", label: "Empty", binding: { path: "" } }],
      style: textStyle,
    };

    expect(extractBindings(withNodes(text))).toEqual([]);
  });
});
