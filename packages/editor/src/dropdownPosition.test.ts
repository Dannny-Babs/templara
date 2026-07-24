import { describe, expect, it } from "vitest";
import {
  anchoredDropdownStyle,
  measureDropdownFrame,
} from "./dropdownPosition.js";

describe("measureDropdownFrame", () => {
  const viewport = { innerWidth: 800, innerHeight: 600 };

  it("opens below the trigger when there is room", () => {
    const frame = measureDropdownFrame(
      { left: 100, right: 180, top: 40, bottom: 72, width: 80 },
      { width: 200, align: "left", estimatedHeight: 160 },
      viewport,
    );

    expect(frame).toMatchObject({
      left: 100,
      top: 80,
      width: 200,
      placement: "down",
    });
    expect(frame?.maxHeight).toBeGreaterThan(96);
  });

  it("flips upward near the bottom of the viewport", () => {
    const frame = measureDropdownFrame(
      { left: 100, right: 180, top: 520, bottom: 552, width: 80 },
      { width: 248, align: "right", estimatedHeight: 180 },
      viewport,
    );

    expect(frame?.placement).toBe("up");
    // preferredLeft is negative; clamp to viewport margin
    expect(frame?.left).toBe(8);
    expect(frame?.top).toBeLessThan(520);
    expect((frame?.top ?? 0) + (frame?.maxHeight ?? 0)).toBeLessThanOrEqual(
      520,
    );
  });

  it("clamps horizontally into the viewport", () => {
    const frame = measureDropdownFrame(
      { left: 760, right: 790, top: 20, bottom: 50, width: 30 },
      { width: 248, align: "right" },
      viewport,
    );

    expect(frame?.left).toBe(542);
    expect(frame!.left + frame!.width).toBeLessThanOrEqual(800 - 8);
  });
});

describe("anchoredDropdownStyle", () => {
  it("applies fixed positioning and scroll clamp", () => {
    const style = anchoredDropdownStyle(
      { background: "#fff" },
      {
        top: 90,
        left: 12,
        width: 200,
        placement: "down",
        maxHeight: 180,
      },
    );

    expect(style).toMatchObject({
      position: "fixed",
      top: 90,
      left: 12,
      width: 200,
      maxHeight: 180,
      overflowY: "auto",
      zIndex: 1000,
    });
  });
});
