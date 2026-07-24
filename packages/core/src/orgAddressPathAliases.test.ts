import { describe, expect, it } from "vitest";
import {
  ORG_ADDRESS_OBJECT_KEYS,
  ORG_ADDRESS_PATH_ALIASES,
  aliasOrgAddressPaths,
  mirrorOrgAddressPostalKeys,
} from "./orgAddressPathAliases.js";

describe("orgAddressPathAliases (C3)", () => {
  it("documents bidirectional postal ↔ postalCode path aliases", () => {
    expect(ORG_ADDRESS_PATH_ALIASES["org.orgAddress.postalCode"]).toBe(
      "org.orgAddress.postal",
    );
    expect(ORG_ADDRESS_PATH_ALIASES["org.orgAddress.postal"]).toBe(
      "org.orgAddress.postalCode",
    );
    expect(ORG_ADDRESS_PATH_ALIASES["org.remitToAddress.postalCode"]).toBe(
      "org.remitToAddress.postal",
    );
    expect([...ORG_ADDRESS_OBJECT_KEYS]).toEqual(["orgAddress", "remitToAddress"]);
  });

  it("mirrors postal onto postalCode when only postal is set", () => {
    expect(
      mirrorOrgAddressPostalKeys({
        companyName: "Acme",
        postal: "L4W 5M8",
        city: "Mississauga",
      }),
    ).toEqual({
      companyName: "Acme",
      postal: "L4W 5M8",
      postalCode: "L4W 5M8",
      city: "Mississauga",
    });
  });

  it("mirrors postalCode onto postal when only postalCode is set", () => {
    expect(mirrorOrgAddressPostalKeys({ postalCode: "48201" })).toEqual({
      postal: "48201",
      postalCode: "48201",
    });
  });

  it("does not overwrite when both keys already differ", () => {
    expect(
      mirrorOrgAddressPostalKeys({ postal: "A", postalCode: "B" }),
    ).toEqual({ postal: "A", postalCode: "B" });
  });

  it("aliases org.orgAddress and org.remitToAddress without touching record addresses", () => {
    const context = {
      org: {
        orgName: "Northwind",
        orgAddress: {
          companyName: "Northwind Freight",
          postal: "L4W 5M8",
          city: "Mississauga",
        },
        remitToAddress: {
          companyName: "Remit",
          postal: "60693",
        },
      },
      record: {
        invoiceToAddress: {
          companyName: "Customer",
          postalCode: "48201",
        },
      },
    };

    const aliased = aliasOrgAddressPaths(context);

    expect(aliased.org.orgAddress.postalCode).toBe("L4W 5M8");
    expect(aliased.org.orgAddress.postal).toBe("L4W 5M8");
    expect(aliased.org.remitToAddress.postalCode).toBe("60693");
    expect(aliased.record.invoiceToAddress).toEqual({
      companyName: "Customer",
      postalCode: "48201",
    });
    expect(Object.prototype.hasOwnProperty.call(aliased.record.invoiceToAddress, "postal")).toBe(
      false,
    );
  });

  it("returns the same reference when nothing needs aliasing", () => {
    const context = {
      org: {
        orgAddress: { postal: "X", postalCode: "X" },
      },
    };
    expect(aliasOrgAddressPaths(context)).toBe(context);
  });

  it("passes through non-objects unchanged", () => {
    expect(aliasOrgAddressPaths(null)).toBe(null);
    expect(aliasOrgAddressPaths("x")).toBe("x");
  });
});
