/** Simple fixed-row virtual window math for large lists (no external deps). */

export type VirtualWindowInput = {
  scrollTop: number;
  viewportHeight: number;
  itemCount: number;
  itemHeight: number;
  /** Extra rows above/below the viewport. Default 4. */
  overscan?: number;
};

export type VirtualWindow = {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
};

export function getVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const itemHeight = Math.max(1, input.itemHeight);
  const itemCount = Math.max(0, Math.floor(input.itemCount));
  const overscan = Math.max(0, input.overscan ?? 4);
  const totalHeight = itemCount * itemHeight;

  if (itemCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 0,
    };
  }

  const viewportHeight = Math.max(0, input.viewportHeight);
  const scrollTop = Math.max(0, Math.min(input.scrollTop, Math.max(0, totalHeight - viewportHeight)));

  const rawStart = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 1;
  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(itemCount, rawStart + visibleCount + overscan);
  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, totalHeight - endIndex * itemHeight);

  return {
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    totalHeight,
  };
}
