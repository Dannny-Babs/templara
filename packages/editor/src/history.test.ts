import { describe, expect, it } from "vitest";
import {
  advanceHistoryTransaction,
  shouldStartNewHistoryEntry,
} from "./history";

describe("history coalescing", () => {
  it("always starts a new entry for keyless (one-shot) commits", () => {
    expect(shouldStartNewHistoryEntry(null, undefined, 1000, 700)).toBe(true);
    expect(
      shouldStartNewHistoryEntry(
        { key: "node:a", time: 900 },
        undefined,
        1000,
        700,
      ),
    ).toBe(true);
  });

  it("starts a new entry when no transaction is open", () => {
    expect(shouldStartNewHistoryEntry(null, "node:a", 1000, 700)).toBe(true);
  });

  it("coalesces consecutive commits sharing a key within the window", () => {
    const active = { key: "node:a", time: 1000 };

    expect(shouldStartNewHistoryEntry(active, "node:a", 1200, 700)).toBe(false);
    expect(shouldStartNewHistoryEntry(active, "node:a", 1699, 700)).toBe(false);
  });

  it("starts a new entry once the window has elapsed", () => {
    const active = { key: "node:a", time: 1000 };

    expect(shouldStartNewHistoryEntry(active, "node:a", 1700, 700)).toBe(true);
  });

  it("starts a new entry when the transaction key changes", () => {
    const active = { key: "node:a", time: 1000 };

    expect(shouldStartNewHistoryEntry(active, "node:b", 1100, 700)).toBe(true);
  });

  it("advances the marker only for keyed commits", () => {
    expect(advanceHistoryTransaction("node:a", 1000)).toEqual({
      key: "node:a",
      time: 1000,
    });
    expect(advanceHistoryTransaction(undefined, 1000)).toBeNull();
  });
});
