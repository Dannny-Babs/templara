import type {
  AssetDefinition,
  BarcodeNode,
  BindingRef,
  Box,
  ConditionalNode,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  ExpressionRef,
  FieldFormat,
  FieldRun,
  FlowNode,
  FlowRegionNode,
  FormulaExpression,
  FormulaOperand,
  FontDefinition,
  Frame,
  GridCellTemplate,
  GridNode,
  GridRowTemplate,
  GroupNode,
  ImageNode,
  ImageSource,
  InlineContent,
  PageTemplate,
  QrNode,
  RepeatNode,
  SectionNode,
  ShapeNode,
  StackNode,
  TextNode,
  TextStyle,
  VariableDefinition
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
  kind: "flow-region" | "section-frame" | "repeat-frame" | "repeat-row" | "page-break" | "measured-text";
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
  variableStack: string[];
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

type GridRowKind = "header" | "body" | "footer";

interface GridRowPlan {
  kind: GridRowKind;
  template: GridRowTemplate;
  scope: Scope;
  index: number;
  count: number;
  height: number;
}

const LAYOUT_EPSILON = 0.001;

const DEBUG_COLORS = {
  flowRegion: "#2563eb",
  sectionFrame: "#0891b2",
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
    repeatAnalyses: [],
    variableStack: []
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
        if (isHidden(state, node, emptyScope())) {
          continue;
        }

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
  if (isHidden(state, node, scope)) {
    return cursor;
  }

  if (node.type === "repeat") {
    return renderRepeatNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "section") {
    return renderSectionNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "stack") {
    return renderStackNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "conditional") {
    return renderConditionalNode(state, context, cursor, node, scope, origin);
  }

  if (node.type === "grid") {
    return renderGridNode(state, context, cursor, node, scope, origin);
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

function renderSectionNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: SectionNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  let nextCursor = cursor;

  if (node.behavior?.breakBefore === "page") {
    nextCursor = forceFlowPageBreak(state, context, nextCursor, node.id, "section break before", true);
  }

  const sectionHeight = measureSectionHeight(state, node, scope);
  const requiredHeight = Math.max(0, node.frame.y) + sectionHeight;

  if (node.behavior?.keepTogether) {
    nextCursor = ensureFlowSpace(state, context, nextCursor, requiredHeight, node.id);
  }

  const padding = sectionPadding(node);
  const gap = node.layout?.gap ?? 0;
  const sectionTop = nextCursor.y + node.frame.y;
  const sectionX = origin.x + node.frame.x;
  const startPageIndex = nextCursor.pageIndex;
  const startPage = state.pages[startPageIndex];
  // Capture where this section's content begins on the start page so the frame
  // can be inserted behind it after we know how far the content actually flows.
  const startContentIndex = startPage.children.length;

  let childCursor: FlowCursor = {
    pageIndex: startPageIndex,
    y: sectionTop + padding.top
  };

  for (const [index, child] of node.children.entries()) {
    childCursor = renderFlowNode(state, context, childCursor, child, scope, {
      x: sectionX + padding.left,
      y: 0
    });

    if (index < node.children.length - 1) {
      childCursor = { ...childCursor, y: childCursor.y + gap };
    }
  }

  const minimumEndY = childCursor.pageIndex === startPageIndex ? sectionTop + node.frame.height : childCursor.y;
  nextCursor = {
    pageIndex: childCursor.pageIndex,
    y: Math.max(childCursor.y + padding.bottom, minimumEndY)
  };

  paintFlowSectionFrames(state, context, node, {
    sectionX,
    sectionTop,
    sectionHeight,
    startPageIndex,
    startContentIndex,
    endPageIndex: childCursor.pageIndex,
    endBottomY: nextCursor.y
  });

  if (node.behavior?.breakAfter === "page") {
    return forceFlowPageBreak(state, context, nextCursor, node.id, "section break after", false);
  }

  return nextCursor;
}

function renderStackNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: StackNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  if (node.direction === "horizontal") {
    return renderHorizontalStackNode(state, context, cursor, node, scope, origin);
  }

  let nextCursor = {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y
  };

  for (const [index, child] of node.children.entries()) {
    nextCursor = renderFlowNode(state, context, nextCursor, child, scope, {
      x: origin.x + node.frame.x,
      y: 0
    });

    if (index < node.children.length - 1) {
      nextCursor = { ...nextCursor, y: nextCursor.y + node.gap };
    }
  }

  return nextCursor;
}

function renderHorizontalStackNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: StackNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const stackHeight = measureStackHeight(state, node, scope);
  const requiredHeight = Math.max(0, node.frame.y) + stackHeight;
  const stackCursor = ensureFlowSpace(state, context, cursor, requiredHeight, node.id);
  const page = state.pages[stackCursor.pageIndex];
  const stackOrigin = {
    x: origin.x + node.frame.x,
    y: stackCursor.y + node.frame.y
  };

  renderStackChildrenAbsolute(state, page, node, scope, stackOrigin);

  return {
    pageIndex: stackCursor.pageIndex,
    y: stackOrigin.y + stackHeight
  };
}

function renderConditionalNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: ConditionalNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const children = selectConditionalChildren(state, node, scope);
  const measuredHeight = measureConditionalHeight(state, node, scope);
  const requiredHeight = Math.max(0, node.frame.y) + measuredHeight;
  cursor = ensureFlowSpace(state, context, cursor, requiredHeight, node.id);
  let nextCursor: FlowCursor = {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y
  };

  for (const child of children ?? []) {
    nextCursor = renderFlowNode(state, context, nextCursor, child, scope, {
      x: origin.x + node.frame.x,
      y: 0
    });
  }

  return {
    pageIndex: nextCursor.pageIndex,
    y: Math.max(nextCursor.y, cursor.y + node.frame.y + measuredHeight)
  };
}

function renderRepeatNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: RepeatNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const value = resolveBinding(node.binding, state, scope);
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

  const headerChildren = node.header ?? [];
  const hasHeader = headerChildren.length > 0;
  const headerHeight = hasHeader
    ? measureRepeatRowHeight(state, { ...node, children: headerChildren }, scope)
    : 0;

  const baseRows = createRepeatRowPlans(state, node, scope, items);

  // Keep-together: if the whole block cannot fit here but would fit on a fresh
  // page, break before rendering anything so the repeat stays intact.
  if (node.layout.keepTogether && baseRows.length > 0) {
    const startPageBottom =
      nextCursor.pageIndex === context.initialPageIndex ? context.firstPageBottom : context.continuationBottom;
    const available = Math.max(0, startPageBottom - nextCursor.y);
    const continuationHeight = Math.max(0, context.continuationBottom - context.continuationTop);
    const blockHeight = repeatBlockHeight(headerHeight, baseRows, node.layout.gap, hasHeader);

    if (blockHeight > available + LAYOUT_EPSILON && blockHeight <= continuationHeight + LAYOUT_EPSILON) {
      nextCursor = forceFlowPageBreak(
        state,
        context,
        nextCursor,
        node.id,
        `repeat ${node.binding.path} keep-together`,
        true
      );
    }
  }

  // Render the initial header and advance the cursor before planning rows, so
  // fit optimization and analysis see the space the header consumes.
  if (hasHeader) {
    const candidate = ensureFlowSpace(state, context, nextCursor, headerHeight, node.id);
    nextCursor = renderRepeatHeaderRow(state, candidate, node, headerChildren, headerHeight, scope, origin);
  }

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
    if (hasHeader && node.layout.repeatHeaderOnPageBreak) {
      const repeatedHeaderBlockHeight = repeatHeaderBlockHeight(
        headerHeight,
        node.layout.gap,
        row.height
      );
      const candidate = ensureFlowSpace(state, context, nextCursor, row.height, node.id);

      if (candidate.pageIndex !== nextCursor.pageIndex) {
        nextCursor = canFitOnContinuationPage(context, repeatedHeaderBlockHeight)
          ? renderRepeatHeaderRow(state, candidate, node, headerChildren, headerHeight, scope, origin)
          : candidate;
        nextCursor = renderRepeatRow(state, context, nextCursor, node, row, origin);
        continue;
      }
    }

    nextCursor = renderRepeatRow(state, context, nextCursor, node, row, origin);
  }

  return nextCursor;
}

function repeatBlockHeight(
  headerHeight: number,
  rows: RepeatRowPlan[],
  gap: number,
  hasHeader: boolean
): number {
  const rowsHeight = rows.reduce((sum, row, index) => sum + row.height + (index > 0 ? gap : 0), 0);
  return (hasHeader ? headerHeight + gap : 0) + rowsHeight;
}

function repeatHeaderBlockHeight(
  headerHeight: number,
  gap: number,
  rowHeight: number
): number {
  return headerHeight + gap + rowHeight;
}

function renderRepeatHeaderRow(
  state: RenderState,
  cursor: FlowCursor,
  node: RepeatNode,
  headerChildren: FlowNode[],
  headerHeight: number,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const page = state.pages[cursor.pageIndex];
  const repeatX = origin.x + node.frame.x;

  addDebugBox(page, {
    sourceNodeId: node.id,
    kind: "repeat-row",
    frame: {
      x: repeatX,
      y: cursor.y,
      width: node.frame.width,
      height: headerHeight
    },
    label: "repeat header",
    color: DEBUG_COLORS.repeatRow
  });

  for (const child of headerChildren) {
    renderAbsoluteNode(state, page, child, scope, { x: repeatX, y: cursor.y });
  }

  return {
    pageIndex: cursor.pageIndex,
    y: cursor.y + headerHeight + node.layout.gap
  };
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

  const filteredItems = items.filter((item, index) => {
    const rowScope = createRepeatRowScope(scope, node, item, index, items.length);
    return shouldRenderRepeatItem(state, node, rowScope);
  });

  return filteredItems.map((item, index) => {
    const rowScope = createRepeatRowScope(scope, node, item, index, filteredItems.length);
    const fixedHeight = measureRepeatRowHeight(state, node, rowScope);
    const minimumHeight = measureRepeatRowMinimumHeight(state, node, rowScope);

    return {
      children: node.children,
      scope: rowScope,
      index,
      count: filteredItems.length,
      fixedHeight,
      minimumHeight,
      height: fixedHeight
    };
  });
}

function createRepeatRowScope(scope: Scope, node: RepeatNode, item: unknown, index: number, count: number): Scope {
  return extendScope(scope, {
    [node.itemAlias]: item,
    loop: {
      index,
      number: index + 1,
      isFirst: index === 0,
      isLast: index === count - 1
    }
  });
}

function shouldRenderRepeatItem(state: RenderState, node: RepeatNode, scope: Scope): boolean {
  if (state.mode === "template" || !node.logic?.repeatItemIf) {
    return true;
  }

  return evaluateExpression(node.logic.repeatItemIf, state, scope);
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

function renderGridNode(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: GridNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const bodyRows = createGridBodyRowPlans(state, node, scope, true, context.sourcePage.id);
  const headerRow = node.header ? createGridStaticRowPlan(state, node, node.header, scope, "header") : undefined;
  const footerRow = node.footer ? createGridStaticRowPlan(state, node, node.footer, scope, "footer") : undefined;
  let nextCursor: FlowCursor = {
    pageIndex: cursor.pageIndex,
    y: cursor.y + node.frame.y
  };

  if (headerRow) {
    nextCursor = renderGridRowAtCursor(state, context, nextCursor, node, headerRow, origin);
  }

  for (const row of bodyRows) {
    const repeatedHeaderBlockHeight =
      headerRow && node.behavior?.repeatHeaderOnPageBreak
        ? headerRow.height + row.height
        : row.height;
    const candidate = ensureGridRowSpace(state, context, nextCursor, node, row, origin);

    if (candidate.pageIndex !== nextCursor.pageIndex && headerRow && node.behavior?.repeatHeaderOnPageBreak) {
      nextCursor = canFitOnContinuationPage(context, repeatedHeaderBlockHeight)
        ? renderGridRowAtCursor(state, context, candidate, node, headerRow, origin)
        : candidate;
      nextCursor = renderGridRowAtCursor(state, context, nextCursor, node, row, origin);
      continue;
    }

    nextCursor = renderGridRowOnPage(state, candidate, node, row, origin);
  }

  if (footerRow) {
    nextCursor = renderGridRowAtCursor(state, context, nextCursor, node, footerRow, origin);
  }

  return nextCursor;
}

function createGridStaticRowPlan(
  state: RenderState,
  node: GridNode,
  template: GridRowTemplate,
  scope: Scope,
  kind: "header" | "footer"
): GridRowPlan {
  return {
    kind,
    template,
    scope,
    index: 0,
    count: 1,
    height: measureGridRowHeight(state, node, template, scope)
  };
}

function createGridBodyRowPlans(
  state: RenderState,
  node: GridNode,
  scope: Scope,
  emitWarning: boolean,
  pageId?: string
): GridRowPlan[] {
  const items = resolveGridItems(state, node, scope, emitWarning, pageId);

  return items.map((item, index) => {
    const rowScope = node.binding
      ? extendScope(scope, {
          item,
          row: item,
          loop: {
            index,
            number: index + 1,
            isFirst: index === 0,
            isLast: index === items.length - 1
          }
        })
      : scope;

    return {
      kind: "body",
      template: node.row,
      scope: rowScope,
      index,
      count: items.length,
      height: measureGridRowHeight(state, node, node.row, rowScope)
    };
  });
}

function resolveGridItems(
  state: RenderState,
  node: GridNode,
  scope: Scope,
  emitWarning: boolean,
  pageId?: string
): unknown[] {
  if (!node.binding) {
    return [undefined];
  }

  const value = resolveBinding(node.binding, state, scope);

  if (Array.isArray(value)) {
    return value;
  }

  if (emitWarning && state.mode !== "template") {
    state.warnings.push({
      code: "binding.grid_not_array",
      message: `Grid binding "${node.binding.path}" did not resolve to an array.`,
      nodeId: node.id,
      pageId
    });
  }

  return state.mode === "template" ? [{}] : [];
}

function ensureGridRowSpace(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: GridNode,
  row: GridRowPlan,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const candidate = ensureFlowSpace(state, context, cursor, row.height, node.id);

  if (candidate.pageIndex !== cursor.pageIndex) {
    addDebugBox(state.pages[cursor.pageIndex], {
      sourceNodeId: node.id,
      kind: "page-break",
      frame: {
        x: origin.x + node.frame.x,
        y: cursor.y,
        width: node.frame.width,
        height: 1
      },
      label: `page break before ${gridRowLabel(row)}`,
      color: DEBUG_COLORS.pageBreak
    });
  }

  return candidate;
}

function renderGridRowAtCursor(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  node: GridNode,
  row: GridRowPlan,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const candidate = ensureGridRowSpace(state, context, cursor, node, row, origin);
  return renderGridRowOnPage(state, candidate, node, row, origin);
}

function renderGridRowOnPage(
  state: RenderState,
  cursor: FlowCursor,
  node: GridNode,
  row: GridRowPlan,
  origin: Pick<Frame, "x" | "y">
): FlowCursor {
  const page = state.pages[cursor.pageIndex];
  const rowOrigin = {
    x: origin.x + node.frame.x,
    y: cursor.y
  };

  renderGridRow(state, page, node, row, rowOrigin);

  return {
    pageIndex: cursor.pageIndex,
    y: cursor.y + row.height
  };
}

function renderGridRow(
  state: RenderState,
  page: RenderPage,
  node: GridNode,
  row: GridRowPlan,
  origin: Pick<Frame, "x" | "y">
): void {
  let columnX = 0;

  for (const column of node.columns) {
    const cell = findGridCell(row.template, column.id);
    const cellOrigin = {
      x: origin.x + columnX,
      y: origin.y
    };

    if (cell?.style) {
      page.children.push({
        id: renderId(page, `${node.id}-${row.kind}-${row.index}-${column.id}-cell`),
        sourceNodeId: node.id,
        type: "shape",
        frame: {
          x: cellOrigin.x,
          y: cellOrigin.y,
          width: column.width,
          height: row.height
        },
        shape: "rectangle",
        fill: cell.style.fill,
        stroke: cell.style.stroke,
        strokeWidth: cell.style.strokeWidth,
        radius: cell.style.radius
      });
    }

    if (cell) {
      renderGridCellContent(state, page, node, cell, row.scope, cellOrigin);
    }

    columnX += column.width;
  }
}

function renderGridCellContent(
  state: RenderState,
  page: RenderPage,
  grid: GridNode,
  cell: GridCellTemplate,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  for (const child of cell.content) {
    renderGridCellNode(state, page, grid, child, scope, origin);
  }
}

function renderGridCellNode(
  state: RenderState,
  page: RenderPage,
  grid: GridNode,
  node: FlowNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  if (isHidden(state, node, scope)) {
    return;
  }

  if (node.type === "conditional") {
    const children = selectConditionalChildren(state, node, scope);

    for (const child of children) {
      renderGridCellNode(state, page, grid, child, scope, {
        x: origin.x + node.frame.x,
        y: origin.y + node.frame.y
      });
    }

    return;
  }

  if (node.type === "stack") {
    renderGridCellStack(state, page, grid, node, scope, origin);
    return;
  }

  if (node.type === "repeat" || node.type === "grid") {
    state.warnings.push({
      code: "grid.nested_flow_not_implemented",
      message: `Nested ${node.type} nodes inside grid cells are not supported yet.`,
      nodeId: node.id,
      pageId: page.id
    });
    return;
  }

  renderAbsoluteNode(state, page, node, scope, origin);
}

function renderGridCellStack(
  state: RenderState,
  page: RenderPage,
  grid: GridNode,
  node: StackNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  let offset = 0;
  const children = node.children.filter((child) => !isHidden(state, child, scope));

  for (const [index, child] of children.entries()) {
    const childOrigin =
      node.direction === "vertical"
        ? { x: origin.x + node.frame.x, y: origin.y + node.frame.y + offset }
        : { x: origin.x + node.frame.x + offset, y: origin.y + node.frame.y };

    renderGridCellNode(state, page, grid, child, scope, childOrigin);
    offset += measureFlowNodeHeight(state, child, scope) + (index < children.length - 1 ? node.gap : 0);
  }
}

function findGridCell(row: GridRowTemplate, columnId: string): GridCellTemplate | undefined {
  return row.cells.find((cell) => cell.columnId === columnId);
}

function gridRowLabel(row: GridRowPlan): string {
  if (row.kind === "body") {
    return `grid row ${row.index + 1}`;
  }

  return `grid ${row.kind}`;
}

function sectionPadding(node: SectionNode): Box {
  return node.layout?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
}

interface FlowSectionFrameSpans {
  sectionX: number;
  sectionTop: number;
  sectionHeight: number;
  startPageIndex: number;
  startContentIndex: number;
  endPageIndex: number;
  endBottomY: number;
}

// Draws the section background/border on every page the section spans. A section
// that stays on one page gets a single frame at its measured height; a section
// that overflows draws a frame fragment per page (filling to the page's flow
// bottom on non-final pages) so the frame never desyncs from its content.
function paintFlowSectionFrames(
  state: RenderState,
  context: FlowContext,
  node: SectionNode,
  spans: FlowSectionFrameSpans
): void {
  const { sectionX, sectionTop, sectionHeight, startPageIndex, startContentIndex, endPageIndex, endBottomY } = spans;

  for (let pageIndex = startPageIndex; pageIndex <= endPageIndex; pageIndex += 1) {
    const page = state.pages[pageIndex];

    if (!page) {
      continue;
    }

    const top = pageIndex === startPageIndex ? sectionTop : context.continuationTop;
    let bottom: number;

    if (startPageIndex === endPageIndex) {
      bottom = sectionTop + sectionHeight;
    } else if (pageIndex === endPageIndex) {
      bottom = endBottomY;
    } else {
      bottom = pageIndex === context.initialPageIndex ? context.firstPageBottom : context.continuationBottom;
    }

    const height = Math.max(0, bottom - top);
    const insertIndex = pageIndex === startPageIndex ? startContentIndex : 0;
    const shape = buildSectionFrameShape(page, node, sectionX, top, height);

    if (shape) {
      page.children.splice(insertIndex, 0, shape);
    }

    addSectionFrameDebugBox(page, node, sectionX, top, height);
  }
}

function renderSectionFrame(
  page: RenderPage,
  node: SectionNode,
  origin: Pick<Frame, "x" | "y">,
  height: number
): void {
  const shape = buildSectionFrameShape(page, node, origin.x, origin.y, height);

  if (shape) {
    page.children.push(shape);
  }

  addSectionFrameDebugBox(page, node, origin.x, origin.y, height);
}

function buildSectionFrameShape(
  page: RenderPage,
  node: SectionNode,
  x: number,
  y: number,
  height: number
): RenderNode | undefined {
  if (!node.style) {
    return undefined;
  }

  return {
    id: renderId(page, `${node.id}-section-frame`),
    sourceNodeId: node.id,
    type: "shape",
    frame: {
      x,
      y,
      width: node.frame.width,
      height
    },
    rotation: node.rotation,
    opacity: node.opacity,
    shape: "rectangle",
    fill: node.style.fill,
    stroke: node.style.stroke,
    strokeWidth: node.style.strokeWidth,
    radius: node.style.radius
  };
}

function addSectionFrameDebugBox(
  page: RenderPage,
  node: SectionNode,
  x: number,
  y: number,
  height: number
): void {
  addDebugBox(page, {
    sourceNodeId: node.id,
    kind: "section-frame",
    frame: {
      x,
      y,
      width: node.frame.width,
      height
    },
    label: node.name ? `section ${node.name}` : "section",
    color: DEBUG_COLORS.sectionFrame
  });
}

function renderStackChildrenAbsolute(
  state: RenderState,
  page: RenderPage,
  node: StackNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  let cursor = 0;
  const children = node.children.filter((child) => !isHidden(state, child, scope));

  for (const [index, child] of children.entries()) {
    const childOrigin =
      node.direction === "horizontal"
        ? { x: origin.x + cursor, y: origin.y }
        : { x: origin.x, y: origin.y + cursor };

    renderStackChildAbsolute(state, page, child, scope, childOrigin);

    const childSize =
      node.direction === "horizontal"
        ? Math.max(0, child.frame.x) + measureFlowNodeWidth(state, child, scope)
        : Math.max(0, child.frame.y) + measureFlowNodeHeight(state, child, scope);
    cursor += childSize + (index < children.length - 1 ? node.gap : 0);
  }
}

function renderStackChildAbsolute(
  state: RenderState,
  page: RenderPage,
  node: FlowNode,
  scope: Scope,
  origin: Pick<Frame, "x" | "y">
): void {
  if (node.type === "repeat" || node.type === "grid") {
    state.warnings.push({
      code: "stack.nested_flow_not_implemented",
      message: `Nested ${node.type} nodes inside absolute stack layout are not supported yet.`,
      nodeId: node.id,
      pageId: page.id
    });
    return;
  }

  renderAbsoluteNode(state, page, node, scope, origin);
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

  const nextCursor = addFlowContinuationPage(state, context);

  state.warnings.push({
    code: "layout.page_break",
    message: `Moved node ${nodeId} to continuation page ${state.pages[nextCursor.pageIndex].id}.`,
    nodeId,
    pageId: state.pages[nextCursor.pageIndex].id
  });

  return nextCursor;
}

function canFitOnContinuationPage(
  context: FlowContext,
  requiredHeight: number
): boolean {
  const continuationHeight = context.continuationBottom - context.continuationTop;
  return requiredHeight <= continuationHeight + LAYOUT_EPSILON;
}

function forceFlowPageBreak(
  state: RenderState,
  context: FlowContext,
  cursor: FlowCursor,
  nodeId: string,
  reason: string,
  skipIfAlreadyAtPageTop: boolean
): FlowCursor {
  const pageTop = cursor.pageIndex === context.initialPageIndex ? context.region.frame.y : context.continuationTop;

  if (skipIfAlreadyAtPageTop && Math.abs(cursor.y - pageTop) <= LAYOUT_EPSILON) {
    return cursor;
  }

  const nextCursor = addFlowContinuationPage(state, context);

  state.warnings.push({
    code: "layout.page_break",
    message: `Created continuation page ${state.pages[nextCursor.pageIndex].id} for ${reason}.`,
    nodeId,
    pageId: state.pages[nextCursor.pageIndex].id
  });

  return nextCursor;
}

function addFlowContinuationPage(state: RenderState, context: FlowContext): FlowCursor {
  const continuationHeight = context.continuationBottom - context.continuationTop;
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
  if (isHidden(state, node, scope)) {
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

    // Shapes can act as containers: paint children relative to the shape's
    // top-left corner, on top of the shape fill/stroke (mirrors `group`).
    if (node.children) {
      for (const child of node.children) {
        renderAbsoluteNode(state, page, child, scope, {
          x: origin.x + node.frame.x,
          y: origin.y + node.frame.y
        });
      }
    }
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

  if (node.type === "conditional") {
    const children = selectConditionalChildren(state, node, scope);

    for (const child of children) {
      renderAbsoluteNode(state, page, child, scope, {
        x: origin.x + node.frame.x,
        y: origin.y + node.frame.y
      });
    }

    return;
  }

  if (node.type === "section") {
    const frame = offsetFrame(node.frame, origin, measureSectionHeight(state, node, scope));
    const padding = sectionPadding(node);
    renderSectionFrame(page, node, { x: frame.x, y: frame.y }, frame.height);

    for (const child of node.children) {
      renderAbsoluteNode(state, page, child, scope, {
        x: frame.x + padding.left,
        y: frame.y + padding.top
      });
    }

    return;
  }

  if (node.type === "stack") {
    const stackOrigin = {
      x: origin.x + node.frame.x,
      y: origin.y + node.frame.y
    };

    renderStackChildrenAbsolute(state, page, node, scope, stackOrigin);
    return;
  }

  if (node.type === "group") {
    for (const child of node.children) {
      renderAbsoluteNode(state, page, child, scope, {
        x: origin.x + node.frame.x,
        y: origin.y + node.frame.y
      });
    }

    return;
  }

  if (node.type === "repeat" || node.type === "grid") {
    state.warnings.push({
      code: "absolute.flow_not_implemented",
      message: `${node.type} nodes can only render inside flow layout in this version.`,
      nodeId: node.id,
      pageId: page.id
    });
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
  if (isHidden(state, node, scope)) {
    return 0;
  }

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

  if (node.type === "image" || node.type === "shape" || node.type === "barcode" || node.type === "qr") {
    return node.frame.height;
  }

  if (node.type === "grid") {
    return measureGridHeight(state, node, scope);
  }

  if (node.type === "section") {
    return measureSectionHeight(state, node, scope);
  }

  if (node.type === "group") {
    return measureGroupHeight(state, node, scope);
  }

  if (node.type === "stack") {
    return measureStackHeight(state, node, scope);
  }

  if (node.type === "conditional") {
    return measureConditionalHeight(state, node, scope);
  }

  if (node.type === "repeat") {
    return measureRepeatRowHeight(state, node, scope);
  }

  return assertNever(node);
}

function measureStackHeight(state: RenderState, node: StackNode, scope: Scope): number {
  const children = node.children.filter((child) => !isHidden(state, child, scope));

  if (node.direction === "horizontal") {
    const childrenBottom = children.reduce((bottom, child) => {
      return Math.max(bottom, child.frame.y + measureFlowNodeHeight(state, child, scope));
    }, 0);

    return Math.max(node.frame.height, childrenBottom);
  }

  const childrenHeight = children.reduce((height, child, index) => {
    return height + (index === 0 ? 0 : node.gap) + Math.max(0, child.frame.y) + measureFlowNodeHeight(state, child, scope);
  }, 0);

  return Math.max(node.frame.height, childrenHeight);
}

function measureFlowNodeWidth(state: RenderState, node: FlowNode, scope: Scope): number {
  if (isHidden(state, node, scope)) {
    return 0;
  }

  if (node.type === "stack") {
    return measureStackWidth(state, node, scope);
  }

  if (node.type === "section") {
    return node.frame.width;
  }

  return node.frame.width;
}

function measureStackWidth(state: RenderState, node: StackNode, scope: Scope): number {
  const children = node.children.filter((child) => !isHidden(state, child, scope));

  if (node.direction === "vertical") {
    const childrenRight = children.reduce((right, child) => {
      return Math.max(right, child.frame.x + measureFlowNodeWidth(state, child, scope));
    }, 0);

    return Math.max(node.frame.width, childrenRight);
  }

  const childrenWidth = children.reduce((width, child, index) => {
    return width + (index === 0 ? 0 : node.gap) + Math.max(0, child.frame.x) + measureFlowNodeWidth(state, child, scope);
  }, 0);

  return Math.max(node.frame.width, childrenWidth);
}

function selectConditionalChildren(state: RenderState, node: ConditionalNode, scope: Scope): FlowNode[] {
  return evaluateExpression(node.condition, state, scope) ? node.children : (node.fallback ?? []);
}

function measureConditionalHeight(state: RenderState, node: ConditionalNode, scope: Scope): number {
  const children = selectConditionalChildren(state, node, scope).filter((child) => !isHidden(state, child, scope));
  const childrenBottom = children.reduce((bottom, child) => {
    return Math.max(bottom, Math.max(0, child.frame.y) + measureFlowNodeHeight(state, child, scope));
  }, 0);

  return Math.max(node.frame.height, childrenBottom);
}

function measureSectionHeight(state: RenderState, node: SectionNode, scope: Scope): number {
  const padding = sectionPadding(node);
  const gap = node.layout?.gap ?? 0;
  const children = node.children.filter((child) => !isHidden(state, child, scope));
  const contentHeight = children.reduce((height, child, index) => {
    const childOffset = Math.max(0, child.frame.y);
    const childHeight = measureFlowNodeHeight(state, child, scope);
    return height + (index === 0 ? 0 : gap) + childOffset + childHeight;
  }, 0);

  return Math.max(node.frame.height, padding.top + contentHeight + padding.bottom);
}

function measureGridHeight(state: RenderState, node: GridNode, scope: Scope): number {
  const headerHeight = node.header ? measureGridRowHeight(state, node, node.header, scope) : 0;
  const bodyRows = createGridBodyRowPlans(state, node, scope, false);
  const bodyHeight = bodyRows.reduce((height, row) => height + row.height, 0);
  const footerHeight = node.footer ? measureGridRowHeight(state, node, node.footer, scope) : 0;

  return Math.max(node.frame.height, headerHeight + bodyHeight + footerHeight);
}

function measureGridRowHeight(
  state: RenderState,
  node: GridNode,
  template: GridRowTemplate,
  scope: Scope
): number {
  const contentBottom = template.cells.reduce((rowBottom, cell) => {
    const cellBottom = cell.content.reduce((bottom, child) => {
      if (isHidden(state, child, scope)) {
        return bottom;
      }

      const childHeight = measureFlowNodeHeight(state, child, scope);
      return Math.max(bottom, child.frame.y + childHeight);
    }, 0);

    return Math.max(rowBottom, cellBottom);
  }, 0);

  return Math.max(node.rowHeight, contentBottom);
}

function measureRepeatRowHeight(state: RenderState, node: RepeatNode, scope: Scope): number {
  const childrenBottom = node.children.reduce((bottom, child) => {
    if (isHidden(state, child, scope)) {
      return bottom;
    }

    const childHeight = measureFlowNodeHeight(state, child, scope);
    return Math.max(bottom, child.frame.y + childHeight);
  }, 0);

  return Math.max(node.frame.height, childrenBottom);
}

function measureRepeatRowMinimumHeight(state: RenderState, node: RepeatNode, scope: Scope): number {
  const childrenBottom = node.children.reduce((bottom, child) => {
    if (isHidden(state, child, scope)) {
      return bottom;
    }

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
    if (isHidden(state, child, scope)) {
      return bottom;
    }

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

  const value = resolveBinding(field.binding, state, scope);

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

    const resolved = resolveBinding(value.binding, state, scope);
    return resolved == null ? "" : String(resolved);
  }

  if (value.kind === "formula") {
    return state.mode === "template" ? "{{formula}}" : String(resolveFormulaExpression(value.formula, state, scope, nodeId) ?? "");
  }

  return resolveInlineContent(value.parts, state, scope, nodeId);
}

function resolveImageSource(state: RenderState, source: ImageSource, scope: Scope): { src: string; placeholder?: string } {
  if (source.kind === "url") {
    return { src: sanitizeImageUrl(source.url, state, source.url) };
  }

  if (source.kind === "asset") {
    const asset = state.assets.get(source.assetId)?.source ?? "";
    return { src: sanitizeImageUrl(asset, state, source.assetId) };
  }

  if (state.mode === "template") {
    return { src: "", placeholder: bindingPlaceholder(source.binding) };
  }

  const value = resolveBinding(source.binding, state, scope);
  return {
    src: value == null ? "" : sanitizeImageUrl(String(value), state, source.binding.path),
  };
}

/**
 * Only allow image sources that cannot execute script. Permits http(s), inline
 * `data:image/*`, protocol-relative, and same-origin/relative paths. Anything
 * else (javascript:, vbscript:, file:, non-image data:, etc.) is dropped and a
 * warning is recorded so untrusted data cannot inject an active URL.
 */
export function sanitizeImageUrl(
  url: string,
  state?: { warnings: RenderWarning[] },
  sourceRef?: string,
): string {
  const trimmed = url.trim();

  if (trimmed === "") {
    return "";
  }

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);

  if (!schemeMatch) {
    // No scheme: relative path, absolute path, protocol-relative, or fragment.
    return trimmed;
  }

  const scheme = schemeMatch[1].toLowerCase();
  const allowed =
    scheme === "http" ||
    scheme === "https" ||
    (scheme === "data" && /^data:image\//i.test(trimmed));

  if (allowed) {
    return trimmed;
  }

  state?.warnings.push({
    code: "image.unsafe-url",
    message: `Blocked unsafe image source scheme "${scheme}:"${sourceRef ? ` from ${sourceRef}` : ""}.`,
  });

  return "";
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

  if (value.kind === "formula") {
    return true;
  }

  return false;
}

function inlineContentHasBinding(content: InlineContent[]): boolean {
  return content.some((part) => part.kind === "field");
}

function resolveBinding(binding: BindingRef, state: RenderState, scope: Scope): unknown {
  return resolvePath(binding.path, state, scope);
}

function evaluateExpression(expression: ExpressionRef, state: RenderState, scope: Scope): boolean {
  const value = resolvePath(expression.source, state, scope);
  const comparison = expression.compareSource ? resolvePath(expression.compareSource, state, scope) : expression.value;

  switch (expression.operator ?? "truthy") {
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    case "exists":
      return value != null && value !== "";
    case "notExists":
      return value == null || value === "";
    case "equals":
      return valuesEqual(value, comparison);
    case "notEquals":
      return !valuesEqual(value, comparison);
    case "greaterThan":
      return compareNumbers(value, comparison, (left, right) => left > right);
    case "greaterThanOrEqual":
      return compareNumbers(value, comparison, (left, right) => left >= right);
    case "lessThan":
      return compareNumbers(value, comparison, (left, right) => left < right);
    case "lessThanOrEqual":
      return compareNumbers(value, comparison, (left, right) => left <= right);
    case "contains":
      return valueContains(value, comparison);
    case "notContains":
      return !valueContains(value, comparison);
    default:
      return false;
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    return new Date(String(left)).getTime() === new Date(String(right)).getTime();
  }

  if (Object.is(left, right)) {
    return true;
  }

  // Coerce across types the same way the numeric comparison operators do, so a
  // numeric-looking string ("30") equals its number (30). Guarded to genuinely
  // numeric-looking values so "" / null / booleans do not collapse to 0.
  if (isNumericLike(left) && isNumericLike(right)) {
    return Number(left) === Number(right);
  }

  return false;
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim() !== "" && Number.isFinite(Number(value));
  }

  return false;
}

function compareNumbers(
  left: unknown,
  right: unknown,
  predicate: (left: number, right: number) => boolean
): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && predicate(leftNumber, rightNumber);
}

function valueContains(value: unknown, needle: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(String(needle ?? ""));
  }

  if (Array.isArray(value)) {
    return value.some((item) => valuesEqual(item, needle));
  }

  return false;
}

function resolvePath(path: string, state: RenderState, scope: Scope): unknown {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.unsafeSegment) {
    state.warnings.push({
      code: "binding.unsafe_path",
      message: `Rejected unsafe binding path "${path}" because it contains "${normalizedPath.unsafeSegment}".`
    });
    return undefined;
  }

  const [root, ...rest] = normalizedPath.parts;

  if (!root) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(scope.values, root)) {
    return getPath(scope.values[root], rest);
  }

  if (root === "variables") {
    const [variableKey, ...variableRest] = rest;
    return variableKey ? getPath(resolveVariableValue(variableKey, state, scope), variableRest) : undefined;
  }

  if (Object.prototype.hasOwnProperty.call(state.data, root)) {
    return getPath(state.data[root], rest);
  }

  const variableValue = resolveVariableValue(root, state, scope);
  return variableValue === undefined ? undefined : getPath(variableValue, rest);
}

function resolveVariableValue(key: string, state: RenderState, scope: Scope): unknown {
  const variable = findVariableDefinition(key, state.template.variables ?? []);

  if (!variable) {
    return undefined;
  }

  if (state.variableStack.includes(variable.id)) {
    state.warnings.push({
      code: "variable.cycle",
      message: `Variable "${variable.id}" references itself through another variable.`,
      nodeId: variable.id
    });
    return undefined;
  }

  state.variableStack.push(variable.id);

  try {
    return resolveVariableDynamicValue(variable.value, state, scope, variable);
  } finally {
    state.variableStack.pop();
  }
}

function resolveVariableDynamicValue(
  value: DynamicValue,
  state: RenderState,
  scope: Scope,
  variable: VariableDefinition
): unknown {
  if (value.kind === "literal") {
    return value.value;
  }

  if (value.kind === "binding") {
    if (state.mode === "template") {
      return bindingPlaceholder(value.binding);
    }

    return resolveBinding(value.binding, state, scope);
  }

  if (value.kind === "formula") {
    if (state.mode === "template") {
      return `{{${variable.id}}}`;
    }

    return resolveFormulaExpression(value.formula, state, scope, variable.id);
  }

  return resolveInlineContent(value.parts, state, scope, `variable:${variable.id}`);
}

function findVariableDefinition(key: string, variables: VariableDefinition[]): VariableDefinition | undefined {
  return variables.find((variable) => variable.id === key) ?? variables.find((variable) => variable.name === key);
}

function resolveFormulaExpression(
  formula: FormulaExpression,
  state: RenderState,
  scope: Scope,
  variableId: string
): unknown {
  switch (formula.op) {
    case "sum": {
      const values = resolveFormulaPathValues(formula.path, state, scope);
      return values.reduce<number>((sum, value) => {
        const number = Number(value);

        if (!Number.isFinite(number)) {
          state.warnings.push({
            code: "formula.invalid_number",
            message: `Formula variable "${variableId}" could not sum non-numeric value from "${formula.path}".`,
            nodeId: variableId
          });
          return sum;
        }

        return sum + number;
      }, 0);
    }

    case "count": {
      const value = resolvePath(formula.path, state, scope);

      if (Array.isArray(value)) {
        return value.length;
      }

      return resolveFormulaPathValues(formula.path, state, scope).filter((entry) => entry != null).length;
    }

    case "concat":
      return formula.parts.map((part) => String(resolveFormulaOperand(part, state, scope, variableId) ?? "")).join("");

    case "add":
    case "subtract":
    case "multiply":
    case "divide": {
      const left = resolveFormulaNumber(formula.left, state, scope, variableId);
      const right = resolveFormulaNumber(formula.right, state, scope, variableId);

      if (left == null || right == null) {
        return "";
      }

      if (formula.op === "add") return left + right;
      if (formula.op === "subtract") return left - right;
      if (formula.op === "multiply") return left * right;

      if (right === 0) {
        state.warnings.push({
          code: "formula.divide_by_zero",
          message: `Formula variable "${variableId}" attempted to divide by zero.`,
          nodeId: variableId
        });
        return "";
      }

      return left / right;
    }
  }
}

function resolveFormulaOperand(
  operand: FormulaOperand,
  state: RenderState,
  scope: Scope,
  variableId: string
): unknown {
  if (operand.kind === "literal") {
    return operand.value;
  }

  if (operand.kind === "variable") {
    return resolveVariableValue(operand.id, state, scope);
  }

  const value = resolvePath(operand.path, state, scope);

  if (value === undefined) {
    state.warnings.push({
      code: "formula.missing_path",
      message: `Formula variable "${variableId}" could not resolve path "${operand.path}".`,
      nodeId: variableId
    });
  }

  return value;
}

function resolveFormulaNumber(
  operand: FormulaOperand,
  state: RenderState,
  scope: Scope,
  variableId: string
): number | undefined {
  const value = resolveFormulaOperand(operand, state, scope, variableId);

  // Treat empty/missing operands as failures rather than silently coercing to 0
  // (Number("") === 0), which would otherwise mask upstream formula errors.
  const number = value === "" || value == null ? Number.NaN : Number(value);

  if (!Number.isFinite(number)) {
    state.warnings.push({
      code: "formula.invalid_number",
      message: `Formula variable "${variableId}" expected a numeric operand.`,
      nodeId: variableId
    });
    return undefined;
  }

  return number;
}

function resolveFormulaPathValues(path: string, state: RenderState, scope: Scope): unknown[] {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.unsafeSegment) {
    state.warnings.push({
      code: "formula.unsafe_path",
      message: `Rejected unsafe formula path "${path}" because it contains "${normalizedPath.unsafeSegment}".`
    });
    return [];
  }

  const [root, ...rest] = normalizedPath.parts;

  if (!root) {
    return [];
  }

  let value: unknown;

  if (Object.prototype.hasOwnProperty.call(scope.values, root)) {
    value = scope.values[root];
  } else if (root === "variables") {
    const [variableKey, ...variableRest] = rest;
    const variableValue = variableKey ? resolveVariableValue(variableKey, state, scope) : undefined;
    return variableRest.length > 0 ? collectPathValues(variableValue, variableRest) : [variableValue];
  } else if (Object.prototype.hasOwnProperty.call(state.data, root)) {
    value = state.data[root];
  } else {
    value = resolveVariableValue(root, state, scope);
  }

  return collectPathValues(value, rest);
}

function collectPathValues(value: unknown, parts: string[]): unknown[] {
  if (parts.length === 0) {
    return Array.isArray(value) ? value : [value];
  }

  if (value == null) {
    return [];
  }

  const [part, ...rest] = parts;

  if (Array.isArray(value)) {
    const numericIndex = Number(part);

    if (Number.isInteger(numericIndex)) {
      return collectPathValues(value[numericIndex], rest);
    }

    return value.flatMap((item) => collectPathValues(item, parts));
  }

  if (typeof value !== "object") {
    return [];
  }

  return collectPathValues((value as Record<string, unknown>)[part], rest);
}

function normalizePath(path: string): {
  parts: string[];
  unsafeSegment?: string;
} {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/\[\]/g, "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const unsafeSegment = parts.find((part) => !isSafePathSegment(part));

  return unsafeSegment ? { parts: [], unsafeSegment } : { parts };
}

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isSafePathSegment(segment: string): boolean {
  return !UNSAFE_PATH_SEGMENTS.has(segment);
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

    // Guard against prototype-pollution / prototype-chain reads from
    // untrusted data paths: only traverse own, non-dangerous keys.
    if (!isSafePathSegment(part) || !Object.prototype.hasOwnProperty.call(current, part)) {
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

function isHidden(state: RenderState, node: DocNode | FlowNode, scope: Scope): boolean {
  if (node.visible === false) {
    return true;
  }

  if (state.mode === "template") {
    return false;
  }

  return Boolean(node.logic?.visibleIf && !evaluateExpression(node.logic.visibleIf, state, scope));
}

function isFlowNode(node: DocNode): node is FlowNode {
  return (
    node.type === "text" ||
    node.type === "image" ||
    node.type === "shape" ||
    node.type === "barcode" ||
    node.type === "qr" ||
    node.type === "section" ||
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
