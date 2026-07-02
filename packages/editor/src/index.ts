import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent, ReactElement, ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AlignBottomIcon,
  AlignHorizontalCenterIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
  AlignVerticalDistributeCenterIcon,
  BarcodeIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  Copy01Icon,
  CursorPointer02Icon,
  Download01Icon,
  FileChartColumnIcon,
  FrameIcon,
  GridIcon,
  GridTableIcon,
  Image01Icon,
  Link01Icon,
  LineIcon,
  MagnetIcon,
  Maximize01Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  QrCodeIcon,
  RepeatIcon,
  Redo03Icon,
  RefreshIcon,
  RulerIcon,
  SignatureIcon,
  SquareIcon,
  Target02Icon,
  TypeCursorIcon,
  Undo03Icon,
  ViewIcon
} from "@hugeicons-pro/core-stroke-rounded";
import type {
  BarcodeNode,
  DataField,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  FlowNode,
  Frame,
  GridNode,
  GroupNode,
  ImageNode,
  PageLayer,
  QrNode,
  RepeatNode,
  ShapeNode,
  TextNode
} from "@templara/core";
import { DocumentPreview } from "@templara/react-renderer";
import { renderDocument } from "@templara/renderer";
import type { AlignmentCommand, EditorNodeItem, EditorRenderNode, EditorVisual } from "./editorModel";
import {
  buildEditorPageModel,
  collectPageNodeItems,
  getAlignmentFramePatches,
  updateNodeById,
  updateNodesById
} from "./editorModel";

export type { AlignmentCommand, EditorPageModel, EditorRenderNode } from "./editorModel";
export { buildEditorPageModel, collectPageNodeItems, getAlignmentFramePatches } from "./editorModel";

const DEFAULT_ZOOM = 0.76;
const GRID_SIZE = 8;
const SNAP_THRESHOLD = 5;
const RULER_SIZE = 24;
const TOOLTIP_DELAY_MS = 420;
const UI_FONT_FAMILY = 'Geist, "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const UI_MONO_FONT_FAMILY = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export interface DocumentEditorProps {
  value: DocumentTemplate;
  data?: Record<string, unknown>;
  onChange?: (nextValue: DocumentTemplate) => void;
  initialPageId?: string;
  onActivePageChange?: (pageId: string) => void;
}

type EditableNode = DocNode | FlowNode;
type InsertTool =
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
  | "frame"
  | "signature";
type InspectorTab = "design" | "data" | "style";
type GuideAxis = "x" | "y";

interface DragState {
  nodeIds: string[];
  startClientX: number;
  startClientY: number;
  startFrames: Record<string, Frame>;
  startAbsoluteFrames: Record<string, Frame>;
}

interface ActiveGuide {
  axis: GuideAxis;
  value: number;
  label: string;
}

interface GuideDragState {
  axis: GuideAxis;
  index: number;
}

interface InsertToolDefinition {
  id: InsertTool;
  label: string;
  shortcut: string;
  icon: IconSvgElement;
}

interface LayerTreeRow {
  key: string;
  label: string;
  depth: number;
  kind: "page" | "section" | "node";
  iconSrc: string;
  nodeId?: string;
  pageId?: string;
}

const sidebarIcons = {
  barcode: "/icons/sidebar-barcode.svg",
  caret: "/icons/ant-design_caret-down-filled.svg",
  circle: "/icons/akar-icons_circle.svg",
  field: "/icons/Linear/Money/Tag.svg",
  frame: "/icons/akar-icons_square.svg",
  image: "/icons/akar-icons_square-1.svg",
  layout: "/icons/akar-icons_panel-split-row.svg",
  line: "/icons/link.svg",
  page: "/icons/akar-icons_square-2.svg",
  qr: "/icons/sidebar-qr-code.svg",
  status: "/icons/Ellipse%202.svg",
  table: "/icons/akar-icons_panel-split-row-2.svg",
  text: "/icons/carbon_text-small-caps.svg",
  textAlt: "/icons/carbon_text-small-caps-1.svg"
} as const;

const insertTools: InsertToolDefinition[] = [
  { id: "select", label: "Select", shortcut: "V", icon: CursorPointer02Icon },
  { id: "text", label: "Text", shortcut: "T", icon: TypeCursorIcon },
  { id: "image", label: "Image", shortcut: "I", icon: Image01Icon },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: SquareIcon },
  { id: "line", label: "Line", shortcut: "L", icon: LineIcon },
  { id: "shape", label: "Shape", shortcut: "O", icon: CircleIcon },
  { id: "barcode", label: "Barcode", shortcut: "B", icon: BarcodeIcon },
  { id: "qr", label: "QR Code", shortcut: "Q", icon: QrCodeIcon },
  { id: "table", label: "Table", shortcut: "G", icon: GridTableIcon },
  { id: "repeat", label: "Repeat", shortcut: "E", icon: RepeatIcon },
  { id: "frame", label: "Frame", shortcut: "F", icon: FrameIcon },
  { id: "signature", label: "Signature", shortcut: "S", icon: SignatureIcon }
];

const alignmentCommands: Array<{ id: AlignmentCommand; icon: IconSvgElement; title: string }> = [
  { id: "align-left", icon: AlignLeftIcon, title: "Align left" },
  { id: "align-center-x", icon: AlignHorizontalCenterIcon, title: "Align horizontal center" },
  { id: "align-right", icon: AlignRightIcon, title: "Align right" },
  { id: "align-top", icon: AlignTopIcon, title: "Align top" },
  { id: "align-center-y", icon: AlignVerticalCenterIcon, title: "Align vertical center" },
  { id: "align-bottom", icon: AlignBottomIcon, title: "Align bottom" },
  { id: "distribute-x", icon: AlignHorizontalDistributeCenterIcon, title: "Distribute horizontal" },
  { id: "distribute-y", icon: AlignVerticalDistributeCenterIcon, title: "Distribute vertical" }
];

export function DocumentEditor({ value, data, onChange, initialPageId, onActivePageChange }: DocumentEditorProps): ReactElement {
  const [draftTemplate, setDraftTemplate] = useState<DocumentTemplate>(() => structuredClone(value));
  const [activePageId, setActivePageId] = useState<string>(() => initialPageId ?? value.pages[0]?.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<InsertTool>("select");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("design");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [verticalGuides, setVerticalGuides] = useState<number[]>([]);
  const [horizontalGuides, setHorizontalGuides] = useState<number[]>([]);
  const [activeGuides, setActiveGuides] = useState<ActiveGuide[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const guideDragState = useRef<GuideDragState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextTemplate = structuredClone(value);
    const nextPageId = initialPageId ?? nextTemplate.pages[0]?.id ?? "";

    setDraftTemplate(nextTemplate);
    setActivePageId(nextPageId);
    setSelectedNodeIds([]);
    setVerticalGuides([]);
    setHorizontalGuides([]);
  }, [initialPageId, value]);

  useEffect(() => {
    if (!draftTemplate.pages.some((page) => page.id === activePageId)) {
      const fallbackPageId = draftTemplate.pages[0]?.id ?? "";
      setActivePageId(fallbackPageId);
      onActivePageChange?.(fallbackPageId);
    }
  }, [activePageId, draftTemplate.pages, onActivePageChange]);

  const pageModel = useMemo(() => buildEditorPageModel(draftTemplate, activePageId), [activePageId, draftTemplate]);
  const nodeItems = useMemo(() => collectPageNodeItems(draftTemplate, activePageId), [activePageId, draftTemplate]);
  const itemLookup = useMemo(() => new Map(nodeItems.map((item) => [item.id, item])), [nodeItems]);
  const selectedItems = selectedNodeIds.map((id) => itemLookup.get(id)).filter((item): item is EditorNodeItem => Boolean(item));
  const primarySelectedItem = selectedItems[0];
  const previewDocument = useMemo(() => renderDocument({ template: draftTemplate, data, mode: "preview" }), [data, draftTemplate]);
  const fontImports = useMemo(() => buildFontImports(draftTemplate), [draftTemplate]);

  useEffect(() => {
    setInspectorTab("design");
  }, [primarySelectedItem?.id]);

  useEffect(() => {
    setSelectedNodeIds((ids) => ids.filter((id) => itemLookup.has(id)));
  }, [itemLookup]);

  useEffect(() => {
    if (!fontImports || typeof window === "undefined") {
      return;
    }

    const styleId = "templara-editor-fonts";
    let styleElement = window.document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = window.document.createElement("style");
      styleElement.id = styleId;
      window.document.head.appendChild(styleElement);
    }

    styleElement.textContent = fontImports;
  }, [fontImports]);

  const commitTemplate = useCallback(
    (nextTemplate: DocumentTemplate) => {
      setDraftTemplate(nextTemplate);
      onChange?.(nextTemplate);
    },
    [onChange]
  );

  const updateFramePatches = useCallback(
    (patches: Record<string, Partial<Frame>>) => {
      const nextTemplate = structuredClone(draftTemplate);

      if (updateNodesById(nextTemplate, patches)) {
        commitTemplate(nextTemplate);
      }
    },
    [commitTemplate, draftTemplate]
  );

  const updateNode = useCallback(
    (nodeId: string, update: (node: EditableNode) => void) => {
      const nextTemplate = structuredClone(draftTemplate);

      if (updateNodeById(nextTemplate, nodeId, update)) {
        commitTemplate(nextTemplate);
      }
    },
    [commitTemplate, draftTemplate]
  );

  const setActivePage = useCallback(
    (pageId: string) => {
      setActivePageId(pageId);
      setSelectedNodeIds([]);
      onActivePageChange?.(pageId);
    },
    [onActivePageChange]
  );

  useEffect(() => {
    function handleToolShortcut(event: globalThis.KeyboardEvent): void {
      if (previewOpen || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const tagName = target?.tagName.toLowerCase();

      if (target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select") {
        return;
      }

      if (event.key === "Escape") {
        setActiveTool("select");
        return;
      }

      const nextTool = insertTools.find((tool) => tool.shortcut.toLowerCase() === event.key.toLowerCase());

      if (!nextTool) {
        return;
      }

      event.preventDefault();
      setActiveTool(nextTool.id);
    }

    window.addEventListener("keydown", handleToolShortcut);

    return () => {
      window.removeEventListener("keydown", handleToolShortcut);
    };
  }, [previewOpen]);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent): void {
      if (guideDragState.current) {
        updateDraggedGuide(event, guideDragState.current, boardRef.current, zoom, setVerticalGuides, setHorizontalGuides);
        return;
      }

      const drag = dragState.current;

      if (!drag) {
        return;
      }

      const rawDelta = {
        x: (event.clientX - drag.startClientX) / zoom,
        y: (event.clientY - drag.startClientY) / zoom
      };
      const snapped = snapMove(rawDelta, drag, nodeItems, pageModel.size, {
        snapToGrid,
        snapToGuides,
        verticalGuides,
        horizontalGuides
      });
      const patches: Record<string, Partial<Frame>> = {};

      for (const nodeId of drag.nodeIds) {
        const startFrame = drag.startFrames[nodeId];

        if (!startFrame) {
          continue;
        }

        patches[nodeId] = {
          x: roundFrameValue(startFrame.x + snapped.delta.x),
          y: roundFrameValue(startFrame.y + snapped.delta.y)
        };
      }

      setActiveGuides(snapped.guides);
      updateFramePatches(patches);
    }

    function handlePointerUp(): void {
      dragState.current = null;
      guideDragState.current = null;
      setActiveGuides([]);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [horizontalGuides, nodeItems, pageModel.size, snapToGrid, snapToGuides, updateFramePatches, verticalGuides, zoom]);

  const handleNodePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>, node: EditorRenderNode) => {
      event.stopPropagation();

      const nextSelection = getNextSelection(selectedNodeIds, node.sourceNodeId, event.shiftKey);
      const dragItems = nextSelection.map((id) => itemLookup.get(id)).filter((item): item is EditorNodeItem => Boolean(item));

      setSelectedNodeIds(nextSelection);
      dragState.current = {
        nodeIds: dragItems.map((item) => item.id),
        startClientX: event.clientX,
        startClientY: event.clientY,
        startFrames: Object.fromEntries(dragItems.map((item) => [item.id, item.frame])),
        startAbsoluteFrames: Object.fromEntries(dragItems.map((item) => [item.id, item.absoluteFrame]))
      };
    },
    [itemLookup, selectedNodeIds]
  );

  const handleLayerSelect = useCallback(
    (event: MouseEvent<HTMLElement>, nodeId: string) => {
      setSelectedNodeIds((ids) => getNextSelection(ids, nodeId, event.shiftKey));
    },
    []
  );

  const handlePagePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === "select") {
        setSelectedNodeIds([]);
        return;
      }

      const point = getPagePoint(event, zoom);
      const nextTemplate = structuredClone(draftTemplate);
      const node = createNodeForTool(activeTool, nextTemplate, snapPoint(point, snapToGrid));
      const page = nextTemplate.pages.find((candidate) => candidate.id === activePageId);
      const layer = page ? getWritableFixedLayer(page.layers) : undefined;

      if (!layer) {
        return;
      }

      layer.nodes.push(node);
      commitTemplate(nextTemplate);
      setSelectedNodeIds([node.id]);
      setActiveTool("select");
    },
    [activePageId, activeTool, commitTemplate, draftTemplate, snapToGrid, zoom]
  );

  const handleFrameChange = useCallback(
    (nodeId: string, patch: Partial<Frame>) => {
      const current = itemLookup.get(nodeId);

      if (!current) {
        return;
      }

      updateFramePatches({
        [nodeId]: {
          ...patch,
          x: patch.x == null ? undefined : snapCoordinate(patch.x, snapToGrid),
          y: patch.y == null ? undefined : snapCoordinate(patch.y, snapToGrid)
        }
      });
    },
    [itemLookup, snapToGrid, updateFramePatches]
  );

  const handleAlignment = useCallback(
    (command: AlignmentCommand) => {
      const patches = getAlignmentFramePatches(
        nodeItems.map((item) => ({ id: item.id, frame: item.frame, absoluteFrame: item.absoluteFrame })),
        selectedNodeIds,
        command,
        pageModel.size
      );

      updateFramePatches(patches);
    },
    [nodeItems, pageModel.size, selectedNodeIds, updateFramePatches]
  );

  const resetDraft = useCallback(() => {
    const nextTemplate = structuredClone(value);
    const nextPageId = initialPageId ?? nextTemplate.pages[0]?.id ?? "";

    setDraftTemplate(nextTemplate);
    setActivePageId(nextPageId);
    setSelectedNodeIds([]);
    setVerticalGuides([]);
    setHorizontalGuides([]);
    onChange?.(nextTemplate);
    onActivePageChange?.(nextPageId);
  }, [initialPageId, onActivePageChange, onChange, value]);

  const handleFitPage = useCallback(() => {
    const viewport = boardRef.current?.closest("[data-templara-editor-viewport]") as HTMLElement | null;

    if (!viewport) {
      setZoom(DEFAULT_ZOOM);
      return;
    }

    const availableWidth = Math.max(320, viewport.clientWidth - 112);
    const availableHeight = Math.max(320, viewport.clientHeight - 128);
    const rulerOffset = showRulers ? RULER_SIZE : 0;
    const nextZoom = Math.min(
      availableWidth / (pageModel.size.width + rulerOffset),
      availableHeight / (pageModel.size.height + rulerOffset),
      1
    );

    setZoom(clampZoom(nextZoom));
  }, [pageModel.size.height, pageModel.size.width, showRulers]);

  const activePageIndex = draftTemplate.pages.findIndex((page) => page.id === activePageId);
  const safeActivePageIndex = activePageIndex >= 0 ? activePageIndex : 0;
  const handlePageStep = useCallback(
    (delta: number) => {
      const nextPage = draftTemplate.pages[safeActivePageIndex + delta];

      if (nextPage) {
        setActivePage(nextPage.id);
      }
    },
    [draftTemplate.pages, safeActivePageIndex, setActivePage]
  );

  const handleInsertBinding = useCallback(
    (path: string) => {
      if (!primarySelectedItem) {
        return;
      }

      updateNode(primarySelectedItem.id, (node) => applyBindingPathToNode(node, path));
    },
    [primarySelectedItem, updateNode]
  );

  return createElement(
    "div",
    { style: shellStyle },
    createElement(TopToolbar, {
      templateName: draftTemplate.metadata?.name ? String(draftTemplate.metadata.name) : (pageModel.name || draftTemplate.id),
      pages: draftTemplate.pages,
      activePageId,
      zoom,
      selectedCount: selectedNodeIds.length,
      showGrid,
      showRulers,
      snapToGrid,
      snapToGuides,
      onSelectPage: setActivePage,
      onZoomChange: setZoom,
      onToggleGrid: () => setShowGrid((value) => !value),
      onToggleRulers: () => setShowRulers((value) => !value),
      onToggleSnapGrid: () => setSnapToGrid((value) => !value),
      onToggleSnapGuides: () => setSnapToGuides((value) => !value),
      onAlign: handleAlignment,
      onPreview: () => setPreviewOpen(true),
      onSave: () => onChange?.(draftTemplate),
      onReset: resetDraft
    }),
    createElement(ToolRail, { activeTool, onSelectTool: setActiveTool }),
    createElement(
      "aside",
      { style: leftPanelStyle },
      createElement(NodeLayerList, {
        pages: draftTemplate.pages,
        items: nodeItems,
        activePageId,
        selectedNodeIds,
        onSelectPage: setActivePage,
        onSelect: handleLayerSelect
      }),
      createElement(DataSchemaPanel, {
        template: draftTemplate,
        selectedNodeType: primarySelectedItem?.type,
        onInsertBinding: primarySelectedItem ? handleInsertBinding : undefined
      })
    ),
    createElement(
      "main",
      { style: mainStyle },
      createElement(EditorCanvas, {
        page: pageModel,
        zoom,
        showGrid,
        showRulers,
        snapToGuides,
        selectedNodeIds,
        activeGuides,
        verticalGuides,
        horizontalGuides,
        pageIndex: safeActivePageIndex,
        pageCount: draftTemplate.pages.length,
        boardRef,
        onZoomChange: setZoom,
        onFitPage: handleFitPage,
        onToggleGrid: () => setShowGrid((value) => !value),
        onToggleRulers: () => setShowRulers((value) => !value),
        onToggleGuides: () => setSnapToGuides((value) => !value),
        onPreviousPage: () => handlePageStep(-1),
        onNextPage: () => handlePageStep(1),
        onNodePointerDown: handleNodePointerDown,
        onPagePointerDown: handlePagePointerDown,
        onStartGuideDrag: (axis, index) => {
          guideDragState.current = { axis, index };
        }
      })
    ),
    createElement(
      "aside",
      { style: rightPanelStyle },
      createElement(PanelHeader, {
        title: primarySelectedItem ? inspectorTitleForItem(primarySelectedItem) : "Page Settings",
        detail: selectedItems.length === 0 ? "No selection" : `${selectedItems.length} selected · ${primarySelectedItem?.type ?? ""}`
      }),
      primarySelectedItem
        ? createElement(NodeInspector, {
            item: primarySelectedItem,
            selectedCount: selectedItems.length,
            activeTab: inspectorTab,
            onTabChange: setInspectorTab,
            onFrameChange: (framePatch) => handleFrameChange(primarySelectedItem.id, framePatch),
            onNodeUpdate: (update) => updateNode(primarySelectedItem.id, update)
          })
        : createElement(PageSettingsPanel, {
            page: pageModel,
            showGrid,
            showRulers,
            snapToGrid,
            snapToGuides,
            onToggleGrid: () => setShowGrid((value) => !value),
            onToggleRulers: () => setShowRulers((value) => !value),
            onToggleSnapGrid: () => setSnapToGrid((value) => !value),
            onToggleSnapGuides: () => setSnapToGuides((value) => !value)
          })
    ),
    previewOpen
      ? createElement(PreviewOverlay, {
          document: previewDocument,
          onClose: () => setPreviewOpen(false)
        })
      : null
  );
}

function ToolRail({ activeTool, onSelectTool }: { activeTool: InsertTool; onSelectTool: (tool: InsertTool) => void }): ReactElement {
  const [tooltipTool, setTooltipTool] = useState<InsertTool | null>(null);
  const tooltipTimer = useRef<number | null>(null);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimer.current != null) {
      window.clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
  }, []);

  const queueTooltip = useCallback(
    (tool: InsertTool) => {
      clearTooltipTimer();
      tooltipTimer.current = window.setTimeout(() => {
        setTooltipTool(tool);
        tooltipTimer.current = null;
      }, TOOLTIP_DELAY_MS);
    },
    [clearTooltipTimer]
  );

  const hideTooltip = useCallback(() => {
    clearTooltipTimer();
    setTooltipTool(null);
  }, [clearTooltipTimer]);

  useEffect(() => () => clearTooltipTimer(), [clearTooltipTimer]);

  return createElement(
    "nav",
    { style: toolRailStyle, "aria-label": "Insert tools" },
    insertTools.map((tool) =>
      createElement(
        "button",
        {
          key: tool.id,
          type: "button",
          title: `${tool.label} (${tool.shortcut})`,
          onBlur: hideTooltip,
          onClick: () => onSelectTool(tool.id),
          onFocus: () => queueTooltip(tool.id),
          onMouseEnter: () => queueTooltip(tool.id),
          onMouseLeave: hideTooltip,
          style: {
            ...toolButtonStyle,
            position: "relative",
            background: activeTool === tool.id ? "#eef2ff" : "transparent",
            borderColor: activeTool === tool.id ? "#818cf8" : "transparent",
            color: activeTool === tool.id ? "#3730a3" : "#111827"
          }
        },
        createElement(ToolIcon, { icon: tool.icon, style: railIconStyle, size: 16 }),
        tooltipTool === tool.id
          ? createElement(
              "span",
              { style: toolTooltipStyle, role: "tooltip" },
              `${tool.label} (${tool.shortcut})`
            )
          : null
      )
    )
  );
}

function InsertPanel({ activeTool, onSelectTool }: { activeTool: InsertTool; onSelectTool: (tool: InsertTool) => void }): ReactElement {
  return createElement(
    "section",
    { style: insertPanelStyle },
    createElement(PanelHeader, { title: "Insert", detail: "" }),
    createElement(
      "div",
      { style: insertGridStyle },
      insertTools.map((tool) =>
        createElement(
          "button",
          {
            key: tool.id,
            type: "button",
            title: `${tool.label} (${tool.shortcut})`,
            onClick: () => onSelectTool(tool.id),
            style: {
              ...insertToolButtonStyle,
              background: activeTool === tool.id ? "#eff6ff" : "#ffffff",
              borderColor: activeTool === tool.id ? "#93c5fd" : "#e5e7eb",
              color: activeTool === tool.id ? "#1d4ed8" : "#1d2939"
            }
          },
          createElement(ToolIcon, { icon: tool.icon, style: insertToolIconStyle, size: 15 }),
          createElement("span", { style: insertToolLabelStyle }, tool.label)
        )
      )
    )
  );
}

function PagePanel({
  pages,
  activePageId,
  onSelectPage
}: {
  pages: DocumentTemplate["pages"];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
}): ReactElement {
  return createElement(
    "section",
    { style: pagesPanelStyle },
    createElement(PanelHeader, { title: "Pages", detail: `${pages.length}` }),
    createElement(
      "div",
      { style: pageListStyle },
      pages.map((page) =>
        createElement(
          "button",
          {
            key: page.id,
            type: "button",
            onClick: () => onSelectPage(page.id),
            style: {
              ...pageButtonStyle,
              background: page.id === activePageId ? "#eff6ff" : "transparent",
              borderColor: page.id === activePageId ? "#93c5fd" : "transparent"
            }
          },
          createElement("span", { style: layerNameStyle }, page.name ?? page.id),
          createElement("span", { style: layerMetaStyle }, `${page.size.width} x ${page.size.height}px`)
        )
      )
    )
  );
}

function TopToolbar({
  templateName,
  pages,
  activePageId,
  zoom,
  selectedCount,
  showGrid,
  showRulers,
  snapToGrid,
  snapToGuides,
  onSelectPage,
  onZoomChange,
  onToggleGrid,
  onToggleRulers,
  onToggleSnapGrid,
  onToggleSnapGuides,
  onAlign,
  onPreview,
  onSave,
  onReset
}: {
  templateName: string;
  pages: DocumentTemplate["pages"];
  activePageId: string;
  zoom: number;
  selectedCount: number;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  onSelectPage: (pageId: string) => void;
  onZoomChange: (zoom: number) => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleSnapGrid: () => void;
  onToggleSnapGuides: () => void;
  onAlign: (command: AlignmentCommand) => void;
  onPreview: () => void;
  onSave: () => void;
  onReset: () => void;
}): ReactElement {
  return createElement(
    "header",
    { style: topToolbarStyle },
    createElement(
      "div",
      { style: toolbarBrandGroupStyle },
      createElement("div", { style: brandMarkStyle }, "T"),
      createElement("div", { style: brandNameStyle }, "Templara"),
      createElement("div", { style: templateTitleStyle }, templateName),
      createElement("span", { style: statusPillStyle }, "Draft")
    ),
    createElement(
      "div",
      { style: toolbarCenterStyle },
      createElement(
        "div",
        { style: toolbarClusterStyle },
        createElement(ToolbarButton, { icon: Undo03Icon, title: "Undo", disabled: true, onClick: () => undefined, compact: true }),
        createElement(ToolbarButton, { icon: Redo03Icon, title: "Redo", disabled: true, onClick: () => undefined, compact: true })
      ),
      createElement(
        "div",
        { style: toolbarClusterStyle },
        createElement(
          "select",
          {
            value: activePageId,
            onChange: (event) => onSelectPage((event.currentTarget as HTMLSelectElement).value),
            style: selectStyle,
            "aria-label": "Active page"
          },
          pages.map((page) => createElement("option", { key: page.id, value: page.id }, page.name ?? page.id))
        )
      ),
      createElement(
        "div",
        { style: toolbarClusterStyle },
        createElement(ToolbarButton, {
          icon: MinusSignIcon,
          title: "Zoom out",
          onClick: () => onZoomChange(clampZoom(zoom - 0.1)),
          compact: true
        }),
        createElement("span", { style: zoomLabelStyle }, `${Math.round(zoom * 100)}%`),
        createElement(ToolbarButton, {
          icon: Add01Icon,
          title: "Zoom in",
          onClick: () => onZoomChange(clampZoom(zoom + 0.1)),
          compact: true
        })
      ),
      createElement(
        "div",
        { style: toolbarClusterStyle },
        createElement(ToggleButton, { icon: GridIcon, title: "Toggle grid", active: showGrid, onClick: onToggleGrid }),
        createElement(ToggleButton, { icon: RulerIcon, title: "Toggle rulers", active: showRulers, onClick: onToggleRulers }),
        createElement(ToggleButton, { icon: MagnetIcon, title: "Toggle snap to grid", active: snapToGrid, onClick: onToggleSnapGrid }),
        createElement(ToggleButton, { icon: Target02Icon, title: "Toggle guides", active: snapToGuides, onClick: onToggleSnapGuides })
      ),
      selectedCount > 0
        ? createElement(
            "div",
            { style: toolbarClusterStyle },
            alignmentCommands.map((command) =>
              createElement(ToolbarButton, {
                key: command.id,
                icon: command.icon,
                title: command.title,
                disabled: (command.id === "distribute-x" || command.id === "distribute-y") && selectedCount < 3,
                onClick: () => onAlign(command.id),
                compact: true
              })
            )
          )
        : null
    ),
    createElement(
      "div",
      { style: toolbarGroupStyle },
      createElement(PreviewDropdown, { onPreview }),
      createElement(MoreOptionsDropdown, { onReset }),
      createElement(ToolbarButton, { label: "Save", title: "Save template", onClick: onSave, variant: "primary" })
    )
  );
}

function PreviewDropdown({ onPreview }: { onPreview: () => void }): ReactElement {
  const [open, setOpen] = useState(false);

  const runPreview = (): void => {
    setOpen(false);
    onPreview();
  };

  return createElement(
    "div",
    { style: dropdownWrapStyle },
    createElement(
      "div",
      { style: splitButtonStyle },
      createElement(
        "button",
        {
          type: "button",
          title: "Preview rendered document",
          onClick: runPreview,
          style: previewMainButtonStyle
        },
        createElement(ToolIcon, { icon: ViewIcon, style: toolbarIconStyle, size: 16 }),
        createElement("span", null, "Preview")
      ),
      createElement(
        "button",
        {
          type: "button",
          title: "Preview options",
          onClick: () => setOpen((value) => !value),
          style: previewChevronButtonStyle
        },
        createElement(ToolIcon, { icon: ChevronDownIcon, style: toolbarIconStyle, size: 14 })
      )
    ),
    open
      ? createElement(
          "div",
          { style: toolbarDropdownStyle },
          createElement(DropdownItem, { label: "Preview with sample data", detail: "Open rendered preview", onClick: runPreview }),
          createElement(DropdownItem, { label: "Preview with large data", detail: "Stress repeat pagination", onClick: runPreview }),
          createElement(DropdownItem, { label: "Export PDF", detail: "Preview first, export later", disabled: true, onClick: () => undefined }),
          createElement(DropdownItem, { label: "Export PNG / HTML", detail: "Coming soon", disabled: true, onClick: () => undefined }),
          createElement(DropdownItem, { label: "Render diagnostics", detail: "Use preview debug output", onClick: runPreview })
        )
      : null
  );
}

function MoreOptionsDropdown({ onReset }: { onReset: () => void }): ReactElement {
  const [open, setOpen] = useState(false);

  return createElement(
    "div",
    { style: dropdownWrapStyle },
    createElement(ToolbarButton, {
      icon: MoreHorizontalIcon,
      title: "More options",
      onClick: () => setOpen((value) => !value),
      compact: true,
      variant: "ghost"
    }),
    open
      ? createElement(
          "div",
          { style: toolbarDropdownStyle },
          createElement(DropdownItem, {
            label: "Reset template edits",
            detail: "Restore the initial template",
            onClick: () => {
              setOpen(false);
              onReset();
            }
          })
        )
      : null
  );
}

function DropdownItem({
  label,
  detail,
  disabled,
  onClick
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      disabled,
      onClick,
      style: {
        ...dropdownItemStyle,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }
    },
    createElement("span", { style: dropdownItemLabelStyle }, label),
    createElement("span", { style: dropdownItemDetailStyle }, detail)
  );
}

function EditorCanvas({
  page,
  zoom,
  showGrid,
  showRulers,
  snapToGuides,
  selectedNodeIds,
  activeGuides,
  verticalGuides,
  horizontalGuides,
  pageIndex,
  pageCount,
  boardRef,
  onZoomChange,
  onFitPage,
  onToggleGrid,
  onToggleRulers,
  onToggleGuides,
  onPreviousPage,
  onNextPage,
  onNodePointerDown,
  onPagePointerDown,
  onStartGuideDrag
}: {
  page: ReturnType<typeof buildEditorPageModel>;
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;
  snapToGuides: boolean;
  selectedNodeIds: string[];
  activeGuides: ActiveGuide[];
  verticalGuides: number[];
  horizontalGuides: number[];
  pageIndex: number;
  pageCount: number;
  boardRef: React.RefObject<HTMLDivElement | null>;
  onZoomChange: (zoom: number) => void;
  onFitPage: () => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleGuides: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onNodePointerDown: (event: PointerEvent<HTMLElement>, node: EditorRenderNode) => void;
  onPagePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onStartGuideDrag: (axis: GuideAxis, index: number) => void;
}): ReactElement {
  const rulerSize = showRulers ? RULER_SIZE : 0;

  return createElement(
    "section",
    { style: canvasViewportStyle, "data-templara-editor-viewport": "true" },
    createElement(
      "div",
      {
        ref: boardRef,
        style: {
          ...canvasBoardStyle,
          width: rulerSize + page.size.width * zoom,
          height: rulerSize + page.size.height * zoom
        }
      },
      showRulers
        ? [
            createElement("div", { key: "corner", style: rulerCornerStyle }),
            createElement(Ruler, { key: "top-ruler", axis: "x", length: page.size.width, zoom }),
            createElement(Ruler, { key: "left-ruler", axis: "y", length: page.size.height, zoom })
          ]
        : null,
      createElement(
        "div",
        {
          style: {
            ...scaledPageWrapStyle,
            left: rulerSize,
            top: rulerSize,
            width: page.size.width * zoom,
            height: page.size.height * zoom
          }
        },
        createElement("div", {
          style: {
            ...pageBadgeStyle,
            left: 0,
            top: -24
          },
          children: `${page.name} / ${page.size.width} x ${page.size.height}`
        }),
        createElement(
          "div",
          {
            "data-templara-editor-page-id": page.id,
            onPointerDown: onPagePointerDown,
            style: {
              ...pageCanvasStyle,
              width: page.size.width,
              height: page.size.height,
              transform: `scale(${zoom})`,
              backgroundImage: showGrid ? gridBackgroundImage : undefined,
              backgroundSize: showGrid ? `${GRID_SIZE}px ${GRID_SIZE}px` : undefined
            }
          },
          page.margin ? createElement(MarginGuideOverlay, { margin: page.margin, pageSize: page.size }) : null,
          page.nodes.map((node) =>
            createElement(EditorNodeView, {
              key: node.id,
              node,
              selected: selectedNodeIds.includes(node.sourceNodeId),
              onPointerDown: onNodePointerDown
            })
          ),
          createElement(SelectionOverlay, {
            nodes: page.nodes.filter((node) => selectedNodeIds.includes(node.sourceNodeId))
          })
        )
      ),
      verticalGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `v-guide-${index}`,
          axis: "x",
          value: guide,
          zoom,
          rulerSize,
          length: page.size.height,
          onPointerDown: () => onStartGuideDrag("x", index)
        })
      ),
      horizontalGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `h-guide-${index}`,
          axis: "y",
          value: guide,
          zoom,
          rulerSize,
          length: page.size.width,
          onPointerDown: () => onStartGuideDrag("y", index)
        })
      ),
      activeGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `active-${guide.axis}-${guide.value}-${index}`,
          axis: guide.axis,
          value: guide.value,
          zoom,
          rulerSize,
          length: guide.axis === "x" ? page.size.height : page.size.width,
          active: true
        })
      )
    ),
    createElement(CanvasDock, {
      zoom,
      showGrid,
      showRulers,
      snapToGuides,
      onZoomChange,
      onFitPage,
      onToggleGrid,
      onToggleRulers,
      onToggleGuides
    }),
    createElement(PageSwitcherDock, {
      pageName: page.name,
      pageIndex,
      pageCount,
      onPreviousPage,
      onNextPage
    })
  );
}

function CanvasDock({
  zoom,
  showGrid,
  showRulers,
  snapToGuides,
  onZoomChange,
  onFitPage,
  onToggleGrid,
  onToggleRulers,
  onToggleGuides
}: {
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;
  snapToGuides: boolean;
  onZoomChange: (zoom: number) => void;
  onFitPage: () => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleGuides: () => void;
}): ReactElement {
  return createElement(
    "div",
    { style: canvasDockStyle },
    createElement(ToolbarButton, {
      icon: MinusSignIcon,
      title: "Zoom out",
      onClick: () => onZoomChange(clampZoom(zoom - 0.1)),
      compact: true
    }),
    createElement("span", { style: canvasDockZoomStyle }, `${Math.round(zoom * 100)}%`),
    createElement(ToolbarButton, {
      icon: Add01Icon,
      title: "Zoom in",
      onClick: () => onZoomChange(clampZoom(zoom + 0.1)),
      compact: true
    }),
    createElement("span", { style: dockSeparatorStyle }),
    createElement(ToolbarButton, { icon: Maximize01Icon, title: "Fit to page", onClick: onFitPage, compact: true }),
    createElement(ToggleButton, { icon: GridIcon, title: "Toggle grid", active: showGrid, onClick: onToggleGrid }),
    createElement(ToggleButton, { icon: RulerIcon, title: "Toggle rulers", active: showRulers, onClick: onToggleRulers }),
    createElement(ToggleButton, { icon: Target02Icon, title: "Toggle guides", active: snapToGuides, onClick: onToggleGuides })
  );
}

function PageSwitcherDock({
  pageName,
  pageIndex,
  pageCount,
  onPreviousPage,
  onNextPage
}: {
  pageName: string;
  pageIndex: number;
  pageCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}): ReactElement {
  return createElement(
    "div",
    { style: canvasPageControlStyle },
    createElement(ToolbarButton, {
      icon: ChevronLeftIcon,
      title: "Previous page",
      disabled: pageIndex <= 0,
      onClick: onPreviousPage,
      compact: true
    }),
    createElement(
      "span",
      { style: canvasPageControlLabelStyle },
      `${pageName} · Page ${pageIndex + 1} of ${Math.max(1, pageCount)}`
    ),
    createElement(ToolbarButton, {
      icon: ChevronRightIcon,
      title: "Next page",
      disabled: pageIndex >= pageCount - 1,
      onClick: onNextPage,
      compact: true
    }),
    createElement(ToolbarButton, { icon: Add01Icon, title: "Add page", disabled: true, onClick: () => undefined, compact: true })
  );
}

function MarginGuideOverlay({
  margin,
  pageSize
}: {
  margin: NonNullable<ReturnType<typeof buildEditorPageModel>["margin"]>;
  pageSize: ReturnType<typeof buildEditorPageModel>["size"];
}): ReactElement {
  return createElement("div", {
    "data-templara-margin-guides": "true",
    style: {
      position: "absolute",
      left: margin.left,
      top: margin.top,
      width: pageSize.width - margin.left - margin.right,
      height: pageSize.height - margin.top - margin.bottom,
      border: "1px dashed rgba(37, 99, 235, 0.32)",
      pointerEvents: "none",
      zIndex: 1
    }
  });
}

function SelectionOverlay({ nodes }: { nodes: EditorRenderNode[] }): ReactElement | null {
  if (nodes.length === 0) {
    return null;
  }

  const bounds = getBounds(nodes.map((node) => node.frame));

  return createElement(
    "div",
    {
      "data-templara-selection-bounds": "true",
      style: {
        position: "absolute",
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: nodes.length > 1 ? "1px solid #2563eb" : "none",
        pointerEvents: "none",
        zIndex: 20
      }
    },
    ["nw", "ne", "sw", "se"].map((corner) =>
      createElement("span", {
        key: corner,
        style: {
          ...selectionHandleStyle,
          ...(corner.includes("n") ? { top: -4 } : { bottom: -4 }),
          ...(corner.includes("w") ? { left: -4 } : { right: -4 })
        }
      })
    )
  );
}

function EditorNodeView({
  node,
  selected,
  onPointerDown
}: {
  node: EditorRenderNode;
  selected: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, node: EditorRenderNode) => void;
}): ReactElement {
  const baseStyle: CSSProperties = {
    position: "absolute",
    left: node.frame.x,
    top: node.frame.y,
    width: node.frame.width,
    height: node.frame.height,
    opacity: node.visual.kind === "container" ? 1 : undefined,
    outline: selected ? "2px solid #2563eb" : undefined,
    outlineOffset: selected ? 2 : undefined,
    cursor: "move",
    userSelect: "none"
  };
  const nodeProps = {
    "data-templara-editor-node-id": node.id,
    "data-templara-source-node-id": node.sourceNodeId,
    "data-templara-node-type": node.nodeType,
    "data-templara-selected": selected ? "true" : undefined,
    onPointerDown: (event: PointerEvent<HTMLElement>) => onPointerDown(event, node)
  };

  if (node.visual.kind === "text") {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        fontFamily: node.visual.style.fontFamily,
        fontSize: node.visual.style.fontSize,
        fontWeight: node.visual.style.fontWeight,
        lineHeight: node.visual.style.lineHeight,
        color: node.visual.style.color,
        textAlign: node.visual.style.align,
        letterSpacing: node.visual.style.letterSpacing,
        whiteSpace: "pre-wrap"
      },
      children: node.visual.text
    });
  }

  if (node.visual.kind === "shape") {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        background: node.visual.fill,
        border: node.visual.stroke ? `${node.visual.strokeWidth ?? 1}px solid ${node.visual.stroke}` : undefined,
        borderRadius: node.visual.shape === "ellipse" ? "999px" : node.visual.radius
      }
    });
  }

  if (node.visual.kind === "image") {
    if (!node.visual.src && node.visual.placeholder) {
      return createElement(PlaceholderBox, { nodeProps, style: baseStyle, label: node.visual.placeholder });
    }

    return createElement("img", {
      ...nodeProps,
      src: node.visual.src,
      alt: node.visual.alt ?? "",
      style: {
        ...baseStyle,
        objectFit: node.visual.fit ?? "contain"
      }
    });
  }

  if (node.visual.kind === "code") {
    return createElement(PlaceholderBox, { nodeProps, style: baseStyle, label: node.visual.placeholder ?? node.visual.value });
  }

  return createElement(ContainerBox, { nodeProps, selected, style: baseStyle, visual: node.visual });
}

function PlaceholderBox({ nodeProps, style, label }: { nodeProps: Record<string, unknown>; style: CSSProperties; label: string }): ReactElement {
  return createElement("div", {
    ...nodeProps,
    style: {
      ...style,
      display: "grid",
      placeItems: "center",
      border: "1px dashed #94a3b8",
      background: "#f8fafc",
      color: "#475569",
      font: `10px/1.3 ${UI_MONO_FONT_FAMILY}`,
      textAlign: "center",
      padding: 4
    },
    children: label
  });
}

function ContainerBox({
  nodeProps,
  selected,
  style,
  visual
}: {
  nodeProps: Record<string, unknown>;
  selected: boolean;
  style: CSSProperties;
  visual: Extract<EditorVisual, { kind: "container" }>;
}): ReactElement {
  const color = containerToneColor(visual.tone);
  const showLabel = selected || visual.tone === "repeat";
  const subtleColor = visual.tone === "repeat" ? color : "rgba(100, 116, 139, 0.28)";

  return createElement(
    "div",
    {
      ...nodeProps,
      style: {
        ...style,
        border: `1px dashed ${selected ? color : subtleColor}`,
        background: visual.tone === "repeat" ? "rgba(124, 58, 237, 0.04)" : "transparent",
        pointerEvents: "auto"
      }
    },
    showLabel
      ? createElement("span", {
          style: {
            position: "absolute",
            left: 4,
            top: -18,
            padding: "2px 5px",
            borderRadius: 3,
            background: color,
            color: "#ffffff",
            font: `10px/1.2 ${UI_MONO_FONT_FAMILY}`,
            whiteSpace: "nowrap"
          },
          children: visual.label
        })
      : null,
    visual.tone === "repeat"
      ? createElement(
          "div",
          {
            style: repeatPlaceholderStyle
          },
          createElement("strong", null, "This is the repeat template."),
          createElement("span", null, "Full repeated output appears in Preview.")
        )
      : null
  );
}

function Ruler({ axis, length, zoom }: { axis: GuideAxis; length: number; zoom: number }): ReactElement {
  const ticks = Array.from({ length: Math.floor(length / 100) + 1 }, (_, index) => index * 100);

  return createElement(
    "div",
    {
      style: axis === "x" ? topRulerStyle : leftRulerStyle
    },
    ticks.map((tick) =>
      createElement("span", {
        key: tick,
        style: axis === "x" ? { ...topRulerTickStyle, left: tick * zoom } : { ...leftRulerTickStyle, top: tick * zoom },
        children: tick
      })
    )
  );
}

function GuideLine({
  axis,
  value,
  zoom,
  rulerSize,
  length,
  active = false,
  onPointerDown
}: {
  axis: GuideAxis;
  value: number;
  zoom: number;
  rulerSize: number;
  length: number;
  active?: boolean;
  onPointerDown?: () => void;
}): ReactElement {
  return createElement("div", {
    onPointerDown: onPointerDown
      ? (event: PointerEvent<HTMLDivElement>) => {
          event.stopPropagation();
          onPointerDown();
        }
      : undefined,
    style:
      axis === "x"
        ? {
            ...verticalGuideStyle,
            left: rulerSize + value * zoom,
            top: rulerSize,
            height: length * zoom,
            background: active ? "#2563eb" : "#ef4444"
          }
        : {
            ...horizontalGuideStyle,
            left: rulerSize,
            top: rulerSize + value * zoom,
            width: length * zoom,
            background: active ? "#2563eb" : "#ef4444"
          }
  });
}

function NodeLayerList({
  pages,
  items,
  activePageId,
  selectedNodeIds,
  onSelectPage,
  onSelect
}: {
  pages: DocumentTemplate["pages"];
  items: EditorNodeItem[];
  activePageId: string;
  selectedNodeIds: string[];
  onSelectPage: (pageId: string) => void;
  onSelect: (event: MouseEvent<HTMLElement>, nodeId: string) => void;
}): ReactElement {
  const rows = buildLayerTreeRows(pages, activePageId, items);

  return createElement(
    "section",
    { style: layersPanelStyle },
    createElement(
      "header",
      { style: layersHeaderStyle },
      createElement("h2", { style: panelTitleStyle }, "Layers"),
      createElement("button", { type: "button", title: "Add layer", style: layersAddButtonStyle }, "+")
    ),
    createElement(
      "div",
      { style: layerListStyle },
      rows.map((row) =>
        createElement(LayerTreeRowView, {
          key: row.key,
          row,
          selected: row.nodeId ? selectedNodeIds.includes(row.nodeId) : row.pageId === activePageId && row.kind === "page",
          onSelect,
          onSelectPage
        })
      )
    )
  );
}

function LayerTreeRowView({
  row,
  selected,
  onSelect,
  onSelectPage
}: {
  row: LayerTreeRow;
  selected: boolean;
  onSelect: (event: MouseEvent<HTMLElement>, nodeId: string) => void;
  onSelectPage: (pageId: string) => void;
}): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      onClick: (event) => {
        if (row.nodeId) {
          onSelect(event, row.nodeId);
          return;
        }

        if (row.pageId) {
          onSelectPage(row.pageId);
        }
      },
      style: {
        ...layerTreeRowStyle,
        paddingLeft: 8 + row.depth * 18,
        background: selected && row.kind !== "page" ? "#dbeafe" : selected && row.kind === "page" ? "#eff6ff" : "transparent",
        borderColor: selected ? "#93c5fd" : "transparent",
        fontWeight: row.kind === "node" ? 500 : 700
      }
    },
    row.kind === "node"
      ? createElement("span", { style: layerTreeCaretStyle })
      : createElement(SidebarIcon, { src: sidebarIcons.caret, alt: "", style: layerTreeCaretStyle }),
    createElement(SidebarIcon, { src: row.iconSrc, alt: "", style: layerTreeIconStyle }),
    createElement("span", { style: layerTreeLabelStyle }, row.label)
  );
}

function SidebarIcon({ src, alt, style }: { src: string; alt: string; style: CSSProperties }): ReactElement {
  return createElement("img", {
    src,
    alt,
    "aria-hidden": alt === "" ? true : undefined,
    style
  });
}

function ToolIcon({ icon, style, size }: { icon: IconSvgElement; style: CSSProperties; size: number }): ReactElement {
  return createElement(
    "span",
    { style, "aria-hidden": true },
    createElement(HugeiconsIcon, {
      icon,
      size,
      strokeWidth: 1.8,
      color: "currentColor"
    })
  );
}

function buildLayerTreeRows(pages: DocumentTemplate["pages"], activePageId: string, items: EditorNodeItem[]): LayerTreeRow[] {
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const rows: LayerTreeRow[] = [];

  if (activePage) {
    rows.push({
      key: `page-${activePage.id}`,
      label: pageDisplayName(pages, activePage.id),
      depth: 0,
      kind: "page",
      iconSrc: sidebarIcons.page,
      pageId: activePage.id
    });
  }

  const hasShipmentBolNodes = itemById.has("handling-units-repeat") && itemById.has("bol-title");

  if (!hasShipmentBolNodes) {
    return rows.concat(buildGenericLayerRows(items));
  }

  const addSection = (key: string, label: string, depth: number): void => {
    rows.push({ key, label, depth, kind: "section", iconSrc: sidebarIcons.frame });
  };
  const addNode = (nodeId: string, label: string, depth: number, iconSrc?: string): void => {
    if (!itemById.has(nodeId)) {
      return;
    }

    rows.push({
      key: `node-${nodeId}-${rows.length}`,
      label,
      depth,
      kind: "node",
      iconSrc: iconSrc ?? nodeIcon(itemById.get(nodeId)?.type),
      nodeId
    });
  };

  addSection("section-header", "Header", 1);
  addNode("business-name", "Business Name", 2, sidebarIcons.text);
  addNode("bol-title", "Title (BOL)", 2, sidebarIcons.text);
  addNode("bol-number-barcode", "Barcode", 2, sidebarIcons.barcode);
  addNode("tracking-qr", "Tracking QR", 2, sidebarIcons.qr);

  addSection("section-shipment-info", "Shipment Info", 1);
  addNode("detail-strip", "BOL Details", 2, sidebarIcons.frame);
  addNode("bol-number", "BOL Number", 2, sidebarIcons.text);
  addNode("pro-value", "PRO Number", 2, sidebarIcons.text);
  addNode("po-value", "PO Number", 2, sidebarIcons.text);

  addSection("section-parties", "Parties", 1);
  addNode("shipper-card", "Shipper", 2, sidebarIcons.frame);
  addNode("recipient-card", "Recipient", 2, sidebarIcons.frame);
  addNode("delivery-card", "Delivery Address", 2, sidebarIcons.frame);

  addSection("section-handling-units", "Handling Units Table", 1);
  addNode("freight-header", "Table Header", 2, sidebarIcons.table);
  addNode("handling-units-repeat", "Repeat: Items", 2, sidebarIcons.layout);
  rows.push({ key: "section-row-template", label: "Row Template", depth: 3, kind: "section", iconSrc: sidebarIcons.frame });
  addNode("unit-pieces", "Pieces", 4, sidebarIcons.text);
  addNode("unit-type", "Type", 4, sidebarIcons.text);
  addNode("unit-description", "Description", 4, sidebarIcons.text);
  addNode("unit-weight", "Weight", 4, sidebarIcons.text);
  addNode("unit-class", "Class", 4, sidebarIcons.text);
  addNode("unit-nmfc", "NMFC", 4, sidebarIcons.text);
  addNode("unit-hazmat", "Hazmat", 4, sidebarIcons.text);

  addSection("section-summary", "Summary", 1);
  addNode("instructions-box", "Instructions Box", 2, sidebarIcons.frame);
  addNode("instructions-label", "Instructions Label", 2, sidebarIcons.text);
  addNode("instructions", "Instructions", 2, sidebarIcons.text);
  addNode("totals-box", "Totals Box", 2, sidebarIcons.frame);
  addNode("total-pieces-label", "Total Pieces Label", 2, sidebarIcons.text);
  addNode("total-pieces", "Total Pieces", 2, sidebarIcons.text);
  addNode("total-weight-label", "Total Weight Label", 2, sidebarIcons.text);
  addNode("total-weight", "Total Weight", 2, sidebarIcons.text);

  addSection("section-signatures", "Signatures", 1);
  addNode("shipper-sign-label", "Shipper Signature", 2, sidebarIcons.text);
  addNode("carrier-sign-label", "Carrier Signature", 2, sidebarIcons.text);
  addNode("legal-note", "Terms", 2, sidebarIcons.text);

  addSection("section-footer", "Footer", 1);
  addNode("shipment-pdf417", "PDF417 Barcode", 2, sidebarIcons.barcode);
  addNode("tracking-qr", "QR Code", 2, sidebarIcons.qr);

  return rows;
}

function buildGenericLayerRows(items: EditorNodeItem[]): LayerTreeRow[] {
  return items.map((item) => ({
    key: item.path,
    label: item.label,
    depth: item.depth + 1,
    kind: "node",
    iconSrc: nodeIcon(item.type),
    nodeId: item.id
  }));
}

function pageDisplayName(pages: DocumentTemplate["pages"], pageId: string): string {
  const pageIndex = pages.findIndex((page) => page.id === pageId);

  return `Page ${pageIndex >= 0 ? pageIndex + 1 : 1}`;
}

function inspectorTitleForItem(item: EditorNodeItem): string {
  if (item.type === "repeat") {
    return "Repeat: Items";
  }

  return item.label;
}

interface FlatDataField extends DataField {
  depth: number;
}

function flattenDataFields(fields: DataField[], depth = 0): FlatDataField[] {
  return fields.flatMap((field) => [
    { ...field, depth },
    ...flattenDataFields(field.children ?? [], depth + 1)
  ]);
}

function applyBindingPathToNode(node: EditableNode, path: string): void {
  if (node.type === "text") {
    node.content = [{ kind: "field", label: path, binding: { path } }];
    return;
  }

  if (node.type === "repeat") {
    node.binding.path = path;
    return;
  }

  if (node.type === "barcode" || node.type === "qr") {
    node.value = { kind: "binding", binding: { path } };
    return;
  }

  if (node.type === "image") {
    node.source = { kind: "binding", binding: { path } };
    return;
  }

  if (node.type === "grid") {
    node.binding = { path };
  }
}

function nodeIcon(type: string | undefined): string {
  if (type === "text") {
    return sidebarIcons.text;
  }

  if (type === "barcode") {
    return sidebarIcons.barcode;
  }

  if (type === "qr") {
    return sidebarIcons.qr;
  }

  if (type === "repeat") {
    return sidebarIcons.layout;
  }

  if (type === "image") {
    return sidebarIcons.image;
  }

  return sidebarIcons.frame;
}

function NodeInspector({
  item,
  selectedCount,
  activeTab,
  onTabChange,
  onFrameChange,
  onNodeUpdate
}: {
  item: EditorNodeItem;
  selectedCount: number;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onFrameChange: (framePatch: Partial<Frame>) => void;
  onNodeUpdate: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;
  const body =
    activeTab === "design"
      ? createElement(DesignInspector, { item, onFrameChange, onNodeUpdate })
      : activeTab === "data"
        ? createElement(DataInspector, { item, onNodeUpdate })
        : createElement(StyleInspector, { item, onNodeUpdate });

  return createElement(
    "div",
    { style: inspectorStyle },
    createElement(InspectorTabs, { activeTab, onTabChange }),
    selectedCount > 1 ? createElement("div", { style: noticeStyle }, `Editing primary selection. Alignment commands affect all ${selectedCount} nodes.`) : null,
    createElement(
      InspectorSection,
      { title: "Selection", detail: node.type, defaultOpen: activeTab === "design" },
      createElement(FieldRow, { label: "ID", value: item.id }),
      createElement(FieldRow, { label: "Layer", value: `${item.layerKind} / ${item.layerId}` })
    ),
    body
  );
}

function InspectorTabs({ activeTab, onTabChange }: { activeTab: InspectorTab; onTabChange: (tab: InspectorTab) => void }): ReactElement {
  return createElement(
    "div",
    { style: inspectorTabsStyle },
    (["design", "data", "style"] as const).map((tab) =>
      createElement(
        "button",
        {
          key: tab,
          type: "button",
          onClick: () => onTabChange(tab),
          style: {
            ...inspectorTabStyle,
            color: activeTab === tab ? "#4f46e5" : "#475569",
            borderBottomColor: activeTab === tab ? "#4f46e5" : "transparent"
          }
        },
        tab[0].toUpperCase() + tab.slice(1)
      )
    )
  );
}

function DesignInspector({
  item,
  onFrameChange,
  onNodeUpdate
}: {
  item: EditorNodeItem;
  onFrameChange: (framePatch: Partial<Frame>) => void;
  onNodeUpdate: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;

  return createElement(
    "div",
    { style: inspectorSectionStackStyle },
    createElement(PositionSection, { frame: item.frame, onFrameChange }),
    node.type === "repeat" ? createElement(RepeatLayoutInspector, { node, onNodeUpdate }) : null,
    node.type === "text"
      ? createElement(
          InspectorSection,
          { title: "Text Layout", detail: node.overflow ?? "wrap" },
          createElement(SegmentedControl, {
            label: "Overflow",
            value: node.overflow ?? "wrap",
            options: ["clip", "wrap", "shrink", "continue"],
            onChange: (value) =>
              onNodeUpdate((draft) => {
                if (draft.type === "text") draft.overflow = value as TextNode["overflow"];
              })
          })
        )
      : null,
    node.type === "barcode" || node.type === "qr"
      ? createElement(
          InspectorSection,
          { title: "Generated Code", detail: node.type === "qr" ? "QR" : node.format },
          createElement(FieldRow, { label: "Code Type", value: node.type === "qr" ? "QR Code" : "Barcode" }),
          node.type === "barcode" ? createElement(FieldRow, { label: "Format", value: node.format }) : null,
          createElement(FieldRow, { label: "Human Label", value: "Off" })
        )
      : null
  );
}

function PositionSection({
  frame,
  onFrameChange
}: {
  frame: Frame;
  onFrameChange: (framePatch: Partial<Frame>) => void;
}): ReactElement {
  return createElement(
    InspectorSection,
    { title: "Position & Size", detail: `${Math.round(frame.width)} x ${Math.round(frame.height)}` },
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(NumberInput, { label: "X", value: frame.x, onChange: (value) => onFrameChange({ x: value }) }),
      createElement(NumberInput, { label: "Y", value: frame.y, onChange: (value) => onFrameChange({ y: value }) }),
      createElement(NumberInput, { label: "W", value: frame.width, onChange: (value) => onFrameChange({ width: Math.max(1, value) }) }),
      createElement(NumberInput, { label: "H", value: frame.height, onChange: (value) => onFrameChange({ height: Math.max(1, value) }) })
    )
  );
}

function RepeatLayoutInspector({
  node,
  onNodeUpdate
}: {
  node: RepeatNode;
  onNodeUpdate: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  return createElement(
    InspectorSection,
    { title: "Repeat Layout", detail: node.layout.direction },
    createElement(SegmentedControl, {
      label: "Direction",
      value: node.layout.direction,
      options: ["vertical", "horizontal"],
      onChange: (value) =>
        onNodeUpdate((draft) => {
          if (draft.type === "repeat") draft.layout.direction = value as RepeatNode["layout"]["direction"];
        })
    }),
    createElement(NumberInput, {
      label: "Gap",
      value: node.layout.gap,
      onChange: (value) =>
        onNodeUpdate((draft) => {
          if (draft.type === "repeat") draft.layout.gap = Math.max(0, value);
        })
    }),
    createElement(SegmentedControl, {
      label: "Row Height",
      value: node.layout.rowSizing ?? "fixed",
      options: ["fixed", "compact"],
      onChange: (value) =>
        onNodeUpdate((draft) => {
          if (draft.type === "repeat") draft.layout.rowSizing = value as RepeatNode["layout"]["rowSizing"];
        })
    }),
    createElement(PropertyToggle, {
      label: "Fill available space",
      active: Boolean(node.layout.fillAvailableSpace),
      onClick: () =>
        onNodeUpdate((draft) => {
          if (draft.type === "repeat") draft.layout.fillAvailableSpace = !draft.layout.fillAvailableSpace;
        })
    }),
    createElement(SegmentedControl, {
      label: "Page Break",
      value: node.layout.splitItems === false ? "keep row" : "auto",
      options: ["auto", "keep row"],
      onChange: (value) =>
        onNodeUpdate((draft) => {
          if (draft.type === "repeat") draft.layout.splitItems = value === "keep row" ? false : undefined;
        })
    }),
    createElement(PropertyToggle, { label: "Repeat header", active: false, onClick: () => undefined }),
    createElement(PropertyToggle, { label: "Keep together", active: node.layout.splitItems === false, onClick: () => undefined })
  );
}

function DataInspector({ item, onNodeUpdate }: { item: EditorNodeItem; onNodeUpdate: (update: (node: EditableNode) => void) => void }): ReactElement {
  const node = item.node;

  if (node.type === "repeat") {
    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Repeat Data", detail: node.binding.path },
        createElement(TextInput, {
          label: "Data Source",
          value: node.binding.path,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "repeat") draft.binding.path = value;
            })
        }),
        createElement(TextInput, {
          label: "Alias",
          value: node.itemAlias,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "repeat") draft.itemAlias = value;
            })
        }),
        createElement(NumberInput, { label: "Min Rows", value: Number(node.metadata?.minEditorRows ?? 1), onChange: () => undefined }),
        createElement(NumberInput, { label: "Sample", value: Number(node.metadata?.sampleRows ?? 1), onChange: () => undefined }),
        createElement(PropertyToggle, { label: "Show sample rows", active: Boolean(node.metadata?.showSampleRows ?? true), onClick: () => undefined })
      )
    );
  }

  if (node.type === "text") {
    const textValue = textNodeContentValue(node);
    const firstBinding = firstTextBinding(node);

    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Text Content", detail: firstBinding ? "bound" : "static" },
        createElement(TextAreaInput, {
          label: "Content",
          value: textValue,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.content = [{ kind: "text", text: value }];
            })
        }),
        createElement(TextInput, {
          label: "Binding",
          value: firstBinding,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.content = value ? [{ kind: "field", label: value, binding: { path: value } }] : [];
            })
        })
      )
    );
  }

  if (node.type === "barcode" || node.type === "qr") {
    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Generated Code", detail: node.type === "qr" ? "QR Code" : node.format },
        createElement(FieldRow, { label: "Code Type", value: node.type === "qr" ? "QR Code" : "Barcode" }),
        createElement(TextInput, {
          label: "Value",
          value: dynamicValueLabel(node.value).replace(/[{}]/g, ""),
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "barcode" || draft.type === "qr") draft.value = { kind: "binding", binding: { path: value } };
            })
        }),
        node.type === "barcode"
          ? createElement(TextInput, {
              label: "Format",
              value: node.format,
              onChange: (value) =>
                onNodeUpdate((draft) => {
                  if (draft.type === "barcode") draft.format = value;
                })
            })
          : null,
        createElement(PropertyToggle, { label: "Human-readable label", active: false, onClick: () => undefined })
      )
    );
  }

  return createElement("p", { style: emptyTextStyle }, "This node has no data binding settings yet.");
}

function StyleInspector({ item, onNodeUpdate }: { item: EditorNodeItem; onNodeUpdate: (update: (node: EditableNode) => void) => void }): ReactElement {
  const node = item.node;

  if (node.type === "text") {
    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Typography", detail: `${node.style.fontSize}px` },
        createElement(TextInput, {
          label: "Font",
          value: node.style.fontFamily,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.fontFamily = value;
            })
        }),
        createElement(NumberInput, {
          label: "Size",
          value: node.style.fontSize,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.fontSize = value;
            })
        }),
        createElement(TextInput, {
          label: "Weight",
          value: String(node.style.fontWeight ?? 400),
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.fontWeight = Number.isFinite(Number(value)) ? Number(value) : value;
            })
        }),
        createElement(NumberInput, {
          label: "Line",
          value: node.style.lineHeight ?? 1.2,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.lineHeight = value;
            })
        }),
        createElement(SegmentedControl, {
          label: "Align",
          value: node.style.align ?? "left",
          options: ["left", "center", "right", "justify"],
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.align = value as TextNode["style"]["align"];
            })
        })
      ),
      createElement(
        InspectorSection,
        { title: "Appearance", detail: node.style.color ?? "#111827" },
        createElement(TextInput, {
          label: "Color",
          value: node.style.color ?? "#111827",
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.color = value;
            })
        }),
        createElement(NumberInput, {
          label: "Tracking",
          value: node.style.letterSpacing ?? 0,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "text") draft.style.letterSpacing = value;
            })
        })
      )
    );
  }

  if (node.type === "shape") {
    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Appearance", detail: node.style.fill ?? "transparent" },
        createElement(TextInput, {
          label: "Fill",
          value: node.style.fill ?? "",
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "shape") draft.style.fill = value;
            })
        }),
        createElement(TextInput, {
          label: "Border",
          value: node.style.stroke ?? "",
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "shape") draft.style.stroke = value;
            })
        }),
        createElement(NumberInput, {
          label: "Width",
          value: node.style.strokeWidth ?? 1,
          onChange: (value) =>
            onNodeUpdate((draft) => {
              if (draft.type === "shape") draft.style.strokeWidth = value;
            })
        })
      )
    );
  }

  if (node.type === "repeat") {
    return createElement(
      "div",
      { style: inspectorSectionStackStyle },
      createElement(
        InspectorSection,
        { title: "Repeat Appearance", detail: "Frame style" },
        createElement(FieldRow, { label: "Background", value: "#FFFFFF" }),
        createElement(FieldRow, { label: "Border", value: "#E5E7EB / 1px" }),
        createElement(FieldRow, { label: "Padding", value: "8px" })
      )
    );
  }

  return createElement("p", { style: emptyTextStyle }, "Style controls for this node type are not expanded yet.");
}
function InspectorSection({
  title,
  detail,
  defaultOpen = true,
  children
}: {
  title: string;
  detail?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}): ReactElement {
  return createElement(
    "details",
    { open: defaultOpen, style: inspectorSectionStyle },
    createElement(
      "summary",
      { style: inspectorSectionSummaryStyle },
      createElement("span", null, title),
      detail ? createElement("span", { style: inspectorSectionDetailStyle }, detail) : null
    ),
    createElement("div", { style: inspectorSectionBodyStyle }, children)
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "label",
    { style: textAreaRowStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(
      "div",
      { style: segmentedControlStyle },
      options.map((option) =>
        createElement(
          "button",
          {
            key: option,
            type: "button",
            onClick: () => onChange(option),
            style: {
              ...segmentedButtonStyle,
              background: option === value ? "#ffffff" : "transparent",
              borderColor: option === value ? "#cbd5e1" : "transparent",
              color: option === value ? "#111827" : "#64748b",
              boxShadow: option === value ? "0 1px 2px rgba(15, 23, 42, 0.08)" : "none"
            }
          },
          option
        )
      )
    )
  );
}

function PageSettingsPanel({
  page,
  showGrid,
  showRulers,
  snapToGrid,
  snapToGuides,
  onToggleGrid,
  onToggleRulers,
  onToggleSnapGrid,
  onToggleSnapGuides
}: {
  page: ReturnType<typeof buildEditorPageModel>;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleSnapGrid: () => void;
  onToggleSnapGuides: () => void;
}): ReactElement {
  const orientation = page.size.width > page.size.height ? "Landscape" : "Portrait";

  return createElement(
    "div",
    { style: inspectorStyle },
    createElement(
      InspectorSection,
      { title: "Page", detail: orientation },
      createElement(FieldRow, { label: "Name", value: page.name }),
      createElement(FieldRow, { label: "Page Size", value: `${page.size.width} x ${page.size.height}px` }),
      createElement(FieldRow, { label: "Orientation", value: orientation }),
      createElement(FieldRow, { label: "Background", value: "#FFFFFF" }),
      createElement(FieldRow, { label: "Margins", value: page.margin ? `${page.margin.top}/${page.margin.right}/${page.margin.bottom}/${page.margin.left}` : "None" }),
      createElement(PropertyToggle, { label: "Show margins", active: Boolean(page.margin), onClick: () => undefined })
    ),
    createElement(
      InspectorSection,
      { title: "Grid", detail: showGrid ? "visible" : "hidden" },
      createElement(PropertyToggle, { label: "Show grid", active: showGrid, onClick: onToggleGrid }),
      createElement(FieldRow, { label: "Grid Size", value: `${GRID_SIZE}px` })
    ),
    createElement(
      InspectorSection,
      { title: "Snapping & Guides", detail: snapToGrid || snapToGuides ? "on" : "off" },
      createElement(PropertyToggle, { label: "Snap to grid", active: snapToGrid, onClick: onToggleSnapGrid }),
      createElement(PropertyToggle, { label: "Guide visibility", active: snapToGuides, onClick: onToggleSnapGuides }),
      createElement(PropertyToggle, { label: "Ruler visibility", active: showRulers, onClick: onToggleRulers }),
      createElement(FieldRow, { label: "Snap Threshold", value: `${SNAP_THRESHOLD}px` })
    )
  );
}

function DataSchemaPanel({
  template,
  selectedNodeType,
  onInsertBinding
}: {
  template: DocumentTemplate;
  selectedNodeType?: string;
  onInsertBinding?: (path: string) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const fields = template.dataSchema?.fields ?? [];
  const flatFields = flattenDataFields(fields);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleFields = normalizedQuery
    ? flatFields.filter((field) => `${field.label} ${field.path} ${field.kind}`.toLowerCase().includes(normalizedQuery))
    : flatFields;

  return createElement(
    "section",
    { style: dataPanelStyle },
    createElement(PanelHeader, { title: "Data", detail: `${flatFields.length} fields` }),
    createElement("input", {
      type: "search",
      value: query,
      placeholder: "Search fields",
      onChange: (event) => setQuery((event.currentTarget as HTMLInputElement).value),
      style: dataSearchStyle
    }),
    createElement(
      "div",
      { style: dataFieldsStyle },
      fields.length === 0
        ? createElement("p", { style: emptyTextStyle }, "No data schema is attached to this template.")
        : visibleFields.length === 0
          ? createElement("p", { style: emptyTextStyle }, "No fields match that search.")
          : visibleFields.map((field) =>
              createElement(
                "div",
                { key: field.path, style: { ...dataFieldStyle, paddingLeft: 8 + field.depth * 10 } },
                createElement(
                  "div",
                  { style: dataFieldHeaderStyle },
                  createElement("span", { style: layerNameStyle }, field.label),
                  createElement(
                    "span",
                    {
                      style: {
                        ...dataTypePillStyle,
                        background: field.kind === "array" ? "#eef2ff" : "#f8fafc",
                        color: field.kind === "array" ? "#3730a3" : "#64748b"
                      }
                    },
                    field.kind === "array" ? "array" : field.kind
                  )
                ),
                createElement("span", { style: layerMetaStyle }, field.path),
                createElement(
                  "div",
                  { style: dataFieldActionsStyle },
                  createElement(DataActionButton, {
                    icon: Copy01Icon,
                    label: "Copy",
                    title: `Copy ${field.path}`,
                    onClick: () => {
                      void navigator.clipboard?.writeText(field.path);
                    }
                  }),
                  createElement(DataActionButton, {
                    icon: Link01Icon,
                    label: onInsertBinding ? "Insert" : "Select a node",
                    title: onInsertBinding
                      ? `Insert ${field.path} into selected ${selectedNodeType ?? "node"}`
                      : "Select a node to insert this binding",
                    disabled: !onInsertBinding,
                    onClick: () => onInsertBinding?.(field.path)
                  })
                )
              )
            )
    )
  );
}

function DataActionButton({
  icon,
  label,
  title,
  disabled,
  onClick
}: {
  icon: IconSvgElement;
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      title,
      disabled,
      onClick,
      style: {
        ...dataActionButtonStyle,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }
    },
    createElement(ToolIcon, { icon, style: toolbarIconStyle, size: 13 }),
    createElement("span", null, label)
  );
}

function PreviewOverlay({ document, onClose }: { document: ReturnType<typeof renderDocument>; onClose: () => void }): ReactElement {
  return createElement(
    "div",
    { style: previewOverlayStyle },
    createElement(
      "header",
      { style: previewToolbarStyle },
      createElement("strong", null, "Rendered Preview"),
      createElement(ToolbarButton, { label: "Close", title: "Close preview", onClick: onClose })
    ),
    createElement(
      "div",
      { style: previewScrollStyle },
      createElement(DocumentPreview, {
        document,
        scale: 0.86
      })
    )
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }): ReactElement {
  return createElement(
    "header",
    { style: panelHeaderStyle },
    createElement("h2", { style: panelTitleStyle }, title),
    createElement("span", { style: panelDetailStyle }, detail)
  );
}

function ToolbarButton({
  icon,
  label,
  title,
  disabled,
  onClick,
  variant = "default",
  compact = false
}: {
  icon?: IconSvgElement;
  label?: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "primary" | "ghost";
  compact?: boolean;
}): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      title,
      disabled,
      onClick,
      style: {
        ...toolbarButtonStyle,
        width: compact ? 32 : undefined,
        minWidth: compact ? 32 : toolbarButtonStyle.minWidth,
        padding: compact ? 0 : toolbarButtonStyle.padding,
        background: variant === "primary" ? "#4f46e5" : variant === "ghost" ? "transparent" : toolbarButtonStyle.background,
        borderColor: variant === "primary" ? "#4f46e5" : variant === "ghost" ? "transparent" : toolbarButtonStyle.borderColor,
        color: variant === "primary" ? "#ffffff" : variant === "ghost" ? "#64748b" : toolbarButtonStyle.color,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }
    },
    icon ? createElement(ToolIcon, { icon, style: toolbarIconStyle, size: 16 }) : null,
    label ? createElement("span", null, label) : null
  );
}

function ToggleButton({
  icon,
  title,
  active,
  onClick
}: {
  icon: IconSvgElement;
  title: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      title,
      onClick,
      style: {
        ...toolbarButtonStyle,
        width: 32,
        minWidth: 32,
        padding: 0,
        background: active ? "#e0ecff" : "#ffffff",
        borderColor: active ? "#7aa7ff" : "#d0d7e2",
        color: active ? "#1d4ed8" : "#334155"
      }
    },
    createElement(ToolIcon, { icon, style: toolbarIconStyle, size: 16 })
  );
}

function FieldRow({ label, value }: { label: string; value: string }): ReactElement {
  return createElement(
    "div",
    { style: readOnlyRowStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("span", { style: fieldValueStyle }, value)
  );
}

function NumberInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  return createElement(
    "label",
    { style: inputRowStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("input", {
      type: "number",
      value,
      onChange: (event) => {
        const nextValue = Number(event.currentTarget.value);

        if (Number.isFinite(nextValue)) {
          onChange(nextValue);
        }
      },
      style: numberInputStyle
    })
  );
}

function TextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "label",
    { style: inputRowStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("input", {
      type: "text",
      value,
      onChange: (event) => onChange((event.currentTarget as HTMLInputElement).value),
      style: textInputStyle
    })
  );
}

function TextAreaInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "label",
    { style: textAreaRowStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("textarea", {
      value,
      onChange: (event) => onChange((event.currentTarget as HTMLTextAreaElement).value),
      rows: 4,
      style: textAreaInputStyle
    })
  );
}

function PropertyToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      onClick,
      style: {
        ...propertyToggleStyle,
        background: active ? "#eef2ff" : "#ffffff",
        borderColor: active ? "#818cf8" : "#d8dee8",
        color: active ? "#3730a3" : "#334155"
      }
    },
    createElement("span", null, label),
    createElement("span", { style: togglePillStyle }, active ? "On" : "Off")
  );
}

function SectionTitle({ title }: { title: string }): ReactElement {
  return createElement("h3", { style: sectionTitleStyle }, title);
}

function textNodeContentValue(node: TextNode): string {
  return node.content
    .map((part) => {
      if (part.kind === "text") {
        return part.text;
      }

      return `{{${part.binding.path}}}`;
    })
    .join("");
}

function firstTextBinding(node: TextNode): string {
  return node.content.find((part) => part.kind === "field")?.binding.path ?? "";
}

function dynamicValueLabel(value: DynamicValue): string {
  if (value.kind === "literal") {
    return value.value;
  }

  if (value.kind === "binding") {
    return `{{${value.binding.path}}}`;
  }

  return value.parts
    .map((part) => {
      if (part.kind === "text") {
        return part.text;
      }

      return `{{${part.binding.path}}}`;
    })
    .join("");
}

function getNextSelection(currentSelection: string[], nodeId: string, additive: boolean): string[] {
  if (!additive) {
    return currentSelection.includes(nodeId) ? currentSelection : [nodeId];
  }

  return currentSelection.includes(nodeId) ? currentSelection.filter((id) => id !== nodeId) : [...currentSelection, nodeId];
}

function snapMove(
  rawDelta: Pick<Frame, "x" | "y">,
  drag: DragState,
  nodeItems: EditorNodeItem[],
  pageSize: Frame["width"] extends number ? { width: number; height: number } : never,
  options: {
    snapToGrid: boolean;
    snapToGuides: boolean;
    verticalGuides: number[];
    horizontalGuides: number[];
  }
): { delta: Pick<Frame, "x" | "y">; guides: ActiveGuide[] } {
  let deltaX = rawDelta.x;
  let deltaY = rawDelta.y;
  const guides: ActiveGuide[] = [];
  const selectedStartFrames = drag.nodeIds.map((id) => drag.startAbsoluteFrames[id]).filter((frame): frame is Frame => Boolean(frame));

  if (selectedStartFrames.length === 0) {
    return { delta: rawDelta, guides };
  }

  const selectionBounds = getBounds(selectedStartFrames);

  if (options.snapToGrid) {
    const snappedX = snapCoordinate(selectionBounds.x + deltaX, true);
    const snappedY = snapCoordinate(selectionBounds.y + deltaY, true);
    deltaX += snappedX - (selectionBounds.x + deltaX);
    deltaY += snappedY - (selectionBounds.y + deltaY);
  }

  if (options.snapToGuides) {
    const unselected = nodeItems.filter((item) => !drag.nodeIds.includes(item.id));
    const xSnap = findAxisSnap(selectionBounds, deltaX, "x", pageSize, unselected, options.verticalGuides);
    const ySnap = findAxisSnap(selectionBounds, deltaY, "y", pageSize, unselected, options.horizontalGuides);

    if (xSnap) {
      deltaX += xSnap.adjustment;
      guides.push(xSnap.guide);
    }

    if (ySnap) {
      deltaY += ySnap.adjustment;
      guides.push(ySnap.guide);
    }
  }

  return {
    delta: { x: deltaX, y: deltaY },
    guides
  };
}

function findAxisSnap(
  bounds: Frame,
  delta: number,
  axis: GuideAxis,
  pageSize: { width: number; height: number },
  unselected: EditorNodeItem[],
  userGuides: number[]
): { adjustment: number; guide: ActiveGuide } | undefined {
  const size = axis === "x" ? pageSize.width : pageSize.height;
  const start = axis === "x" ? bounds.x : bounds.y;
  const length = axis === "x" ? bounds.width : bounds.height;
  const movingPositions = [
    { value: start + delta, label: "start" },
    { value: start + length / 2 + delta, label: "center" },
    { value: start + length + delta, label: "end" }
  ];
  const candidates = [
    { value: 0, label: "page start" },
    { value: size / 2, label: "page center" },
    { value: size, label: "page end" },
    ...userGuides.map((guide) => ({ value: guide, label: "guide" })),
    ...unselected.flatMap((item) => {
      const frame = item.absoluteFrame;
      const itemStart = axis === "x" ? frame.x : frame.y;
      const itemLength = axis === "x" ? frame.width : frame.height;

      return [
        { value: itemStart, label: item.label },
        { value: itemStart + itemLength / 2, label: item.label },
        { value: itemStart + itemLength, label: item.label }
      ];
    })
  ];
  let best: { adjustment: number; guide: ActiveGuide; distance: number } | undefined;

  for (const moving of movingPositions) {
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.value - moving.value);

      if (distance > SNAP_THRESHOLD || (best && distance >= best.distance)) {
        continue;
      }

      best = {
        adjustment: candidate.value - moving.value,
        guide: {
          axis,
          value: candidate.value,
          label: `${moving.label} to ${candidate.label}`
        },
        distance
      };
    }
  }

  return best;
}

function updateDraggedGuide(
  event: globalThis.PointerEvent,
  drag: GuideDragState,
  board: HTMLDivElement | null,
  zoom: number,
  setVerticalGuides: (update: (guides: number[]) => number[]) => void,
  setHorizontalGuides: (update: (guides: number[]) => number[]) => void
): void {
  if (!board) {
    return;
  }

  const rect = board.getBoundingClientRect();
  const value = drag.axis === "x" ? (event.clientX - rect.left - RULER_SIZE) / zoom : (event.clientY - rect.top - RULER_SIZE) / zoom;
  const rounded = roundFrameValue(Math.max(0, value));

  if (drag.axis === "x") {
    setVerticalGuides((guides) => guides.map((guide, index) => (index === drag.index ? rounded : guide)));
  } else {
    setHorizontalGuides((guides) => guides.map((guide, index) => (index === drag.index ? rounded : guide)));
  }
}

function getPagePoint(event: PointerEvent<HTMLDivElement>, zoom: number): Pick<Frame, "x" | "y"> {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom
  };
}

function snapPoint(point: Pick<Frame, "x" | "y">, enabled: boolean): Pick<Frame, "x" | "y"> {
  return {
    x: snapCoordinate(point.x, enabled),
    y: snapCoordinate(point.y, enabled)
  };
}

function snapCoordinate(value: number, enabled: boolean): number {
  if (!enabled) {
    return roundFrameValue(value);
  }

  const nearest = Math.round(value / GRID_SIZE) * GRID_SIZE;

  return Math.abs(nearest - value) <= SNAP_THRESHOLD ? nearest : roundFrameValue(value);
}

function createNodeForTool(tool: InsertTool, template: DocumentTemplate, point: Pick<Frame, "x" | "y">): DocNode {
  const x = Math.max(0, roundFrameValue(point.x));
  const y = Math.max(0, roundFrameValue(point.y));

  if (tool === "text") {
    return {
      id: createNodeId(template, "text"),
      type: "text",
      frame: { x, y, width: 180, height: 28 },
      content: [{ kind: "text", text: "Text" }],
      style: { fontFamily: "Geist", fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: "#111827" }
    } satisfies TextNode;
  }

  if (tool === "image") {
    return {
      id: createNodeId(template, "image"),
      type: "image",
      frame: { x, y, width: 180, height: 120 },
      source: { kind: "binding", binding: { path: "image.url" } },
      fit: "contain",
      alt: "Image"
    } satisfies ImageNode;
  }

  if (tool === "barcode") {
    return {
      id: createNodeId(template, "barcode"),
      type: "barcode",
      format: "code128",
      frame: { x, y, width: 180, height: 48 },
      value: { kind: "binding", binding: { path: "shipment.bolNumber" } }
    } satisfies BarcodeNode;
  }

  if (tool === "qr") {
    return {
      id: createNodeId(template, "qr"),
      type: "qr",
      frame: { x, y, width: 72, height: 72 },
      value: { kind: "binding", binding: { path: "shipment.trackingUrl" } }
    } satisfies QrNode;
  }

  if (tool === "line") {
    return {
      id: createNodeId(template, "line"),
      type: "shape",
      shape: "line",
      frame: { x, y, width: 180, height: 2 },
      style: { fill: "#111827", stroke: "#111827", strokeWidth: 1, radius: 0 }
    } satisfies ShapeNode;
  }

  if (tool === "shape") {
    return {
      id: createNodeId(template, "ellipse"),
      type: "shape",
      shape: "ellipse",
      frame: { x, y, width: 96, height: 96 },
      style: { fill: "#f8fafc", stroke: "#94a3b8", strokeWidth: 1 }
    } satisfies ShapeNode;
  }

  if (tool === "table") {
    const columns = [
      { id: "qty", label: "QTY", width: 64 },
      { id: "description", label: "DESCRIPTION", width: 210 },
      { id: "weight", label: "WEIGHT", width: 92 },
      { id: "pieces", label: "PIECES", width: 88 }
    ];
    const headerStyle = { fontFamily: "Geist", fontSize: 10, fontWeight: 800, lineHeight: 1.2, color: "#111827" };
    const rowStyle = { fontFamily: "Geist", fontSize: 11, fontWeight: 500, lineHeight: 1.2, color: "#111827" };

    return {
      id: createNodeId(template, "table"),
      type: "grid",
      frame: { x, y, width: 454, height: 76 },
      columns,
      rowHeight: 28,
      header: {
        cells: columns.map((column) => ({
          columnId: column.id,
          content: [
            {
              id: createNodeId(template, `table-${column.id}-header`),
              type: "text",
              frame: { x: 8, y: 8, width: Math.max(24, column.width - 16), height: 14 },
              content: [{ kind: "text", text: column.label ?? column.id.toUpperCase() }],
              style: headerStyle
            } satisfies TextNode
          ],
          style: { fill: "#f8fafc", stroke: "#d8dee8", strokeWidth: 1 }
        }))
      },
      row: {
        cells: columns.map((column) => ({
          columnId: column.id,
          content: [
            {
              id: createNodeId(template, `table-${column.id}-cell`),
              type: "text",
              frame: { x: 8, y: 8, width: Math.max(24, column.width - 16), height: 14 },
              content: [{ kind: "field", label: column.label ?? column.id, binding: { path: `item.${column.id}` } }],
              style: rowStyle
            } satisfies TextNode
          ],
          style: { fill: "#ffffff", stroke: "#d8dee8", strokeWidth: 1 }
        }))
      }
    } satisfies GridNode;
  }

  if (tool === "repeat") {
    return {
      id: createNodeId(template, "repeat"),
      type: "repeat",
      frame: { x, y, width: 360, height: 36 },
      binding: { path: "items" },
      itemAlias: "item",
      layout: { direction: "vertical", gap: 0 },
      children: [
        {
          id: createNodeId(template, "repeat-row-bg"),
          type: "shape",
          shape: "rectangle",
          frame: { x: 0, y: 0, width: 360, height: 36 },
          style: { fill: "#ffffff", stroke: "#d8dee8", strokeWidth: 1, radius: 0 }
        },
        {
          id: createNodeId(template, "repeat-row-text"),
          type: "text",
          frame: { x: 12, y: 10, width: 220, height: 16 },
          content: [{ kind: "field", label: "Item name", binding: { path: "item.name" } }],
          style: { fontFamily: "Geist", fontSize: 12, fontWeight: 500, lineHeight: 1.2, color: "#111827" }
        }
      ]
    } satisfies RepeatNode;
  }

  if (tool === "frame") {
    return {
      id: createNodeId(template, "frame"),
      type: "group",
      frame: { x, y, width: 240, height: 160 },
      name: "Frame",
      children: []
    } satisfies GroupNode;
  }

  if (tool === "signature") {
    return {
      id: createNodeId(template, "signature"),
      type: "group",
      frame: { x, y, width: 170, height: 74 },
      name: "Signature",
      children: [
        {
          id: createNodeId(template, "signature-line"),
          type: "shape",
          shape: "line",
          frame: { x: 12, y: 42, width: 120, height: 1 },
          style: { fill: "#94a3b8", stroke: "#94a3b8", strokeWidth: 1, radius: 0 }
        },
        {
          id: createNodeId(template, "signature-label"),
          type: "text",
          frame: { x: 12, y: 12, width: 132, height: 14 },
          content: [{ kind: "text", text: "Signature" }],
          style: { fontFamily: "Geist", fontSize: 10, fontWeight: 700, lineHeight: 1.2, color: "#111827" }
        },
        {
          id: createNodeId(template, "signature-date"),
          type: "text",
          frame: { x: 12, y: 52, width: 92, height: 12 },
          content: [{ kind: "text", text: "Date:" }],
          style: { fontFamily: "Geist", fontSize: 9, fontWeight: 700, lineHeight: 1.2, color: "#111827" }
        }
      ]
    } satisfies GroupNode;
  }

  return {
    id: createNodeId(template, "rectangle"),
    type: "shape",
    shape: "rectangle",
    frame: { x, y, width: 160, height: 96 },
    style: { fill: "#ffffff", stroke: "#94a3b8", strokeWidth: 1, radius: 0 }
  } satisfies ShapeNode;
}

function getWritableFixedLayer(layers: PageLayer[]): PageLayer | undefined {
  let layer = layers.find((candidate) => candidate.kind === "fixed");

  if (!layer) {
    layer = {
      id: "fixed",
      kind: "fixed",
      nodes: []
    };
    layers.push(layer);
  }

  return layer;
}

function createNodeId(template: DocumentTemplate, prefix: string): string {
  const existing = new Set<string>();

  for (const page of template.pages) {
    for (const layer of page.layers) {
      collectNodeIds(layer.nodes, existing);
    }
  }

  let index = 1;
  let id = `${prefix}-${index}`;

  while (existing.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }

  return id;
}

function collectNodeIds(nodes: EditableNode[], ids: Set<string>): void {
  for (const node of nodes) {
    ids.add(node.id);

    if (node.type === "group" || node.type === "flowRegion" || node.type === "stack") {
      collectNodeIds(node.children, ids);
    }

    if (node.type === "repeat") {
      collectNodeIds(node.children, ids);

      if (node.emptyState) {
        collectNodeIds(node.emptyState, ids);
      }
    }

    if (node.type === "conditional") {
      collectNodeIds(node.children, ids);

      if (node.fallback) {
        collectNodeIds(node.fallback, ids);
      }
    }
  }
}

function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.25, Math.round(value * 100) / 100));
}

function roundFrameValue(value: number): number {
  return Math.round(value);
}

function getBounds(frames: Frame[]): Frame {
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function containerToneColor(tone: Extract<EditorVisual, { kind: "container" }>["tone"]): string {
  if (tone === "repeat") {
    return "#7c3aed";
  }

  if (tone === "flow") {
    return "#2563eb";
  }

  if (tone === "grid") {
    return "#0f766e";
  }

  return "#64748b";
}

function buildFontImports(template: DocumentTemplate): string {
  return (template.fonts ?? [])
    .map((font) => {
      if (font.source?.kind === "css-url") {
        return `@import url("${font.source.url.replace(/"/g, '\\"')}");`;
      }

      if (font.source?.kind === "google-font") {
        const family = font.source.family.replace(/\s+/g, "+");
        const weights = font.source.weights?.length ? `:wght@${font.source.weights.join(";")}` : "";
        const display = font.source.display ?? "swap";

        return `@import url("https://fonts.googleapis.com/css2?family=${family}${weights}&display=${display}");`;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

const gridBackgroundImage =
  "linear-gradient(to right, rgba(148, 163, 184, 0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.11) 1px, transparent 1px)";

const shellStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "60px 300px minmax(0, 1fr) 344px",
  gridTemplateRows: "60px minmax(0, 1fr)",
  background: "#eef2f6",
  color: "#111827",
  fontFamily: UI_FONT_FAMILY
};

const toolRailStyle: CSSProperties = {
  gridColumn: 1,
  gridRow: 2,
  position: "relative",
  zIndex: 20,
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "12px 0",
  borderRight: "1px solid #d8dee8",
  background: "#ffffff",
  overflow: "visible"
};

const toolButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#111827",
  cursor: "pointer"
};

const railIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16
};

const toolTooltipStyle: CSSProperties = {
  position: "absolute",
  left: 42,
  top: "50%",
  zIndex: 60,
  transform: "translateY(-50%)",
  padding: "7px 9px",
  border: "1px solid #d8dee8",
  borderRadius: 6,
  background: "#111827",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
  font: `700 11px/1 ${UI_FONT_FAMILY}`,
  whiteSpace: "nowrap",
  pointerEvents: "none"
};

const toolSectionLabelStyle: CSSProperties = {
  width: "100%",
  marginBottom: 6,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
  textAlign: "left"
};

const toolShortcutStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: "1px solid #d8dee8",
  borderRadius: 5,
  background: "#ffffff",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 10,
  fontWeight: 900,
  color: "#334155"
};

const toolLabelStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 750,
  textAlign: "left"
};

const insertPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden",
  borderBottom: "1px solid #e5e7eb"
};

const insertGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
  padding: "0 10px 12px"
};

const insertToolButtonStyle: CSSProperties = {
  minWidth: 0,
  height: 28,
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  alignItems: "center",
  gap: 4,
  padding: "0 5px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  background: "#ffffff",
  cursor: "pointer"
};

const insertToolIconStyle: CSSProperties = {
  display: "block",
  width: 16,
  height: 16,
  objectFit: "contain"
};

const insertToolLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "inherit",
  font: `700 10px/1 ${UI_FONT_FAMILY}`,
  textAlign: "left"
};

const leftPanelStyle: CSSProperties = {
  gridColumn: 2,
  gridRow: 2,
  height: "100%",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) 286px",
  borderRight: "1px solid #d8dee8",
  background: "#ffffff",
  overflow: "hidden"
};

const rightPanelStyle: CSSProperties = {
  gridColumn: 4,
  gridRow: 2,
  height: "100%",
  minHeight: 0,
  borderLeft: "1px solid #d8dee8",
  background: "#ffffff",
  overflowY: "auto"
};

const mainStyle: CSSProperties = {
  gridColumn: 3,
  gridRow: 2,
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  overflow: "hidden"
};

const topToolbarStyle: CSSProperties = {
  gridColumn: "1 / -1",
  gridRow: 1,
  height: 60,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 14px",
  background: "#ffffff",
  borderBottom: "1px solid #d8dee8",
  overflow: "hidden"
};

const toolbarGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: "0 0 auto"
};

const toolbarClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flex: "0 0 auto",
  padding: "0 8px",
  borderLeft: "1px solid #edf0f5"
};

const toolbarBrandGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "0 0 auto",
  minWidth: 296
};

const toolbarCenterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minWidth: 0,
  flex: "1 1 auto",
  overflowX: "auto",
  scrollbarWidth: "none"
};

const brandMarkStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  background: "#4f46e5",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 13
};

const brandNameStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 850,
  letterSpacing: 0
};

const templateTitleStyle: CSSProperties = {
  maxWidth: 190,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  paddingLeft: 14,
  marginLeft: 4,
  borderLeft: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#111827"
};

const statusPillStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800
};

const toolbarButtonStyle: CSSProperties = {
  height: 32,
  minWidth: 32,
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid #d0d7e2",
  borderRadius: 5,
  background: "#ffffff",
  color: "#111827",
  font: `700 11px/1 ${UI_FONT_FAMILY}`
};

const toolbarIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  flex: "0 0 auto"
};

const dropdownWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex"
};

const splitButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 32,
  border: "1px solid #d0d7e2",
  borderRadius: 5,
  overflow: "hidden",
  background: "#ffffff"
};

const previewMainButtonStyle: CSSProperties = {
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 9px",
  border: 0,
  borderRight: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#111827",
  font: `800 11px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const previewChevronButtonStyle: CSSProperties = {
  width: 28,
  height: 30,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer"
};

const toolbarDropdownStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: 38,
  zIndex: 80,
  width: 228,
  display: "grid",
  gap: 2,
  padding: 6,
  border: "1px solid #d8dee8",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.16)"
};

const dropdownItemStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gap: 3,
  padding: "8px 9px",
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#111827",
  textAlign: "left"
};

const dropdownItemLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800
};

const dropdownItemDetailStyle: CSSProperties = {
  color: "#64748b",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10
};

const selectStyle: CSSProperties = {
  height: 32,
  maxWidth: 170,
  border: "1px solid #d0d7e2",
  borderRadius: 5,
  background: "#ffffff",
  color: "#111827",
  font: `600 12px/1 ${UI_FONT_FAMILY}`
};

const zoomLabelStyle: CSSProperties = {
  width: 44,
  textAlign: "center",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 12,
  fontWeight: 700,
  color: "#334155"
};

const canvasViewportStyle: CSSProperties = {
  position: "relative",
  minWidth: 0,
  minHeight: 0,
  overflow: "auto",
  display: "grid",
  placeItems: "center",
  padding: 48,
  background: "#e8edf4"
};

const canvasBoardStyle: CSSProperties = {
  position: "relative",
  flex: "0 0 auto"
};

const canvasPageControlStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 18,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 6,
  border: "1px solid #d8dee8",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
  transform: "translateX(-50%)"
};

const canvasPageControlLabelStyle: CSSProperties = {
  minWidth: 150,
  padding: "0 10px",
  color: "#334155",
  fontSize: 12,
  fontWeight: 750,
  textAlign: "center"
};

const canvasDockStyle: CSSProperties = {
  position: "absolute",
  left: 18,
  bottom: 18,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 6,
  border: "1px solid #d8dee8",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.94)",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.12)",
  backdropFilter: "blur(10px)"
};

const canvasDockZoomStyle: CSSProperties = {
  minWidth: 46,
  color: "#334155",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center"
};

const dockSeparatorStyle: CSSProperties = {
  width: 1,
  height: 20,
  margin: "0 3px",
  background: "#e5e7eb"
};

const scaledPageWrapStyle: CSSProperties = {
  position: "absolute"
};

const pageCanvasStyle: CSSProperties = {
  position: "relative",
  transformOrigin: "top left",
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.07)",
  overflow: "hidden"
};

const pageBadgeStyle: CSSProperties = {
  position: "absolute",
  zIndex: 12,
  padding: "3px 6px",
  borderRadius: 4,
  background: "#6d5dfc",
  color: "#ffffff",
  font: `800 9px/1.2 ${UI_MONO_FONT_FAMILY}`,
  whiteSpace: "nowrap",
  pointerEvents: "none"
};

const selectionHandleStyle: CSSProperties = {
  position: "absolute",
  width: 8,
  height: 8,
  border: "1px solid #2563eb",
  borderRadius: 2,
  background: "#ffffff"
};

const repeatPlaceholderStyle: CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  bottom: 12,
  minHeight: 48,
  display: "grid",
  placeItems: "center",
  gap: 2,
  padding: 8,
  borderRadius: 6,
  color: "#7c3aed",
  background: "rgba(124, 58, 237, 0.06)",
  font: `11px/1.35 ${UI_FONT_FAMILY}`,
  textAlign: "center",
  pointerEvents: "none"
};

const rulerCornerStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: RULER_SIZE,
  height: RULER_SIZE,
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc"
};

const topRulerStyle: CSSProperties = {
  position: "absolute",
  left: RULER_SIZE,
  top: 0,
  height: RULER_SIZE,
  right: 0,
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc"
};

const leftRulerStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: RULER_SIZE,
  width: RULER_SIZE,
  bottom: 0,
  borderRight: "1px solid #cbd5e1",
  background: "#f8fafc"
};

const topRulerTickStyle: CSSProperties = {
  position: "absolute",
  top: 3,
  height: 18,
  borderLeft: "1px solid #94a3b8",
  paddingLeft: 3,
  color: "#64748b",
  font: `9px/1 ${UI_MONO_FONT_FAMILY}`
};

const leftRulerTickStyle: CSSProperties = {
  position: "absolute",
  left: 3,
  width: 18,
  borderTop: "1px solid #94a3b8",
  paddingTop: 2,
  color: "#64748b",
  font: `9px/1 ${UI_MONO_FONT_FAMILY}`,
  writingMode: "vertical-rl"
};

const verticalGuideStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  cursor: "ew-resize",
  zIndex: 8
};

const horizontalGuideStyle: CSSProperties = {
  position: "absolute",
  height: 1,
  cursor: "ns-resize",
  zIndex: 8
};

const pagesPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden",
  borderBottom: "1px solid #e5e7eb"
};

const pageListStyle: CSSProperties = {
  maxHeight: 94,
  overflowY: "auto",
  padding: "0 10px 10px"
};

const pageButtonStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gap: 2,
  padding: "7px 8px",
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#111827",
  textAlign: "left",
  cursor: "pointer"
};

const layersPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden"
};

const layersHeaderStyle: CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 12px",
  borderBottom: "1px solid #f2f4f7"
};

const layersAddButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  color: "#475467",
  font: `600 20px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const layerListStyle: CSSProperties = {
  height: "calc(100% - 42px)",
  minHeight: 0,
  overflowY: "auto",
  padding: "6px 8px 14px"
};

const layerButtonStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gap: 2,
  padding: "7px 8px",
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#111827",
  textAlign: "left",
  cursor: "pointer"
};

const layerTreeRowStyle: CSSProperties = {
  width: "100%",
  height: 28,
  display: "grid",
  gridTemplateColumns: "14px 18px minmax(0, 1fr)",
  alignItems: "center",
  gap: 6,
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#667085",
  textAlign: "left",
  cursor: "pointer",
  font: `500 14px/21px ${UI_FONT_FAMILY}`
};

const layerTreeCaretStyle: CSSProperties = {
  width: 14,
  height: 14,
  objectFit: "contain"
};

const layerTreeIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  objectFit: "contain"
};

const layerTreeLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 12px 8px"
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800
};

const panelDetailStyle: CSSProperties = {
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  color: "#64748b"
};

const layerNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 700
};

const layerMetaStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  color: "#64748b"
};

const dataPanelStyle: CSSProperties = {
  minHeight: 0,
  borderTop: "1px solid #e5e7eb",
  overflow: "hidden"
};

const dataFieldsStyle: CSSProperties = {
  height: 202,
  overflowY: "auto",
  padding: "0 10px 12px"
};

const dataFieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "7px 8px",
  borderRadius: 6,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  marginBottom: 6
};

const dataSearchStyle: CSSProperties = {
  width: "calc(100% - 20px)",
  height: 30,
  margin: "0 10px 8px",
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  color: "#111827",
  font: `12px/1.2 ${UI_FONT_FAMILY}`
};

const dataFieldHeaderStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};

const dataTypePillStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "2px 5px",
  border: "1px solid #e5e7eb",
  borderRadius: 999,
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 9,
  fontWeight: 800
};

const dataFieldActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  marginTop: 2
};

const dataActionButtonStyle: CSSProperties = {
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "0 6px",
  border: "1px solid #d8dee8",
  borderRadius: 5,
  background: "#ffffff",
  color: "#334155",
  font: `700 10px/1 ${UI_FONT_FAMILY}`
};

const inspectorStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14
};

const noticeStyle: CSSProperties = {
  padding: 8,
  borderRadius: 6,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 11,
  lineHeight: 1.4
};

const inspectorTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  borderBottom: "1px solid #e5e7eb",
  margin: "-2px -14px 4px"
};

const inspectorTabStyle: CSSProperties = {
  height: 38,
  border: 0,
  borderBottom: "2px solid transparent",
  background: "transparent",
  font: `700 12px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const inspectorSectionStackStyle: CSSProperties = {
  display: "grid",
  gap: 10
};

const inspectorSectionStyle: CSSProperties = {
  display: "grid",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#ffffff",
  overflow: "hidden"
};

const inspectorSectionSummaryStyle: CSSProperties = {
  minHeight: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 10px",
  borderBottom: "1px solid #f2f4f7",
  color: "#111827",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  cursor: "pointer"
};

const inspectorSectionDetailStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#64748b",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "none"
};

const inspectorSectionBodyStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 10
};

const segmentedControlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gap: 2,
  padding: 2,
  border: "1px solid #d8dee8",
  borderRadius: 7,
  background: "#f8fafc"
};

const segmentedButtonStyle: CSSProperties = {
  minHeight: 26,
  padding: "0 6px",
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  font: `700 10px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const propertySectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb"
};

const propertySubsectionStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  background: "#f8fafc"
};

const sectionTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#334155",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0
};

const twoColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8
};

const readOnlyRowStyle: CSSProperties = {
  display: "grid",
  gap: 4
};

const inputRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  gap: 8,
  alignItems: "center"
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b"
};

const fieldValueStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 12,
  color: "#111827"
};

const numberInputStyle: CSSProperties = {
  height: 30,
  width: "100%",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  font: `12px/1 ${UI_MONO_FONT_FAMILY}`
};

const textInputStyle: CSSProperties = {
  height: 30,
  width: "100%",
  minWidth: 0,
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  color: "#111827",
  font: `12px/1.2 ${UI_FONT_FAMILY}`
};

const textAreaRowStyle: CSSProperties = {
  display: "grid",
  gap: 6
};

const textAreaInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  resize: "vertical",
  padding: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  color: "#111827",
  font: `12px/1.35 ${UI_MONO_FONT_FAMILY}`
};

const propertyToggleStyle: CSSProperties = {
  minHeight: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 9px",
  border: "1px solid #d8dee8",
  borderRadius: 6,
  font: `700 12px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const togglePillStyle: CSSProperties = {
  padding: "2px 6px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.76)",
  color: "inherit",
  fontSize: 10,
  fontWeight: 900
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "#e5e7eb",
  margin: "2px 0"
};

const jsonPreviewStyle: CSSProperties = {
  margin: 0,
  padding: 10,
  borderRadius: 6,
  background: "#0f172a",
  color: "#e2e8f0",
  font: `11px/1.4 ${UI_MONO_FONT_FAMILY}`,
  overflow: "auto"
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  padding: 14,
  color: "#64748b",
  fontSize: 13
};

const previewOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "grid",
  gridTemplateRows: "48px minmax(0, 1fr)",
  background: "rgba(15, 23, 42, 0.56)"
};

const previewToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  background: "#ffffff",
  borderBottom: "1px solid #d8dee8"
};

const previewScrollStyle: CSSProperties = {
  minHeight: 0,
  overflow: "auto",
  padding: 28
};
