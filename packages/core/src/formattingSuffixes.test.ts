import { describe, expect, it } from "vitest";
import {
  asPreformattedDisplayString,
  bindingPathHasFormattingSuffix,
  COMPOSITE_DATE_PATH_SUFFIXES,
  DATE_FORMAT_SUFFIXES,
  DATE_RANGE_SUFFIXES,
  DATE_TIME_PROPERTY_SUFFIXES,
  FORMATTING_PATH_SUFFIXES,
  isFormattingPathSuffix,
  MONEY_FORMAT_SUFFIXES,
  OTHER_FORMATTING_SUFFIXES,
} from "./formattingSuffixes.js";

describe("formattingSuffixes (P3 allowlist)", () => {
  it("locks MoneyFormatType membership", () => {
    expect([...MONEY_FORMAT_SUFFIXES]).toEqual([
      "withCurrencyCode",
      "withDecimalsAndCurrencyCode",
      "unroundedWithoutCurrencyCode",
    ]);
  });

  it("locks DateTimeValueFormatType membership", () => {
    expect([...DATE_FORMAT_SUFFIXES]).toEqual([
      "standardDate",
      "standardDateTime",
      "shortDate",
      "shortDateTime",
      "longDate",
      "longDateTime",
    ]);
  });

  it("locks DateTimeValueProperties membership", () => {
    expect([...DATE_TIME_PROPERTY_SUFFIXES]).toEqual([
      "dateTimeInLocation",
      "dateTimeInLocationEnd",
    ]);
  });

  it("locks DateTimeValueFormatRangeType membership", () => {
    expect([...DATE_RANGE_SUFFIXES]).toEqual([
      "standardDateRange",
      "standardDateTimeRange",
      "shortDateRange",
      "shortDateTimeRange",
      "shortDateTimeRangeCompact",
      "longDateRange",
      "longDateTimeRange",
    ]);
  });

  it("includes url among other formatting suffixes", () => {
    expect([...OTHER_FORMATTING_SUFFIXES]).toEqual(["url"]);
  });

  it("has no duplicates in FORMATTING_PATH_SUFFIXES", () => {
    expect(new Set(FORMATTING_PATH_SUFFIXES).size).toBe(FORMATTING_PATH_SUFFIXES.length);
  });

  it("builds composite dateTimeInLocation*.format suffixes", () => {
    expect(COMPOSITE_DATE_PATH_SUFFIXES).toContain("dateTimeInLocation.shortDate");
    expect(COMPOSITE_DATE_PATH_SUFFIXES).toContain("dateTimeInLocationEnd.longDateTime");
    expect(COMPOSITE_DATE_PATH_SUFFIXES).toHaveLength(
      DATE_TIME_PROPERTY_SUFFIXES.length * DATE_FORMAT_SUFFIXES.length,
    );
  });
});

describe("value adapter helpers", () => {
  it("detects formatting path suffixes and composite date paths", () => {
    expect(isFormattingPathSuffix("withDecimalsAndCurrencyCode")).toBe(true);
    expect(isFormattingPathSuffix("amount")).toBe(false);

    expect(bindingPathHasFormattingSuffix("record.total.withDecimalsAndCurrencyCode")).toBe(true);
    expect(bindingPathHasFormattingSuffix("record.invoiceDate.dateTimeInLocation.shortDate")).toBe(
      true,
    );
    expect(bindingPathHasFormattingSuffix("document.currentDate.shortDate")).toBe(true);
    expect(bindingPathHasFormattingSuffix("record.invoiceToAddress.postalCode")).toBe(false);
    expect(bindingPathHasFormattingSuffix("")).toBe(false);
  });

  it("passes through preformatted strings without reformatting", () => {
    expect(asPreformattedDisplayString("$4,590.00 USD")).toBe("$4,590.00 USD");
    expect(asPreformattedDisplayString("Jul 1, 2026")).toBe("Jul 1, 2026");
    expect(asPreformattedDisplayString("")).toBe("");
    expect(asPreformattedDisplayString(4590)).toBeUndefined();
    expect(asPreformattedDisplayString({ withDecimalsAndCurrencyCode: "$1.00" })).toBeUndefined();
    expect(asPreformattedDisplayString(null)).toBeUndefined();
  });

  it("matches invoice-context fixture path shapes", () => {
    // Shapes from docs/discovery + apps/evals fixtures/invoice-context.json
    const fixtureLeaves: Array<{ path: string; value: string }> = [
      { path: "record.total.withDecimalsAndCurrencyCode", value: "$4,590.00 USD" },
      { path: "record.subTotal.withDecimalsAndCurrencyCode", value: "$4,200.00 USD" },
      {
        path: "record.miscLineItems.0.rate.unroundedWithoutCurrencyCode",
        value: "$140",
      },
      { path: "record.invoiceDate.dateTimeInLocation.shortDate", value: "Jul 1, 2026" },
      { path: "record.dueDate.dateTimeInLocation.shortDate", value: "Jul 31, 2026" },
      { path: "document.currentDate.shortDate", value: "Jul 24, 2026" },
    ];

    for (const leaf of fixtureLeaves) {
      expect(bindingPathHasFormattingSuffix(leaf.path)).toBe(true);
      expect(asPreformattedDisplayString(leaf.value)).toBe(leaf.value);
    }
  });
});
