import { describe, expect, it } from "vitest";
import { renderDocument } from "@templara/renderer";
import type { RenderDocumentResult } from "@templara/renderer";
import {
  invoiceSampleData,
  invoiceTemplate,
  payStubSampleData,
  payStubTemplate,
  receiptSampleData,
  receiptTemplate,
  shipmentBolSampleData,
  shipmentBolTemplate,
  shippingLabelSampleData,
  shippingLabelTemplate,
} from "./index";

function collectText(result: RenderDocumentResult): string {
  return result.pages
    .flatMap((page) =>
      page.children.map((node) => {
        if (node.type === "text") return node.text;
        if (node.type === "barcode" || node.type === "qr") return node.value;
        return "";
      }),
    )
    .join("\n");
}

function lastPageText(result: RenderDocumentResult): string {
  const page = result.pages.at(-1);
  if (!page) return "";
  return page.children.map((node) => (node.type === "text" ? node.text : "")).join("\n");
}

function analysisFor(result: RenderDocumentResult, sourceNodeId: string) {
  const analysis = result.repeatAnalyses.find((entry) => entry.sourceNodeId === sourceNodeId);
  if (!analysis) throw new Error(`No repeat analysis for ${sourceNodeId}`);
  return analysis;
}

function invoiceDataWithItems(count: number): Record<string, unknown> {
  const data = structuredClone(invoiceSampleData);
  data.invoice.items = Array.from({ length: count }, (_, index) => ({
    description: `Line item ${index + 1}`,
    quantity: (index % 5) + 1,
    unitPrice: 25 + index,
    total: (25 + index) * ((index % 5) + 1),
  }));
  return data;
}

function bolDataWithUnits(count: number): Record<string, unknown> {
  const data = structuredClone(shipmentBolSampleData);
  data.shipment.handlingUnits = Array.from({ length: count }, (_, index) => ({
    pieces: (index % 3) + 1,
    type: index % 2 === 0 ? "Pallet" : "Crate",
    description: `Handling unit ${index + 1}`,
    weight: 300 + index * 12,
    freightClass: ["70", "85", "92.5", "100"][index % 4],
    nmfc: `NS${2000 + index}`,
    hazmat: index % 7 === 0 ? "Y" : "N",
  }));
  return data;
}

describe("invoice template fixtures", () => {
  it("renders a small invoice on a single page with its summary", () => {
    const result = renderDocument({ template: invoiceTemplate, data: invoiceSampleData });

    expect(result.pages.length).toBe(1);
    expect(collectText(result)).toContain("Thank you for your business.");
    expect(collectText(result)).toContain("Freight service - Toronto to Calgary");
    expect(result.warnings.some((warning) => warning.code === "binding.repeat_not_array")).toBe(false);
  });

  it("paginates a large invoice and keeps the summary on the last page", () => {
    const data = invoiceDataWithItems(80);
    const result = renderDocument({ template: invoiceTemplate, data });

    expect(result.pages.length).toBeGreaterThan(1);

    const analysis = analysisFor(result, "invoice-items-repeat");
    expect(analysis.itemCount).toBe(80);
    expect(analysis.overflowItemCount).toBeGreaterThan(0);
    expect(analysis.estimatedTotalPages).toBeGreaterThan(1);

    expect(lastPageText(result)).toContain("Thank you for your business.");
  });
});

describe("shipment BOL template fixtures", () => {
  it("renders a small BOL and resolves its handling units", () => {
    const data = bolDataWithUnits(4);
    const result = renderDocument({ template: shipmentBolTemplate, data });

    expect(result.pages.length).toBe(1);
    expect(collectText(result)).toContain("BILL OF LADING");
    expect(collectText(result)).toContain("Handling unit 1");

    const analysis = analysisFor(result, "handling-units-repeat");
    expect(analysis.itemCount).toBe(4);
    expect(analysis.overflowItemCount).toBe(0);
  });

  it("paginates a large BOL across multiple pages", () => {
    const data = bolDataWithUnits(120);
    const result = renderDocument({ template: shipmentBolTemplate, data });

    expect(result.pages.length).toBeGreaterThan(1);

    const analysis = analysisFor(result, "handling-units-repeat");
    expect(analysis.itemCount).toBe(120);
    expect(analysis.overflowItemCount).toBeGreaterThan(0);
    expect(analysis.estimatedTotalPages).toBeGreaterThan(1);
  });
});

describe("receipt template fixtures", () => {
  it("renders a small receipt on a single page with totals", () => {
    const result = renderDocument({ template: receiptTemplate, data: receiptSampleData });

    expect(result.pages.length).toBe(1);
    expect(collectText(result)).toContain("Thank you for shopping with us.");
    expect(collectText(result)).toContain("Cold brew coffee");

    const analysis = analysisFor(result, "receipt-items-repeat");
    expect(analysis.itemCount).toBe(4);
    expect(analysis.overflowItemCount).toBe(0);
  });

  it("paginates a large receipt", () => {
    const data = structuredClone(receiptSampleData);
    data.receipt.items = Array.from({ length: 90 }, (_, index) => ({
      name: `SKU ${index + 1}`,
      quantity: (index % 4) + 1,
      price: 2 + index,
      total: (2 + index) * ((index % 4) + 1),
    }));
    const result = renderDocument({ template: receiptTemplate, data });

    expect(result.pages.length).toBeGreaterThan(1);
    const analysis = analysisFor(result, "receipt-items-repeat");
    expect(analysis.itemCount).toBe(90);
    expect(analysis.overflowItemCount).toBeGreaterThan(0);
    expect(lastPageText(result)).toContain("Thank you for shopping with us.");

    // The column header repeats on every page the item rows flow onto.
    const pageHasHeader = (page: (typeof result.pages)[number]): boolean =>
      page.children.some((child) => child.type === "text" && child.text === "Price");
    const pageHasRow = (page: (typeof result.pages)[number]): boolean =>
      page.children.some((child) => child.type === "text" && /^SKU /.test(child.text));

    for (const page of result.pages) {
      if (pageHasRow(page)) {
        expect(pageHasHeader(page)).toBe(true);
      }
    }
    expect(result.pages.filter(pageHasHeader).length).toBeGreaterThan(1);
  });
});

describe("pay stub template fixtures", () => {
  it("renders earnings and deductions with a net-pay summary", () => {
    const result = renderDocument({ template: payStubTemplate, data: payStubSampleData });

    expect(result.pages.length).toBe(1);
    const text = collectText(result);
    expect(text).toContain("Regular");
    expect(text).toContain("Federal tax");
    expect(text).toContain("Net Pay");

    expect(analysisFor(result, "stub-earnings-repeat").itemCount).toBe(3);
    expect(analysisFor(result, "stub-deductions-repeat").itemCount).toBe(5);
  });
});

describe("shipping label template fixtures", () => {
  it("renders a single 4x6 label with tracking code and destination", () => {
    const result = renderDocument({ template: shippingLabelTemplate, data: shippingLabelSampleData });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].width).toBe(384);
    expect(result.pages[0].height).toBe(576);

    const text = collectText(result);
    expect(text).toContain("Prairie Retail Group");
    expect(text).toContain("T2C 5R9");
    expect(text).toContain("NSF984421CA");
  });
});
