/**
 * Golden: extractBindings(invoiceTemplate) — Stream A (ticket A1) on integration.
 *
 * Pins the exact sorted unique path list so deletions/renames fail this test.
 */
import { extractBindings } from "@templara/core";
import { invoiceTemplate } from "@templara/templates";
import { describe, expect, it } from "vitest";

/** Locked snapshot from extractBindings(invoiceTemplate); regenerate only when the template intentionally changes. */
const INVOICE_TEMPLATE_BINDING_PATHS = [
  "business.address",
  "business.email",
  "business.name",
  "business.phone",
  "customer.address",
  "customer.email",
  "customer.name",
  "delivery.address",
  "delivery.name",
  "delivery.window",
  "invoice.date",
  "invoice.dueDate",
  "invoice.items",
  "invoice.items.total",
  "invoice.notes",
  "invoice.number",
  "invoice.paymentUrl",
  "invoice.poNumber",
  "invoice.terms",
  "invoice.totals.subtotal",
  "invoice.totals.tax",
  "invoice.totals.total",
  "item.description",
  "item.quantity",
  "item.total",
  "item.unitPrice",
] as const;

describe("extractBindings(invoiceTemplate) golden", () => {
  it("returns the exact sorted unique path list", () => {
    const paths = extractBindings(invoiceTemplate);

    expect(paths).toEqual([...INVOICE_TEMPLATE_BINDING_PATHS]);
    expect(paths).toEqual([...paths].sort());
    expect(new Set(paths).size).toBe(paths.length);
  });
});
