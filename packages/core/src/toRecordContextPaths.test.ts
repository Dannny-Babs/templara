import { describe, expect, it } from "vitest";
import { toRecordContextPaths } from "./extractBindings";

describe("toRecordContextPaths", () => {
  it("filters to record.* paths, strips the prefix, and sorts uniquely", () => {
    expect(
      toRecordContextPaths([
        "record.total.withDecimalsAndCurrencyCode",
        "org.logoUrl",
        "document.shortDate",
        "record.invoiceDate.dateTimeInLocation.shortDate",
      ]),
    ).toEqual([
      "invoiceDate.dateTimeInLocation.shortDate",
      "total.withDecimalsAndCurrencyCode",
    ]);
  });

  it("collapses duplicates", () => {
    expect(
      toRecordContextPaths([
        "record.total",
        "record.total",
        "record.invoiceDate",
      ]),
    ).toEqual(["invoiceDate", "total"]);
  });

  it("returns [] for empty input", () => {
    expect(toRecordContextPaths([])).toEqual([]);
  });

  it("drops bare record and empty record. prefix results", () => {
    expect(toRecordContextPaths(["record", "record.", "Record.total"])).toEqual([]);
  });

  it("drops demo domains until remapped by a host adapter", () => {
    expect(toRecordContextPaths(["invoice.total", "business.logoUrl"])).toEqual([]);
  });
});
