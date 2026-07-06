import { describe, expect, it } from "vitest";
import { inferDataSchemaFromSample } from "./schemaAuthoring";

describe("inferDataSchemaFromSample", () => {
  it("infers nested object and array fields with stable paths", () => {
    const schema = inferDataSchemaFromSample({
      shipment: {
        bolNumber: "BOL-1001",
        date: "2026-07-06",
        logoUrl: "https://example.com/logo.png",
        items: [{ description: "Widget", weight: 12, hazmat: false }],
      },
    });

    expect(schema.fields[0]).toMatchObject({
      path: "shipment",
      kind: "object",
      children: expect.arrayContaining([
        expect.objectContaining({ path: "shipment.bolNumber", kind: "string" }),
        expect.objectContaining({ path: "shipment.date", kind: "date" }),
        expect.objectContaining({ path: "shipment.logoUrl", kind: "image" }),
        expect.objectContaining({
          path: "shipment.items",
          kind: "array",
          children: expect.arrayContaining([
            expect.objectContaining({ path: "shipment.items.description", kind: "string" }),
            expect.objectContaining({ path: "shipment.items.weight", kind: "number" }),
            expect.objectContaining({ path: "shipment.items.hazmat", kind: "boolean" }),
          ]),
        }),
      ]),
    });
  });

  it("infers unknown for nullish scalar values", () => {
    expect(inferDataSchemaFromSample({ missing: null }).fields[0]).toMatchObject({
      path: "missing",
      kind: "unknown",
    });
  });
});
