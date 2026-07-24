import { describe, expect, it } from "vitest";
import { loadJsonFixture } from "./fixture-utils.js";

describe("fixtures load", () => {
  it("parses invoice-context.json as a non-null object", () => {
    const context = loadJsonFixture("invoice-context.json");
    expect(context).not.toBeNull();
    expect(typeof context).toBe("object");
  });
});
