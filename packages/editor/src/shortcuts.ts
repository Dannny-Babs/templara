import type { ReorderCommand } from "./editorModel";

export const DEFAULT_NUDGE_STEP = 1;
export const DEFAULT_NUDGE_LARGE_STEP = 10;

export type InsertTool =
  | "select"
  | "text"
  | "image"
  | "rectangle"
  | "line"
  | "shape"
  | "barcode"
  | "qr"
  | "table"
  | "repeat"
  | "condition"
  | "frame"
  | "signature";

export interface InsertToolShortcut {
  id: InsertTool;
  shortcut: string;
}

export interface ShortcutTargetLike {
  isContentEditable?: boolean;
  tagName?: string | null;
}

export interface EditorShortcutEventLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export type EditorShortcutCommand =
  | { type: "delete" }
  | { type: "duplicate" }
  | { type: "group" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "redo" }
  | { type: "reorder"; command: ReorderCommand }
  | { type: "select-tool"; tool: InsertTool }
  | { type: "undo" }
  | { type: "ungroup" };

export interface ResolveEditorShortcutOptions {
  previewOpen: boolean;
  selectedCount: number;
  target?: ShortcutTargetLike | null;
  tools: readonly InsertToolShortcut[];
}

export function isEditableShortcutTarget(
  target: ShortcutTargetLike | null | undefined,
): boolean {
  const tagName = target?.tagName?.toLowerCase();

  return Boolean(
    target?.isContentEditable ||
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select",
  );
}

export function resolveEditorShortcut(
  event: EditorShortcutEventLike,
  options: ResolveEditorShortcutOptions,
): EditorShortcutCommand | null {
  if (
    options.previewOpen ||
    event.defaultPrevented ||
    event.altKey ||
    isEditableShortcutTarget(options.target)
  ) {
    return null;
  }

  const key = event.key;
  const lowerKey = key.toLowerCase();
  const hasCommandModifier = Boolean(event.metaKey || event.ctrlKey);

  if (hasCommandModifier && lowerKey === "z") {
    return event.shiftKey ? { type: "redo" } : { type: "undo" };
  }

  if (hasCommandModifier && lowerKey === "y") {
    return { type: "redo" };
  }

  if (
    options.selectedCount > 0 &&
    (key === "Backspace" || key === "Delete")
  ) {
    return { type: "delete" };
  }

  if (
    options.selectedCount > 0 &&
    hasCommandModifier &&
    lowerKey === "d"
  ) {
    return { type: "duplicate" };
  }

  if (hasCommandModifier && lowerKey === "g") {
    return event.shiftKey ? { type: "ungroup" } : { type: "group" };
  }

  if (
    options.selectedCount === 1 &&
    hasCommandModifier &&
    (key === "]" || key === "[")
  ) {
    const forward = key === "]";

    return {
      type: "reorder",
      command: event.shiftKey
        ? forward
          ? "front"
          : "back"
        : forward
          ? "forward"
          : "backward",
    };
  }

  if (hasCommandModifier) {
    return null;
  }

  if (options.selectedCount > 0 && key.startsWith("Arrow")) {
    const step = event.shiftKey ? DEFAULT_NUDGE_LARGE_STEP : DEFAULT_NUDGE_STEP;
    const dx =
      key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
    const dy =
      key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;

    return dx === 0 && dy === 0 ? null : { type: "nudge", dx, dy };
  }

  if (key === "Escape") {
    return { type: "select-tool", tool: "select" };
  }

  const nextTool = options.tools.find(
    (tool) => tool.shortcut.toLowerCase() === lowerKey,
  );

  return nextTool ? { type: "select-tool", tool: nextTool.id } : null;
}
