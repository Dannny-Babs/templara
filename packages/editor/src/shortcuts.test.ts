import { describe, expect, it } from "vitest";
import {
  isEditableShortcutTarget,
  resolveEditorShortcut,
  type InsertToolShortcut,
} from "./shortcuts";

const tools: InsertToolShortcut[] = [
  { id: "select", shortcut: "V" },
  { id: "text", shortcut: "T" },
  { id: "rectangle", shortcut: "R" },
];

describe("editor shortcut resolution", () => {
  it("ignores shortcuts while typing into form controls", () => {
    expect(isEditableShortcutTarget({ tagName: "input" })).toBe(true);
    expect(isEditableShortcutTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableShortcutTarget({ tagName: "select" })).toBe(true);
    expect(isEditableShortcutTarget({ isContentEditable: true })).toBe(true);
    expect(
      resolveEditorShortcut(
        { key: "t" },
        { previewOpen: false, selectedCount: 0, target: { tagName: "input" }, tools },
      ),
    ).toBeNull();
  });

  it("maps platform undo and redo shortcuts", () => {
    expect(
      resolveEditorShortcut(
        { key: "z", metaKey: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toEqual({ type: "undo" });
    expect(
      resolveEditorShortcut(
        { key: "z", ctrlKey: true, shiftKey: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toEqual({ type: "redo" });
    expect(
      resolveEditorShortcut(
        { key: "y", ctrlKey: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toEqual({ type: "redo" });
  });

  it("maps tool shortcuts and escape back to select", () => {
    expect(
      resolveEditorShortcut(
        { key: "t" },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toEqual({ type: "select-tool", tool: "text" });
    expect(
      resolveEditorShortcut(
        { key: "Escape" },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toEqual({ type: "select-tool", tool: "select" });
  });

  it("maps selected-node commands", () => {
    expect(
      resolveEditorShortcut(
        { key: "Backspace" },
        { previewOpen: false, selectedCount: 2, tools },
      ),
    ).toEqual({ type: "delete" });
    expect(
      resolveEditorShortcut(
        { key: "d", metaKey: true },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toEqual({ type: "duplicate" });
    expect(
      resolveEditorShortcut(
        { key: "]", metaKey: true, shiftKey: true },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toEqual({ type: "reorder", command: "front" });
  });

  it("maps arrow nudges with configured step sizes", () => {
    expect(
      resolveEditorShortcut(
        { key: "ArrowLeft" },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toEqual({ type: "nudge", dx: -1, dy: 0 });
    expect(
      resolveEditorShortcut(
        { key: "ArrowDown", shiftKey: true },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toEqual({ type: "nudge", dx: 0, dy: 10 });
  });

  it("does not resolve shortcuts while preview is open", () => {
    expect(
      resolveEditorShortcut(
        { key: "t" },
        { previewOpen: true, selectedCount: 0, tools },
      ),
    ).toBeNull();
  });

  it("bails on Alt-modified and already-handled events", () => {
    expect(
      resolveEditorShortcut(
        { key: "t", altKey: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toBeNull();
    expect(
      resolveEditorShortcut(
        { key: "t", defaultPrevented: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toBeNull();
  });

  it("leaves unmapped command-modifier combos to the browser", () => {
    expect(
      resolveEditorShortcut(
        { key: "s", metaKey: true },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toBeNull();
  });

  it("maps group and ungroup", () => {
    expect(
      resolveEditorShortcut(
        { key: "g", ctrlKey: true },
        { previewOpen: false, selectedCount: 2, tools },
      ),
    ).toEqual({ type: "group" });
    expect(
      resolveEditorShortcut(
        { key: "g", ctrlKey: true, shiftKey: true },
        { previewOpen: false, selectedCount: 2, tools },
      ),
    ).toEqual({ type: "ungroup" });
  });

  it("only reorders with exactly one node selected", () => {
    expect(
      resolveEditorShortcut(
        { key: "[", metaKey: true },
        { previewOpen: false, selectedCount: 1, tools },
      ),
    ).toEqual({ type: "reorder", command: "backward" });
    expect(
      resolveEditorShortcut(
        { key: "]", metaKey: true },
        { previewOpen: false, selectedCount: 2, tools },
      ),
    ).toBeNull();
  });

  it("requires a selection for delete and duplicate", () => {
    expect(
      resolveEditorShortcut(
        { key: "Backspace" },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toBeNull();
    expect(
      resolveEditorShortcut(
        { key: "d", metaKey: true },
        { previewOpen: false, selectedCount: 0, tools },
      ),
    ).toBeNull();
  });
});
