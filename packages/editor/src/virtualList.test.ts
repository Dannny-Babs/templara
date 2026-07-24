import { describe, expect, it } from "vitest";
import { getVirtualWindow } from "./virtualList.js";

describe("getVirtualWindow", () => {
  it("returns empty window for zero items", () => {
    expect(
      getVirtualWindow({
        scrollTop: 0,
        viewportHeight: 200,
        itemCount: 0,
        itemHeight: 40,
      }),
    ).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 0,
    });
  });

  it("windows a long list around the scroll position", () => {
    const window = getVirtualWindow({
      scrollTop: 800,
      viewportHeight: 200,
      itemCount: 1000,
      itemHeight: 40,
      overscan: 2,
    });

    expect(window.totalHeight).toBe(40_000);
    expect(window.startIndex).toBe(18);
    expect(window.endIndex).toBe(28);
    expect(window.paddingTop).toBe(18 * 40);
    expect(window.paddingBottom).toBe(40_000 - 28 * 40);
  });

  it("clamps scroll and end index to list bounds", () => {
    const window = getVirtualWindow({
      scrollTop: 50_000,
      viewportHeight: 200,
      itemCount: 10,
      itemHeight: 40,
      overscan: 4,
    });

    // max scroll = 10*40 - 200 = 200 → rawStart 5; overscan pulls start to 1
    expect(window.startIndex).toBe(1);
    expect(window.endIndex).toBe(10);
    expect(window.paddingBottom).toBe(0);
    expect(window.totalHeight).toBe(400);
  });

  it("keeps rendered window far smaller than a multi-thousand schema", () => {
    const window = getVirtualWindow({
      scrollTop: 12_000,
      viewportHeight: 280,
      itemCount: 3474,
      itemHeight: 70,
      overscan: 6,
    });

    expect(window.endIndex - window.startIndex).toBeLessThan(30);
    expect(window.totalHeight).toBe(3474 * 70);
  });
});
