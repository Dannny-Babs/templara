import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
} from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  BarcodeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  Copy01Icon,
  CubeIcon,
  CursorPointer02Icon,
  FrameIcon,
  GridTableIcon,
  Image01Icon,
  BendToolIcon,
  Link01Icon,
  MinusSignIcon,
  QrCodeIcon,
  RepeatIcon,
  Redo03Icon,
  SignatureIcon,
  SquareIcon,
  ThirdBracketIcon,
  TypeCursorIcon,
  Undo03Icon,
  ViewIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import {
  ChevronDownIcon as ChevronDownSharpIcon,
  ChevronRightIcon as ChevronRightSharpIcon,
} from "@hugeicons-pro/core-stroke-sharp";
import type {
  BarcodeNode,
  ConditionalNode,
  DataField,
  DocNode,
  DocumentTemplate,
  FlowNode,
  Frame,
  GridNode,
  GroupNode,
  ImageNode,
  PageLayer,
  QrNode,
  RepeatNode,
  ShapeNode,
  TextNode,
} from "@templara/core";
import { DocumentPreview } from "@templara/react-renderer";
import { renderDocument } from "@templara/renderer";
import type { ExportPreflight } from "@templara/pdf";
import {
  buildExportFontCss,
  collectExportDiagnostics,
  exportPreviewToPdf,
} from "@templara/pdf";
import type {
  EditorNodeItem,
  EditorRenderNode,
  EditorVisual,
  ResizeHandle,
} from "./editorModel";
import type { ReorderCommand } from "./editorModel";
import {
  buildEditorPageModel,
  collectPageNodeItems,
  findEditableNode,
  getResizeFramePatch,
  groupNodesInTemplate,
  moveNodeInTemplate,
  reorderNodeInTemplate,
  ungroupNodeInTemplate,
  updateNodeById,
  updateNodesById,
} from "./editorModel";
import type { HistoryTransaction } from "./history";
import {
  DEFAULT_HISTORY_COALESCE_MS,
  advanceHistoryTransaction,
  shouldStartNewHistoryEntry,
} from "./history";
import type { DataExplorerField, DataExplorerGroup } from "./dataExplorer";
import {
  applyDataBindingToNode,
  buildDataExplorerModel,
  createBoundTextNode,
  isFieldBindableForNode,
} from "./dataExplorer";
import {
  NodeInspectorPanel,
  PageInspectorPanel,
  initialInspectorUiState,
  inspectorUiReducer,
  resolvePageInspectorDraft,
} from "./inspector";
import type { InsertTool } from "./shortcuts";
import { resolveEditorShortcut } from "./shortcuts";

export type {
  AlignmentCommand,
  EditorPageModel,
  EditorRenderNode,
} from "./editorModel";
export {
  buildEditorPageModel,
  collectPageNodeItems,
  getAlignmentFramePatches,
} from "./editorModel";

const DEFAULT_ZOOM = 0.76;
const GRID_SIZE = 8;
const SNAP_THRESHOLD = 5;
const RULER_SIZE = 24;
const TOOLTIP_DELAY_MS = 420;
const BINDING_DRAG_TYPE = "application/x-templara-binding";
const INSPECTOR_PANEL_WIDTH = 320;
const INSPECTOR_MIN_WIDTH = 280;
const INSPECTOR_MAX_WIDTH = 640;
const DATA_PANEL_DEFAULT_HEIGHT = 286;
const DATA_PANEL_MIN_HEIGHT = 44;
const DATA_PANEL_MAX_HEIGHT = 620;
const UI_FONT_FAMILY =
  'Geist, "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const UI_MONO_FONT_FAMILY =
  '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const UI_CHROME_BORDER = "#e8ecf1";
const UI_CHROME_RADIUS = 6;
const UI_SURFACE_SHADOW = "0 1px 2px rgba(15, 23, 42, 0.04)";
const UI_FOCUS_RING_SHADOW =
  "0 0 0 1px rgba(99, 102, 241, 0.38), 0 1px 2px rgba(15, 23, 42, 0.05)";
const UI_SELECTION_RING =
  "0 0 0 1px rgba(99, 102, 241, 0.32), 0 1px 2px rgba(15, 23, 42, 0.04)";
const UI_SELECTION_BG = "#f8faff";

export interface DocumentEditorProps {
  value: DocumentTemplate;
  data?: Record<string, unknown>;
  onChange?: (nextValue: DocumentTemplate) => void;
  onDataChange?: (nextData: Record<string, unknown>) => void;
  initialPageId?: string;
  onActivePageChange?: (pageId: string) => void;
  /**
   * Optional custom control rendered in the top toolbar next to the document
   * title (e.g. a template switcher supplied by the host app). Kept out of the
   * action cluster so it never overlaps Preview/Save.
   */
  toolbarAccessory?: ReactNode;
}

type EditableNode = DocNode | FlowNode;
type PreviewMode = "sample" | "large" | "export";
type GuideAxis = "x" | "y";

interface DragState {
  nodeIds: string[];
  startClientX: number;
  startClientY: number;
  startFrames: Record<string, Frame>;
  startAbsoluteFrames: Record<string, Frame>;
  startTemplate: DocumentTemplate;
  historyRecorded: boolean;
}

interface ResizeState {
  nodeId: string;
  handle: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startFrame: Frame;
  startTemplate: DocumentTemplate;
  historyRecorded: boolean;
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
  type?: string;
  nodeId?: string;
  pageId?: string;
  parentId?: string;
  isContainer?: boolean;
  hasChildren?: boolean;
  collapsed?: boolean;
}

type LayerDropIntent = "before" | "after" | "inside";

interface LayerMoveTarget {
  referenceId: string;
  position: LayerDropIntent;
}

interface DropdownFrame {
  top: number;
  left: number;
  width: number;
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
  textAlt: "/icons/carbon_text-small-caps-1.svg",
} as const;

const insertTools: InsertToolDefinition[] = [
  { id: "select", label: "Select", shortcut: "V", icon: CursorPointer02Icon },
  { id: "text", label: "Text", shortcut: "T", icon: TypeCursorIcon },
  { id: "image", label: "Image", shortcut: "I", icon: Image01Icon },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: SquareIcon },
  { id: "line", label: "Line", shortcut: "L", icon: BendToolIcon },
  { id: "shape", label: "Shape", shortcut: "O", icon: CircleIcon },
  { id: "barcode", label: "Barcode", shortcut: "B", icon: BarcodeIcon },
  { id: "qr", label: "QR Code", shortcut: "Q", icon: QrCodeIcon },
  { id: "table", label: "Table", shortcut: "G", icon: GridTableIcon },
  { id: "repeat", label: "Repeat", shortcut: "E", icon: RepeatIcon },
  {
    id: "condition",
    label: "Condition",
    shortcut: "C",
    icon: ThirdBracketIcon,
  },
  { id: "frame", label: "Frame", shortcut: "F", icon: FrameIcon },
  { id: "signature", label: "Signature", shortcut: "S", icon: SignatureIcon },
];

export function DocumentEditor({
  value,
  data,
  onChange,
  onDataChange,
  initialPageId,
  onActivePageChange,
  toolbarAccessory,
}: DocumentEditorProps): ReactElement {
  const [draftTemplate, setDraftTemplate] = useState<DocumentTemplate>(() =>
    structuredClone(value),
  );
  const [draftData, setDraftData] = useState<
    Record<string, unknown> | undefined
  >(() => cloneEditorData(data));
  const [historyPast, setHistoryPast] = useState<DocumentTemplate[]>([]);
  const [historyFuture, setHistoryFuture] = useState<DocumentTemplate[]>([]);
  const [activePageId, setActivePageId] = useState<string>(
    () => initialPageId ?? value.pages[0]?.id ?? "",
  );
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<InsertTool>("select");
  const [inspectorUiState, dispatchInspectorUi] = useReducer(
    inspectorUiReducer,
    initialInspectorUiState,
  );
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [verticalGuides, setVerticalGuides] = useState<number[]>([]);
  const [horizontalGuides, setHorizontalGuides] = useState<number[]>([]);
  const [activeGuides, setActiveGuides] = useState<ActiveGuide[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("sample");
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const dragState = useRef<DragState | null>(null);
  const resizeState = useRef<ResizeState | null>(null);
  const guideDragState = useRef<GuideDragState | null>(null);
  const historyTransaction = useRef<HistoryTransaction | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_PANEL_WIDTH);
  const [dataPanelHeight, setDataPanelHeight] = useState(DATA_PANEL_DEFAULT_HEIGHT);

  const beginInspectorResize = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = inspectorWidth;
      const onMove = (moveEvent: globalThis.PointerEvent): void => {
        const next = Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, startWidth + (startX - moveEvent.clientX)));
        setInspectorWidth(next);
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [inspectorWidth],
  );

  const beginDataPanelResize = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = dataPanelHeight;
      const onMove = (moveEvent: globalThis.PointerEvent): void => {
        const next = Math.min(DATA_PANEL_MAX_HEIGHT, Math.max(DATA_PANEL_MIN_HEIGHT, startHeight + (startY - moveEvent.clientY)));
        setDataPanelHeight(next);
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [dataPanelHeight],
  );

  const toggleDataPanelCollapsed = useCallback(() => {
    setDataPanelHeight((current) => (current <= DATA_PANEL_MIN_HEIGHT ? DATA_PANEL_DEFAULT_HEIGHT : DATA_PANEL_MIN_HEIGHT));
  }, []);

  useEffect(() => {
    const nextTemplate = structuredClone(value);
    const nextPageId = initialPageId ?? nextTemplate.pages[0]?.id ?? "";

    setDraftTemplate(nextTemplate);
    setActivePageId(nextPageId);
    setSelectedNodeIds([]);
    setVerticalGuides([]);
    setHorizontalGuides([]);
    setHistoryPast([]);
    setHistoryFuture([]);
  }, [initialPageId, value]);

  useEffect(() => {
    setDraftData(cloneEditorData(data));
  }, [data]);

  useEffect(() => {
    if (!draftTemplate.pages.some((page) => page.id === activePageId)) {
      const fallbackPageId = draftTemplate.pages[0]?.id ?? "";
      setActivePageId(fallbackPageId);
      onActivePageChange?.(fallbackPageId);
    }
  }, [activePageId, draftTemplate.pages, onActivePageChange]);

  const pageModel = useMemo(
    () => buildEditorPageModel(draftTemplate, activePageId),
    [activePageId, draftTemplate],
  );
  const pageInspectorDraft = useMemo(
    () => resolvePageInspectorDraft(inspectorUiState, activePageId),
    [activePageId, inspectorUiState],
  );
  const nodeItems = useMemo(
    () => collectPageNodeItems(draftTemplate, activePageId),
    [activePageId, draftTemplate],
  );
  const itemLookup = useMemo(
    () => new Map(nodeItems.map((item) => [item.id, item])),
    [nodeItems],
  );
  const selectedItems = selectedNodeIds
    .map((id) => itemLookup.get(id))
    .filter((item): item is EditorNodeItem => Boolean(item));
  const primarySelectedItem = selectedItems[0];
  const dataExplorerModel = useMemo(
    () =>
      buildDataExplorerModel({
        template: draftTemplate,
        data: draftData,
        nodeItems,
        selectedNodeIds,
      }),
    [draftData, draftTemplate, nodeItems, selectedNodeIds],
  );
  const previewData = useMemo(
    () =>
      previewMode === "large" ? amplifyPreviewData(draftData) : draftData,
    [draftData, previewMode],
  );
  const previewDocument = useMemo(
    () =>
      renderDocument({
        template: draftTemplate,
        data: previewData,
        mode: "preview",
      }),
    [previewData, draftTemplate],
  );
  const fontImports = useMemo(
    () => buildFontImports(draftTemplate),
    [draftTemplate],
  );

  useEffect(() => {
    setSelectedNodeIds((ids) => ids.filter((id) => itemLookup.has(id)));
  }, [itemLookup]);

  useEffect(() => {
    dispatchInspectorUi({
      type: "garbage-collect",
      targetIds: [
        `page:${activePageId}`,
        ...nodeItems.map((item) => `node:${item.id}` as const),
      ],
    });
  }, [activePageId, nodeItems]);

  useEffect(() => {
    if (!fontImports || typeof window === "undefined") {
      return;
    }

    const styleId = "templara-editor-fonts";
    let styleElement = window.document.getElementById(
      styleId,
    ) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = window.document.createElement("style");
      styleElement.id = styleId;
      window.document.head.appendChild(styleElement);
    }

    styleElement.textContent = fontImports;
  }, [fontImports]);

  const commitTemplate = useCallback(
    (
      nextTemplate: DocumentTemplate,
      options: { history?: boolean; transaction?: string } = {},
    ) => {
      if (options.history !== false) {
        const now = Date.now();

        if (
          shouldStartNewHistoryEntry(
            historyTransaction.current,
            options.transaction,
            now,
            DEFAULT_HISTORY_COALESCE_MS,
          )
        ) {
          setHistoryPast((past) =>
            [...past, structuredClone(draftTemplate)].slice(-80),
          );
          setHistoryFuture([]);
        }

        historyTransaction.current = advanceHistoryTransaction(
          options.transaction,
          now,
        );
      }

      setDraftTemplate(nextTemplate);
      onChange?.(nextTemplate);
    },
    [draftTemplate, onChange],
  );

  const updateFramePatches = useCallback(
    (
      patches: Record<string, Partial<Frame>>,
      options: { history?: boolean; transaction?: string } = {},
    ) => {
      const nextTemplate = structuredClone(draftTemplate);

      if (updateNodesById(nextTemplate, patches)) {
        commitTemplate(nextTemplate, options);
      }
    },
    [commitTemplate, draftTemplate],
  );

  const updateNode = useCallback(
    (
      nodeId: string,
      update: (node: EditableNode) => void,
      options: { history?: boolean; transaction?: string } = {},
    ) => {
      const nextTemplate = structuredClone(draftTemplate);

      if (updateNodeById(nextTemplate, nodeId, update)) {
        commitTemplate(nextTemplate, options);
      }
    },
    [commitTemplate, draftTemplate],
  );

  const updatePage = useCallback(
    (
      pageId: string,
      update: (page: DocumentTemplate["pages"][number]) => void,
    ) => {
      const nextTemplate = structuredClone(draftTemplate);
      const page = nextTemplate.pages.find(
        (candidate) => candidate.id === pageId,
      );

      if (!page) {
        return;
      }

      update(page);
      commitTemplate(nextTemplate, { transaction: `page:${pageId}` });
    },
    [commitTemplate, draftTemplate],
  );

  const commitData = useCallback(
    (nextData: Record<string, unknown>) => {
      const cloned = structuredClone(nextData);
      setDraftData(cloned);
      onDataChange?.(cloned);
    },
    [onDataChange],
  );

  const undoTemplate = useCallback(() => {
    const previous = historyPast.at(-1);

    if (!previous) {
      return;
    }

    const nextTemplate = structuredClone(previous);
    historyTransaction.current = null;
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) =>
      [structuredClone(draftTemplate), ...future].slice(0, 80),
    );
    setDraftTemplate(nextTemplate);
    onChange?.(nextTemplate);
  }, [draftTemplate, historyPast, onChange]);

  const redoTemplate = useCallback(() => {
    const next = historyFuture[0];

    if (!next) {
      return;
    }

    const nextTemplate = structuredClone(next);
    historyTransaction.current = null;
    setHistoryFuture((future) => future.slice(1));
    setHistoryPast((past) =>
      [...past, structuredClone(draftTemplate)].slice(-80),
    );
    setDraftTemplate(nextTemplate);
    onChange?.(nextTemplate);
  }, [draftTemplate, historyFuture, onChange]);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const nextTemplate = structuredClone(draftTemplate);
      const duplicatedId = duplicateNodeInTemplate(nextTemplate, nodeId);

      if (!duplicatedId) {
        return;
      }

      commitTemplate(nextTemplate);
      setSelectedNodeIds([duplicatedId]);
    },
    [commitTemplate, draftTemplate],
  );

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      const nextTemplate = structuredClone(draftTemplate);
      let changed = false;

      for (const nodeId of nodeIds) {
        if (findEditableNode(nextTemplate, nodeId)?.locked === true) {
          continue;
        }

        changed = deleteNodeFromTemplate(nextTemplate, nodeId) || changed;
      }

      if (!changed) {
        return;
      }

      commitTemplate(nextTemplate);
      setSelectedNodeIds([]);
    },
    [commitTemplate, draftTemplate],
  );

  const reorderSelected = useCallback(
    (command: ReorderCommand) => {
      if (selectedNodeIds.length !== 1) {
        return;
      }

      const nextTemplate = structuredClone(draftTemplate);

      if (reorderNodeInTemplate(nextTemplate, selectedNodeIds[0], command)) {
        commitTemplate(nextTemplate);
      }
    },
    [commitTemplate, draftTemplate, selectedNodeIds],
  );

  const handleToggleLayerCollapse = useCallback((nodeId: string) => {
    setCollapsedLayerIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleMoveLayerNode = useCallback(
    (nodeId: string, target: LayerMoveTarget) => {
      const nextTemplate = structuredClone(draftTemplate);

      if (moveNodeInTemplate(nextTemplate, nodeId, target)) {
        commitTemplate(nextTemplate, { transaction: `move-layer-${nodeId}` });
      }
    },
    [commitTemplate, draftTemplate],
  );

  const groupSelected = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      return;
    }

    const nextTemplate = structuredClone(draftTemplate);
    const groupId = groupNodesInTemplate(
      nextTemplate,
      selectedNodeIds,
      createNodeId(nextTemplate, "group"),
    );

    if (!groupId) {
      return;
    }

    commitTemplate(nextTemplate);
    setSelectedNodeIds([groupId]);
  }, [commitTemplate, draftTemplate, selectedNodeIds]);

  const ungroupSelected = useCallback(() => {
    if (selectedNodeIds.length !== 1) {
      return;
    }

    const nextTemplate = structuredClone(draftTemplate);
    const freed = ungroupNodeInTemplate(nextTemplate, selectedNodeIds[0]);

    if (!freed) {
      return;
    }

    commitTemplate(nextTemplate);
    setSelectedNodeIds(freed);
  }, [commitTemplate, draftTemplate, selectedNodeIds]);

  const setActivePage = useCallback(
    (pageId: string) => {
      setActivePageId(pageId);
      setSelectedNodeIds([]);
      onActivePageChange?.(pageId);
    },
    [onActivePageChange],
  );

  useEffect(() => {
    function handleToolShortcut(event: globalThis.KeyboardEvent): void {
      const command = resolveEditorShortcut(event, {
        previewOpen,
        selectedCount: selectedNodeIds.length,
        target: event.target instanceof HTMLElement ? event.target : null,
        tools: insertTools,
      });

      if (!command) {
        return;
      }

      // Escape (reset to the select tool) preserves the browser default the way
      // it did before this handler was extracted; every other handled shortcut
      // cancels it.
      if (event.key !== "Escape") {
        event.preventDefault();
      }

      switch (command.type) {
        case "undo":
          undoTemplate();
          return;
        case "redo":
          redoTemplate();
          return;
        case "delete":
          deleteNodes(selectedNodeIds);
          return;
        case "duplicate":
          duplicateNode(selectedNodeIds[0]);
          return;
        case "group":
          groupSelected();
          return;
        case "ungroup":
          ungroupSelected();
          return;
        case "reorder":
          reorderSelected(command.command);
          return;
        case "select-tool":
          setActiveTool(command.tool);
          return;
        case "nudge": {
          const patches: Record<string, Partial<Frame>> = {};

          for (const id of selectedNodeIds) {
            const item = itemLookup.get(id);

            if (!item || item.node.locked === true) {
              continue;
            }

            patches[id] = {
              x: roundFrameValue(item.frame.x + command.dx),
              y: roundFrameValue(item.frame.y + command.dy),
            };
          }

          if (Object.keys(patches).length === 0) {
            return;
          }

          updateFramePatches(patches, {
            transaction: `nudge:${selectedNodeIds.join(",")}`,
          });
          return;
        }
      }
    }

    window.addEventListener("keydown", handleToolShortcut);

    return () => {
      window.removeEventListener("keydown", handleToolShortcut);
    };
  }, [
    deleteNodes,
    duplicateNode,
    groupSelected,
    itemLookup,
    previewOpen,
    redoTemplate,
    reorderSelected,
    selectedNodeIds,
    ungroupSelected,
    undoTemplate,
    updateFramePatches,
  ]);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent): void {
      if (guideDragState.current) {
        updateDraggedGuide(
          event,
          guideDragState.current,
          boardRef.current,
          zoom,
          setVerticalGuides,
          setHorizontalGuides,
        );
        return;
      }

      const resize = resizeState.current;

      if (resize) {
        const delta = {
          x: (event.clientX - resize.startClientX) / zoom,
          y: (event.clientY - resize.startClientY) / zoom,
        };
        const patch = getResizeFramePatch(resize.startFrame, resize.handle, delta, {
          lockAspect: event.shiftKey,
          snap: (value) => snapCoordinate(value, snapToGrid),
        });

        const changed =
          (patch.x != null && patch.x !== resize.startFrame.x) ||
          (patch.y != null && patch.y !== resize.startFrame.y) ||
          (patch.width != null && patch.width !== resize.startFrame.width) ||
          (patch.height != null && patch.height !== resize.startFrame.height);

        if (!changed) {
          return;
        }

        if (!resize.historyRecorded) {
          setHistoryPast((past) =>
            [...past, structuredClone(resize.startTemplate)].slice(-80),
          );
          setHistoryFuture([]);
          resize.historyRecorded = true;
        }

        updateFramePatches({ [resize.nodeId]: patch }, { history: false });
        return;
      }

      const drag = dragState.current;

      if (!drag) {
        return;
      }

      const rawDelta = {
        x: (event.clientX - drag.startClientX) / zoom,
        y: (event.clientY - drag.startClientY) / zoom,
      };
      const snapped = snapMove(rawDelta, drag, nodeItems, pageModel.size, {
        snapToGrid,
        snapToGuides,
        verticalGuides,
        horizontalGuides,
      });
      const patches: Record<string, Partial<Frame>> = {};

      for (const nodeId of drag.nodeIds) {
        const startFrame = drag.startFrames[nodeId];

        if (!startFrame) {
          continue;
        }

        patches[nodeId] = {
          x: roundFrameValue(startFrame.x + snapped.delta.x),
          y: roundFrameValue(startFrame.y + snapped.delta.y),
        };
      }

      const moved = Object.entries(patches).some(([nodeId, patch]) => {
        const startFrame = drag.startFrames[nodeId];

        return Boolean(
          startFrame &&
          ((patch.x != null && patch.x !== startFrame.x) ||
            (patch.y != null && patch.y !== startFrame.y)),
        );
      });

      if (!moved) {
        setActiveGuides(snapped.guides);
        return;
      }

      if (!drag.historyRecorded) {
        setHistoryPast((past) =>
          [...past, structuredClone(drag.startTemplate)].slice(-80),
        );
        setHistoryFuture([]);
        drag.historyRecorded = true;
      }

      setActiveGuides(snapped.guides);
      updateFramePatches(patches, { history: false });
    }

    function handlePointerUp(): void {
      dragState.current = null;
      resizeState.current = null;
      guideDragState.current = null;
      setActiveGuides([]);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    horizontalGuides,
    nodeItems,
    pageModel.size,
    snapToGrid,
    snapToGuides,
    updateFramePatches,
    verticalGuides,
    zoom,
  ]);

  const handleNodePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>, node: EditorRenderNode) => {
      event.stopPropagation();

      const nextSelection = getNextSelection(
        selectedNodeIds,
        node.sourceNodeId,
        event.shiftKey,
      );
      const dragItems = nextSelection
        .map((id) => itemLookup.get(id))
        .filter((item): item is EditorNodeItem => Boolean(item));

      setSelectedNodeIds(nextSelection);

      const movableItems = dragItems.filter(
        (item) => item.node.locked !== true,
      );

      if (movableItems.length === 0) {
        dragState.current = null;
        return;
      }

      dragState.current = {
        nodeIds: movableItems.map((item) => item.id),
        startClientX: event.clientX,
        startClientY: event.clientY,
        startFrames: Object.fromEntries(
          movableItems.map((item) => [item.id, item.frame]),
        ),
        startAbsoluteFrames: Object.fromEntries(
          movableItems.map((item) => [item.id, item.absoluteFrame]),
        ),
        startTemplate: structuredClone(draftTemplate),
        historyRecorded: false,
      };
    },
    [draftTemplate, itemLookup, selectedNodeIds],
  );

  const handleStartResize = useCallback(
    (event: PointerEvent<HTMLElement>, handle: ResizeHandle) => {
      event.stopPropagation();

      if (selectedNodeIds.length !== 1) {
        return;
      }

      const item = itemLookup.get(selectedNodeIds[0]);

      if (!item || item.node.locked === true) {
        return;
      }

      resizeState.current = {
        nodeId: item.id,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startFrame: item.frame,
        startTemplate: structuredClone(draftTemplate),
        historyRecorded: false,
      };
    },
    [draftTemplate, itemLookup, selectedNodeIds],
  );

  const handleLayerSelect = useCallback(
    (event: MouseEvent<HTMLElement>, nodeId: string) => {
      setSelectedNodeIds((ids) =>
        getNextSelection(ids, nodeId, event.shiftKey),
      );
    },
    [],
  );

  const handlePagePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === "select") {
        setSelectedNodeIds([]);
        return;
      }

      const point = getPagePoint(event, zoom);
      const nextTemplate = structuredClone(draftTemplate);
      const node = createNodeForTool(
        activeTool,
        nextTemplate,
        snapPoint(point, snapToGrid),
      );
      const page = nextTemplate.pages.find(
        (candidate) => candidate.id === activePageId,
      );
      const layer = page ? getWritableFixedLayer(page.layers) : undefined;

      if (!layer) {
        return;
      }

      layer.nodes.push(node);
      commitTemplate(nextTemplate);
      setSelectedNodeIds([node.id]);
      setActiveTool("select");
    },
    [activePageId, activeTool, commitTemplate, draftTemplate, snapToGrid, zoom],
  );

  const handleFrameChange = useCallback(
    (nodeId: string, patch: Partial<Frame>) => {
      const current = itemLookup.get(nodeId);

      if (!current) {
        return;
      }

      updateFramePatches(
        {
          [nodeId]: {
            ...patch,
            x:
              patch.x == null ? undefined : snapCoordinate(patch.x, snapToGrid),
            y:
              patch.y == null ? undefined : snapCoordinate(patch.y, snapToGrid),
          },
        },
        { transaction: `frame:${nodeId}` },
      );
    },
    [itemLookup, snapToGrid, updateFramePatches],
  );

  const handleFitPage = useCallback(() => {
    const viewport = boardRef.current?.closest(
      "[data-templara-editor-viewport]",
    ) as HTMLElement | null;

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
      1,
    );

    setZoom(clampZoom(nextZoom));
  }, [pageModel.size.height, pageModel.size.width, showRulers]);

  const activePageIndex = draftTemplate.pages.findIndex(
    (page) => page.id === activePageId,
  );
  const safeActivePageIndex = activePageIndex >= 0 ? activePageIndex : 0;

  const createBoundTextAtPoint = useCallback(
    (field: DataExplorerField, point: Pick<Frame, "x" | "y">) => {
      if (!isFieldBindableForNode(field)) {
        return;
      }

      const nextTemplate = structuredClone(draftTemplate);
      const page = nextTemplate.pages.find(
        (candidate) => candidate.id === activePageId,
      );
      const layer = page ? getWritableFixedLayer(page.layers) : undefined;

      if (!layer) {
        return;
      }

      const node = createBoundTextNode(
        createNodeId(nextTemplate, "bound-field"),
        field.path,
        snapPoint(point, snapToGrid),
      );
      layer.nodes.push(node);
      commitTemplate(nextTemplate);
      setSelectedNodeIds([node.id]);
      setActiveTool("select");
    },
    [activePageId, commitTemplate, draftTemplate, snapToGrid],
  );

  const handleDataFieldActivate = useCallback(
    (field: DataExplorerField) => {
      if (selectedNodeIds.length > 1) {
        return;
      }

      if (primarySelectedItem) {
        if (!isFieldBindableForNode(field, primarySelectedItem.node)) {
          return;
        }

        updateNode(primarySelectedItem.id, (node) =>
          applyDataBindingToNode(node, field.path),
        );
        return;
      }

      createBoundTextAtPoint(field, defaultDataInsertPoint(pageModel));
    },
    [
      createBoundTextAtPoint,
      pageModel,
      primarySelectedItem,
      selectedNodeIds.length,
      updateNode,
    ],
  );

  const handleBindingDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, fieldPath: string) => {
      const field = dataExplorerModel.allFields.find(
        (candidate) => candidate.path === fieldPath,
      );

      if (!field) {
        return;
      }

      createBoundTextAtPoint(field, getPagePoint(event, zoom));
    },
    [createBoundTextAtPoint, dataExplorerModel.allFields, zoom],
  );

  return createElement(
    "div",
    {
      style: {
        ...shellStyle,
        gridTemplateColumns: `60px 300px minmax(0, 1fr) ${inspectorWidth}px`,
      },
    },
    createElement(TopToolbar, {
      templateName: templateDisplayName(draftTemplate, pageModel.name),
      zoom,
      canUndo: historyPast.length > 0,
      canRedo: historyFuture.length > 0,
      onZoomChange: setZoom,
      onFitPage: handleFitPage,
      onUndo: undoTemplate,
      onRedo: redoTemplate,
      onCopyTemplate: () => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(
            JSON.stringify(draftTemplate, null, 2),
          );
        }
      },
      onPreview: (mode: PreviewMode) => {
        setPreviewMode(mode);
        setPreviewOpen(true);
      },
      onSave: () => onChange?.(draftTemplate),
      accessory: toolbarAccessory,
    }),
    createElement(ToolRail, { activeTool, onSelectTool: setActiveTool }),
    createElement(
      "aside",
      {
        style: {
          ...leftPanelStyle,
          gridTemplateRows: `minmax(0, 1fr) ${dataPanelHeight}px`,
        },
      },
      createElement(NodeLayerList, {
        pages: draftTemplate.pages,
        items: nodeItems,
        activePageId,
        selectedNodeIds,
        collapsedIds: collapsedLayerIds,
        onSelectPage: setActivePage,
        onSelect: handleLayerSelect,
        onToggleCollapse: handleToggleLayerCollapse,
        onMoveNode: handleMoveLayerNode,
      }),
      createElement("div", {
        style: { ...panelRowResizeHandleStyle, bottom: dataPanelHeight - 3 },
        onPointerDown: beginDataPanelResize,
        onDoubleClick: toggleDataPanelCollapsed,
        title: "Drag to resize · double-click to collapse",
      }),
      createElement(DataSchemaPanel, {
        model: dataExplorerModel,
        selectedNode: primarySelectedItem?.node,
        selectedCount: selectedNodeIds.length,
        onActivateField: handleDataFieldActivate,
      }),
    ),
    createElement(
      "main",
      { style: mainStyle },
      createElement(EditorCanvas, {
        page: pageModel,
        pageInspectorDraft,
        zoom,
        showGrid,
        showRulers,
        selectedNodeIds,
        activeGuides,
        verticalGuides,
        horizontalGuides,
        boardRef,
        onNodePointerDown: handleNodePointerDown,
        onStartResize: handleStartResize,
        onPagePointerDown: handlePagePointerDown,
        onBindingDrop: handleBindingDrop,
        onStartGuideDrag: (axis, index) => {
          guideDragState.current = { axis, index };
        },
      }),
    ),
    createElement(
      "aside",
      {
        style: {
          ...rightPanelStyle,
          width: inspectorWidth,
          minWidth: inspectorWidth,
          maxWidth: inspectorWidth,
        },
      },
      createElement("div", {
        style: inspectorResizeHandleStyle,
        onPointerDown: beginInspectorResize,
        title: "Drag to resize",
      }),
      primarySelectedItem
        ? createElement(NodeInspectorPanel, {
            template: draftTemplate,
            data: draftData,
            item: primarySelectedItem,
            nodeItems,
            selectedCount: selectedItems.length,
            uiState: inspectorUiState,
            dispatch: dispatchInspectorUi,
            onFrameCommit: (framePatch) =>
              handleFrameChange(primarySelectedItem.id, framePatch),
            onNodeCommit: (update, options) =>
              updateNode(primarySelectedItem.id, update, options),
            onDuplicate: () => duplicateNode(primarySelectedItem.id),
            onDelete: () => deleteNodes(selectedNodeIds),
          })
        : createElement(PageInspectorPanel, {
            template: draftTemplate,
            data: draftData,
            page: pageModel,
            pageTemplate:
              draftTemplate.pages[safeActivePageIndex] ??
              draftTemplate.pages[0],
            uiState: inspectorUiState,
            dispatch: dispatchInspectorUi,
            showGrid,
            showRulers,
            snapToGrid,
            snapToGuides,
            onDataCommit: commitData,
            onTemplateCommit: (update) => {
              const nextTemplate = structuredClone(draftTemplate);
              update(nextTemplate);
              commitTemplate(nextTemplate);
            },
            onPageCommit: (update) => updatePage(pageModel.id, update),
            onToggleGrid: () => setShowGrid((value) => !value),
            onToggleRulers: () => setShowRulers((value) => !value),
            onToggleSnapGrid: () => setSnapToGrid((value) => !value),
            onToggleSnapGuides: () => setSnapToGuides((value) => !value),
          }),
    ),
    previewOpen
      ? createElement(PreviewOverlay, {
          document: previewDocument,
          title: templateDisplayName(draftTemplate),
          autoExport: previewMode === "export",
          onClose: () => setPreviewOpen(false),
        })
      : null,
  );
}

function templateDisplayName(
  template: DocumentTemplate,
  fallbackName?: string,
): string {
  const rawName = template.metadata?.name
    ? String(template.metadata.name)
    : fallbackName || template.id;
  return /\btemplate\b/i.test(rawName) ? rawName : `${rawName} Template`;
}

function cloneEditorData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return data ? structuredClone(data) : undefined;
}

const LARGE_PREVIEW_TARGET_ROWS = 50;

/**
 * Builds a "stress" dataset for the large-data preview by expanding every array
 * it finds (line items, rows, etc.) to {@link LARGE_PREVIEW_TARGET_ROWS} entries
 * by cycling the original elements. Nested arrays inside those elements are left
 * at their original size to avoid combinatorial blow-up.
 */
function amplifyPreviewData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) {
    return data;
  }

  return amplifyPreviewValue(data) as Record<string, unknown>;
}

function amplifyPreviewValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return value;
    }

    const expanded: unknown[] = [];
    let index = 0;
    while (expanded.length < LARGE_PREVIEW_TARGET_ROWS) {
      expanded.push(structuredClone(value[index % value.length]));
      index += 1;
    }
    return expanded;
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      next[key] = amplifyPreviewValue(entry);
    }
    return next;
  }

  return value;
}

function ToolRail({
  activeTool,
  onSelectTool,
}: {
  activeTool: InsertTool;
  onSelectTool: (tool: InsertTool) => void;
}): ReactElement {
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
    [clearTooltipTimer],
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
            color: activeTool === tool.id ? "#3730a3" : "#111827",
          },
        },
        createElement(ToolIcon, {
          icon: tool.icon,
          style: railIconStyle,
          size: 16,
        }),
        tooltipTool === tool.id
          ? createElement(
              "span",
              { style: toolTooltipStyle, role: "tooltip" },
              `${tool.label} (${tool.shortcut})`,
            )
          : null,
      ),
    ),
  );
}

function InsertPanel({
  activeTool,
  onSelectTool,
}: {
  activeTool: InsertTool;
  onSelectTool: (tool: InsertTool) => void;
}): ReactElement {
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
              color: activeTool === tool.id ? "#1d4ed8" : "#1d2939",
            },
          },
          createElement(ToolIcon, {
            icon: tool.icon,
            style: insertToolIconStyle,
            size: 15,
          }),
          createElement("span", { style: insertToolLabelStyle }, tool.label),
        ),
      ),
    ),
  );
}

function PagePanel({
  pages,
  activePageId,
  onSelectPage,
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
              borderColor: page.id === activePageId ? "#93c5fd" : "transparent",
            },
          },
          createElement(
            "span",
            { style: layerNameStyle },
            page.name ?? page.id,
          ),
          createElement(
            "span",
            { style: layerMetaStyle },
            `${page.size.width} x ${page.size.height}px`,
          ),
        ),
      ),
    ),
  );
}

function TopToolbar({
  templateName,
  zoom,
  canUndo,
  canRedo,
  onZoomChange,
  onFitPage,
  onUndo,
  onRedo,
  onCopyTemplate,
  onPreview,
  onSave,
  accessory,
}: {
  templateName: string;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onZoomChange: (zoom: number) => void;
  onFitPage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyTemplate: () => void;
  onPreview: (mode: PreviewMode) => void;
  onSave: () => void;
  accessory?: ReactNode;
}): ReactElement {
  return createElement(
    "header",
    { style: topToolbarStyle },
    createElement(
      "div",
      { style: toolbarBrandGroupStyle },
      createElement(
        "div",
        { style: brandMarkStyle },
        createElement(ToolIcon, {
          icon: CubeIcon,
          style: brandMarkIconStyle,
          size: 17,
        }),
      ),
      createElement("div", { style: brandNameStyle }, "Templara"),
      createElement("span", { style: toolbarDividerStyle }),
      accessory ?? createElement("div", { style: templateTitleStyle }, templateName),
      createElement("span", { style: statusPillStyle }, "Draft"),
    ),
    createElement(
      "div",
      { style: toolbarCenterStyle },
      createElement(
        "nav",
        { style: toolbarClusterStyle },
        createElement(ToolbarButton, {
          icon: Undo03Icon,
          title: "Undo",
          disabled: !canUndo,
          onClick: onUndo,
          compact: true,
        }),
        createElement(ToolbarButton, {
          icon: Redo03Icon,
          title: "Redo",
          disabled: !canRedo,
          onClick: onRedo,
          compact: true,
        }),
      ),
      createElement(ZoomControl, { zoom, onZoomChange, onFitPage }),
    ),
    createElement(
      "div",
      { style: toolbarGroupStyle },
      createElement(ToolbarButton, {
        icon: Copy01Icon,
        title: "Copy template JSON",
        onClick: onCopyTemplate,
        compact: true,
      }),
      createElement(PreviewDropdown, { onPreview }),
      createElement(ToolbarButton, {
        label: "Save",
        title: "Save template",
        onClick: onSave,
        variant: "primary",
      }),
    ),
  );
}

function ZoomControl({
  zoom,
  onZoomChange,
  onFitPage,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitPage: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<DropdownFrame | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuWidth = 196;

  const updateMenuFrame = useCallback(() => {
    setMenuFrame(measureDropdownFrame(wrapRef.current, menuWidth, "center"));
  }, []);

  const setPreset = (value: number): void => {
    setOpen(false);
    onZoomChange(clampZoom(value));
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuFrame();

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      if (wrapRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    const handleLayoutChange = (): void => updateMenuFrame();

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open, updateMenuFrame]);

  return createElement(
    "div",
    {
      ref: wrapRef,
      style: { ...dropdownWrapStyle, ...zoomDropdownWrapStyle },
      title: "Zoom",
    },
    createElement(
      "div",
      { style: zoomControlStyle },
      createElement(
        "button",
        {
          type: "button",
          title: "Zoom out",
          onClick: () => onZoomChange(clampZoom(zoom - 0.1)),
          style: zoomControlButtonStyle,
        },
        createElement(ToolIcon, {
          icon: MinusSignIcon,
          style: toolbarIconStyle,
          size: 14,
        }),
      ),
      createElement(
        "button",
        {
          type: "button",
          title: "Zoom level",
          "aria-expanded": open,
          onClick: () =>
            setOpen((value) => {
              const next = !value;
              if (next) updateMenuFrame();
              return next;
            }),
          style: zoomControlValueStyle,
        },
        createElement("span", null, `${Math.round(zoom * 100)}%`),
        createElement(ToolIcon, {
          icon: ChevronDownIcon,
          style: toolbarIconStyle,
          size: 12,
        }),
      ),
      createElement(
        "button",
        {
          type: "button",
          title: "Zoom in",
          onClick: () => onZoomChange(clampZoom(zoom + 0.1)),
          style: zoomControlButtonStyle,
        },
        createElement(ToolIcon, {
          icon: Add01Icon,
          style: toolbarIconStyle,
          size: 14,
        }),
      ),
    ),
    open
      ? createElement(
          "div",
          { style: anchoredDropdownStyle(zoomDropdownStyle, menuFrame) },
          createElement(DropdownItem, {
            label: "Fit page",
            detail: "Scale canvas to viewport",
            onClick: () => {
              setOpen(false);
              onFitPage();
            },
          }),
          createElement(DropdownItem, {
            label: "50%",
            detail: "Half scale",
            onClick: () => setPreset(0.5),
          }),
          createElement(DropdownItem, {
            label: "75%",
            detail: "Compact editing",
            onClick: () => setPreset(0.75),
          }),
          createElement(DropdownItem, {
            label: "100%",
            detail: "Actual pixels",
            onClick: () => setPreset(1),
          }),
          createElement(DropdownItem, {
            label: "125%",
            detail: "Close detail",
            onClick: () => setPreset(1.25),
          }),
          createElement(DropdownItem, {
            label: "150%",
            detail: "Inspect layout",
            onClick: () => setPreset(1.5),
          }),
        )
      : null,
  );
}

function PreviewDropdown({
  onPreview,
}: {
  onPreview: (mode: PreviewMode) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<DropdownFrame | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuWidth = 248;

  const updateMenuFrame = useCallback(() => {
    setMenuFrame(measureDropdownFrame(wrapRef.current, menuWidth, "right"));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuFrame();

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      if (wrapRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    const handleLayoutChange = (): void => updateMenuFrame();

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open, updateMenuFrame]);

  const runPreview = (mode: PreviewMode): void => {
    setOpen(false);
    onPreview(mode);
  };

  return createElement(
    "div",
    { ref: wrapRef, style: dropdownWrapStyle },
    createElement(
      "button",
      {
        type: "button",
        title: "Preview options",
        "aria-expanded": open,
        onClick: () =>
          setOpen((value) => {
            const next = !value;
            if (next) updateMenuFrame();
            return next;
          }),
        style: previewButtonStyle,
      },
      createElement(ToolIcon, {
        icon: ViewIcon,
        style: toolbarIconStyle,
        size: 16,
      }),
      createElement("span", null, "Preview"),
      createElement(ToolIcon, {
        icon: ChevronDownIcon,
        style: toolbarIconStyle,
        size: 13,
      }),
    ),
    open
      ? createElement(
          "div",
          { style: anchoredDropdownStyle(toolbarDropdownStyle, menuFrame) },
          createElement(DropdownItem, {
            label: "Preview (sample data)",
            detail: "Open the rendered preview",
            onClick: () => runPreview("sample"),
          }),
          createElement(DropdownItem, {
            label: "Preview with large data",
            detail: "Fill repeats to test pagination",
            onClick: () => runPreview("large"),
          }),
          createElement(DropdownItem, {
            label: "Export PDF",
            detail: "Open preview, then print to PDF",
            onClick: () => runPreview("export"),
          }),
        )
      : null,
  );
}

function DropdownItem({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  const [hovered, setHovered] = useState(false);

  return createElement(
    "button",
    {
      type: "button",
      title: `${label} - ${detail}`,
      disabled,
      onClick,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        ...dropdownItemStyle,
        background: !disabled && hovered ? "#EEF0FB" : "transparent",
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      },
    },
    createElement("span", { style: dropdownItemLabelStyle }, label),
    createElement("span", { style: dropdownItemDetailStyle }, detail),
  );
}

function EditorCanvas({
  page,
  pageInspectorDraft,
  zoom,
  showGrid,
  showRulers,
  selectedNodeIds,
  activeGuides,
  verticalGuides,
  horizontalGuides,
  boardRef,
  onNodePointerDown,
  onStartResize,
  onPagePointerDown,
  onBindingDrop,
  onStartGuideDrag,
}: {
  page: ReturnType<typeof buildEditorPageModel>;
  pageInspectorDraft: ReturnType<typeof resolvePageInspectorDraft>;
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;
  selectedNodeIds: string[];
  activeGuides: ActiveGuide[];
  verticalGuides: number[];
  horizontalGuides: number[];
  boardRef: React.RefObject<HTMLDivElement | null>;
  onNodePointerDown: (
    event: PointerEvent<HTMLElement>,
    node: EditorRenderNode,
  ) => void;
  onStartResize: (
    event: PointerEvent<HTMLElement>,
    handle: ResizeHandle,
  ) => void;
  onPagePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onBindingDrop: (event: DragEvent<HTMLDivElement>, fieldPath: string) => void;
  onStartGuideDrag: (axis: GuideAxis, index: number) => void;
}): ReactElement {
  const rulerSize = showRulers ? RULER_SIZE : 0;
  const margin = page.margin;
  const safeAreaPx = Math.round((pageInspectorDraft.safeAreaMm * 96) / 25.4);
  const bleedPx = Math.round((pageInspectorDraft.bleedMm * 96) / 25.4);

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
          height: rulerSize + page.size.height * zoom,
        },
      },
      showRulers
        ? [
            createElement("div", { key: "corner", style: rulerCornerStyle }),
            createElement(Ruler, {
              key: "top-ruler",
              axis: "x",
              length: page.size.width,
              zoom,
            }),
            createElement(Ruler, {
              key: "left-ruler",
              axis: "y",
              length: page.size.height,
              zoom,
            }),
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
            height: page.size.height * zoom,
          },
        },
        createElement("div", {
          style: {
            ...pageBadgeStyle,
            left: 0,
            top: -24,
          },
          children: `${page.name} / ${page.size.width} x ${page.size.height}`,
        }),
        createElement(
          "div",
          {
            "data-templara-editor-page-id": page.id,
            onDragOver: (event: DragEvent<HTMLDivElement>) => {
              if (event.dataTransfer.types.includes(BINDING_DRAG_TYPE)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            },
            onDrop: (event: DragEvent<HTMLDivElement>) => {
              const fieldPath = event.dataTransfer.getData(BINDING_DRAG_TYPE);

              if (!fieldPath) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              onBindingDrop(event, fieldPath);
            },
            onPointerDown: onPagePointerDown,
            style: {
              ...pageCanvasStyle,
              width: page.size.width,
              height: page.size.height,
              transform: `scale(${zoom})`,
              backgroundColor: pageInspectorDraft.backgroundColor,
              boxShadow: pageInspectorDraft.pageShadow
                ? pageCanvasStyle.boxShadow
                : "none",
              backgroundImage: showGrid ? gridBackgroundImage : undefined,
              backgroundSize: showGrid
                ? `${GRID_SIZE}px ${GRID_SIZE}px`
                : undefined,
            },
          },
          pageInspectorDraft.bleedEnabled && bleedPx > 0
            ? createElement(BleedOverlay, { bleedPx, pageSize: page.size })
            : null,
          margin && pageInspectorDraft.showPrintableArea
            ? createElement(PrintableAreaOverlay, {
                margin,
                pageSize: page.size,
              })
            : null,
          margin && pageInspectorDraft.showMarginGuides
            ? createElement(MarginGuideOverlay, { margin, pageSize: page.size })
            : null,
          margin && pageInspectorDraft.safeAreaEnabled && safeAreaPx > 0
            ? createElement(SafeAreaOverlay, {
                margin,
                safeAreaPx,
                pageSize: page.size,
              })
            : null,
          page.nodes.map((node) =>
            createElement(EditorNodeView, {
              key: node.id,
              node,
              selected: selectedNodeIds.includes(node.sourceNodeId),
              onPointerDown: onNodePointerDown,
            }),
          ),
          createElement(SelectionOverlay, {
            nodes: page.nodes.filter((node) =>
              selectedNodeIds.includes(node.sourceNodeId),
            ),
            zoom,
            onStartResize,
          }),
        ),
      ),
      verticalGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `v-guide-${index}`,
          axis: "x",
          value: guide,
          zoom,
          rulerSize,
          length: page.size.height,
          onPointerDown: () => onStartGuideDrag("x", index),
        }),
      ),
      horizontalGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `h-guide-${index}`,
          axis: "y",
          value: guide,
          zoom,
          rulerSize,
          length: page.size.width,
          onPointerDown: () => onStartGuideDrag("y", index),
        }),
      ),
      activeGuides.map((guide, index) =>
        createElement(GuideLine, {
          key: `active-${guide.axis}-${guide.value}-${index}`,
          axis: guide.axis,
          value: guide.value,
          zoom,
          rulerSize,
          length: guide.axis === "x" ? page.size.height : page.size.width,
          active: true,
        }),
      ),
    ),
  );
}

function MarginGuideOverlay({
  margin,
  pageSize,
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
      zIndex: 1,
    },
  });
}

function PrintableAreaOverlay({
  margin,
  pageSize,
}: {
  margin: NonNullable<ReturnType<typeof buildEditorPageModel>["margin"]>;
  pageSize: ReturnType<typeof buildEditorPageModel>["size"];
}): ReactElement {
  return createElement("div", {
    "data-templara-printable-area": "true",
    style: {
      position: "absolute",
      left: margin.left,
      top: margin.top,
      width: pageSize.width - margin.left - margin.right,
      height: pageSize.height - margin.top - margin.bottom,
      background: "rgba(99, 102, 241, 0.04)",
      pointerEvents: "none",
      zIndex: 0,
    },
  });
}

function SafeAreaOverlay({
  margin,
  safeAreaPx,
  pageSize,
}: {
  margin: NonNullable<ReturnType<typeof buildEditorPageModel>["margin"]>;
  safeAreaPx: number;
  pageSize: ReturnType<typeof buildEditorPageModel>["size"];
}): ReactElement {
  const left = margin.left + safeAreaPx;
  const top = margin.top + safeAreaPx;
  const width = Math.max(
    0,
    pageSize.width - margin.left - margin.right - safeAreaPx * 2,
  );
  const height = Math.max(
    0,
    pageSize.height - margin.top - margin.bottom - safeAreaPx * 2,
  );

  return createElement("div", {
    "data-templara-safe-area": "true",
    style: {
      position: "absolute",
      left,
      top,
      width,
      height,
      border: "1px solid rgba(16, 185, 129, 0.35)",
      background: "rgba(16, 185, 129, 0.05)",
      pointerEvents: "none",
      zIndex: 2,
    },
  });
}

function BleedOverlay({
  bleedPx,
  pageSize,
}: {
  bleedPx: number;
  pageSize: ReturnType<typeof buildEditorPageModel>["size"];
}): ReactElement {
  return createElement("div", {
    "data-templara-bleed": "true",
    style: {
      position: "absolute",
      left: -bleedPx,
      top: -bleedPx,
      width: pageSize.width + bleedPx * 2,
      height: pageSize.height + bleedPx * 2,
      border: `${bleedPx}px solid rgba(244, 63, 94, 0.08)`,
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: 0,
    },
  });
}

const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

const RESIZE_HANDLE_CURSOR: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

function SelectionOverlay({
  nodes,
  zoom,
  onStartResize,
}: {
  nodes: EditorRenderNode[];
  zoom: number;
  onStartResize: (
    event: PointerEvent<HTMLElement>,
    handle: ResizeHandle,
  ) => void;
}): ReactElement | null {
  if (nodes.length === 0) {
    return null;
  }

  const bounds = getBounds(nodes.map((node) => node.frame));
  // Resize is single-node only for now; multi-select shows a static bounding box.
  const resizable = nodes.length === 1;
  // Counter-scale the handles so they keep a constant on-screen size at any zoom.
  const handleScale = zoom > 0 ? 1 / zoom : 1;

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
        zIndex: 20,
      },
    },
    (resizable ? RESIZE_HANDLES : (["nw", "ne", "sw", "se"] as ResizeHandle[])).map(
      (handle) =>
        createElement("span", {
          key: handle,
          "data-templara-resize-handle": handle,
          onPointerDown: resizable
            ? (event: PointerEvent<HTMLElement>) => onStartResize(event, handle)
            : undefined,
          style: {
            ...selectionHandleStyle,
            ...resizeHandlePlacement(handle),
            transform: `scale(${handleScale})`,
            pointerEvents: resizable ? "auto" : "none",
            cursor: resizable ? RESIZE_HANDLE_CURSOR[handle] : undefined,
          },
        }),
    ),
  );
}

function resizeHandlePlacement(handle: ResizeHandle): CSSProperties {
  const style: CSSProperties = {};

  if (handle.includes("n")) {
    style.top = -4;
  } else if (handle.includes("s")) {
    style.bottom = -4;
  } else {
    style.top = "50%";
    style.marginTop = -4;
  }

  if (handle.includes("w")) {
    style.left = -4;
  } else if (handle.includes("e")) {
    style.right = -4;
  } else {
    style.left = "50%";
    style.marginLeft = -4;
  }

  return style;
}

function EditorNodeView({
  node,
  selected,
  onPointerDown,
}: {
  node: EditorRenderNode;
  selected: boolean;
  onPointerDown: (
    event: PointerEvent<HTMLElement>,
    node: EditorRenderNode,
  ) => void;
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
    userSelect: "none",
  };
  const nodeProps = {
    "data-templara-editor-node-id": node.id,
    "data-templara-source-node-id": node.sourceNodeId,
    "data-templara-node-type": node.nodeType,
    "data-templara-selected": selected ? "true" : undefined,
    onPointerDown: (event: PointerEvent<HTMLElement>) =>
      onPointerDown(event, node),
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
        whiteSpace: "pre-wrap",
      },
      children: node.visual.text,
    });
  }

  if (node.visual.kind === "shape") {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        background: node.visual.fill,
        border: node.visual.stroke
          ? `${node.visual.strokeWidth ?? 1}px solid ${node.visual.stroke}`
          : undefined,
        borderRadius:
          node.visual.shape === "ellipse" ? "999px" : node.visual.radius,
      },
    });
  }

  if (node.visual.kind === "image") {
    if (!node.visual.src && node.visual.placeholder) {
      return createElement(PlaceholderBox, {
        nodeProps,
        style: baseStyle,
        label: node.visual.placeholder,
      });
    }

    return createElement("img", {
      ...nodeProps,
      src: node.visual.src,
      alt: node.visual.alt ?? "",
      style: {
        ...baseStyle,
        objectFit: node.visual.fit ?? "contain",
      },
    });
  }

  if (node.visual.kind === "code") {
    return createElement(PlaceholderBox, {
      nodeProps,
      style: baseStyle,
      label: node.visual.placeholder ?? node.visual.value,
    });
  }

  return createElement(ContainerBox, {
    nodeProps,
    selected,
    style: baseStyle,
    visual: node.visual,
  });
}

function PlaceholderBox({
  nodeProps,
  style,
  label,
}: {
  nodeProps: Record<string, unknown>;
  style: CSSProperties;
  label: string;
}): ReactElement {
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
      padding: 4,
    },
    children: label,
  });
}

function ContainerBox({
  nodeProps,
  selected,
  style,
  visual,
}: {
  nodeProps: Record<string, unknown>;
  selected: boolean;
  style: CSSProperties;
  visual: Extract<EditorVisual, { kind: "container" }>;
}): ReactElement {
  const color = containerToneColor(visual.tone);
  const showLabel = selected || visual.tone === "repeat";
  const subtleColor =
    visual.tone === "repeat" ? color : "rgba(100, 116, 139, 0.28)";

  return createElement(
    "div",
    {
      ...nodeProps,
      style: {
        ...style,
        border: `1px dashed ${selected ? color : subtleColor}`,
        background:
          visual.tone === "repeat" ? "rgba(124, 58, 237, 0.04)" : "transparent",
        pointerEvents: "auto",
      },
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
            whiteSpace: "nowrap",
          },
          children: visual.label,
        })
      : null,
    visual.tone === "repeat"
      ? createElement(
          "div",
          {
            style: repeatPlaceholderStyle,
          },
          createElement("strong", null, "This is the repeat template."),
          createElement(
            "span",
            null,
            "Full repeated output appears in Preview.",
          ),
        )
      : null,
  );
}

function Ruler({
  axis,
  length,
  zoom,
}: {
  axis: GuideAxis;
  length: number;
  zoom: number;
}): ReactElement {
  const ticks = Array.from(
    { length: Math.floor(length / 100) + 1 },
    (_, index) => index * 100,
  );

  return createElement(
    "div",
    {
      style: axis === "x" ? topRulerStyle : leftRulerStyle,
    },
    ticks.map((tick) =>
      createElement("span", {
        key: tick,
        style:
          axis === "x"
            ? { ...topRulerTickStyle, left: tick * zoom }
            : { ...leftRulerTickStyle, top: tick * zoom },
        children: tick,
      }),
    ),
  );
}

function GuideLine({
  axis,
  value,
  zoom,
  rulerSize,
  length,
  active = false,
  onPointerDown,
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
            background: active ? "#2563eb" : "#ef4444",
          }
        : {
            ...horizontalGuideStyle,
            left: rulerSize,
            top: rulerSize + value * zoom,
            width: length * zoom,
            background: active ? "#2563eb" : "#ef4444",
          },
  });
}

function NodeLayerList({
  pages,
  items,
  activePageId,
  selectedNodeIds,
  collapsedIds,
  onSelectPage,
  onSelect,
  onToggleCollapse,
  onMoveNode,
}: {
  pages: DocumentTemplate["pages"];
  items: EditorNodeItem[];
  activePageId: string;
  selectedNodeIds: string[];
  collapsedIds: ReadonlySet<string>;
  onSelectPage: (pageId: string) => void;
  onSelect: (event: MouseEvent<HTMLElement>, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onMoveNode: (nodeId: string, target: LayerMoveTarget) => void;
}): ReactElement {
  const rows = buildLayerTreeRows(pages, activePageId, items, collapsedIds);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    key: string;
    intent: LayerDropIntent;
  } | null>(null);

  // Mirror the drag state into refs so the drop handler always reads the latest
  // values. In a synthetic drag (dragover + drop in the same tick) React may not
  // have flushed the setState before onDrop runs, which would drop the move.
  const draggingIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<{ key: string; intent: LayerDropIntent } | null>(
    null,
  );

  const finishDrag = (): void => {
    draggingIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDrop = (row: LayerTreeRow): void => {
    const activeDragId = draggingIdRef.current;
    const activeDropTarget = dropTargetRef.current;

    if (
      activeDragId &&
      activeDropTarget &&
      activeDropTarget.key === row.key &&
      row.nodeId &&
      row.nodeId !== activeDragId
    ) {
      onMoveNode(activeDragId, {
        referenceId: row.nodeId,
        position: activeDropTarget.intent,
      });
    }

    finishDrag();
  };

  return createElement(
    "section",
    { style: layersPanelStyle },
    createElement(
      "header",
      { style: layersHeaderStyle },
      createElement("h2", { style: panelTitleStyle }, "Layers"),
      createElement(
        "button",
        { type: "button", title: "Add layer", style: layersAddButtonStyle },
        "+",
      ),
    ),
    createElement(
      "div",
      { style: layerListStyle },
      rows.map((row) =>
        createElement(LayerTreeRowView, {
          key: row.key,
          row,
          selected: row.nodeId
            ? selectedNodeIds.includes(row.nodeId)
            : row.pageId === activePageId && row.kind === "page",
          dragging: Boolean(row.nodeId) && draggingId === row.nodeId,
          dropIntent:
            dropTarget && dropTarget.key === row.key ? dropTarget.intent : null,
          onSelect,
          onSelectPage,
          onToggleCollapse,
          onDragStart: () => {
            if (row.nodeId) {
              draggingIdRef.current = row.nodeId;
              setDraggingId(row.nodeId);
            }
          },
          onDragOver: (event: DragEvent<HTMLElement>) => {
            const activeDragId = draggingIdRef.current;
            if (!activeDragId || !row.nodeId || row.nodeId === activeDragId) {
              return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "move";

            const rect = event.currentTarget.getBoundingClientRect();
            const ratio =
              rect.height > 0
                ? (event.clientY - rect.top) / rect.height
                : 0.5;
            let intent: LayerDropIntent;
            if (row.isContainer && ratio > 0.32 && ratio < 0.68) {
              intent = "inside";
            } else if (ratio < 0.5) {
              intent = "before";
            } else {
              intent = "after";
            }

            dropTargetRef.current = { key: row.key, intent };
            setDropTarget((prev) =>
              prev && prev.key === row.key && prev.intent === intent
                ? prev
                : { key: row.key, intent },
            );
          },
          onDrop: () => handleDrop(row),
          onDragEnd: finishDrag,
        }),
      ),
    ),
  );
}

function LayerTreeRowView({
  row,
  selected,
  dragging,
  dropIntent,
  onSelect,
  onSelectPage,
  onToggleCollapse,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  row: LayerTreeRow;
  selected: boolean;
  dragging: boolean;
  dropIntent: LayerDropIntent | null;
  onSelect: (event: MouseEvent<HTMLElement>, nodeId: string) => void;
  onSelectPage: (pageId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}): ReactElement {
  const showCaret = Boolean(row.isContainer && row.hasChildren);
  const caret = showCaret
    ? createElement(
        "span",
        {
          role: "button",
          title: row.collapsed ? "Expand" : "Collapse",
          onClick: (event: MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (row.nodeId) {
              onToggleCollapse(row.nodeId);
            }
          },
          style: layerTreeCaretButtonStyle,
        },
        createElement(ToolIcon, {
          icon: row.collapsed ? ChevronRightSharpIcon : ChevronDownSharpIcon,
          style: layerTreeCaretIconStyle,
          size: 16,
        }),
      )
    : createElement("span", { style: layerTreeCaretStyle });

  const background =
    dropIntent === "inside"
      ? UI_DROP_INSIDE_BG
      : selected
        ? UI_SELECTION_BG
        : "transparent";
  const boxShadow =
    dropIntent === "inside"
      ? UI_DROP_INSIDE_RING
      : selected
        ? UI_SELECTION_RING
        : "none";

  return createElement(
    "div",
    {
      role: "button",
      draggable: Boolean(row.nodeId),
      title: row.label,
      onDragStart,
      onDragOver,
      onDrop,
      onDragEnd,
      onClick: (event: MouseEvent<HTMLElement>) => {
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
        background,
        boxShadow,
        fontWeight: row.kind === "node" ? 500 : 600,
        opacity: dragging ? 0.45 : 1,
      },
    },
    dropIntent === "before"
      ? createElement("span", { style: layerDropLineTopStyle })
      : null,
    dropIntent === "after"
      ? createElement("span", { style: layerDropLineBottomStyle })
      : null,
    caret,
    createElement(LayerNodeIcon, { type: row.type, style: layerTreeIconStyle }),
    createElement("span", { style: layerTreeLabelStyle }, row.label),
  );
}

function ToolIcon({
  icon,
  style,
  size,
}: {
  icon: IconSvgElement;
  style: CSSProperties;
  size: number;
}): ReactElement {
  return createElement(
    "span",
    { style, "aria-hidden": true },
    createElement(HugeiconsIcon, {
      icon,
      size,
      strokeWidth: 1.8,
      color: "currentColor",
    }),
  );
}

// Inline glyph shapes lifted from the studio icon set (originally hard-coded
// #D0D5DD) and re-authored to paint with `currentColor`, so they inherit the
// row's text/selection color instead of rendering faint gray.
function GlyphIcon({
  paths,
  variant,
  style,
  size = 15,
}: {
  paths: string[];
  variant: "fill" | "stroke";
  style: CSSProperties;
  size?: number;
}): ReactElement {
  return createElement(
    "span",
    { style, "aria-hidden": true },
    createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        style: { display: "block" },
      },
      ...paths.map((d, index) =>
        createElement("path", {
          key: index,
          d,
          ...(variant === "fill"
            ? { fill: "currentColor" }
            : {
                stroke: "currentColor",
                strokeWidth: 1.33333,
                strokeLinecap: "round" as const,
                strokeLinejoin: "round" as const,
              }),
        }),
      ),
    ),
  );
}

const LAYER_GLYPH_PATHS: Record<
  string,
  { variant: "fill" | "stroke"; paths: string[] }
> = {
  text: {
    variant: "fill",
    paths: [
      "M10.7812 13.5V7.5H8.4375V6.5H14.0625V7.5H11.7188V13.5H10.7812Z",
      "M5.15625 13.5V4H0.9375V3H10.3125V4H6.09375V13.5H5.15625Z",
    ],
  },
  frame: {
    variant: "stroke",
    paths: [
      "M2 2.66675L2 13.3334C2 14.0698 2.59695 14.6667 3.33333 14.6667H12.6667C13.403 14.6667 14 14.0698 14 13.3334V2.66675C14 1.93037 13.403 1.33341 12.6667 1.33341H3.33333C2.59695 1.33341 2 1.93037 2 2.66675Z",
      "M2 8H14",
    ],
  },
  table: {
    variant: "stroke",
    paths: [
      "M13.3333 2H2.66659C1.93021 2 1.33325 2.59695 1.33325 3.33333V12.6667C1.33325 13.403 1.93021 14 2.66659 14H13.3333C14.0696 14 14.6666 13.403 14.6666 12.6667V3.33333C14.6666 2.59695 14.0696 2 13.3333 2Z",
      "M8 2V14",
    ],
  },
};

// Node type -> crisp Hugeicon for the types that read better as line icons.
const LAYER_TYPE_ICONS: Record<string, IconSvgElement> = {
  page: SquareIcon,
  image: Image01Icon,
  barcode: BarcodeIcon,
  qr: QrCodeIcon,
  repeat: RepeatIcon,
  conditional: ThirdBracketIcon,
  signature: SignatureIcon,
  shape: CircleIcon,
  line: MinusSignIcon,
};

// Alternate inline asset glyphs with Hugeicons so each node type gets an icon
// that actually communicates what it is.
const LAYER_GLYPH_TYPES: Record<string, keyof typeof LAYER_GLYPH_PATHS> = {
  text: "text",
  group: "frame",
  section: "frame",
  stack: "frame",
  frame: "frame",
  flowRegion: "frame",
  grid: "table",
  table: "table",
};

function LayerNodeIcon({
  type,
  style,
}: {
  type?: string;
  style: CSSProperties;
}): ReactElement {
  const glyphKey = type ? LAYER_GLYPH_TYPES[type] : undefined;
  if (glyphKey) {
    const glyph = LAYER_GLYPH_PATHS[glyphKey];
    return createElement(GlyphIcon, {
      paths: glyph.paths,
      variant: glyph.variant,
      style,
    });
  }

  const icon = (type && LAYER_TYPE_ICONS[type]) || FrameIcon;
  return createElement(ToolIcon, { icon, style, size: 15 });
}

function buildLayerTreeRows(
  pages: DocumentTemplate["pages"],
  activePageId: string,
  items: EditorNodeItem[],
  collapsedIds: ReadonlySet<string>,
): LayerTreeRow[] {
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const rows: LayerTreeRow[] = [];

  if (activePage) {
    rows.push({
      key: `page-${activePage.id}`,
      label: pageDisplayName(pages, activePage.id),
      depth: 0,
      kind: "page",
      iconSrc: sidebarIcons.page,
      type: "page",
      pageId: activePage.id,
      isContainer: true,
      hasChildren: items.length > 0,
    });
  }

  // `items` is a pre-order DFS of the real document structure, annotated with
  // depth. We rebuild parent links from a depth-keyed ancestor stack, which also
  // lets us hide descendants of collapsed containers.
  const ancestors: { id: string; depth: number }[] = [];

  items.forEach((item, index) => {
    while (
      ancestors.length > 0 &&
      ancestors[ancestors.length - 1].depth >= item.depth
    ) {
      ancestors.pop();
    }

    const parentId =
      ancestors.length > 0 ? ancestors[ancestors.length - 1].id : undefined;
    const next = items[index + 1];
    const hasChildren = Boolean(next && next.depth > item.depth);
    const isContainer = hasChildren || CONTAINER_NODE_TYPES.has(item.type);
    const hiddenByCollapse = ancestors.some((ancestor) =>
      collapsedIds.has(ancestor.id),
    );

    if (isContainer) {
      ancestors.push({ id: item.id, depth: item.depth });
    }

    if (hiddenByCollapse) {
      return;
    }

    rows.push({
      key: item.path,
      label: item.label,
      depth: item.depth + 1,
      kind: "node",
      iconSrc: nodeIcon(item.type),
      type: item.type,
      nodeId: item.id,
      parentId,
      isContainer,
      hasChildren,
      collapsed: collapsedIds.has(item.id),
    });
  });

  return rows;
}

const CONTAINER_NODE_TYPES = new Set([
  "section",
  "group",
  "repeat",
  "grid",
  "stack",
  "flowRegion",
  "frame",
  "conditional",
  "shape",
]);

function pageDisplayName(
  pages: DocumentTemplate["pages"],
  pageId: string,
): string {
  const pageIndex = pages.findIndex((page) => page.id === pageId);

  return `Page ${pageIndex >= 0 ? pageIndex + 1 : 1}`;
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

function DataSchemaPanel({
  model,
  selectedNode,
  selectedCount,
  onActivateField,
}: {
  model: ReturnType<typeof buildDataExplorerModel>;
  selectedNode?: EditableNode;
  selectedCount: number;
  onActivateField: (field: DataExplorerField) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [collapsedFields, setCollapsedFields] = useState<
    Record<string, boolean>
  >({});
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = filterDataExplorerGroups(
    model.groups,
    normalizedQuery,
  ).map((group) => ({
    ...group,
    fields: normalizedQuery
      ? group.fields
      : visibleDataTreeFields(group, collapsedFields),
  }));
  const visibleFieldCount = visibleGroups.reduce(
    (sum, group) => sum + group.fields.length,
    0,
  );
  const status =
    selectedCount > 1
      ? "Select one node to bind"
      : selectedNode
        ? `Binding to ${selectedNode.type}`
        : "Click or drag to create text";

  return createElement(
    "section",
    { style: dataPanelStyle },
    createElement(PanelHeader, {
      title: "Data",
      detail: `${model.allFields.length} fields`,
    }),
    createElement(DataSearchInput, { value: query, onChange: setQuery }),
    createElement("div", { style: dataPanelStatusStyle }, status),
    createElement(
      "div",
      { style: dataFieldsStyle },
      model.allFields.length === 0
        ? createElement(
            "p",
            { style: emptyTextStyle },
            "No data schema is attached to this template.",
          )
        : visibleFieldCount === 0
          ? createElement(
              "p",
              { style: emptyTextStyle },
              "No fields match that search.",
            )
          : visibleGroups.map((group) =>
              createElement(DataExplorerGroupView, {
                key: group.id,
                group,
                selectedNode,
                selectedCount,
                collapsedFields,
                onToggleField: (field) =>
                  setCollapsedFields((current) => ({
                    ...current,
                    [dataTreeKey(group.id, field)]:
                      !current[dataTreeKey(group.id, field)],
                  })),
                onActivateField,
              }),
            ),
    ),
  );
}

function filterDataExplorerGroups(
  groups: DataExplorerGroup[],
  query: string,
): DataExplorerGroup[] {
  if (!query) {
    return groups;
  }

  return groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) =>
        `${field.label} ${field.path} ${field.displayPath ?? ""} ${field.kind}`
          .toLowerCase()
          .includes(query),
      ),
    }))
    .filter((group) => group.fields.length > 0);
}

function DataExplorerGroupView({
  group,
  selectedNode,
  selectedCount,
  collapsedFields,
  onToggleField,
  onActivateField,
}: {
  group: DataExplorerGroup;
  selectedNode?: EditableNode;
  selectedCount: number;
  collapsedFields: Record<string, boolean>;
  onToggleField: (field: DataExplorerField) => void;
  onActivateField: (field: DataExplorerField) => void;
}): ReactElement {
  return createElement(
    "div",
    { style: dataGroupStyle },
    createElement(
      "div",
      { style: dataGroupHeaderStyle },
      createElement("span", null, group.title),
      group.detail
        ? createElement("span", { style: dataGroupDetailStyle }, group.detail)
        : null,
    ),
    group.fields.map((field) =>
      createElement(DataExplorerFieldRow, {
        key: field.id,
        field,
        selectedNode,
        selectedCount,
        collapsed: Boolean(collapsedFields[dataTreeKey(group.id, field)]),
        onToggleCollapsed: field.hasChildren
          ? () => onToggleField(field)
          : undefined,
        onActivateField,
      }),
    ),
  );
}

function DataExplorerFieldRow({
  field,
  selectedNode,
  selectedCount,
  collapsed,
  onToggleCollapsed,
  onActivateField,
}: {
  field: DataExplorerField;
  selectedNode?: EditableNode;
  selectedCount: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onActivateField: (field: DataExplorerField) => void;
}): ReactElement {
  const bindDisabled =
    selectedCount > 1 || !isFieldBindableForNode(field, selectedNode);
  const canDragToCanvas = isFieldBindableForNode(field);
  const title = bindDisabled
    ? selectedCount > 1
      ? "Select one node to bind"
      : `Cannot bind ${field.kind} to ${selectedNode?.type ?? "text"}`
    : selectedNode
      ? `Bind ${field.path} to selected ${selectedNode.type}`
      : `Create text bound to ${field.path}`;

  return createElement(
    "div",
    {
      draggable: canDragToCanvas,
      title,
      role: "button",
      tabIndex: bindDisabled ? -1 : 0,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest("button") || bindDisabled) {
          return;
        }

        onActivateField(field);
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (bindDisabled || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onActivateField(field);
      },
      onDragStart: (event: DragEvent<HTMLDivElement>) => {
        if (!canDragToCanvas) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(BINDING_DRAG_TYPE, field.path);
        event.dataTransfer.setData("text/plain", `{{${field.path}}}`);
      },
      style: {
        ...dataFieldStyle,
        paddingLeft: 8 + field.depth * 10,
        cursor: bindDisabled ? "not-allowed" : "pointer",
        opacity: bindDisabled ? 0.62 : 1,
      },
    },
    createElement(
      "div",
      { style: dataFieldHeaderStyle },
      createElement(
        "span",
        { style: dataFieldNameWrapStyle },
        field.hasChildren
          ? createElement(
              "button",
              {
                type: "button",
                title: collapsed
                  ? `Expand ${field.path}`
                  : `Collapse ${field.path}`,
                onClick: (event) => {
                  event.stopPropagation();
                  onToggleCollapsed?.();
                },
                style: dataTreeToggleStyle,
              },
              createElement(ToolIcon, {
                icon: ChevronRightIcon,
                size: 12,
                style: {
                  transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 120ms ease",
                },
              }),
            )
          : createElement("span", { style: dataTreeToggleSpacerStyle }),
        createElement("span", { style: layerNameStyle }, field.label),
      ),
      createElement(
        "span",
        {
          style: {
            ...dataTypePillStyle,
            background: dataKindBackground(field),
            color: dataKindColor(field),
          },
        },
        field.kind,
      ),
    ),
    createElement(
      "span",
      { style: layerMetaStyle },
      field.displayPath ? `${field.path} · ${field.displayPath}` : field.path,
    ),
    createElement(
      "div",
      { style: dataFieldActionsStyle },
      createElement(DataActionButton, {
        icon: Copy01Icon,
        label: "Copy",
        title: `Copy ${field.path}`,
        onClick: () => {
          void navigator.clipboard?.writeText(field.path);
        },
      }),
      createElement(DataActionButton, {
        icon: selectedNode ? Link01Icon : TypeCursorIcon,
        label: selectedNode ? "Bind" : "Text",
        title,
        disabled: bindDisabled,
        onClick: () => onActivateField(field),
      }),
    ),
  );
}

function visibleDataTreeFields(
  group: DataExplorerGroup,
  collapsedFields: Record<string, boolean>,
): DataExplorerField[] {
  return group.fields.filter((field) => {
    let parentPath = field.parentPath;

    while (parentPath) {
      const parent = group.fields.find(
        (candidate) => candidate.path === parentPath,
      );

      if (!parent) {
        return true;
      }

      if (collapsedFields[dataTreeKey(group.id, parent)]) {
        return false;
      }

      parentPath = parent.parentPath;
    }

    return true;
  });
}

function dataTreeKey(groupId: string, field: DataExplorerField): string {
  return `${groupId}:${field.id}`;
}

function dataKindBackground(field: DataExplorerField): string {
  if (field.source === "scope") return "#eef2ff";
  if (field.source === "variable") return "#f5f3ff";
  if (field.kind === "array") return "#ecfdf5";
  if (field.kind === "object") return "#f8fafc";
  return "#ffffff";
}

function dataKindColor(field: DataExplorerField): string {
  if (field.source === "scope") return "#3730a3";
  if (field.source === "variable") return "#6d28d9";
  if (field.kind === "array") return "#047857";
  if (field.kind === "object") return "#64748b";
  return "#475569";
}

function DataSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  const [focused, setFocused] = useState(false);

  return createElement("input", {
    type: "search",
    value,
    placeholder: "Search fields",
    onChange: (event) =>
      onChange((event.currentTarget as HTMLInputElement).value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      ...dataSearchStyle,
      ...(focused ? dataSearchFocusStyle : dataSearchBlurStyle),
    },
  });
}

function DataActionButton({
  icon,
  label,
  title,
  disabled,
  onClick,
}: {
  icon: IconSvgElement;
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}): ReactElement {
  const [focused, setFocused] = useState(false);

  return createElement(
    "button",
    {
      type: "button",
      title,
      disabled,
      onClick,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        ...dataActionButtonStyle,
        ...(focused ? dataActionButtonFocusStyle : null),
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      },
    },
    createElement(ToolIcon, { icon, style: toolbarIconStyle, size: 13 }),
    createElement("span", null, label),
  );
}

function PreviewOverlay({
  document: renderResult,
  title,
  autoExport,
  onClose,
}: {
  document: ReturnType<typeof renderDocument>;
  title: string;
  autoExport?: boolean;
  onClose: () => void;
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoExportFired = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);
  const preflight = useMemo(
    () => collectExportDiagnostics(renderResult),
    [renderResult],
  );
  const fontCss = useMemo(
    () => buildExportFontCss(renderResult),
    [renderResult],
  );

  const handleExport = useCallback(async () => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const pageElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-templara-page-id]"),
    );
    const pageSizes = renderResult.pages.map((page) => ({
      width: page.width,
      height: page.height,
    }));

    setExporting(true);
    setExportMessage(null);

    try {
      const result = await exportPreviewToPdf(pageElements, pageSizes, {
        title,
        fontCss,
      });

      if (result.status === "printed") {
        setExportMessage({
          tone: "info",
          text: 'Opened the print dialog \u2014 choose "Save as PDF" to download.',
        });
      } else {
        setExportMessage({
          tone: "error",
          text: result.message ?? "Export could not start.",
        });
      }
    } finally {
      setExporting(false);
    }
  }, [fontCss, renderResult.pages, title]);

  useEffect(() => {
    if (!autoExport || autoExportFired.current || !preflight.ok) {
      return;
    }

    autoExportFired.current = true;
    // Defer one frame so the preview DOM (and its page elements) exist.
    const timer = window.setTimeout(() => {
      void handleExport();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [autoExport, handleExport, preflight.ok]);

  return createElement(
    "div",
    { style: previewOverlayStyle },
    createElement(
      "header",
      { style: previewToolbarStyle },
      createElement("strong", null, "Rendered Preview"),
      createElement(
        "div",
        { style: previewToolbarActionsStyle },
        createElement(ExportDiagnosticsBadge, { preflight }),
        createElement(ToolbarButton, {
          label: exporting ? "Preparing\u2026" : "Export PDF",
          title: preflight.ok
            ? "Export to PDF via the browser print dialog"
            : "Resolve blocking issues before exporting",
          variant: "primary",
          disabled: exporting || !preflight.ok,
          onClick: () => {
            void handleExport();
          },
        }),
        createElement(ToolbarButton, {
          label: "Close",
          title: "Close preview",
          onClick: onClose,
        }),
      ),
    ),
    createElement(
      "div",
      { style: previewContentStyle },
      exportMessage
        ? createElement(
            "div",
            {
              style: {
                ...exportMessageStyle,
                color: exportMessage.tone === "error" ? "#991b1b" : "#1e3a8a",
                background:
                  exportMessage.tone === "error" ? "#fef2f2" : "#eff6ff",
              },
            },
            exportMessage.text,
          )
        : null,
      preflight.diagnostics.length > 0
        ? createElement(ExportDiagnosticsPanel, { preflight })
        : null,
      createElement(
        "div",
        { ref: scrollRef, style: previewScrollStyle },
        createElement(DocumentPreview, {
          document: renderResult,
          scale: 0.86,
        }),
      ),
    ),
  );
}

function ExportDiagnosticsBadge({
  preflight,
}: {
  preflight: ExportPreflight;
}): ReactElement {
  const label =
    preflight.errorCount > 0
      ? `${preflight.errorCount} blocking`
      : preflight.warningCount > 0
        ? `${preflight.warningCount} warning${preflight.warningCount === 1 ? "" : "s"}`
        : "Ready to export";
  const tone =
    preflight.errorCount > 0
      ? { color: "#991b1b", background: "#fef2f2", border: "#fca5a5" }
      : preflight.warningCount > 0
        ? { color: "#92400e", background: "#fffbeb", border: "#fcd34d" }
        : { color: "#166534", background: "#f0fdf4", border: "#86efac" };

  return createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: tone.color,
        background: tone.background,
        border: `1px solid ${tone.border}`,
      },
    },
    `${preflight.pageCount} page${preflight.pageCount === 1 ? "" : "s"} \u00b7 ${label}`,
  );
}

function ExportDiagnosticsPanel({
  preflight,
}: {
  preflight: ExportPreflight;
}): ReactElement {
  return createElement(
    "div",
    { style: exportDiagnosticsPanelStyle },
    preflight.diagnostics.map((diagnostic, index) =>
      createElement(
        "div",
        {
          key: `${diagnostic.code}-${diagnostic.nodeId ?? index}`,
          style: exportDiagnosticRowStyle,
        },
        createElement(
          "span",
          {
            style: {
              ...exportDiagnosticDotStyle,
              background:
                diagnostic.severity === "error"
                  ? "#dc2626"
                  : diagnostic.severity === "warning"
                    ? "#d97706"
                    : "#2563eb",
            },
          },
        ),
        createElement("span", { style: { flex: 1 } }, diagnostic.message),
        diagnostic.nodeId
          ? createElement(
              "code",
              { style: exportDiagnosticNodeStyle },
              diagnostic.nodeId,
            )
          : null,
      ),
    ),
  );
}

function PanelHeader({
  title,
  detail,
}: {
  title: string;
  detail: string;
}): ReactElement {
  return createElement(
    "header",
    { style: panelHeaderStyle },
    createElement("h2", { style: panelTitleStyle }, title),
    createElement("span", { style: panelDetailStyle }, detail),
  );
}

function ToolbarButton({
  icon,
  label,
  title,
  disabled,
  onClick,
  variant = "default",
  compact = false,
}: {
  icon?: IconSvgElement;
  label?: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "primary" | "ghost" | "subtle";
  compact?: boolean;
}): ReactElement {
  const [focused, setFocused] = useState(false);
  const isSubtle = variant === "subtle";

  return createElement(
    "button",
    {
      type: "button",
      title,
      disabled,
      onClick,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        ...toolbarButtonStyle,
        height: compact ? 32 : toolbarButtonStyle.height,
        width: compact ? 32 : undefined,
        minWidth: compact ? 32 : toolbarButtonStyle.minWidth,
        padding: compact ? 0 : toolbarButtonStyle.padding,
        background:
          variant === "primary"
            ? "#4f46e5"
            : variant === "ghost" || isSubtle
              ? "transparent"
              : toolbarButtonStyle.background,
        border:
          variant === "primary"
            ? "1px solid #4f46e5"
            : variant === "ghost" || isSubtle
              ? "1px solid transparent"
              : toolbarButtonStyle.border,
        borderColor:
          variant === "primary"
            ? "#4f46e5"
            : variant === "ghost" || isSubtle
              ? "transparent"
              : toolbarButtonStyle.borderColor,
        boxShadow: isSubtle
          ? focused
            ? "0 0 0 2px rgba(129, 140, 248, 0.28)"
            : "none"
          : toolbarButtonStyle.boxShadow,
        outline: "none",
        color:
          variant === "primary"
            ? "#ffffff"
            : variant === "ghost" || isSubtle
              ? "#64748b"
              : toolbarButtonStyle.color,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      },
    },
    icon
      ? createElement(ToolIcon, { icon, style: toolbarIconStyle, size: 16 })
      : null,
    label ? createElement("span", null, label) : null,
  );
}

function getNextSelection(
  currentSelection: string[],
  nodeId: string,
  additive: boolean,
): string[] {
  if (!additive) {
    return currentSelection.includes(nodeId) ? currentSelection : [nodeId];
  }

  return currentSelection.includes(nodeId)
    ? currentSelection.filter((id) => id !== nodeId)
    : [...currentSelection, nodeId];
}

function snapMove(
  rawDelta: Pick<Frame, "x" | "y">,
  drag: DragState,
  nodeItems: EditorNodeItem[],
  pageSize: Frame["width"] extends number
    ? { width: number; height: number }
    : never,
  options: {
    snapToGrid: boolean;
    snapToGuides: boolean;
    verticalGuides: number[];
    horizontalGuides: number[];
  },
): { delta: Pick<Frame, "x" | "y">; guides: ActiveGuide[] } {
  let deltaX = rawDelta.x;
  let deltaY = rawDelta.y;
  const guides: ActiveGuide[] = [];
  const selectedStartFrames = drag.nodeIds
    .map((id) => drag.startAbsoluteFrames[id])
    .filter((frame): frame is Frame => Boolean(frame));

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
    const unselected = nodeItems.filter(
      (item) => !drag.nodeIds.includes(item.id),
    );
    const xSnap = findAxisSnap(
      selectionBounds,
      deltaX,
      "x",
      pageSize,
      unselected,
      options.verticalGuides,
    );
    const ySnap = findAxisSnap(
      selectionBounds,
      deltaY,
      "y",
      pageSize,
      unselected,
      options.horizontalGuides,
    );

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
    guides,
  };
}

function findAxisSnap(
  bounds: Frame,
  delta: number,
  axis: GuideAxis,
  pageSize: { width: number; height: number },
  unselected: EditorNodeItem[],
  userGuides: number[],
): { adjustment: number; guide: ActiveGuide } | undefined {
  const size = axis === "x" ? pageSize.width : pageSize.height;
  const start = axis === "x" ? bounds.x : bounds.y;
  const length = axis === "x" ? bounds.width : bounds.height;
  const movingPositions = [
    { value: start + delta, label: "start" },
    { value: start + length / 2 + delta, label: "center" },
    { value: start + length + delta, label: "end" },
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
        { value: itemStart + itemLength, label: item.label },
      ];
    }),
  ];
  let best:
    | { adjustment: number; guide: ActiveGuide; distance: number }
    | undefined;

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
          label: `${moving.label} to ${candidate.label}`,
        },
        distance,
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
  setHorizontalGuides: (update: (guides: number[]) => number[]) => void,
): void {
  if (!board) {
    return;
  }

  const rect = board.getBoundingClientRect();
  const value =
    drag.axis === "x"
      ? (event.clientX - rect.left - RULER_SIZE) / zoom
      : (event.clientY - rect.top - RULER_SIZE) / zoom;
  const rounded = roundFrameValue(Math.max(0, value));

  if (drag.axis === "x") {
    setVerticalGuides((guides) =>
      guides.map((guide, index) => (index === drag.index ? rounded : guide)),
    );
  } else {
    setHorizontalGuides((guides) =>
      guides.map((guide, index) => (index === drag.index ? rounded : guide)),
    );
  }
}

function getPagePoint(
  event: PointerEvent<HTMLDivElement> | DragEvent<HTMLDivElement>,
  zoom: number,
): Pick<Frame, "x" | "y"> {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom,
  };
}

function defaultDataInsertPoint(
  page: ReturnType<typeof buildEditorPageModel>,
): Pick<Frame, "x" | "y"> {
  return {
    x: page.margin?.left ? page.margin.left + 16 : 72,
    y: page.margin?.top ? page.margin.top + 16 : 72,
  };
}

function snapPoint(
  point: Pick<Frame, "x" | "y">,
  enabled: boolean,
): Pick<Frame, "x" | "y"> {
  return {
    x: snapCoordinate(point.x, enabled),
    y: snapCoordinate(point.y, enabled),
  };
}

function snapCoordinate(value: number, enabled: boolean): number {
  if (!enabled) {
    return roundFrameValue(value);
  }

  const nearest = Math.round(value / GRID_SIZE) * GRID_SIZE;

  return Math.abs(nearest - value) <= SNAP_THRESHOLD
    ? nearest
    : roundFrameValue(value);
}

function createNodeForTool(
  tool: InsertTool,
  template: DocumentTemplate,
  point: Pick<Frame, "x" | "y">,
): DocNode {
  const x = Math.max(0, roundFrameValue(point.x));
  const y = Math.max(0, roundFrameValue(point.y));

  if (tool === "text") {
    return {
      id: createNodeId(template, "text"),
      type: "text",
      frame: { x, y, width: 180, height: 28 },
      content: [{ kind: "text", text: "Text" }],
      style: {
        fontFamily: "Geist",
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.2,
        color: "#111827",
      },
    } satisfies TextNode;
  }

  if (tool === "image") {
    return {
      id: createNodeId(template, "image"),
      type: "image",
      frame: { x, y, width: 180, height: 120 },
      source: { kind: "binding", binding: { path: "image.url" } },
      fit: "contain",
      alt: "Image",
    } satisfies ImageNode;
  }

  if (tool === "barcode") {
    return {
      id: createNodeId(template, "barcode"),
      type: "barcode",
      format: "code128",
      frame: { x, y, width: 180, height: 48 },
      value: { kind: "binding", binding: { path: "shipment.bolNumber" } },
    } satisfies BarcodeNode;
  }

  if (tool === "qr") {
    return {
      id: createNodeId(template, "qr"),
      type: "qr",
      frame: { x, y, width: 72, height: 72 },
      value: { kind: "binding", binding: { path: "shipment.trackingUrl" } },
    } satisfies QrNode;
  }

  if (tool === "line") {
    return {
      id: createNodeId(template, "line"),
      type: "shape",
      shape: "line",
      frame: { x, y, width: 180, height: 2 },
      style: { fill: "#111827", stroke: "#111827", strokeWidth: 1, radius: 0 },
    } satisfies ShapeNode;
  }

  if (tool === "shape") {
    return {
      id: createNodeId(template, "ellipse"),
      type: "shape",
      shape: "ellipse",
      frame: { x, y, width: 96, height: 96 },
      style: { fill: "#f8fafc", stroke: "#94a3b8", strokeWidth: 1 },
    } satisfies ShapeNode;
  }

  if (tool === "table") {
    const columns = [
      { id: "qty", label: "QTY", width: 64 },
      { id: "description", label: "DESCRIPTION", width: 210 },
      { id: "weight", label: "WEIGHT", width: 92 },
      { id: "pieces", label: "PIECES", width: 88 },
    ];
    const headerStyle = {
      fontFamily: "Geist",
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.2,
      color: "#111827",
    };
    const rowStyle = {
      fontFamily: "Geist",
      fontSize: 11,
      fontWeight: 500,
      lineHeight: 1.2,
      color: "#111827",
    };

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
              frame: {
                x: 8,
                y: 8,
                width: Math.max(24, column.width - 16),
                height: 14,
              },
              content: [
                { kind: "text", text: column.label ?? column.id.toUpperCase() },
              ],
              style: headerStyle,
            } satisfies TextNode,
          ],
          style: { fill: "#f8fafc", stroke: "#d8dee8", strokeWidth: 1 },
        })),
      },
      row: {
        cells: columns.map((column) => ({
          columnId: column.id,
          content: [
            {
              id: createNodeId(template, `table-${column.id}-cell`),
              type: "text",
              frame: {
                x: 8,
                y: 8,
                width: Math.max(24, column.width - 16),
                height: 14,
              },
              content: [
                {
                  kind: "field",
                  label: column.label ?? column.id,
                  binding: { path: `item.${column.id}` },
                },
              ],
              style: rowStyle,
            } satisfies TextNode,
          ],
          style: { fill: "#ffffff", stroke: "#d8dee8", strokeWidth: 1 },
        })),
      },
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
          style: {
            fill: "#ffffff",
            stroke: "#d8dee8",
            strokeWidth: 1,
            radius: 0,
          },
        },
        {
          id: createNodeId(template, "repeat-row-text"),
          type: "text",
          frame: { x: 12, y: 10, width: 220, height: 16 },
          content: [
            {
              kind: "field",
              label: "Item name",
              binding: { path: "item.name" },
            },
          ],
          style: {
            fontFamily: "Geist",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.2,
            color: "#111827",
          },
        },
      ],
    } satisfies RepeatNode;
  }

  if (tool === "condition") {
    return {
      id: createNodeId(template, "conditional"),
      type: "conditional",
      frame: { x, y, width: 240, height: 120 },
      condition: { source: "field.path" },
      children: [],
      fallback: [],
    } satisfies ConditionalNode;
  }

  if (tool === "frame") {
    return {
      id: createNodeId(template, "frame"),
      type: "group",
      frame: { x, y, width: 240, height: 160 },
      name: "Frame",
      children: [],
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
          style: {
            fill: "#94a3b8",
            stroke: "#94a3b8",
            strokeWidth: 1,
            radius: 0,
          },
        },
        {
          id: createNodeId(template, "signature-label"),
          type: "text",
          frame: { x: 12, y: 12, width: 132, height: 14 },
          content: [{ kind: "text", text: "Signature" }],
          style: {
            fontFamily: "Geist",
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#111827",
          },
        },
        {
          id: createNodeId(template, "signature-date"),
          type: "text",
          frame: { x: 12, y: 52, width: 92, height: 12 },
          content: [{ kind: "text", text: "Date:" }],
          style: {
            fontFamily: "Geist",
            fontSize: 9,
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#111827",
          },
        },
      ],
    } satisfies GroupNode;
  }

  return {
    id: createNodeId(template, "rectangle"),
    type: "shape",
    shape: "rectangle",
    frame: { x, y, width: 160, height: 96 },
    style: { fill: "#ffffff", stroke: "#94a3b8", strokeWidth: 1, radius: 0 },
  } satisfies ShapeNode;
}

function duplicateNodeInTemplate(
  template: DocumentTemplate,
  nodeId: string,
): string | undefined {
  const existingIds = new Set<string>();

  for (const page of template.pages) {
    for (const layer of page.layers) {
      collectNodeIds(layer.nodes, existingIds);
    }
  }

  for (const page of template.pages) {
    for (const layer of page.layers) {
      const duplicatedId = duplicateNodeInCollection(
        layer.nodes,
        nodeId,
        existingIds,
      );

      if (duplicatedId) {
        return duplicatedId;
      }
    }
  }

  return undefined;
}

function duplicateNodeInCollection(
  nodes: EditableNode[],
  nodeId: string,
  existingIds: Set<string>,
): string | undefined {
  for (const [index, node] of nodes.entries()) {
    if (node.id === nodeId) {
      const duplicate = structuredClone(node);
      duplicate.frame = {
        ...duplicate.frame,
        x: roundFrameValue(duplicate.frame.x + 16),
        y: roundFrameValue(duplicate.frame.y + 16),
      };
      assignDuplicateNodeIds(duplicate, existingIds);
      nodes.splice(index + 1, 0, duplicate);

      return duplicate.id;
    }

    for (const children of childCollectionsForNode(node)) {
      const duplicatedId = duplicateNodeInCollection(
        children,
        nodeId,
        existingIds,
      );

      if (duplicatedId) {
        return duplicatedId;
      }
    }
  }

  return undefined;
}

function deleteNodeFromTemplate(
  template: DocumentTemplate,
  nodeId: string,
): boolean {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      if (deleteNodeFromCollection(layer.nodes, nodeId)) {
        return true;
      }
    }
  }

  return false;
}

function deleteNodeFromCollection(
  nodes: EditableNode[],
  nodeId: string,
): boolean {
  const index = nodes.findIndex((node) => node.id === nodeId);

  if (index >= 0) {
    nodes.splice(index, 1);
    return true;
  }

  for (const node of nodes) {
    for (const children of childCollectionsForNode(node)) {
      if (deleteNodeFromCollection(children, nodeId)) {
        return true;
      }
    }
  }

  return false;
}

function assignDuplicateNodeIds(
  node: EditableNode,
  existingIds: Set<string>,
): void {
  node.id = nextDuplicateNodeId(node.id, existingIds);
  existingIds.add(node.id);

  for (const children of childCollectionsForNode(node)) {
    for (const child of children) {
      assignDuplicateNodeIds(child, existingIds);
    }
  }
}

function nextDuplicateNodeId(baseId: string, existingIds: Set<string>): string {
  let candidate = `${baseId}-copy`;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-copy-${index}`;
    index += 1;
  }

  return candidate;
}

function childCollectionsForNode(node: EditableNode): EditableNode[][] {
  if (
    node.type === "group" ||
    node.type === "flowRegion" ||
    node.type === "section" ||
    node.type === "stack"
  ) {
    return [node.children];
  }

  if (node.type === "repeat") {
    const collections: EditableNode[][] = [node.children];
    if (node.header) {
      collections.push(node.header);
    }
    if (node.emptyState) {
      collections.push(node.emptyState);
    }
    return collections;
  }

  if (node.type === "conditional") {
    return node.fallback ? [node.children, node.fallback] : [node.children];
  }

  return [];
}

function getWritableFixedLayer(layers: PageLayer[]): PageLayer | undefined {
  let layer = layers.find((candidate) => candidate.kind === "fixed");

  if (!layer) {
    layer = {
      id: "fixed",
      kind: "fixed",
      nodes: [],
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

    if (
      node.type === "group" ||
      node.type === "flowRegion" ||
      node.type === "section" ||
      node.type === "stack"
    ) {
      collectNodeIds(node.children, ids);
    }

    if (node.type === "repeat") {
      collectNodeIds(node.children, ids);

      if (node.header) {
        collectNodeIds(node.header, ids);
      }

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

function measureDropdownFrame(
  anchor: HTMLElement | null,
  width: number,
  align: "center" | "right",
): DropdownFrame | null {
  if (!anchor || typeof window === "undefined") {
    return null;
  }

  const rect = anchor.getBoundingClientRect();
  const viewportMargin = 8;
  const preferredLeft =
    align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.right - width;
  const maxLeft = Math.max(viewportMargin, window.innerWidth - width - viewportMargin);

  return {
    top: rect.bottom + 8,
    left: Math.min(maxLeft, Math.max(viewportMargin, preferredLeft)),
    width,
  };
}

function anchoredDropdownStyle(
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
    transform: "none",
    zIndex: 1000,
  };
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
    height: bottom - top,
  };
}

function containerToneColor(
  tone: Extract<EditorVisual, { kind: "container" }>["tone"],
): string {
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
        const weights = font.source.weights?.length
          ? `:wght@${font.source.weights.join(";")}`
          : "";
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
  gridTemplateColumns: `60px 300px minmax(0, 1fr) ${INSPECTOR_PANEL_WIDTH}px`,
  gridTemplateRows: "60px minmax(0, 1fr)",
  background: "#eef2f6",
  color: "#111827",
  fontFamily: UI_FONT_FAMILY,
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
  overflow: "visible",
};

const toolButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: "1px solid transparent",
  borderRadius: 8,
  background: "transparent",
  color: "#111827",
  cursor: "pointer",
};

const railIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
};

const toolTooltipStyle: CSSProperties = {
  position: "absolute",
  left: 58,
  top: "50%",
  zIndex: 60,
  transform: "translateY(-50%)",
  padding: "7px 9px",
  border: "1px solid #d8dee8",
  borderRadius: 6,
  background: "#111827",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
  font: `600 11px/1 ${UI_FONT_FAMILY}`,
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

const toolSectionLabelStyle: CSSProperties = {
  width: "100%",
  marginBottom: 6,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 600,
  textAlign: "left",
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
  color: "#334155",
};

const toolLabelStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 750,
  textAlign: "left",
};

const insertPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden",
  borderBottom: "1px solid #e5e7eb",
};

const insertGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
  padding: "0 10px 12px",
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
  cursor: "pointer",
};

const insertToolIconStyle: CSSProperties = {
  display: "block",
  width: 16,
  height: 16,
  objectFit: "contain",
};

const insertToolLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "inherit",
  font: `600 10px/1 ${UI_FONT_FAMILY}`,
  textAlign: "left",
};

const leftPanelStyle: CSSProperties = {
  gridColumn: 2,
  gridRow: 2,
  position: "relative",
  height: "100%",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) 286px",
  borderRight: "1px solid #d8dee8",
  background: "#ffffff",
  overflow: "hidden",
};

const rightPanelStyle: CSSProperties = {
  gridColumn: 4,
  gridRow: 2,
  position: "relative",
  width: INSPECTOR_PANEL_WIDTH,
  minWidth: INSPECTOR_PANEL_WIDTH,
  maxWidth: INSPECTOR_PANEL_WIDTH,
  height: "100%",
  minHeight: 0,
  borderLeft: "1px solid #eceef3",
  background: "#ffffff",
  overflow: "hidden",
};

const inspectorResizeHandleStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  width: 8,
  zIndex: 30,
  cursor: "col-resize",
  touchAction: "none",
};

const panelRowResizeHandleStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: 8,
  zIndex: 30,
  cursor: "row-resize",
  touchAction: "none",
};

const mainStyle: CSSProperties = {
  gridColumn: 3,
  gridRow: 2,
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  overflow: "hidden",
};

const topToolbarStyle: CSSProperties = {
  gridColumn: "1 / -1",
  gridRow: 1,
  position: "relative",
  zIndex: 120,
  height: 60,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  padding: "0 24px",
  background: "#ffffff",
  borderBottom: "1px solid #e5e7eb",
  overflow: "visible",
};

const toolbarGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "0 0 auto",
};

const toolbarClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "0 0 auto",
  padding: 0,
};

const toolbarBrandGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flex: "0 0 auto",
  minWidth: 460,
};

const toolbarCenterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 28,
  minWidth: 0,
  flex: "1 1 auto",
  overflow: "visible",
  scrollbarWidth: "none",
};

const brandMarkStyle: CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "linear-gradient(135deg, #6d5dfc 0%, #4f46e5 55%, #7c3aed 100%)",
  color: "#ffffff",
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(79, 70, 229, 0.22)",
};

const brandMarkIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 17,
  height: 17,
  color: "#ffffff",
  flex: "0 0 auto",
};

const brandNameStyle: CSSProperties = {
  color: "#111827",
  fontSize: 18,
  fontWeight: 850,
  letterSpacing: 0,
};

const toolbarDividerStyle: CSSProperties = {
  width: 1,
  height: 34,
  margin: "0 12px",
  background: "#e5e7eb",
  flex: "0 0 auto",
};

const templateTitleStyle: CSSProperties = {
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
};

const statusPillStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  background: "#f1f3f6",
  color: "#667085",
  fontSize: 11,
  fontWeight: 600,
};

const toolbarButtonStyle: CSSProperties = {
  height: 36,
  minWidth: 36,
  padding: "0 13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid #d7dce4",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  font: `600 13px/1 ${UI_FONT_FAMILY}`,
  boxShadow: "0 1px 1px rgba(16, 24, 40, 0.02)",
};

const toolbarIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  flex: "0 0 auto",
};

const dropdownWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  overflow: "visible",
};

const zoomDropdownWrapStyle: CSSProperties = {
  alignItems: "center",
};

const zoomControlStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 38,
  border: "1px solid #d7dce4",
  borderRadius: 7,
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 1px 1px rgba(16, 24, 40, 0.02)",
};

const zoomControlButtonStyle: CSSProperties = {
  width: 34,
  height: 36,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "#ffffff",
  color: "#4b5563",
  cursor: "pointer",
};

const zoomControlValueStyle: CSSProperties = {
  height: 36,
  minWidth: 76,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "0 10px",
  border: 0,
  borderLeft: "1px solid #edf0f5",
  borderRight: "1px solid #edf0f5",
  background: "#ffffff",
  color: "#111827",
  cursor: "default",
  font: `850 13px/1 ${UI_MONO_FONT_FAMILY}`,
};

const previewButtonStyle: CSSProperties = {
  height: 38,
  minWidth: 120,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 16px",
  border: "1px solid #d7dce4",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  boxShadow: "0 1px 1px rgba(16, 24, 40, 0.02)",
  cursor: "pointer",
  font: `600 13px/1 ${UI_FONT_FAMILY}`,
};

const toolbarDropdownStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: 44,
  zIndex: 500,
  width: 248,
  display: "grid",
  gap: 1,
  padding: 5,
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow:
    "0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.06)",
};

const zoomDropdownStyle: CSSProperties = {
  ...toolbarDropdownStyle,
  left: "50%",
  right: "auto",
  width: 196,
  transform: "translateX(-50%)",
};

const dropdownItemStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gap: 3,
  padding: "8px 10px",
  border: "1px solid transparent",
  borderRadius: 7,
  background: "transparent",
  color: "#111827",
  textAlign: "left",
  transition: "background 90ms ease-out",
};

const dropdownItemLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#111827",
};

const dropdownItemDetailStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 400,
};

const canvasViewportStyle: CSSProperties = {
  position: "relative",
  minWidth: 0,
  minHeight: 0,
  overflow: "auto",
  display: "grid",
  placeItems: "center",
  padding: 48,
  background: "#e8edf4",
};

const canvasBoardStyle: CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
};

const scaledPageWrapStyle: CSSProperties = {
  position: "absolute",
};

const pageCanvasStyle: CSSProperties = {
  position: "relative",
  transformOrigin: "top left",
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.07)",
  overflow: "hidden",
};

const pageBadgeStyle: CSSProperties = {
  position: "absolute",
  zIndex: 12,
  padding: "3px 6px",
  borderRadius: 4,
  background: "#6d5dfc",
  color: "#ffffff",
  font: `600 9px/1.2 ${UI_MONO_FONT_FAMILY}`,
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

const selectionHandleStyle: CSSProperties = {
  position: "absolute",
  width: 8,
  height: 8,
  border: "1px solid #2563eb",
  borderRadius: 2,
  background: "#ffffff",
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
  pointerEvents: "none",
};

const rulerCornerStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: RULER_SIZE,
  height: RULER_SIZE,
  borderRight: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
};

const topRulerStyle: CSSProperties = {
  position: "absolute",
  left: RULER_SIZE,
  top: 0,
  height: RULER_SIZE,
  right: 0,
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
};

const leftRulerStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: RULER_SIZE,
  width: RULER_SIZE,
  bottom: 0,
  borderRight: "1px solid #cbd5e1",
  background: "#f8fafc",
};

const topRulerTickStyle: CSSProperties = {
  position: "absolute",
  top: 3,
  height: 18,
  borderLeft: "1px solid #94a3b8",
  paddingLeft: 3,
  color: "#64748b",
  font: `9px/1 ${UI_MONO_FONT_FAMILY}`,
};

const leftRulerTickStyle: CSSProperties = {
  position: "absolute",
  left: 3,
  width: 18,
  borderTop: "1px solid #94a3b8",
  paddingTop: 2,
  color: "#64748b",
  font: `9px/1 ${UI_MONO_FONT_FAMILY}`,
  writingMode: "vertical-rl",
};

const verticalGuideStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  cursor: "ew-resize",
  zIndex: 8,
};

const horizontalGuideStyle: CSSProperties = {
  position: "absolute",
  height: 1,
  cursor: "ns-resize",
  zIndex: 8,
};

const pagesPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden",
  borderBottom: "1px solid #e5e7eb",
};

const pageListStyle: CSSProperties = {
  maxHeight: 94,
  overflowY: "auto",
  padding: "0 10px 10px",
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
  cursor: "pointer",
};

const layersPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: "hidden",
};

const layersHeaderStyle: CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 12px",
  borderBottom: "1px solid #f2f4f7",
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
  cursor: "pointer",
};

const layerListStyle: CSSProperties = {
  height: "calc(100% - 42px)",
  minHeight: 0,
  overflowY: "auto",
  padding: "6px 8px 14px",
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
  cursor: "pointer",
};

const layerTreeRowStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 28,
  display: "grid",
  gridTemplateColumns: "14px 18px minmax(0, 1fr)",
  alignItems: "center",
  gap: 6,
  border: "1px solid transparent",
  borderRadius: UI_CHROME_RADIUS,
  background: "transparent",
  boxShadow: "none",
  color: "#667085",
  textAlign: "left",
  cursor: "pointer",
  font: `500 14px/21px ${UI_FONT_FAMILY}`,
  outline: "none",
  transition: "background 90ms ease-out, box-shadow 90ms ease-out, opacity 90ms ease-out",
};

const layerTreeCaretStyle: CSSProperties = {
  width: 18,
  height: 18,
  objectFit: "contain",
};

const layerTreeCaretButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  borderRadius: 4,
  cursor: "pointer",
  color: "#667085",
};

const layerTreeCaretIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  display: "inline-flex",
};

const UI_DROP_INSIDE_BG = "#eef2ff";
const UI_DROP_INSIDE_RING = "inset 0 0 0 1px #6366f1";

const layerDropLineTopStyle: CSSProperties = {
  position: "absolute",
  left: 6,
  right: 6,
  top: -1,
  height: 2,
  borderRadius: 2,
  background: "#6366f1",
  pointerEvents: "none",
};

const layerDropLineBottomStyle: CSSProperties = {
  position: "absolute",
  left: 6,
  right: 6,
  bottom: -1,
  height: 2,
  borderRadius: 2,
  background: "#6366f1",
  pointerEvents: "none",
};

const layerTreeIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  objectFit: "contain",
};

const layerTreeLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 12px 8px",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
};

const panelDetailStyle: CSSProperties = {
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  color: "#64748b",
};

const layerNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 600,
};

const layerMetaStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  color: "#64748b",
};

const dataPanelStyle: CSSProperties = {
  minHeight: 0,
  borderTop: "1px solid #e5e7eb",
  overflow: "hidden",
};

const dataFieldsStyle: CSSProperties = {
  height: 178,
  overflowY: "auto",
  padding: "0 10px 12px",
};

const dataPanelStatusStyle: CSSProperties = {
  minHeight: 20,
  margin: "0 10px 8px",
  padding: "4px 7px",
  border: "1px solid #eef0f3",
  borderRadius: UI_CHROME_RADIUS,
  background: "#fbfcfe",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 600,
};

const dataGroupStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 10,
};

const dataGroupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "3px 2px",
  color: "#0f172a",
  fontSize: 10,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const dataGroupDetailStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#94a3b8",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 9,
  fontWeight: 600,
  textTransform: "none",
};

const dataFieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "7px 8px",
  borderRadius: UI_CHROME_RADIUS,
  background: "#fbfcfe",
  border: "1px solid transparent",
  boxShadow:
    "0 0 0 1px rgba(238, 240, 243, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)",
  marginBottom: 6,
};

const dataSearchStyle: CSSProperties = {
  width: "calc(100% - 20px)",
  height: 30,
  margin: "0 10px 8px",
  padding: "0 9px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  outline: "none",
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#111827",
  font: `12px/1.2 ${UI_FONT_FAMILY}`,
};

const dataSearchFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW,
};

const dataSearchBlurStyle: CSSProperties = {
  borderColor: UI_CHROME_BORDER,
  boxShadow: UI_SURFACE_SHADOW,
};

const dataFieldHeaderStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const dataFieldNameWrapStyle: CSSProperties = {
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const dataTreeToggleStyle: CSSProperties = {
  width: 16,
  height: 16,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#64748b",
  cursor: "pointer",
  flex: "0 0 auto",
};

const dataTreeToggleSpacerStyle: CSSProperties = {
  width: 16,
  height: 16,
  flex: "0 0 auto",
};

const dataTypePillStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 18,
  padding: "0 6px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: 4,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 9,
  fontWeight: 600,
  lineHeight: 1,
};

const dataFieldActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  marginTop: 2,
};

const dataActionButtonStyle: CSSProperties = {
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "0 6px",
  border: "1px solid transparent",
  borderRadius: 4,
  background: "#ffffff",
  boxShadow:
    "0 0 0 1px rgba(232, 236, 241, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)",
  color: "#334155",
  font: `600 10px/1 ${UI_FONT_FAMILY}`,
  outline: "none",
};

const dataActionButtonFocusStyle: CSSProperties = {
  background: UI_SELECTION_BG,
  boxShadow: UI_SELECTION_RING,
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  padding: 10,
  color: "#64748b",
  fontSize: 10,
  lineHeight: 1.35,
};

const previewOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  background: "rgba(15, 23, 42, 0.56)",
};

const previewToolbarStyle: CSSProperties = {
  flex: "0 0 48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  background: "#ffffff",
  borderBottom: "1px solid #d8dee8",
};

const previewToolbarActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const previewContentStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

const previewScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: 28,
};

const exportMessageStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 500,
  borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
};

const exportDiagnosticsPanelStyle: CSSProperties = {
  flex: "0 0 auto",
  maxHeight: 168,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #d8dee8",
};

const exportDiagnosticRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12.5,
  color: "#334155",
  lineHeight: 1.4,
};

const exportDiagnosticDotStyle: CSSProperties = {
  flex: "0 0 auto",
  width: 8,
  height: 8,
  borderRadius: 999,
};

const exportDiagnosticNodeStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "1px 6px",
  borderRadius: 4,
  background: "#f1f5f9",
  color: "#475569",
  font: "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
};
