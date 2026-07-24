import { describe, expect, it } from "vitest";
import { preparePreviewData } from "./previewData.js";

describe("preparePreviewData", () => {
  it("aliases org address postal keys by default", () => {
    const prepared = preparePreviewData({
      org: {
        orgAddress: { postal: "M5V2T6", city: "Toronto" },
      },
      record: {
        invoiceToAddress: { postalCode: "10001" },
      },
    });

    expect(prepared.org).toMatchObject({
      orgAddress: { postal: "M5V2T6", postalCode: "M5V2T6", city: "Toronto" },
    });
    expect(prepared.record).toEqual({
      invoiceToAddress: { postalCode: "10001" },
    });
  });

  it("can skip aliasing when the host already normalized context", () => {
    const input = {
      org: { orgAddress: { postal: "M5V2T6" } },
    };

    expect(preparePreviewData(input, { aliasOrgAddresses: false })).toEqual(
      input,
    );
  });
});
