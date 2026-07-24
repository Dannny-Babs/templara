import {
  asPreformattedDisplayString,
  bindingPathHasFormattingSuffix,
  MONEY_FORMAT_SUFFIXES,
} from "@templara/core";
import { describe, expect, it } from "vitest";
import { findPathsEndingWith, getAtPath, loadJsonFixture } from "./fixture-utils.js";

type InvoiceContext = {
  org?: unknown;
  record?: unknown;
  document?: unknown;
};

describe("value adapter vs invoice-context fixture", () => {
  const context = loadJsonFixture<InvoiceContext>("invoice-context.json");

  it("treats fixture money suffix leaves as preformatted display strings", () => {
    for (const suffix of MONEY_FORMAT_SUFFIXES) {
      const paths = findPathsEndingWith(context.record, suffix, "record");
      for (const path of paths) {
        expect(bindingPathHasFormattingSuffix(path)).toBe(true);
        const value = getAtPath(context, path);
        expect(asPreformattedDisplayString(value)).toBe(value);
      }
    }
  });

  it("treats known date suffix leaves as preformatted display strings", () => {
    const datePaths = [
      "record.invoiceDate.dateTimeInLocation.shortDate",
      "record.dueDate.dateTimeInLocation.shortDate",
      "document.currentDate.shortDate",
    ];

    for (const path of datePaths) {
      expect(bindingPathHasFormattingSuffix(path)).toBe(true);
      const value = getAtPath(context, path);
      expect(typeof value).toBe("string");
      expect(asPreformattedDisplayString(value)).toBe(value);
    }
  });
});
