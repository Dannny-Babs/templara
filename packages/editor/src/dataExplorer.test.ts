import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { DocumentTemplate, GridNode, ImageNode, RepeatNode, TextNode } from "@templara/core";
import { collectPageNodeItems } from "./editorModel";
import {
  applyDataBindingToNode,
  buildDataExplorerModel,
  createBoundTextNode,
  dataFieldsFromLabelMap,
  defaultCollapsedDataFieldKeys,
  filterDataExplorerGroups,
  isFieldBindableForNode,
  isSystemDataPath,
  resolveSelectedDataScope
} from "./dataExplorer";

const textStyle = { fontFamily: "Geist", fontSize: 12, lineHeight: 1.2 };

function fixtureTemplate(): DocumentTemplate {
  return {
    id: "data-explorer-test",
    version: "0.0.1",
    unit: "px",
    variables: [
      {
        id: "totalLabel",
        name: "Total Label",
        category: "computed",
        value: { kind: "literal", value: "Total" }
      },
      {
        id: "handlingUnitCount",
        name: "Handling Unit Count",
        category: "computed",
        value: { kind: "formula", formula: { op: "count", path: "shipment.handlingUnits" } }
      }
    ],
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
                id: "recipient",
                type: "text",
                frame: { x: 40, y: 40, width: 160, height: 20 },
                content: [{ kind: "field", label: "Recipient", binding: { path: "shipment.recipient.name" } }],
                style: textStyle
              },
              {
                id: "items-repeat",
                type: "repeat",
                frame: { x: 40, y: 80, width: 300, height: 32 },
                binding: { path: "shipment.handlingUnits" },
                itemAlias: "item",
                layout: { direction: "vertical", gap: 0 },
                children: [
                  {
                    id: "item-description",
                    type: "text",
                    frame: { x: 8, y: 8, width: 160, height: 16 },
                    content: [{ kind: "field", label: "Description", binding: { path: "item.description" } }],
                    style: textStyle
                  }
                ]
              },
              {
                id: "grid",
                type: "grid",
                frame: { x: 40, y: 140, width: 300, height: 80 },
                binding: { path: "shipment.handlingUnits" },
                columns: [{ id: "description", label: "Description", width: 180 }],
                rowHeight: 24,
                row: {
                  cells: [
                    {
                      columnId: "description",
                      content: [
                        {
                          id: "grid-description",
                          type: "text",
                          frame: { x: 8, y: 6, width: 160, height: 14 },
                          content: [{ kind: "field", label: "Description", binding: { path: "item.description" } }],
                          style: textStyle
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ],
    dataSchema: {
      fields: [
        { path: "shipment", label: "Shipment", kind: "object" },
        { path: "shipment.bolNumber", label: "BOL Number", kind: "string" },
        { path: "shipment.handlingUnits", label: "Handling Units", kind: "array" }
      ]
    }
  };
}

const sampleData = {
  shipment: {
    bolNumber: "BOL-1",
    recipient: {
      name: "Prairie Retail"
    },
    handlingUnits: [
      {
        description: "Wrapped freight",
        weight: 320,
        hazmat: false
      }
    ]
  },
  business: {
    logoUrl: "https://example.test/logo.png"
  }
} satisfies Record<string, unknown>;

describe("data explorer model", () => {
  it("merges schema fields with sample-data fallback fields", () => {
    const model = buildDataExplorerModel({ template: fixtureTemplate(), data: sampleData });
    const documentPaths = model.groups.find((group) => group.id === "document")?.fields.map((field) => field.path);

    expect(documentPaths).toContain("shipment.bolNumber");
    expect(documentPaths).toContain("shipment.recipient.name");
    expect(documentPaths).toContain("business.logoUrl");
  });

  it("annotates object and array parent rows with hierarchy metadata", () => {
    const model = buildDataExplorerModel({ template: fixtureTemplate(), data: sampleData });
    const documentFields = model.groups.find((group) => group.id === "document")?.fields ?? [];
    const shipment = documentFields.find((field) => field.path === "shipment");
    const handlingUnits = documentFields.find((field) => field.path === "shipment.handlingUnits");
    const weight = documentFields.find((field) => field.path === "shipment.handlingUnits.weight");

    expect(shipment).toMatchObject({
      depth: 0,
      hasChildren: true
    });
    expect(handlingUnits).toMatchObject({
      parentPath: "shipment",
      depth: 1,
      hasChildren: true
    });
    expect(weight).toMatchObject({
      parentPath: "shipment.handlingUnits",
      depth: 2
    });
  });

  it("includes template variables as direct bindable fields", () => {
    const model = buildDataExplorerModel({ template: fixtureTemplate(), data: sampleData });
    const variables = model.groups.find((group) => group.id === "variables")?.fields ?? [];
    const variable = variables.find((field) => field.path === "totalLabel");
    const formulaVariable = variables.find((field) => field.path === "handlingUnitCount");

    expect(variable).toMatchObject({
      path: "totalLabel",
      displayPath: "variables.totalLabel",
      source: "variable",
      kind: "text"
    });
    expect(formulaVariable).toMatchObject({
      path: "handlingUnitCount",
      displayPath: "variables.handlingUnitCount",
      source: "variable",
      kind: "number",
      bindable: true
    });
  });

  it("shows repeat child fields using the repeat alias", () => {
    const template = fixtureTemplate();
    const items = collectPageNodeItems(template, "page-1");
    const model = buildDataExplorerModel({ template, data: sampleData, nodeItems: items, selectedNodeIds: ["item-description"] });
    const scope = model.groups.find((group) => group.id === "scope");

    expect(resolveSelectedDataScope(items, ["item-description"])).toMatchObject({
      alias: "item",
      bindingPath: "shipment.handlingUnits",
      source: "repeat"
    });
    expect(scope?.fields.map((field) => field.path)).toEqual(expect.arrayContaining(["item.description", "item.weight", "item.hazmat"]));
  });

  it("shows grid row scope fields using item alias", () => {
    const template = fixtureTemplate();
    const items = collectPageNodeItems(template, "page-1");
    const model = buildDataExplorerModel({ template, data: sampleData, nodeItems: items, selectedNodeIds: ["grid"] });
    const scope = model.groups.find((group) => group.id === "scope");

    expect(scope?.detail).toBe("item from shipment.handlingUnits");
    expect(scope?.fields.map((field) => field.path)).toContain("item.description");
  });

  it("omits current scope for multi-select so binding can be disabled by the UI", () => {
    const template = fixtureTemplate();
    const items = collectPageNodeItems(template, "page-1");

    expect(resolveSelectedDataScope(items, ["recipient", "item-description"])).toBeUndefined();
  });
});

describe("data binding helpers", () => {
  it("updates supported node bindings consistently", () => {
    const text: TextNode = {
      id: "text",
      type: "text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      content: [{ kind: "text", text: "Hello" }],
      style: textStyle
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
    const grid: GridNode = {
      id: "grid",
      type: "grid",
      frame: { x: 0, y: 0, width: 200, height: 80 },
      columns: [],
      rowHeight: 24,
      row: { cells: [] }
    };

    applyDataBindingToNode(text, "shipment.recipient.name");
    applyDataBindingToNode(repeat, "shipment.handlingUnits");
    applyDataBindingToNode(image, "business.logoUrl");
    applyDataBindingToNode(grid, "shipment.handlingUnits");

    expect(text.content).toEqual([{ kind: "field", label: "shipment.recipient.name", binding: { path: "shipment.recipient.name" } }]);
    expect(repeat.binding.path).toBe("shipment.handlingUnits");
    expect(image.source).toEqual({ kind: "binding", binding: { path: "business.logoUrl" } });
    expect(grid.binding).toEqual({ path: "shipment.handlingUnits" });
  });

  it("creates a bound text node for click or drag insertion", () => {
    const node = createBoundTextNode("bound-field-1", "shipment.bolNumber", { x: 48.4, y: 81.7 });

    expect(node).toMatchObject({
      id: "bound-field-1",
      type: "text",
      frame: { x: 48, y: 82 },
      content: [{ kind: "field", label: "shipment.bolNumber", binding: { path: "shipment.bolNumber" } }]
    });
  });

  it("allows arrays only for repeat and grid binding targets", () => {
    const template = fixtureTemplate();
    const arrayField = buildDataExplorerModel({ template, data: sampleData }).allFields.find((field) => field.path === "shipment.handlingUnits");
    const primitiveField = buildDataExplorerModel({ template, data: sampleData }).allFields.find((field) => field.path === "shipment.bolNumber");
    const repeat = template.pages[0].layers[0].nodes.find((node) => node.id === "items-repeat");
    const text = template.pages[0].layers[0].nodes.find((node) => node.id === "recipient");

    if (!arrayField || !primitiveField || repeat?.type !== "repeat" || text?.type !== "text") {
      throw new Error("Invalid test fixture");
    }

    expect(isFieldBindableForNode(arrayField, repeat)).toBe(true);
    expect(isFieldBindableForNode(arrayField, text)).toBe(false);
    expect(isFieldBindableForNode(primitiveField, text)).toBe(true);
  });
});

describe("large schema browse helpers", () => {
  it("hides $-prefixed system fields by default", () => {
    const template: DocumentTemplate = {
      id: "system-fields",
      version: "0.0.1",
      unit: "px",
      pages: [{ id: "page-1", size: { width: 100, height: 100 }, layers: [] }],
      dataSchema: {
        fields: [
          {
            path: "record",
            label: "Record",
            kind: "object",
            children: [
              { path: "$id", label: "System id", kind: "string" },
              { path: "fullId", label: "Full ID", kind: "string" },
              {
                path: "connectedLegs",
                label: "Legs",
                kind: "object",
                children: [
                  { path: "$createdAt", label: "Created", kind: "string" },
                  { path: "name", label: "Leg name", kind: "string" },
                ],
              },
            ],
          },
        ],
      },
    };

    const hidden = buildDataExplorerModel({ template });
    expect(hidden.allFields.some((field) => field.path.includes("$"))).toBe(false);
    expect(hidden.allFields.map((field) => field.path)).toEqual(
      expect.arrayContaining([
        "record",
        "record.fullId",
        "record.connectedLegs",
        "record.connectedLegs.name",
      ]),
    );

    const shown = buildDataExplorerModel({ template, hideSystemFields: false });
    expect(shown.allFields.some((field) => field.path.endsWith("$id"))).toBe(true);
  });

  it("keeps ancestor rows when searching nested fields", () => {
    const template: DocumentTemplate = {
      id: "search-ancestors",
      version: "0.0.1",
      unit: "px",
      pages: [{ id: "page-1", size: { width: 100, height: 100 }, layers: [] }],
      dataSchema: {
        fields: [
          {
            path: "record",
            label: "Record",
            kind: "object",
            children: [
              {
                path: "connectedLegs",
                label: "Legs",
                kind: "object",
                children: [
                  { path: "originPostalCode", label: "Origin postal", kind: "string" },
                  { path: "name", label: "Leg name", kind: "string" },
                ],
              },
            ],
          },
        ],
      },
    };

    const model = buildDataExplorerModel({ template });
    const filtered = filterDataExplorerGroups(model.groups, "postal");
    const paths = filtered[0]?.fields.map((field) => field.path) ?? [];

    expect(paths).toEqual([
      "record",
      "record.connectedLegs",
      "record.connectedLegs.originPostalCode",
    ]);
  });

  it("loads the truncated order-schema fixture into a searchable model", () => {
    const samplePath = new URL(
      "../../../docs/fixtures/order-schema-sample.json",
      import.meta.url,
    );
    const sample = JSON.parse(
      readFileSync(samplePath, "utf8"),
    ) as Record<string, unknown>;
    const fields = dataFieldsFromLabelMap(sample);
    const template: DocumentTemplate = {
      id: "order-schema-sample",
      version: "0.0.1",
      unit: "px",
      pages: [{ id: "page-1", size: { width: 100, height: 100 }, layers: [] }],
      dataSchema: { fields },
    };

    const started = performance.now();
    const model = buildDataExplorerModel({ template });
    const filtered = filterDataExplorerGroups(model.groups, "postal");
    const elapsed = performance.now() - started;

    expect(model.allFields.length).toBeGreaterThan(40);
    expect(model.allFields.some((field) => isSystemDataPath(field.path))).toBe(
      false,
    );
    expect(filtered[0]?.fields.some((field) => /postal/i.test(field.path))).toBe(
      true,
    );
    expect(Object.keys(defaultCollapsedDataFieldKeys(model.groups)).length).toBeGreaterThan(
      0,
    );
    // Browse + search against the fixture should stay interactive on CI.
    expect(elapsed).toBeLessThan(250);
  });
});
