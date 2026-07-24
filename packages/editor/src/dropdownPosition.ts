import type { CSSProperties } from "react";

export type DropdownAlign = "center" | "right" | "left";
export type DropdownPlacement = "down" | "up";

export interface DropdownFrame {
  top: number;
  left: number;
  width: number;
  placement: DropdownPlacement;
  maxHeight: number;
}

export interface MeasureDropdownFrameOptions {
  /** Preferred menu width in CSS pixels. */
  width: number;
  align?: DropdownAlign;
  /** Estimated menu height before measuring the real menu DOM. */
  estimatedHeight?: number;
  /** Gap between the trigger and the menu. */
  gap?: number;
  /** Inset from the viewport edges. */
  viewportMargin?: number;
  /** Hard cap on menu height. */
  maxMenuHeight?: number;
}

const DEFAULT_ESTIMATED_HEIGHT = 220;
const DEFAULT_GAP = 8;
const DEFAULT_VIEWPORT_MARGIN = 8;
const DEFAULT_MAX_MENU_HEIGHT = 320;

/**
 * Positions a fixed toolbar/inspector menu relative to an anchor, flipping
 * upward when there is not enough space below and clamping into the viewport.
 */
export function measureDropdownFrame(
  anchor: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width"> | null,
  options: MeasureDropdownFrameOptions,
  viewport: Pick<Window, "innerWidth" | "innerHeight"> = typeof window ===
  "undefined"
    ? { innerWidth: 1024, innerHeight: 768 }
    : window,
): DropdownFrame | null {
  if (!anchor) {
    return null;
  }

  const width = options.width;
  const align = options.align ?? "left";
  const gap = options.gap ?? DEFAULT_GAP;
  const viewportMargin = options.viewportMargin ?? DEFAULT_VIEWPORT_MARGIN;
  const estimatedHeight = options.estimatedHeight ?? DEFAULT_ESTIMATED_HEIGHT;
  const maxMenuHeight = options.maxMenuHeight ?? DEFAULT_MAX_MENU_HEIGHT;

  const preferredLeft =
    align === "center"
      ? anchor.left + anchor.width / 2 - width / 2
      : align === "right"
        ? anchor.right - width
        : anchor.left;
  const maxLeft = Math.max(
    viewportMargin,
    viewport.innerWidth - width - viewportMargin,
  );
  const left = Math.min(maxLeft, Math.max(viewportMargin, preferredLeft));

  const spaceBelow = viewport.innerHeight - anchor.bottom - viewportMargin;
  const spaceAbove = anchor.top - viewportMargin;
  const placement: DropdownPlacement =
    spaceBelow < estimatedHeight + gap && spaceAbove > spaceBelow
      ? "up"
      : "down";

  const available =
    placement === "down" ? spaceBelow - gap : spaceAbove - gap;
  const maxHeight = Math.max(
    96,
    Math.min(maxMenuHeight, Math.floor(available)),
  );

  const top =
    placement === "down"
      ? anchor.bottom + gap
      : Math.max(viewportMargin, anchor.top - gap - maxHeight);

  return {
    top,
    left,
    width,
    placement,
    maxHeight,
  };
}

/**
 * Applies a measured {@link DropdownFrame} onto a base menu style object.
 */
export function anchoredDropdownStyle(
  base: CSSProperties,
  frame: DropdownFrame | null,
): CSSProperties {
  if (!frame) {
    return base;
  }

  return {
    ...base,
    position: "fixed",
    top: frame.top,
    right: "auto",
    left: frame.left,
    width: frame.width,
    maxHeight: frame.maxHeight,
    overflowY: "auto",
    transform: "none",
    zIndex: 1000,
  };
}
