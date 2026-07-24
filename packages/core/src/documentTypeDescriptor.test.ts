import { describe, expect, it } from "vitest";
import {
  isTemplaraDocumentTypeDescriptor,
  type TemplaraDocumentTypeDescriptor,
} from "./documentTypeDescriptor.js";

describe("TemplaraDocumentTypeDescriptor", () => {
  it("accepts a valid host descriptor", () => {
    const descriptor: TemplaraDocumentTypeDescriptor = {
      objectKey: "invoice",
      label: "Invoice (Templara)",
      templateId: "invoice-v1",
      renderMode: "ssr-html",
    };
    expect(isTemplaraDocumentTypeDescriptor(descriptor)).toBe(true);
  });

  it("rejects incomplete descriptors", () => {
    expect(isTemplaraDocumentTypeDescriptor({ objectKey: "invoice" })).toBe(false);
    expect(
      isTemplaraDocumentTypeDescriptor({
        objectKey: "invoice",
        label: "Invoice",
        templateId: "x",
        renderMode: "pdf",
      }),
    ).toBe(false);
  });
});
