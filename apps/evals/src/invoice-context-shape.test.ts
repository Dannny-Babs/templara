import { MONEY_FORMAT_SUFFIXES } from "@templara/core";
import { describe, expect, it } from "vitest";
import { findPathsEndingWith, getAtPath, loadJsonFixture } from "./fixture-utils.js";
import { FIXTURE_MONEY_SUFFIX_LEAVES } from "./suffix-allowlist.js";

type InvoiceContext = {
  org?: unknown;
  record?: unknown;
  document?: unknown;
  _note?: unknown;
};

describe("invoice context shape", () => {
  const context = loadJsonFixture<InvoiceContext>("invoice-context.json");

  it("has required top-level keys org, record, and document as objects", () => {
    expect(context).toEqual(
      expect.objectContaining({
        org: expect.any(Object),
        record: expect.any(Object),
        document: expect.any(Object),
      }),
    );
    expect(context.org).not.toBeNull();
    expect(context.record).not.toBeNull();
    expect(context.document).not.toBeNull();
  });

  it("shares core P3 money allowlist and asserts fixture-present leaves", () => {
    // Full closed set lives in @templara/core; fixture only exercises a subset.
    expect([...MONEY_FORMAT_SUFFIXES]).toEqual([
      "withCurrencyCode",
      "withDecimalsAndCurrencyCode",
      "unroundedWithoutCurrencyCode",
    ]);
    expect([...FIXTURE_MONEY_SUFFIX_LEAVES]).toEqual([
      "withDecimalsAndCurrencyCode",
      "unroundedWithoutCurrencyCode",
    ]);

    const total = getAtPath(context, "record.total.withDecimalsAndCurrencyCode");
    const subTotal = getAtPath(context, "record.subTotal.withDecimalsAndCurrencyCode");

    expect(typeof total).toBe("string");
    expect(total).not.toBe("");
    expect(typeof subTotal).toBe("string");
    expect(subTotal).not.toBe("");

    // Nested line / order money leaf under record (not the invoice totals).
    const nestedMoneyLeaves = findPathsEndingWith(
      context.record,
      "withDecimalsAndCurrencyCode",
      "record",
    ).filter(
      (path) =>
        path !== "record.total.withDecimalsAndCurrencyCode" &&
        path !== "record.subTotal.withDecimalsAndCurrencyCode",
    );

    expect(nestedMoneyLeaves.length).toBeGreaterThan(0);
    for (const path of nestedMoneyLeaves) {
      expect(typeof getAtPath(context, path)).toBe("string");
    }

    // Misc line rates use unroundedWithoutCurrencyCode in this fixture.
    const unroundedLeaves = findPathsEndingWith(
      context.record,
      "unroundedWithoutCurrencyCode",
      "record",
    );
    expect(unroundedLeaves.length).toBeGreaterThan(0);
    for (const path of unroundedLeaves) {
      const value = getAtPath(context, path);
      expect(typeof value).toBe("string");
      expect(value).not.toBe("");
    }
  });

  it("exposes known date suffix leaves as strings", () => {
    const invoiceDate = getAtPath(context, "record.invoiceDate.dateTimeInLocation.shortDate");
    const dueDate = getAtPath(context, "record.dueDate.dateTimeInLocation.shortDate");

    expect(typeof invoiceDate).toBe("string");
    expect(invoiceDate).not.toBe("");
    expect(typeof dueDate).toBe("string");
    expect(dueDate).not.toBe("");
  });

  it("exposes document.currentDate.shortDate as a string when present", () => {
    const shortDate = getAtPath(context, "document.currentDate.shortDate");
    expect(typeof shortDate).toBe("string");
    expect(shortDate).not.toBe("");
  });
});
