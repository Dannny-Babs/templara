import type {
  AssetDefinition,
  BarcodeNode,
  BindingRef,
  ConditionalNode,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  FieldFormat,
  FieldRun,
  FlowNode,
  FlowRegionNode,
  FontDefinition,
  Frame,
  GridNode,
  GroupNode,
  ImageNode,
  ImageSource,
  InlineContent,
  PageTemplate,
  QrNode,
  RepeatNode,
  ShapeNode,
  StackNode,
  TextNode,
  TextStyle
} from "@templara/core";

export interface RenderDocumentInput {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  mode?: RenderMode;
  measurement?: MeasurementProvider;
  fonts?: FontDefinition[];
  fontFamily?: string;
}

export type RenderMode = "template" | "preview" | "export";

export interface MeasurementProvider {
  measureText(input: TextMeasureInput): FrameMeasurement;
}

export interface TextMeasureInput {
  text: string;
  style: TextStyle;
  width: number;
}

export interface FrameMeasurement {
  width: number;
  height: number;
  lines?: number;
}

export interface RenderDocumentResult {
  pages: RenderPage[];
  warnings: RenderWarning[];
  repeatAnalyses: RepeatFitAnalysis[];
  fonts: RenderFontDefinition[];
  selectedFontFamily?: string;
}

export interface RenderFontDefinition {
  id: string;
  family: string;
  cssUrl?: string;
  fallback?: string;
}

export interface RenderPage {
  id: string;
  width: number;
  height: number;
  children: RenderNode[];
  debugBoxes: RenderDebugBox[];
}

export type RenderNode = RenderTextNode | RenderImageNode | RenderShapeNode | RenderGeneratedNode;

export interface BaseRenderNode {
  id: string;
  sourceNodeId: string;
  frame: Frame;
  rotation?: number;
  opacity?: number;
}

export interface RenderTextNode extends BaseRenderNode {
  type: "text";
  text: string;
  style: TextStyle;
}

export interface RenderImageNode extends BaseRenderNode {
  type: "image";
  src: string;
  fit?: "cover" | "contain" | "fill" | "none";
  alt?: string;
  placeholder?: string;
}

export interface RenderShapeNode extends BaseRenderNode {
  type: "shape";
  shape: "rectangle" | "ellipse" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export interface RenderGeneratedNode extends BaseRenderNode {
  type: "barcode" | "qr";
  value: string;
  format?: string;
  placeholder?: string;
}

export interface RenderDebugBox {
  id: string;
  sourceNodeId: string;
  kind: "flow-region" | "repeat-frame" | "repeat-row" | "page-break" | "measured-text";
  frame: Frame;
  label: string;
  color: string;
}

export interface RenderWarning {
  code: string;
  message: string;
  nodeId?: string;
  pageId?: string;
}

export interface RepeatFitAnalysis {
  id: string;
  sourceNodeId: string;
  bindingPath: string;
  itemCount: number;
  rowGap: number;
  startPageId: string;
  startY: number;
  spaceLeftOnStartPage: number;
  usedSpaceOnStartPage: number;
  remainingSpaceOnStartPage: number;
  startPageUtilization: number;
  totalRowsHeight: number;
  averageRowHeight: number;
  minRowHeight: number;
  maxRowHeight: number;
  fixedRowHeight: number;
  plannedRowHeight: number;
  compacted: boolean;
  filledStartPage: boolean;
  additionalRowsFitOnStartPage: number;
  rowsFitOnStartPage: number;
  overflowItemCount: number;
  continuationPageCapacity: number;
  estimatedTotalPages: number;
  pagePlan: RepeatPageFit[];
}

export interface RepeatPageFit {
  pageNumber: number;
  startIndex: number;
  endIndex: number;
  itemCount: number;
  availableHeight: number;
  usedHeight: number;
  remainingHeight: number;
}

interface RenderState {
  template: DocumentTemplate;
  data: Record<string, unknown>;
  mode: RenderMode;
  measurement: MeasurementProvider;
  assets: Map<string, AssetDefinition>;
  fonts: RenderFontDefinition[];
  selectedFontFamily?: string;
  pages: RenderPage[];
  warnings: RenderWarning[];
  repeatAnalyses: RepeatFitAnalysis[];
}

interface Scope {
  values: Record<string, unknown>;
}

interface FlowCursor {
  pageIndex: number;
  y: number;
}

interface FlowContext {
  sourcePage: PageTemplate;
  initialPageIndex: number;
  region: FlowRegionNode;
  continuationTop: number;
  continuationBottom: number;
  firstPageBottom: number;
}

interface RepeatRowPlan {
  children: FlowNode[];
  scope: Scope;
  index: number;
  count: number;
  fixedHeight: number;
  minimumHeight: number;
  height: number;
}

interface RepeatRowOptimization {
  rows: RepeatRowPlan[];
  compacted: boolean;
  filledStartPage: boolean;
  fixedRowHeight: number;
  plannedRowHeight: number;
  fixedRowsFitOnStartPage: number;
}

const LAYOUT_EPSILON = 0.001;

const DEBUG_COLORS = {
  flowRegion: "#2563eb",
  repeatFrame: "#7c3aed",
  repeatRow: "#16a34a",
  pageBreak: "#dc2626",
  measuredText: "#ea580c"
};

export function renderDocument(input: RenderDocumentInput): RenderDocumentResult {
  const state: RenderState = {
    template: input.template,
    data: input.data ?? {},
    mode: input.mode ?? "preview",
    measurement: input.measurement ?? defaultMeasurementProvider,
    assets: new Map(input.template.assets?.map((asset) => [asset.id, asset])),
    fonts: normalizeFonts(input.fonts ?? input.template.fonts ?? []),
    selectedFontFamily: input.fontFamily,
    pages: [],
    warnings: [],
    repeatAnalyses: []
  };

  for (const page of input.template.pages) {
    renderTemplatePage(state, page);
  }

  return {
    pages: state.pages,
    warnings: state.warnings,
    repeatAnalyses: state.repeatAnalyses,
    fonts: state.fonts,
    selectedFontFamily: state.selectedFontFamily
  };
}

function renderTemplatePage(state: RenderState, sourcePage: PageTemplate): void {
  const pageIndex = addRenderPage(state, sourcePage, 0);
  const page = state.pages[pageIndex];

  for (const layer of sourcePage.layers) {
    if (layer.kind === "flow") {
      continue;
    }

    for (const node of layer.nodes) {
      renderAbsoluteNode(state, page, node, emptyScope(), { x: 0, y: 0 });
    }
  }

  for (const layer of sourcePage.layers) {
    if (layer.kind !== "flow") {
      continue;
    }

    for (const node of layer.nodes) {
      if (node.type === "flowRegion") {
        renderFlowRegion(state, sourcePage, pageIndex, node);
      } else {
        state.warnings.push({
          code: "flow.unsupported_root",
          message: `Only flowRegion nodes are supported at the root of a flow layer in v0. Received ${node.type}.`,
          nodeId: node.id,
          pageId: sourcePage.id
        });
      }
    }
  }
}

function renderFlowRegion(
  state: RenderState,
  sourcePage: PageTemplate,
  initialPageIndex: number,
  region: FlowRegionNode
): void {
  const continuationTop = sourcePage.margin?.top ?? region.frame.y;
  const continuationBottom = sourcePage.size.height - (sourcePage.margin?.bottom ?? 0);
  const firstPageBottom = resolveFlowRegionBottom(sourcePage, region);
  const context: FlowContext = {
    sourcePage,
    initialPageIndex: initialPageIndex,
    region,
    continuationTop,
    continuationBottom,
    firstPageBottom
  };

  addDebugBox(state.pages[initialPageIndex], {
    sourceNodeId: region.id,
    kind: "flow-region",
    frame: {
      ...region.frame,
      height: Math.max(0, firstPageBottom - region.frame.y)
    },
    label: region.flowBoundary === "page-margin" ? "flow to page margin" : "flow region",
    color: DEBUG_COLORS.flowRegion
  });

  let cursor: FlowCursor = {
    pageIndex: initialPageIndex,
    y: region.frame.y
  };

  for (const child of region.children) {
    cursor = renderFlowNode(state, context, cursor, child, emptyScope(), { x: region.frame.x, y: 0 });
  }
}

function renderFlowNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: FlowNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  if (node.type === "repeat") {
    return renderRepeatNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "stack") {
    return renderStackNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "conditional") {
    return renderConditionalNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "grid") {
    state.warnings.push({
      code: "flow.grid_not_implemented",
      message: "Grid layout is in the v0 schema but not implemented in the renderer yet.",
      nodeId: node.id,
      pageId: context.sourcePage.id
    });
    return cursor;
  }

  const measuredHeight = measureFlowNodeHeight(state, node, scope);
  const requiredHeight = Math.max(0, node.frame.y) + measuredHeight;
  cursor = ensureFlowSpace(state, context, cursor, requiredHeight, node.id);
  renderAbsoluteNode(state, state.pages[cursor.pageIndex], node, scope, {
    x: origin.x,
    y: cursor.y
  });

  return {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y + measuredHeight
  };
}

function resolveFlowRegionBottom(sourcePage: PageTemplate, region: FlowRegionNode): number {
  if (region.flowBoundary === "page-margin") {
    return sourcePage.size.height - (sourcePage.margin?.bottom ?? 0);
  }

  return region.frame.y + region.frame.height;
}

function renderStackNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: StackNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  if (node.direction !== "vertical") {
    state.warnings.push({
      code: "flow.horizontal_stack_not_implemented",
      message: "Only vertical stacks are supported in v0.",
      nodeId: node.id,
      pageId: context.sourcePage.id
    });
    return cursor;
  }

  let nextCursor = {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y
  };

  for (const child of node.children) {
    nextCursor = renderFlowNode(state, context, nextCursor, child, scope, {
      x: origin.x + node.frame.x,
      y: 0
    });
    nextCursor = { ...nextCursor, y: nextCursor.y + node.gap };
  }

  return nextCursor;
}

function renderConditionalNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: ConditionalNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const value = resolvePath(node.condition.source, state.data, scope);
  const children = value ? node.children : node.fallback;
  let nextCursor = cursor;

  for (const child of children ?? []) {
    nextCursor = renderFlowNode(state, context, nextCursor, child, scope, origin);
  }

  return nextCursor;
}

function renderRepeatNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: RepeatNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const value = resolveBinding(node.binding, state.data, scope);
  const items = Array.isArray(value) ? value : [];
  const repeatX = origin.x + node.frame.x;
  let nextCursor: FlowCursor = {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y
  };

  if (!Array.isArray(value)) {
    state.warnings.push({
      code: "binding.repeat_not_array",
      message: `Repeat binding "${node.binding.path}" did not resolve to an array.`,
      nodeId: node.id,
      pageId: context.sourcePage.id
    });
  }

  const baseRows = createRepeatRowPlans(state, node, scope, items);
  const optimization = optimizeRepeatRows(context, nextCursor, node, baseRows);
  const rows = optimization.rows;
  const analysis = analyzeRepeatFit(state, context, nextCursor, node, rows, optimization);
  state.repeatAnalyses.push(analysis);

  addDebugBox(state.pages[nextCursor.pageIndex], {
    sourceNodeId: node.id,
    kind: "repeat-frame",
    frame: {
      x: repeatX,
      y: nextCursor.y,
      width: node.frame.width,
      height: node.frame.height
    },
    label: `repeat ${node.binding.path}: fits ${analysis.rowsFitOnStartPage}/${analysis.itemCount}`,
    color: DEBUG_COLORS.repeatFrame
  });

  for (const row of rows) {
    nextCursor = renderRepeatRow(state, context, nextCursor, node, row, origin);
  }

  return nextCursor;
}

function createRepeatRowPlans(state: RenderState, node: RepeatNode, scope: Scope, items: unknown[]): RepeatRowPlan[] {
  if (items.length === 0) {
    const children = node.emptyState ?? [];
    return children.length === 0
      ? []
      : [
          {
            children,
            scope,
            index: 0,
            count: 1,
            fixedHeight: measureRepeatRowHeight(state, { ...node, children }, scope),
            minimumHeight: measureRepeatRowMinimumHeight(state, { ...node, children }, scope),
            height: measureRepeatRowHeight(state, { ...node, children }, scope)
          }
        ];
  }

  return items.map((item, index) => {
    const rowScope = extendScope(scope, {
      [node.itemAlias]: item,
      loop: {
        index,
        number: index + 1,
        isFirst: index === 0,
        isLast: index === items.length - 1
      }
    });

    const fixedHeight = measureRepeatRowHeight(state, node, rowScope);
    const minimumHeight = measureRepeatRowMinimumHeight(state, node, rowScope);

    return {
      children: node.children,
      scope: rowScope,
      index,
      count: items.length,
      fixedHeight,
      minimumHeight,
      height: fixedHeight
    };
  });
}

function optimizeRepeatRows(
  context: FlowContext,
  cursor: FlowCursor,
  repeat: RepeatNode,
  rows: RepeatRowPlan[]
): RepeatRowOptimization {
  const fixedRowHeight = rows.length > 0 ? Math.max(...rows.map((row) => row.fixedHeight)) : repeat.frame.height;
  const startPageBottom = cursor.pageIndex === context.initialPageIndex ? context.firstPageBottom : context.continuationBottom;
  const startAvailableHeight = Math.max(0, startPageBottom - cursor.y);
  const fixedRowsFitOnStartPage = fitRowsInHeight(
    rows.map((row) => row.fixedHeight),
    repeat.layout.gap,
    startAvailableHeight
  );

  if (repeat.layout.rowSizing !== "compact" || rows.length === 0 || fixedRowsFitOnStartPage >= rows.length) {
    return {
      rows,
      compacted: false,
      filledStartPage: false,
      fixedRowHeight,
      plannedRowHeight: fixedRowHeight,
      fixedRowsFitOnStartPage
    };
  }

  const uniqueFixedHeights = new Set(rows.map((row) => roundLayout(row.fixedHeight)));

  if (uniqueFixedHeights.size !== 1) {
    return {
      rows,
      compacted: false,
      filledStartPage: false,
      fixedRowHeight,
      plannedRowHeight: fixedRowHeight,
      fixedRowsFitOnStartPage
    };
  }

  const minRowHeight = Math.max(
    repeat.layout.minRowHeight ?? 0,
    ...rows.map((row) => row.minimumHeight)
  );
  const maxCompressionRatio = repeat.layout.maxCompressionRatio ?? 0.12;
  const compressionFloor = fixedRowHeight * (1 - maxCompressionRatio);
  const lowerBound = Math.max(minRowHeight, compressionFloor);
  const maxPossibleRows = Math.min(
    rows.length,
    Math.floor((startAvailableHeight + repeat.layout.gap) / (lowerBound + repeat.layout.gap))
  );

  if (maxPossibleRows <= fixedRowsFitOnStartPage) {
    return maybeFillStartPageRows(rows, repeat, startAvailableHeight, fixedRowHeight, fixedRowsFitOnStartPage);
  }

  const targetRows = maxPossibleRows;
  const compactHeight = (startAvailableHeight - repeat.layout.gap * Math.max(0, targetRows - 1)) / targetRows;

  if (compactHeight >= fixedRowHeight || compactHeight < lowerBound) {
    return maybeFillStartPageRows(rows, repeat, startAvailableHeight, fixedRowHeight, fixedRowsFitOnStartPage);
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      height: compactHeight
    })),
    compacted: true,
    filledStartPage: true,
    fixedRowHeight,
    plannedRowHeight: compactHeight,
    fixedRowsFitOnStartPage
  };
}

function maybeFillStartPageRows(
  rows: RepeatRowPlan[],
  repeat: RepeatNode,
  startAvailableHeight: number,
  fixedRowHeight: number,
  fixedRowsFitOnStartPage: number
): RepeatRowOptimization {
  if (!repeat.layout.fillAvailableSpace || fixedRowsFitOnStartPage <= 0 || fixedRowsFitOnStartPage >= rows.length) {
    return {
      rows,
      compacted: false,
      filledStartPage: false,
      fixedRowHeight,
      plannedRowHeight: fixedRowHeight,
      fixedRowsFitOnStartPage
    };
  }

  const fillHeight =
    (startAvailableHeight - repeat.layout.gap * Math.max(0, fixedRowsFitOnStartPage - 1)) / fixedRowsFitOnStartPage;
  const maxExpansionRatio = repeat.layout.maxExpansionRatio ?? 0.15;
  const expansionCeiling = fixedRowHeight * (1 + maxExpansionRatio);

  if (fillHeight <= fixedRowHeight || fillHeight > expansionCeiling) {
    return {
      rows,
      compacted: false,
      filledStartPage: false,
      fixedRowHeight,
      plannedRowHeight: fixedRowHeight,
      fixedRowsFitOnStartPage
    };
  }

  return {
    rows: rows.map((row, index) => ({
      ...row,
      height: index < fixedRowsFitOnStartPage ? fillHeight : row.height
    })),
    compacted: false,
    filledStartPage: true,
    fixedRowHeight,
    plannedRowHeight: fillHeight,
    fixedRowsFitOnStartPage
  };
}

function analyzeRepeatFit(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  repeat: RepeatNode,
  rows: RepeatRowPlan[],
  optimization: RepeatRowOptimization
): RepeatFitAnalysis {
  const currentPage = state.pages[cursor.pageIndex];
  const startPageBottom = cursor.pageIndex === context.initialPageIndex ? context.firstPageBottom : context.continuationBottom;
  const startAvailableHeight = Math.max(0, startPageBottom - cursor.y);
  const continuationHeight = Math.max(0, context.continuationBottom - context.continuationTop);
  const rowHeights = rows.map((row) => row.height);
  const pagePlan = planRepeatPages(rowHeights, repeat.layout.gap, startAvailableHeight, continuationHeight);
  const firstPage = pagePlan[0];
  const totalRowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const minRowHeight = rowHeights.length > 0 ? Math.min(...rowHeights) : 0;
  const maxRowHeight = rowHeights.length > 0 ? Math.max(...rowHeights) : 0;
  const averageRowHeight = rowHeights.length > 0 ? totalRowsHeight / rowHeights.length : 0;
  const continuationFirstPage = pagePlan.find((page) => page.pageNumber > 1);

  return {
    id: `${currentPage.id}-${repeat.id}-analysis-${state.repeatAnalyses.length + 1}`,
    sourceNodeId: repeat.id,
    bindingPath: repeat.binding.path,
    itemCount: rows.length,
    rowGap: repeat.layout.gap,
    startPageId: currentPage.id,
    startY: cursor.y,
    spaceLeftOnStartPage: startAvailableHeight,
    usedSpaceOnStartPage: firstPage?.usedHeight ?? 0,
    remainingSpaceOnStartPage: firstPage?.remainingHeight ?? startAvailableHeight,
    startPageUtilization:
      startAvailableHeight > 0 ? Math.min(1, Math.max(0, (firstPage?.usedHeight ?? 0) / startAvailableHeight)) : 0,
    totalRowsHeight,
    averageRowHeight,
    minRowHeight,
    maxRowHeight,
    fixedRowHeight: optimization.fixedRowHeight,
    plannedRowHeight: optimization.plannedRowHeight,
    compacted: optimization.compacted,
    filledStartPage: optimization.filledStartPage,
    additionalRowsFitOnStartPage: Math.max(0, (firstPage?.itemCount ?? 0) - optimization.fixedRowsFitOnStartPage),
    rowsFitOnStartPage: firstPage?.itemCount ?? 0,
    overflowItemCount: Math.max(0, rows.length - (firstPage?.itemCount ?? 0)),
    continuationPageCapacity: continuationFirstPage?.itemCount ?? estimateContinuationCapacity(rowHeights, repeat.layout.gap, continuationHeight),
    estimatedTotalPages: Math.max(1, pagePlan.length),
    pagePlan
  };
}

function planRepeatPages(
  rowHeights: number[],
  gap: number,
  firstAvailableHeight: number,
  continuationAvailableHeight: number
): RepeatPageFit[] {
  if (rowHeights.length === 0) {
    return [
      {
        pageNumber: 1,
        startIndex: 0,
        endIndex: -1,
        itemCount: 0,
        availableHeight: firstAvailableHeight,
        usedHeight: 0,
        remainingHeight: firstAvailableHeight
      }
    ];
  }

  const pages: RepeatPageFit[] = [];
  let index = 0;
  let pageNumber = 1;

  while (index < rowHeights.length) {
    const availableHeight = pageNumber === 1 ? firstAvailableHeight : continuationAvailableHeight;
    const startIndex = index;
    let usedHeight = 0;
    let count = 0;

    while (index < rowHeights.length) {
      const nextHeight = rowHeights[index];
      const nextUsedHeight = usedHeight + (count > 0 ? gap : 0) + nextHeight;

      if (count > 0 && nextUsedHeight - availableHeight > LAYOUT_EPSILON) {
        break;
      }

      if (count === 0 && nextHeight - availableHeight > LAYOUT_EPSILON) {
        usedHeight = nextHeight;
        index += 1;
        count = 1;
        break;
      }

      usedHeight = nextUsedHeight;
      index += 1;
      count += 1;
    }

    pages.push({
      pageNumber,
      startIndex,
      endIndex: index - 1,
      itemCount: count,
      availableHeight,
      usedHeight,
      remainingHeight: availableHeight - usedHeight
    });

    pageNumber += 1;
  }

  return pages;
}

function estimateContinuationCapacity(rowHeights: number[], gap: number, availableHeight: number): number {
  if (rowHeights.length === 0) {
    return 0;
  }

  return fitRowsInHeight(rowHeights, gap, availableHeight);
}

function fitRowsInHeight(rowHeights: number[], gap: number, availableHeight: number): number {
  let usedHeight = 0;
  let count = 0;

  for (const rowHeight of rowHeights) {
    const nextUsedHeight = usedHeight + (count > 0 ? gap : 0) + rowHeight;

    if (count > 0 && nextUsedHeight - availableHeight > LAYOUT_EPSILON) {
      break;
    }

    if (count === 0 && rowHeight - availableHeight > LAYOUT_EPSILON) {
      return 1;
    }

    usedHeight = nextUsedHeight;
    count += 1;
  }

  return count;
}

function renderRepeatRow(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  repeat: RepeatNode,
  row: RepeatRowPlan,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const rowHeight = row.height;
  const repeatX = origin.x + repeat.frame.x;
  const breakCandidate = ensureFlowSpace(state, context, cursor, rowHeight, repeat.id);

  if (breakCandidate.pageIndex !== cursor.pageIndex) {
    addDebugBox(state.pages[cursor.pageIndex], {
      sourceNodeId: repeat.id,
      kind: "page-break",
      frame: {
        x: repeatX,
        y: cursor.y,
        width: repeat.frame.width,
        height: 1
      },
      label: `page break before row ${row.index + 1}`,
      color: DEBUG_COLORS.pageBreak
    });
  }

  const rowTop = breakCandidate.y;
  const page = state.pages[breakCandidate.pageIndex];

  addDebugBox(page, {
    sourceNodeId: repeat.id,
    kind: "repeat-row",
    frame: {
      x: repeatX,
      y: rowTop,
      width: repeat.frame.width,
      height: rowHeight
    },
    label: `row ${row.index + 1}/${row.count}`,
    color: DEBUG_COLORS.repeatRow
  });

  for (const child of row.children) {
    renderAbsoluteNode(state, page, stretchRepeatBackground(child, repeat, row), row.scope, {
      x: repeatX,
      y: rowTop
    });
  }

  return {
    pageIndex: breakCandidate.pageIndex,
    y: rowTop + rowHeight + repeat.layout.gap
  };
}

function ensureFlowSpace(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  requiredHeight: number,
  nodeId: string
): FlowCursor {
  const pageBottom = cursor.pageIndex === context.initialPageIndex ? context.firstPageBottom : context.continuationBottom;

  if (cursor.y + requiredHeight <= pageBottom + LAYOUT_EPSILON) {
    return cursor;
  }

  const continuationHeight = context.continuationBottom - context.continuationTop;

  if (requiredHeight > continuationHeight) {
    state.warnings.push({
      code: "layout.unbreakable_overflow",
      message: `Node ${nodeId} is taller than a continuation page flow area.`,
      nodeId,
      pageId: state.pages[cursor.pageIndex]?.id
    });
  }

  const nextPageIndex = addRenderPage(state, context.sourcePage, state.pages.length);
  addDebugBox(state.pages[nextPageIndex], {
    sourceNodeId: context.region.id,
    kind: "flow-region",
    frame: {
      x: context.region.frame.x,
      y: context.continuationTop,
      width: context.region.frame.width,
      height: continuationHeight
    },
    label: "flow continuation",
    color: DEBUG_COLORS.flowRegion
  });

  state.warnings.push({
    code: "layout.page_break",
    message: `Moved node ${nodeId} to continuation page ${state.pages[nextPageIndex].id}.`,
    nodeId,
    pageId: state.pages[nextPageIndex].id
  });

  return {
    pageIndex: nextPageIndex,
    y: context.continuationTop
  };
}

function renderAbsoluteNode(
  state: RenderState,
  page: RenderPage,
  node: DocNode | FlowNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  if (isHidden(node)) {
    return;
  }

  if (node.type === "text") {
    const style = resolveTextStyle(state, node.style);
    const text = resolveInlineContent(node.content, state, scope, node.id);
    const measured = state.measurement.measureText({
      text,
      style,
      width: node.frame.width
    });
    const frame = offsetFrame(node.frame, origin, Math.max(node.frame.height, measured.height));

    page.children.push({
      id: renderId(page, node.id),
      sourceNodeId: node.id,
      type: "text",
      frame,
      rotation: node.rotation,
      opacity: node.opacity,
      text,
      style
    });

    addDebugBox(page, {
      sourceNodeId: node.id,
      kind: "measured-text",
      frame,
      label: `${measured.lines ?? 1} line${measured.lines === 1 ? "" : "s"}`,
      color: DEBUG_COLORS.measuredText
    });
    return;
  }

  if (node.type === "image") {
    const source = resolveImageSource(state, node.source, scope);
    page.children.push({
      id: renderId(page, node.id),
      sourceNodeId: node.id,
      type: "image",
      frame: offsetFrame(node.frame, origin),
      rotation: node.rotation,
      opacity: node.opacity,
      src: source.src,
      fit: node.fit,
      alt: node.alt,
      placeholder: source.placeholder
    });
    return;
  }

  if (node.type === "shape") {
    page.children.push({
      id: renderId(page, node.id),
      sourceNodeId: node.id,
      type: "shape",
      frame: offsetFrame(node.frame, origin),
      rotation: node.rotation,
      opacity: node.opacity,
      shape: node.shape,
      fill: node.style.fill,
      stroke: node.style.stroke,
      strokeWidth: node.style.strokeWidth,
      radius: node.style.radius
    });
    return;
  }

  if (node.type === "barcode") {
    renderGeneratedNode(state, page, node, scope, origin, "barcode");
    return;
  }

  if (node.type === "qr") {
    renderGeneratedNode(state, page, node, scope, origin, "qr");
    return;
  }

  if (node.type === "group") {
    for (const child of node.children) {
      renderAbsoluteNode(state, page, child, scope, {
        x: origin.x + node.frame.x,
        y: origin.y + node.frame.y
      });
    }
  }
}

function renderGeneratedNode(
  state: RenderState,
  page: RenderPage,
  node: BarcodeNode | QrNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">,
  type: "barcode" | "qr"
): void {
  const value = resolveDynamicValue(node.value, state, scope, node.id);
  page.children.push({
    id: renderId(page, node.id),
    sourceNodeId: node.id,
    type,
    frame: offsetFrame(node.frame, origin),
    rotation: node.rotation,
    opacity: node.opacity,
    value,
    format: node.type === "barcode" ? node.format : undefined,
    placeholder: state.mode === "template" && dynamicValueHasBinding(node.value) ? value : undefined
  });
}

function measureFlowNodeHeight(state: RenderState, node: FlowNode, scope: Scope): number {
  if (node.type === "text") {
    const style = resolveTextStyle(state, node.style);
    const text = resolveInlineContent(node.content, state, scope, node.id);
    return Math.max(
      node.frame.height,
      state.measurement.measureText({
        text,
        style,
        width: node.frame.width
      }).height
    );
  }

  if (node.type === "image" || node.type === "shape" || node.type === "barcode" || node.type === "qr" || node.type === "grid") {
    return node.frame.height;
  }

  if (node.type === "group") {
    return measureGroupHeight(state, node, scope);
  }

  if (node.type === "stack") {
    return node.children.reduce((height, child, index) => {
      const gap = index === 0 ? 0 : node.gap;
      return height + gap + measureFlowNodeHeight(state, child, scope);
    }, node.frame.height);
  }

  if (node.type === "conditional") {
    const value = resolvePath(node.condition.source, state.data, scope);
    const children = value ? node.children : (node.fallback ?? []);
    return children.reduce((height, child) => height + measureFlowNodeHeight(state, child, scope), node.frame.height);
  }

  if (node.type === "repeat") {
    return measureRepeatRowHeight(state, node, scope);
  }

  return assertNever(node);
}

function measureRepeatRowHeight(state: RenderState, node: RepeatNode, scope: Scope): number {
  const childrenBottom = node.children.reduce((bottom, child) => {
    const childHeight = measureFlowNodeHeight(state, child, scope);
    return Math.max(bottom, child.frame.y + childHeight);
  }, 0);

  return Math.max(node.frame.height, childrenBottom);
}

function measureRepeatRowMinimumHeight(state: RenderState, node: RepeatNode, scope: Scope): number {
  const childrenBottom = node.children.reduce((bottom, child) => {
    if (isRepeatBackgroundShape(child, node, node.frame.height)) {
      return bottom;
    }

    const childHeight = measureFlowNodeHeight(state, child, scope);
    return Math.max(bottom, child.frame.y + childHeight);
  }, 0);

  return Math.max(node.layout.minRowHeight ?? 0, childrenBottom);
}

function stretchRepeatBackground(child: FlowNode, repeat: RepeatNode, row: RepeatRowPlan): FlowNode {
  if (!isRepeatBackgroundShape(child, repeat, row.fixedHeight) || child.type !== "shape") {
    return child;
  }

  return {
    ...child,
    frame: {
      ...child.frame,
      height: row.height
    }
  };
}

function isRepeatBackgroundShape(child: FlowNode, repeat: RepeatNode, rowHeight: number): boolean {
  return (
    child.type === "shape" &&
    child.frame.x === 0 &&
    child.frame.y === 0 &&
    child.frame.width === repeat.frame.width &&
    roundLayout(child.frame.height) === roundLayout(rowHeight)
  );
}

function measureGroupHeight(state: RenderState, node: GroupNode, scope: Scope): number {
  const childrenBottom = node.children.reduce((bottom, child) => {
    if (!isFlowNode(child)) {
      return Math.max(bottom, child.frame.y + child.frame.height);
    }

    return Math.max(bottom, child.frame.y + measureFlowNodeHeight(state, child, scope));
  }, 0);

  return Math.max(node.frame.height, childrenBottom);
}

function resolveInlineContent(
  content: InlineContent[],
  state: RenderState,
  scope: Scope,
  nodeId: string
): string {
  return content
    .map((part) => {
      if (part.kind === "text") {
        return part.text;
      }

      return resolveField(part, state, scope, nodeId);
    })
    .join("");
}

function resolveField(field: FieldRun, state: RenderState, scope: Scope, nodeId: string): string {
  if (state.mode === "template") {
    return bindingPlaceholder(field.binding);
  }

  const value = resolveBinding(field.binding, state.data, scope);

  if (value == null) {
    state.warnings.push({
      code: "binding.missing",
      message: `Missing binding "${field.binding.path}" for field "${field.label}".`,
      nodeId
    });
    return field.fallback ?? "";
  }

  return formatValue(value, field.format);
}

function resolveDynamicValue(
  value: DynamicValue,
  state: RenderState,
  scope: Scope,
  nodeId: string
): string {
  if (value.kind === "literal") {
    return value.value;
  }

  if (value.kind === "binding") {
    if (state.mode === "template") {
      return bindingPlaceholder(value.binding);
    }

    const resolved = resolveBinding(value.binding, state.data, scope);
    return resolved == null ? "" : String(resolved);
  }

  return resolveInlineContent(value.parts, state, scope, nodeId);
}

function resolveImageSource(state: RenderState, source: ImageSource, scope: Scope): { src: string; placeholder?: string } {
  if (source.kind === "url") {
    return { src: source.url };
  }

  if (source.kind === "asset") {
    return { src: state.assets.get(source.assetId)?.source ?? "" };
  }

  if (state.mode === "template") {
    return { src: "", placeholder: bindingPlaceholder(source.binding) };
  }

  const value = resolveBinding(source.binding, state.data, scope);
  return { src: value == null ? "" : String(value) };
}

function bindingPlaceholder(binding: BindingRef): string {
  return `{{${binding.path}}}`;
}

function dynamicValueHasBinding(value: DynamicValue): boolean {
  if (value.kind === "binding") {
    return true;
  }

  if (value.kind === "template") {
    return inlineContentHasBinding(value.parts);
  }

  return false;
}

function inlineContentHasBinding(content: InlineContent[]): boolean {
  return content.some((part) => part.kind === "field");
}

function resolveBinding(binding: BindingRef, data: Record<string, unknown>, scope: Scope): unknown {
  return resolvePath(binding.path, data, scope);
}

function resolvePath(path: string, data: Record<string, unknown>, scope: Scope): unknown {
  const [root, ...rest] = normalizePath(path);

  if (!root) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(scope.values, root)) {
    return getPath(scope.values[root], rest);
  }

  return getPath(data[root], rest);
}

function normalizePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/\[\]/g, "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getPath(value: unknown, parts: string[]): unknown {
  let current = value;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      current = current[Number(part)];
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function formatValue(value: unknown, format?: FieldFormat): string {
  if (!format) {
    return String(value);
  }

  if (format.type === "currency") {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat(format.locale ?? "en-US", {
          style: "currency",
          currency: format.currency
        }).format(number)
      : String(value);
  }

  if (format.type === "date") {
    const date = value instanceof Date ? value : parseDateValue(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat(format.locale ?? "en-US", {
          dateStyle: format.dateStyle ?? "medium"
        }).format(date);
  }

  if (format.type === "number") {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat(format.locale ?? "en-US", {
          minimumFractionDigits: format.minimumFractionDigits,
          maximumFractionDigits: format.maximumFractionDigits
        }).format(number)
      : String(value);
  }

  const text = String(value);

  if (format.transform === "uppercase") {
    return text.toUpperCase();
  }

  if (format.transform === "lowercase") {
    return text.toLowerCase();
  }

  if (format.transform === "capitalize") {
    return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return text;
}

function parseDateValue(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
}

function addRenderPage(state: RenderState, sourcePage: PageTemplate, index: number): number {
  const suffix = index === 0 ? "" : `-${index + 1}`;
  const page: RenderPage = {
    id: `${sourcePage.id}${suffix}`,
    width: sourcePage.size.width,
    height: sourcePage.size.height,
    children: [],
    debugBoxes: []
  };

  state.pages.push(page);
  return state.pages.length - 1;
}

function addDebugBox(page: RenderPage, box: Omit<RenderDebugBox, "id">): void {
  page.debugBoxes.push({
    id: `${page.id}-debug-${page.debugBoxes.length + 1}`,
    ...box
  });
}

function offsetFrame(frame: Frame, origin: Pick<Frame, "x" | "y">, measuredHeight = frame.height): Frame {
  return {
    x: origin.x + frame.x,
    y: origin.y + frame.y,
    width: frame.width,
    height: measuredHeight
  };
}

function renderId(page: RenderPage, nodeId: string): string {
  return `${page.id}-${nodeId}-${page.children.length + 1}`;
}

function emptyScope(): Scope {
  return { values: {} };
}

function extendScope(scope: Scope, values: Record<string, unknown>): Scope {
  return {
    values: {
      ...scope.values,
      ...values
    }
  };
}

function isHidden(node: DocNode | FlowNode): boolean {
  return node.visible === false;
}

function isFlowNode(node: DocNode): node is FlowNode {
  return (
    node.type === "text" ||
    node.type === "image" ||
    node.type === "shape" ||
    node.type === "barcode" ||
    node.type === "qr" ||
    node.type === "stack" ||
    node.type === "repeat" ||
    node.type === "conditional" ||
    node.type === "grid" ||
    node.type === "group"
  );
}

export const defaultMeasurementProvider: MeasurementProvider = {
  measureText({ text, style, width }) {
    const fontSize = Math.max(4, style.fontSize);
    const lineHeight = resolveLineHeight(style);
    const averageCharacterWidth = Math.max(1, fontSize * getFontWidthFactor(style.fontFamily) + (style.letterSpacing ?? 0));
    const charactersPerLine = Math.max(1, Math.floor(width / averageCharacterWidth));
    const lines = text.split("\n").reduce((count, line) => {
      return count + Math.max(1, Math.ceil(line.length / charactersPerLine));
    }, 0);

    return {
      width,
      height: lines * lineHeight,
      lines
    };
  }
};

function resolveTextStyle(state: RenderState, style: TextStyle): TextStyle {
  if (!state.selectedFontFamily) {
    return style;
  }

  const selectedFont = state.fonts.find((font) => font.family === state.selectedFontFamily || font.id === state.selectedFontFamily);
  const fontFamily = selectedFont?.fallback
    ? `${quoteFontFamily(selectedFont.family)}, ${selectedFont.fallback}`
    : state.selectedFontFamily;

  return {
    ...style,
    fontFamily
  };
}

function normalizeFonts(fonts: FontDefinition[]): RenderFontDefinition[] {
  return fonts.map((font) => ({
    id: font.id,
    family: font.family,
    fallback: font.fallback,
    cssUrl: getFontCssUrl(font)
  }));
}

function getFontCssUrl(font: FontDefinition): string | undefined {
  if (!font.source || font.source.kind === "system") {
    return undefined;
  }

  if (font.source.kind === "css-url") {
    return font.source.url;
  }

  const family = font.source.family.trim().replace(/\s+/g, "+");
  const fontWeights = font.source.weights ?? font.weights;
  const weights = fontWeights?.length ? `:wght@${fontWeights.join(";")}` : "";
  const display = font.source.display ?? "swap";

  return `https://fonts.googleapis.com/css2?family=${family}${weights}&display=${display}`;
}

function quoteFontFamily(fontFamily: string): string {
  return /^[a-z0-9-]+$/i.test(fontFamily) ? fontFamily : `"${fontFamily.replace(/"/g, '\\"')}"`;
}

function getFontWidthFactor(fontFamily: string): number {
  const family = fontFamily.toLowerCase();

  if (family.includes("mono")) {
    return 0.6;
  }

  if (family.includes("playfair") || family.includes("georgia") || family.includes("serif")) {
    return 0.52;
  }

  if (family.includes("space grotesk")) {
    return 0.56;
  }

  return 0.54;
}

function resolveLineHeight(style: TextStyle): number {
  if (style.lineHeight == null) {
    return style.fontSize * 1.2;
  }

  if (style.lineHeight <= 4) {
    return style.fontSize * style.lineHeight;
  }

  return style.lineHeight;
}

function roundLayout(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled renderer value: ${JSON.stringify(value)}`);
}
