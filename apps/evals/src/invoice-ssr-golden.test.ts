import { readFileSync } from "node:fs";
import { aliasOrgAddressPaths } from "@templara/core";
import { renderTemplateToHtml } from "@templara/react-renderer/ssr";
import { invoiceSampleData, invoiceTemplate } from "@templara/templates";
import { describe, expect, it } from "vitest";
import { fixturePath, getAtPath, loadJsonFixture } from "./fixture-utils.js";

/**
 * G2 — Invoice SSR golden + discovery fixture contract.
 *
 * Honest fidelity note (do not claim DB1 HTML parity):
 * - `invoice-rendered.html` is DB1 **Handlebars → Lexical editor HTML** for Northwind.
 * - `@templara/templates` `invoiceTemplate` is a separate **JSON DocumentTemplate**
 *   with different layout, sample data (Acme), and binding paths (`business.*` /
 *   `invoice.*`, not `{ org, record, document }`).
 * - Full byte/normalized compare against discovery HTML would be a false-fidelity
 *   trap. Wave 3 pins a Templara SSR marker golden and a separate discovery
 *   fixture-load contract; true DB1 parity needs a mapped Templara template +
 *   host context (later waves / H1).
 */

/** Collapse whitespace for coarse structural checks (not full HTML equality). */
function normalizeHtmlWhitespace(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

describe("G2 Templara invoice SSR golden", () => {
  it("renders invoiceTemplate SSR HTML with pinned sample markers", () => {
    const html = renderTemplateToHtml(
      structuredClone(invoiceTemplate),
      structuredClone(invoiceSampleData),
    );
    const normalized = normalizeHtmlWhitespace(html);

    expect(html).toContain('data-templara-document="true"');
    expect(html).toContain('data-templara-page-id="page-1"');

    // Identity / header markers from invoiceSampleData
    expect(normalized).toContain("INVOICE");
    expect(normalized).toContain("Acme Logistics");
    expect(normalized).toContain("INV-2026-1048");
    expect(normalized).toContain("Prairie Retail Group");
    expect(normalized).toContain("Freight service - Toronto to Calgary");
    expect(normalized).toContain("Thank you for your business.");

    // Totals appear via currency formatting on sample numbers
    expect(normalized).toMatch(/2,?727\.26|2727\.26/);
  });
});

describe("G2 discovery invoice-rendered.html contract (not Templara parity)", () => {
  it("loads the DB1 fixture and keeps known Handlebars markers", () => {
    const html = readFileSync(fixturePath("invoice-rendered.html"), "utf8");
    const normalized = normalizeHtmlWhitespace(html);

    expect(html.length).toBeGreaterThan(1000);
    expect(normalized).toContain("Northwind Freight Systems Inc.");
    expect(normalized).toContain("INVOICE-100482");
    expect(normalized).toContain("Acme Manufacturing LLC");
    expect(normalized).toContain("editor__layout");

    // Intentional DB1 blank: org postalCode path unbound (P3/P4). Fixture still
    // shows customer postalCode 48201 from record addresses.
    expect(normalized).toContain("48201");
  });

  it("documents that discovery HTML is not claimed equal to Templara SSR", () => {
    const discovery = normalizeHtmlWhitespace(
      readFileSync(fixturePath("invoice-rendered.html"), "utf8"),
    );
    const templara = normalizeHtmlWhitespace(
      renderTemplateToHtml(
        structuredClone(invoiceTemplate),
        structuredClone(invoiceSampleData),
      ),
    );

    // Different engines + data: neither should be used as the other's golden.
    expect(discovery).not.toContain("Acme Logistics");
    expect(templara).not.toContain("Northwind Freight Systems Inc.");
    expect(templara).not.toContain("editor__layout");
  });
});

describe("G2 + C3: alias org postal on invoice-context fixture", () => {
  it("fills org.orgAddress.postalCode from postal via aliasOrgAddressPaths", () => {
    const context = loadJsonFixture<{
      org: {
        orgAddress: { postal?: string; postalCode?: string };
        remitToAddress: { postal?: string; postalCode?: string };
      };
      record: { invoiceToAddress: { postalCode?: string } };
    }>("invoice-context.json");

    expect(getAtPath(context, "org.orgAddress.postal")).toBe("L4W 5M8");
    expect(getAtPath(context, "org.orgAddress.postalCode")).toBeUndefined();

    const aliased = aliasOrgAddressPaths(context);
    expect(getAtPath(aliased, "org.orgAddress.postalCode")).toBe("L4W 5M8");
    expect(getAtPath(aliased, "org.remitToAddress.postalCode")).toBe("60693");
    // Record addresses already use postalCode — left alone
    expect(getAtPath(aliased, "record.invoiceToAddress.postalCode")).toBe("48201");
  });
});
