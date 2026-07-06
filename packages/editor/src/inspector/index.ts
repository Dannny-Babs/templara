import { createContext, createElement, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  BarcodeIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  CopyPlusIcon,
  Delete02Icon,
  EyeOffIcon,
  File02Icon,
  FrameIcon,
  GridTableIcon,
  Image01Icon,
  InformationCircleIcon,
  Link01Icon,
  LinkSquare02Icon,
  LockIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  QrCodeIcon,
  RefreshIcon,
  RepeatIcon,
  Search01Icon,
  Target02Icon,
  ThirdBracketIcon,
  TypeCursorIcon
} from "@hugeicons-pro/core-stroke-rounded";
import { ChevronDownIcon } from "@hugeicons-pro/core-stroke-sharp";
import { PAGE_PRESETS, describeExpression, evaluateExpressionPreview } from "@templara/core";
import type {
  BarcodeNode,
  Box,
  DataField,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  ExpressionOperator,
  ExpressionRef,
  FieldRun,
  FlowNode,
  FormulaExpression,
  FormulaOperand,
  Frame,
  GridNode,
  ImageNode,
  PageTemplate,
  QrNode,
  RepeatNode,
  TextNode,
  VariableDefinition
} from "@templara/core";
import type { EditorNodeItem, EditorPageModel } from "../editorModel";
import type { DataExplorerField, DataExplorerModel } from "../dataExplorer";
import {
  applyDataBindingToNode,
  buildDataExplorerModel,
  formatDataSampleValue,
  isFieldBindableForNode,
  sampleValueForBindingPath
} from "../dataExplorer";
import {
  addGridStaticRow,
  addGridColumn,
  bindGridColumn,
  removeGridColumn,
  removeGridStaticRow,
  setGridCellPadding,
  setGridCellStyle,
  setGridAllowRowSplit,
  setGridColumnLabel,
  setGridColumnWidth,
  setGridFooterEnabled,
  setGridHeaderEnabled,
  setGridRepeatHeaderOnBreak
} from "../gridModel";
import { insertBindingToken, parseInlineContent, serializeInlineContent } from "../textContent";

export type EditableNode = DocNode | FlowNode;
export type InspectorTab = "layout" | "data" | "logic" | "advanced";
export type InspectorTargetId = `page:${string}` | `node:${string}`;
export type InspectorCommitOptions = { history?: boolean; transaction?: string };
export type NodeCommitHandler = (
  update: (node: EditableNode) => void,
  options?: InspectorCommitOptions
) => void;

export interface PageInspectorDraft {
  sizePreset?: string;
  linkedMargins?: boolean;
  showMarginGuides?: boolean;
  showPrintableArea?: boolean;
  pageShadow?: boolean;
  safeAreaEnabled?: boolean;
  safeAreaMm?: number;
  bleedEnabled?: boolean;
  bleedMm?: number;
  backgroundColor?: string;
  defaultFormat?: string;
  dpi?: string;
  includeCropMarks?: boolean;
  rootObject?: string;
  pageScope?: string;
  sampleDataSource?: string;
  dateFormat?: string;
  numberFormat?: string;
  currency?: string;
  locale?: string;
  themeToken?: string;
  primaryColorToken?: string;
  typographyToken?: string;
}

export interface ResolvedPageInspectorDraft {
  sizePreset: string;
  linkedMargins: boolean;
  showMarginGuides: boolean;
  showPrintableArea: boolean;
  pageShadow: boolean;
  safeAreaEnabled: boolean;
  safeAreaMm: number;
  bleedEnabled: boolean;
  bleedMm: number;
  backgroundColor: string;
  defaultFormat: string;
  dpi: string;
  includeCropMarks: boolean;
  rootObject: string;
  pageScope: string;
  sampleDataSource: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  locale: string;
  themeToken: string;
  primaryColorToken: string;
  typographyToken: string;
}

export function resolvePageInspectorDraft(uiState: InspectorUiState, pageId: string, template?: DocumentTemplate): ResolvedPageInspectorDraft {
  const draft = uiState.pageDraftSettingsByPageId[pageId] ?? {};

  return {
    sizePreset: draft.sizePreset ?? "",
    linkedMargins: draft.linkedMargins ?? true,
    showMarginGuides: draft.showMarginGuides ?? true,
    showPrintableArea: draft.showPrintableArea ?? true,
    pageShadow: draft.pageShadow ?? true,
    safeAreaEnabled: draft.safeAreaEnabled ?? true,
    safeAreaMm: draft.safeAreaMm ?? 24,
    bleedEnabled: draft.bleedEnabled ?? true,
    bleedMm: draft.bleedMm ?? 3,
    backgroundColor: draft.backgroundColor ?? "#FFFFFF",
    defaultFormat: draft.defaultFormat ?? "pdf",
    dpi: draft.dpi ?? "300",
    includeCropMarks: draft.includeCropMarks ?? true,
    rootObject: draft.rootObject ?? defaultRootObject(template),
    pageScope: draft.pageScope ?? "this-page",
    sampleDataSource: draft.sampleDataSource ?? "Invoice Sample Data",
    dateFormat: draft.dateFormat ?? "YYYY-MM-DD",
    numberFormat: draft.numberFormat ?? "1,234.56",
    currency: draft.currency ?? "usd",
    locale: draft.locale ?? "en-US",
    themeToken: draft.themeToken ?? "light",
    primaryColorToken: draft.primaryColorToken ?? "color.primary",
    typographyToken: draft.typographyToken ?? "type.body"
  };
}

export interface InspectorUiState {
  activeTabByTarget: Record<InspectorTargetId, InspectorTab>;
  collapsedSectionsByTarget: Record<InspectorTargetId, Record<string, boolean>>;
  pageDraftSettingsByPageId: Record<string, PageInspectorDraft>;
}

export type InspectorUiAction =
  | { type: "set-tab"; targetId: InspectorTargetId; tab: InspectorTab }
  | { type: "toggle-section"; targetId: InspectorTargetId; sectionId: string }
  | { type: "set-page-draft"; pageId: string; patch: Partial<PageInspectorDraft> }
  | { type: "garbage-collect"; targetIds: InspectorTargetId[] };

export const initialInspectorUiState: InspectorUiState = {
  activeTabByTarget: {},
  collapsedSectionsByTarget: {},
  pageDraftSettingsByPageId: {}
};

const CTRL_H = 28;
const SELECT_H = 36;
const PAGE_CTRL_H = 32;
const NODE_CTRL_H = 32;
const NODE_RADIUS = 8;
const INSPECTOR_ROW_GAP = 14;
const INSPECTOR_INLINE_GAP = 8;
const INSPECTOR_FIELD_GAP = 4;
const INSPECTOR_TOGGLE_STACK_GAP = 4;
const INSPECTOR_HINT_GAP = 12;
const PX_PER_MM = 96 / 25.4;
// Quiet Chrome + Ring System.
const UI_ACCENT = "#5B5BD6";
const UI_ACCENT_SOFT = "#EEF0FB";
const UI_REST_BORDER = "#E5E7EB";
const UI_HOVER_BORDER = "#D1D5DB";
const UI_DISABLED_BG = "#F3F4F6";
const UI_DISABLED_BORDER = "#F1F3F5";
const UI_RING = "0 0 0 3px rgba(91, 91, 214, 0.14)";
const UI_RING_INVALID = "0 0 0 3px rgba(239, 68, 68, 0.12)";
// Three-step gray ladder: value / label / helper.
const UI_TEXT_VALUE = "#111827";
const UI_TEXT_LABEL = "#4B5563";
const UI_TEXT_HELPER = "#9CA3AF";
// Cards on a soft gray body.
const UI_CARD_BODY = "#F6F7F9";
const UI_CARD_SURFACE = "#FFFFFF";
const UI_CARD_BORDER = "#F1F3F5";
const UI_CARD_SHADOW = "0 1px 2px rgba(17, 24, 39, 0.03)";
const UI_ROW_GAP = 14;
const UI_CHROME_BORDER = UI_REST_BORDER;
const UI_CHROME_RADIUS = 8;
const UI_SURFACE_SHADOW = UI_CARD_SHADOW;
const UI_FOCUS_RING_SHADOW = UI_RING;
const UI_SELECTION_RING = UI_RING;
const UI_SELECTION_BG = UI_ACCENT_SOFT;
const UI_CHROME_CLASS = "tmpl-field";
const UI_SEGMENT_CLASS = "tmpl-seg";
const UI_BUTTON_CLASS = "tmpl-btn";
const UI_TOGGLE_CLASS = "tmpl-toggle";
const UI_MENU_CLASS = "tmpl-menu";
const UI_MENU_ITEM_CLASS = "tmpl-menu-item";
const GRID_SIZE = 8;
const SNAP_THRESHOLD = 5;
const INSPECTOR_METADATA_KEY = "inspector";
const UI_FONT_FAMILY = 'Geist, "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const UI_MONO_FONT_FAMILY = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

interface FlatDataField extends DataField {
  depth: number;
}

const logicOperators: ExpressionOperator[] = [
  "truthy",
  "falsy",
  "exists",
  "notExists",
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "contains",
  "notContains"
];
const valueLessLogicOperators = new Set<ExpressionOperator>(["truthy", "falsy", "exists", "notExists"]);
const inspectorTabs: InspectorTab[] = ["layout", "data", "logic", "advanced"];
const InspectorSectionContext = createContext<{ uiState: InspectorUiState; dispatch: (action: InspectorUiAction) => void } | null>(null);

export function inspectorUiReducer(state: InspectorUiState, action: InspectorUiAction): InspectorUiState {
  if (action.type === "set-tab") {
    return {
      ...state,
      activeTabByTarget: {
        ...state.activeTabByTarget,
        [action.targetId]: action.tab
      }
    };
  }

  if (action.type === "toggle-section") {
    const currentTarget = state.collapsedSectionsByTarget[action.targetId] ?? {};

    return {
      ...state,
      collapsedSectionsByTarget: {
        ...state.collapsedSectionsByTarget,
        [action.targetId]: {
          ...currentTarget,
          [action.sectionId]: !currentTarget[action.sectionId]
        }
      }
    };
  }

  if (action.type === "set-page-draft") {
    return {
      ...state,
      pageDraftSettingsByPageId: {
        ...state.pageDraftSettingsByPageId,
        [action.pageId]: {
          ...state.pageDraftSettingsByPageId[action.pageId],
          ...action.patch
        }
      }
    };
  }

  const allowedTargets = new Set(action.targetIds);
  const activeTabByTarget = Object.fromEntries(Object.entries(state.activeTabByTarget).filter(([targetId]) => allowedTargets.has(targetId as InspectorTargetId))) as Record<
    InspectorTargetId,
    InspectorTab
  >;
  const collapsedSectionsByTarget = Object.fromEntries(
    Object.entries(state.collapsedSectionsByTarget).filter(([targetId]) => allowedTargets.has(targetId as InspectorTargetId))
  ) as Record<InspectorTargetId, Record<string, boolean>>;

  return {
    ...state,
    activeTabByTarget,
    collapsedSectionsByTarget
  };
}

export function getInspectorMetadata(node: EditableNode): Record<string, unknown> {
  const raw = node.metadata?.[INSPECTOR_METADATA_KEY];
  return isRecord(raw) ? raw : {};
}

export function setInspectorMetadataValue(node: EditableNode, key: string, value: unknown): void {
  const current = getInspectorMetadata(node);

  node.metadata = {
    ...node.metadata,
    [INSPECTOR_METADATA_KEY]: {
      ...current,
      [key]: value
    }
  };
}

export function applyBindingPathToInspectorNode(node: EditableNode, path: string): void {
  applyDataBindingToNode(node, path);
}

export function applyVisibleExpressionToInspectorNode(node: EditableNode, expression: ExpressionRef | undefined): void {
  setVisibleExpressionForNode(node, expression);
}

export function applyRepeatItemExpressionToInspectorNode(node: EditableNode, expression: ExpressionRef | undefined): void {
  setRepeatItemExpressionForNode(node, expression);
}

export function applyTextValueRulesToInspectorNode(
  node: TextNode,
  rules: { fallback?: string; format?: FieldRun["format"] }
): void {
  const target = firstFieldRun(node);

  if (!target) {
    return;
  }

  if (rules.fallback) target.fallback = rules.fallback;
  else delete target.fallback;

  if (rules.format) target.format = rules.format;
  else delete target.format;
}

export function addDefaultVariableToInspectorTemplate(template: DocumentTemplate): VariableDefinition {
  const variable = createDefaultVariable(template);
  template.variables = [...(template.variables ?? []), variable];
  return variable;
}

export function NodeInspectorPanel({
  template,
  data,
  item,
  nodeItems,
  selectedCount,
  uiState,
  dispatch,
  onFrameCommit,
  onNodeCommit,
  onDuplicate,
  onDelete
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  selectedCount: number;
  uiState: InspectorUiState;
  dispatch: (action: InspectorUiAction) => void;
  onFrameCommit: (framePatch: Partial<Frame>) => void;
  onNodeCommit: NodeCommitHandler;
  onDuplicate: () => void;
  onDelete: () => void;
}): ReactElement {
  const targetId: InspectorTargetId = `node:${item.id}`;
  const activeTab = uiState.activeTabByTarget[targetId] ?? "layout";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const node = item.node;
  const bindingPath = bindingPathForNode(node);
  const scope = bindingScopeForNode(template, node);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [targetId]);

  return createElement(
    InspectorSectionContext.Provider,
    { value: { uiState, dispatch } },
    createElement(
      InspectorShell,
      {
        header: createElement(NodeInspectorHeader, { item, selectedCount, template, onNodeCommit, onDuplicate, onDelete }),
        tabs: createElement(InspectorTabs, { targetId, activeTab, dispatch }),
        footer: createElement(InspectorFooter, {
          title: "Diagnostics",
          status: bindingPath ? `Binding ${bindingPath}` : "No binding",
          detail: `Scope ${scope}`
        })
      },
      createElement(
        "div",
        { ref: scrollRef, style: inspectorContentStyle },
        selectedCount > 1 ? createElement("div", { style: noticeStyle }, `Multi-select: editing ${item.label} as the primary node. Shared alignment can move the full selection from the canvas.`) : null,
        activeTab === "layout" ? createElement(NodeLayoutTab, { template, data, item, nodeItems, onFrameCommit, onNodeCommit }) : null,
        activeTab === "data" ? createElement(NodeDataTab, { template, data, item, nodeItems, onNodeCommit }) : null,
        activeTab === "logic" ? createElement(NodeLogicTab, { template, data, item, nodeItems, onNodeCommit }) : null,
        activeTab === "advanced" ? createElement(NodeAdvancedTab, { template, data, item, nodeItems, selectedCount, onNodeCommit }) : null
      )
    )
  );
}

export function PageInspectorPanel({
  template,
  data,
  page,
  pageTemplate,
  uiState,
  dispatch,
  showGrid,
  showRulers,
  snapToGrid,
  snapToGuides,
  onDataCommit,
  onTemplateCommit,
  onPageCommit,
  onToggleGrid,
  onToggleRulers,
  onToggleSnapGrid,
  onToggleSnapGuides
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  page: EditorPageModel;
  pageTemplate: PageTemplate;
  uiState: InspectorUiState;
  dispatch: (action: InspectorUiAction) => void;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  onDataCommit?: (data: Record<string, unknown>) => void;
  onTemplateCommit: (update: (template: DocumentTemplate) => void) => void;
  onPageCommit: (update: (page: PageTemplate) => void) => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleSnapGrid: () => void;
  onToggleSnapGuides: () => void;
}): ReactElement {
  const targetId: InspectorTargetId = `page:${page.id}`;
  const activeTab = uiState.activeTabByTarget[targetId] ?? "layout";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageIndex = template.pages.findIndex((entry) => entry.id === page.id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [targetId]);

  return createElement(
    InspectorSectionContext.Provider,
    { value: { uiState, dispatch } },
    createElement(
      InspectorShell,
      {
        header: createElement(PageInspectorHeader, { page, pageTemplate, template, uiState, dispatch }),
        tabs: createElement(InspectorTabs, { targetId, activeTab, dispatch }),
        footer:
          activeTab === "data"
            ? null
            : createElement(InspectorFooter, {
                title: "Workspace",
                status: showGrid ? "Grid visible" : "Grid hidden",
                detail: snapToGrid || snapToGuides ? "Snapping enabled" : "Snapping disabled"
              })
      },
      createElement(
        "div",
        { ref: scrollRef, style: inspectorContentStyle },
        activeTab === "layout" ? createElement(PageLayoutTab, { page, pageTemplate, template, targetId, uiState, dispatch, onPageCommit }) : null,
        activeTab === "data"
          ? createElement(PageDataTab, {
              template,
              data,
              page,
              pageTemplate,
              pageIndex: pageIndex >= 0 ? pageIndex : 0,
              targetId,
              uiState,
              dispatch,
              onDataCommit,
              onTemplateCommit,
              onPageCommit
            })
          : null,
        activeTab === "logic" ? createElement(PageLogicTab, { targetId, template }) : null,
        activeTab === "advanced"
          ? createElement(PageAdvancedTab, {
              targetId,
              showGrid,
              showRulers,
              snapToGrid,
              snapToGuides,
              onToggleGrid,
              onToggleRulers,
              onToggleSnapGrid,
              onToggleSnapGuides
            })
          : null
      )
    )
  );
}

const INSPECTOR_CHROME_CSS = `
.${UI_CHROME_CLASS}{border:1px solid ${UI_REST_BORDER};background:${UI_CARD_SURFACE};box-shadow:none;transition:box-shadow 120ms ease-out,border-color 120ms ease-out;}
.${UI_CHROME_CLASS}:hover:not(.is-disabled){border-color:${UI_HOVER_BORDER};}
.${UI_CHROME_CLASS}:focus-within:not(.is-disabled){border-color:${UI_ACCENT};box-shadow:${UI_RING};}
.${UI_CHROME_CLASS}.is-invalid{border-color:#EF4444;box-shadow:${UI_RING_INVALID};}
.${UI_CHROME_CLASS}.is-disabled{background:${UI_DISABLED_BG};border-color:${UI_DISABLED_BORDER};box-shadow:none;cursor:not-allowed;}
.${UI_CHROME_CLASS}.is-disabled input,.${UI_CHROME_CLASS}.is-disabled select{cursor:not-allowed;color:${UI_TEXT_HELPER};}
.${UI_CHROME_CLASS} input::placeholder{color:${UI_TEXT_HELPER};}
.${UI_SEGMENT_CLASS}{border:1px solid ${UI_REST_BORDER};background:${UI_CARD_SURFACE};color:${UI_TEXT_LABEL};box-shadow:none;outline:none;transition:box-shadow 120ms ease-out,border-color 120ms ease-out,background 120ms ease-out;}
.${UI_SEGMENT_CLASS}:hover:not(.is-active){border-color:${UI_HOVER_BORDER};}
.${UI_SEGMENT_CLASS}.is-active{border-color:${UI_ACCENT};background:${UI_ACCENT_SOFT};color:${UI_ACCENT};box-shadow:inset 0 0 0 1px ${UI_ACCENT};z-index:1;}
.${UI_SEGMENT_CLASS}:focus-visible{box-shadow:${UI_RING};z-index:2;}
.${UI_BUTTON_CLASS}{outline:none;transition:box-shadow 120ms ease-out,border-color 120ms ease-out,background 120ms ease-out;}
.${UI_BUTTON_CLASS}:focus-visible{box-shadow:${UI_RING};border-color:${UI_ACCENT};}
.${UI_BUTTON_CLASS}:disabled{background:${UI_DISABLED_BG};border-color:${UI_DISABLED_BORDER};color:${UI_TEXT_HELPER};box-shadow:none;cursor:not-allowed;}
.${UI_TOGGLE_CLASS}{outline:none;border-radius:999px;transition:box-shadow 120ms ease-out;}
.${UI_TOGGLE_CLASS}:focus-visible{box-shadow:${UI_RING};}
.${UI_MENU_CLASS}{border:1px solid ${UI_REST_BORDER};background:${UI_CARD_SURFACE};border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,0.16),0 2px 6px rgba(15,23,42,0.06);padding:5px;display:flex;flex-direction:column;gap:1px;max-height:280px;overflow-y:auto;animation:tmpl-menu-in 110ms ease-out;}
@keyframes tmpl-menu-in{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.${UI_MENU_ITEM_CLASS}{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:7px 9px;border:0;border-radius:7px;background:transparent;color:${UI_TEXT_VALUE};font:400 13px/1.25 ${UI_FONT_FAMILY};text-align:left;cursor:pointer;transition:background 90ms ease-out;white-space:nowrap;}
.${UI_MENU_ITEM_CLASS}:hover:not(:disabled),.${UI_MENU_ITEM_CLASS}.is-active{background:${UI_ACCENT_SOFT};}
.${UI_MENU_ITEM_CLASS}[aria-selected="true"]{color:${UI_ACCENT};font-weight:500;}
.${UI_MENU_ITEM_CLASS}:disabled{opacity:0.45;cursor:not-allowed;}
`;

function InspectorShell({ header, tabs, footer, children }: { header: ReactNode; tabs: ReactNode; footer: ReactNode; children?: ReactNode }): ReactElement {
  return createElement(
    "div",
    { style: inspectorShellStyle },
    createElement("style", { dangerouslySetInnerHTML: { __html: INSPECTOR_CHROME_CSS } }),
    header,
    tabs,
    children,
    footer
  );
}

function NodeInspectorHeader({
  item,
  selectedCount,
  template,
  onNodeCommit,
  onDuplicate,
  onDelete
}: {
  item: EditorNodeItem;
  selectedCount: number;
  template: DocumentTemplate;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}): ReactElement {
  const node = item.node;
  const nodeName = inspectorTitleForItem(item);
  const chips = nodeHeaderChips(item);

  return createElement(
    "header",
    { style: inspectorHeaderStyle },
    createElement(
      "div",
      { style: inspectorSummaryRowStyle },
      createElement(
        "div",
        { style: inspectorNodeSummaryStyle },
        createElement("div", { style: inspectorNodeIconStyle }, createElement(ToolIcon, { icon: inspectorIconForNode(node), size: 15 })),
        createElement(
          "div",
          { style: inspectorNodeTextStyle },
          createElement("strong", { style: inspectorNodeNameStyle }, nodeName),
          createElement("span", { style: inspectorNodeTypeStyle }, `${nodeKindLabel(node)} Node`)
        )
      ),
      createElement(
        "div",
        { style: inspectorActionGroupStyle },
        createElement(InspectorActionButton, { icon: CopyPlusIcon, title: "Duplicate", onClick: onDuplicate }),
        createElement(InspectorActionButton, {
          icon: LockIcon,
          title: node.locked ? "Unlock" : "Lock",
          active: Boolean(node.locked),
          onClick: () =>
            onNodeCommit((draft) => {
              draft.locked = !draft.locked;
            })
        }),
        createElement(InspectorActionButton, {
          icon: EyeOffIcon,
          title: node.visible === false ? "Show" : "Hide",
          active: node.visible === false,
          onClick: () =>
            onNodeCommit((draft) => {
              draft.visible = draft.visible === false ? true : false;
            })
        }),
        createElement(InspectorActionButton, { icon: Delete02Icon, title: selectedCount > 1 ? "Delete selection" : "Delete node", onClick: onDelete })
      )
    ),
    createElement(
      "div",
      { style: pageHeaderTagRowStyle },
      chips.map((chip) => createElement(PageHeaderTag, { key: chip, label: chip }))
    )
  );
}

function nodeHeaderChips(item: EditorNodeItem): string[] {
  const node = item.node;
  if (node.type === "text") {
    return ["Text", titleCase(node.overflow ?? "wrap"), `${node.style.fontSize}px`];
  }
  if (node.type === "image") {
    return ["Image", node.source.kind === "binding" ? "Bound" : "Static", titleCase(node.fit ?? "contain")];
  }
  if (node.type === "repeat") {
    return ["Repeat", node.layout.direction === "horizontal" ? "Columns" : "Rows"];
  }
  if (node.type === "grid") {
    return ["Table", `${node.columns.length} columns`, node.binding ? "Bound" : "Static"];
  }
  if (node.type === "barcode") {
    return ["Barcode", node.format];
  }
  if (node.type === "qr") {
    return ["QR Code"];
  }
  return [nodeKindLabel(node)];
}

function PageInspectorHeader({
  page,
  pageTemplate,
  template,
  uiState
}: {
  page: EditorPageModel;
  pageTemplate: PageTemplate;
  template: DocumentTemplate;
  uiState: InspectorUiState;
  dispatch: (action: InspectorUiAction) => void;
}): ReactElement {
  const draft = resolvePageInspectorDraft(uiState, page.id, template);
  const presetLabel = pageHeaderPresetLabel(page, draft);
  const orientationLabel = page.size.width > page.size.height ? "Landscape" : "Portrait";
  const marginLabel = pageHeaderMarginLabel(pageTemplate);

  return createElement(
    "header",
    { style: pageInspectorHeaderStyle },
    createElement(
      "div",
      { style: pageHeaderSummaryRowStyle },
      createElement(
        "div",
        { style: pageHeaderSummaryStyle },
        createElement("div", { style: pageHeaderIconStyle }, createElement(ToolIcon, { icon: File02Icon, size: 15 })),
        createElement(
          "div",
          { style: pageHeaderTextStyle },
          createElement("strong", { style: pageHeaderNameStyle }, page.name),
          createElement("span", { style: pageHeaderSubtitleStyle }, "Page Inspector")
        )
      ),
      createElement(PageHeaderIconButton, { icon: MoreHorizontalIcon, title: "Page actions", onClick: () => undefined })
    ),
    createElement(
      "div",
      { style: pageHeaderTagRowStyle },
      createElement(PageHeaderTag, { label: presetLabel }),
      createElement(PageHeaderTag, { label: orientationLabel }),
      createElement(PageHeaderTag, { label: marginLabel })
    )
  );
}

function PageHeaderIconButton({ icon, title, onClick }: { icon: IconSvgElement; title: string; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", title, onClick, style: pageHeaderIconButtonStyle },
    createElement(ToolIcon, { icon, size: 16 })
  );
}

function PageHeaderTag({ label }: { label: string }): ReactElement {
  return createElement("span", { style: pageHeaderTagStyle }, label);
}

function pageHeaderPresetLabel(page: EditorPageModel, draft: ResolvedPageInspectorDraft): string {
  const presetId = draft.sizePreset || pagePresetIdForSize(page.size);
  if (presetId === "custom") return "Custom";
  const preset = Object.values(PAGE_PRESETS).find((candidate) => candidate.id === presetId);
  return preset?.label ?? titleCase(presetId);
}

function pageHeaderMarginLabel(pageTemplate: PageTemplate): string {
  const margin = pageTemplate.margin ?? defaultMarginBox();
  const values = [margin.top, margin.right, margin.bottom, margin.left].map((value) => Math.round(mmFromPx(value)));
  const allEqual = values.every((value) => value === values[0]);
  return allEqual ? `Margins ${values[0]}` : "Margins mixed";
}

function InspectorTabs({
  targetId,
  activeTab,
  dispatch
}: {
  targetId: InspectorTargetId;
  activeTab: InspectorTab;
  dispatch: (action: InspectorUiAction) => void;
}): ReactElement {
  return createElement(
    "div",
    { style: inspectorTabsStyle },
    inspectorTabs.map((tab) =>
      createElement(
        "button",
        {
          key: tab,
          type: "button",
          onClick: () => dispatch({ type: "set-tab", targetId, tab }),
          style: {
            ...inspectorTabStyle,
            color: activeTab === tab ? "#5B5BD6" : "#64748b"
          }
        },
        titleCase(inspectorTabLabel(tab)),
        activeTab === tab ? createElement("span", { style: inspectorTabUnderlineStyle }) : null
      )
    )
  );
}

function NodeLayoutTab({
  template,
  data,
  item,
  nodeItems,
  onFrameCommit,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  onFrameCommit: (framePatch: Partial<Frame>) => void;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;

  if (node.type === "text") {
    return createElement(
      SectionStack,
      null,
      createElement(TextLayoutSection, { node, frame: item.frame, onFrameCommit, onNodeCommit }),
      createElement(TextAlignmentSection, { node, onNodeCommit }),
      createElement(TextTypographySection, { node, onNodeCommit }),
      createElement(TextColorsSection, { node, onNodeCommit }),
      createElement(TextContentSection, { template, data, item, nodeItems, node, onNodeCommit })
    );
  }

  if (node.type === "repeat") {
    return createElement(
      SectionStack,
      null,
      createElement(PositionSection, { targetId: `node:${item.id}`, frame: item.frame, onFrameCommit }),
      createElement(RepeatLayoutSection, { node, onNodeCommit }),
      createElement(RepeatPaginationSection, { node, onNodeCommit }),
      createElement(VisibilitySection, { node, onNodeCommit })
    );
  }

  if (node.type === "grid") {
    return createElement(
      SectionStack,
      null,
      createElement(PositionSection, { targetId: `node:${item.id}`, frame: item.frame, onFrameCommit }),
      createElement(GridStructureSection, { node, onNodeCommit }),
      createElement(GridColumnsSection, { node, onNodeCommit }),
      createElement(GridCellStyleSection, { node, onNodeCommit }),
      createElement(GridBehaviorSection, { node, onNodeCommit }),
      createElement(VisibilitySection, { node, onNodeCommit })
    );
  }

  if (node.type === "image") {
    return createElement(
      SectionStack,
      null,
      createElement(ImageSizePositionSection, { node, frame: item.frame, onFrameCommit, onNodeCommit }),
      createElement(ImageAlignmentSection, { node, onNodeCommit }),
      createElement(ImageAppearanceSection, { node, onNodeCommit }),
      createElement(ImageLayerSection, { node, onNodeCommit })
    );
  }

  if (node.type === "barcode" || node.type === "qr") {
    return createElement(
      SectionStack,
      null,
      createElement(PositionSection, { targetId: `node:${item.id}`, frame: item.frame, onFrameCommit }),
      createElement(CodeLayoutSection, { node, onNodeCommit }),
      createElement(VisibilitySection, { node, onNodeCommit })
    );
  }

  return createElement(
    SectionStack,
    null,
    createElement(PositionSection, { targetId: `node:${item.id}`, frame: item.frame, onFrameCommit }),
    createElement(VisibilitySection, { node, onNodeCommit }),
    createElement(InspectorSection, { targetId: `node:${item.id}`, sectionId: "unsupported", title: "Node Type" }, createElement(EmptyText, null, `${node.type} controls are not expanded in this pass.`))
  );
}

function NodeDataTab({
  template,
  data,
  item,
  nodeItems,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;

  if (node.type === "repeat") {
    return createElement(
      SectionStack,
      null,
      createElement(RepeatDataSection, { template, data, item, nodeItems, node, onNodeCommit }),
      createElement(RepeatDiagnosticsSection, { data, node })
    );
  }

  if (node.type === "grid") {
    return createElement(
      SectionStack,
      null,
      createElement(GridDataSection, { template, data, item, nodeItems, node, onNodeCommit }),
      createElement(BindingExplorerSection, { template, data, item, nodeItems, onNodeCommit, showCurrentBinding: false })
    );
  }

  if (node.type === "text") {
    return createElement(
      SectionStack,
      null,
      createElement(TextCurrentBindingSection, { template, data, node, onNodeCommit }),
      createElement(BindingExplorerSection, { template, data, item, nodeItems, onNodeCommit, showCurrentBinding: false }),
      createElement(TextRecentSection, { template, data, item, nodeItems, node, onNodeCommit }),
      createElement(TextSamplePreviewSection, { template, data, node })
    );
  }

  if (node.type === "image") {
    return createElement(
      SectionStack,
      null,
      createElement(ImageSourceSection, { node, onNodeCommit }),
      node.source.kind === "binding" ? createElement(ImageBindingSection, { template, data, node }) : null,
      createElement(ImageDisplaySection, { node, onNodeCommit }),
      createElement(ImageAltTextSection, { node, onNodeCommit }),
      createElement(BindingExplorerSection, { template, data, item, nodeItems, onNodeCommit, showCurrentBinding: false }),
      createElement(ImageLoadingSection, { node, onNodeCommit })
    );
  }

  if (node.type === "barcode" || node.type === "qr") {
    return createElement(
      SectionStack,
      null,
      createElement(CodeDataSection, { template, data, node, onNodeCommit }),
      createElement(BindingExplorerSection, { template, data, item, nodeItems, onNodeCommit, showCurrentBinding: false })
    );
  }

  return createElement(SectionStack, null, createElement(BindingExplorerSection, { template, data, item, nodeItems, onNodeCommit }));
}

function NodeAdvancedTab({
  template,
  data,
  item,
  nodeItems,
  selectedCount,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  selectedCount: number;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  if (item.node.type === "text") {
    return createElement(
      SectionStack,
      null,
      createElement(TextBehaviorSection, { node: item.node, onNodeCommit }),
      createElement(TextAccessibilitySection, { item, onNodeCommit }),
      createElement(TextDiagnosticsSection, { template, data, node: item.node }),
      createElement(TextActionsSection, { node: item.node, onNodeCommit })
    );
  }

  if (item.node.type === "image") {
    const imageNode = item.node;
    return createElement(
      SectionStack,
      null,
      createElement(ImageVisibilitySection, { node: imageNode, onNodeCommit }),
      createElement(ImageEffectsSection, { node: imageNode, onNodeCommit }),
      createElement(ImageTransformSection, { node: imageNode, onNodeCommit }),
      createElement(ImageDeveloperSection, { item, node: imageNode, onNodeCommit }),
      createElement(ImageDiagnosticsSection, { template, data, node: imageNode }),
      createElement(ImageActionsSection, { node: imageNode, onNodeCommit })
    );
  }

  return createElement(
    SectionStack,
    null,
    createElement(AppearanceSection, { node: item.node, onNodeCommit }),
    createElement(BehaviorSection, { node: item.node, onNodeCommit }),
    createElement(MetadataSection, { item, selectedCount, onNodeCommit })
  );
}

function NodeLogicTab({
  template,
  data,
  item,
  nodeItems,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;

  return createElement(
    SectionStack,
    null,
    createElement(RenderLogicSection, { template, data, item, nodeItems, onNodeCommit }),
    node.type === "repeat" ? createElement(RepeatFilterSection, { template, data, item, nodeItems, node, onNodeCommit }) : null,
    node.type === "text" ? createElement(TextValueRulesSection, { node, onNodeCommit }) : null,
    createElement(VariableReferenceSection, { template, data, item, nodeItems })
  );
}

function PageLogicTab({ targetId, template }: { targetId: InspectorTargetId; template: DocumentTemplate }): ReactElement {
  return createElement(
    SectionStack,
    null,
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-logic-overview", title: "Document Logic", collapsible: false },
      createElement(FieldRow, { label: "Variables", value: `${template.variables?.length ?? 0}` }),
      createElement(EmptyText, null, "Select a node to edit visibility, repeat filters, and value rules. Page-level variable editing lives in Data.")
    )
  );
}

function PageLayoutTab({
  page,
  pageTemplate,
  template,
  targetId,
  uiState,
  dispatch,
  onDataCommit,
  onPageCommit
}: {
  page: EditorPageModel;
  pageTemplate: PageTemplate;
  template: DocumentTemplate;
  targetId: InspectorTargetId;
  uiState: InspectorUiState;
  dispatch: (action: InspectorUiAction) => void;
  onDataCommit?: (data: Record<string, unknown>) => void;
  onPageCommit: (update: (page: PageTemplate) => void) => void;
}): ReactElement {
  const orientation = page.size.width > page.size.height ? "landscape" : "portrait";
  const presetOptions = Object.values(PAGE_PRESETS).map((preset) => ({ value: preset.id, label: preset.label }));
  const draft = resolvePageInspectorDraft(uiState, page.id, template);
  const presetId = draft.sizePreset || pagePresetIdForSize(page.size);
  const paperSizeOptions = presetId === "custom" ? [{ value: "custom", label: "Custom" }, ...presetOptions] : presetOptions;
  const margin = pageTemplate.margin ?? defaultMarginBox();
  const backgroundColor = draft.backgroundColor;

  const setDraft = (patch: Partial<PageInspectorDraft>): void => {
    dispatch({ type: "set-page-draft", pageId: page.id, patch });
  };

  const commitMarginMm = (side: keyof Box, mm: number): void => {
    const px = pxFromMm(mm);
    onPageCommit((pageDraft) => {
      const box = ensurePageMargin(pageDraft);
      if (draft.linkedMargins) {
        box.top = box.right = box.bottom = box.left = px;
      } else {
        box[side] = px;
      }
    });
  };

  return createElement(
    SectionStack,
    null,
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-document-setup", title: "Document Setup" },
      createElement(
        "div",
        { style: pageSectionRowsStyle },
        createElement(
          PageInlineRow,
          { columns: "minmax(0, 1fr) minmax(0, 1fr)" },
          createElement(
            PageInlineField,
            { label: "Paper Size" },
            createElement(PageInlineSelect, {
              value: presetId,
              options: paperSizeOptions,
              onChange: (value) => {
                const preset = Object.values(PAGE_PRESETS).find((candidate) => candidate.id === value);
                setDraft({ sizePreset: value });
                if (!preset) return;
                onPageCommit((pageDraft) => {
                  pageDraft.size =
                    orientation === "landscape" ? { width: preset.height, height: preset.width } : { width: preset.width, height: preset.height };
                });
              }
            })
          ),
          createElement(
            PageInlineField,
            { label: "Orientation" },
            createElement(PageOrientationControl, {
              value: orientation,
              onChange: (value) => {
                if (value === orientation) return;
                onPageCommit((pageDraft) => {
                  pageDraft.size = { width: pageDraft.size.height, height: pageDraft.size.width };
                });
              }
            })
          )
        ),
        createElement(
          PageInlineRow,
          { columns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.35fr)" },
          createElement(
            PageInlineField,
            { label: "Width (mm)" },
            createElement(PageInlineNumber, {
              value: mmFromPx(page.size.width),
              onCommit: (mm) =>
                onPageCommit((pageDraft) => {
                  pageDraft.size.width = pxFromMm(mm);
                })
            })
          ),
          createElement(
            PageInlineField,
            { label: "Height (mm)" },
            createElement(PageInlineNumber, {
              value: mmFromPx(page.size.height),
              onCommit: (mm) =>
                onPageCommit((pageDraft) => {
                  pageDraft.size.height = pxFromMm(mm);
                })
            })
          ),
          createElement(
            PageInlineField,
            { label: "Background" },
            createElement(PageInlineColor, {
              value: backgroundColor,
              onCommit: (value) => setDraft({ backgroundColor: value })
            })
          )
        )
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-margins", title: "Margins" },
      createElement(
        "div",
        { style: pageSectionRowsStyle },
        createElement(PageMarginsRow, {
          margin,
          linked: draft.linkedMargins,
          onToggleLinked: () => setDraft({ linkedMargins: !draft.linkedMargins }),
          onCommit: commitMarginMm
        }),
        createElement(PageSectionHint, null, draft.linkedMargins ? "All margins are linked" : "Margins are independent")
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-safe-area", title: "Safe Area & Bleed" },
      createElement(
        "div",
        { style: pageSectionRowsStyle },
        createElement(PageToggleValueRow, {
          label: "Safe Area",
          enabled: draft.safeAreaEnabled,
          value: draft.safeAreaMm,
          unit: "mm",
          onToggle: () => setDraft({ safeAreaEnabled: !draft.safeAreaEnabled }),
          onCommit: (value) => setDraft({ safeAreaMm: Math.max(0, value) })
        }),
        createElement(PageToggleValueRow, {
          label: "Bleed",
          enabled: draft.bleedEnabled,
          value: draft.bleedMm,
          unit: "mm",
          onToggle: () => setDraft({ bleedEnabled: !draft.bleedEnabled }),
          onCommit: (value) => setDraft({ bleedMm: Math.max(0, value) })
        }),
        createElement(PageSectionHint, null, "Safe area stays within the printable region.")
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-visuals", title: "Page Visuals" },
      createElement(
        "div",
        { style: pageSectionRowsStyle },
        createElement(
          "div",
          { style: pageToggleStackStyle },
          createElement(ToggleSwitch, {
            label: "Show Margins",
            checked: draft.showMarginGuides,
            onChange: () => setDraft({ showMarginGuides: !draft.showMarginGuides })
          }),
          createElement(ToggleSwitch, {
            label: "Show Printable Area",
            checked: draft.showPrintableArea,
            onChange: () => setDraft({ showPrintableArea: !draft.showPrintableArea })
          }),
          createElement(ToggleSwitch, {
            label: "Page Shadow",
            checked: draft.pageShadow,
            onChange: () => setDraft({ pageShadow: !draft.pageShadow })
          })
        ),
        createElement(PageSectionHint, null, "Subtle shadow around the page.")
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-export", title: "Export Defaults" },
      createElement(
        "div",
        { style: pageSectionRowsStyle },
        createElement(
          PageInlineRow,
          { columns: "minmax(0, 1.35fr) minmax(0, 1fr)" },
          createElement(
            PageInlineField,
            { label: "Default Format" },
            createElement(PageInlineSelect, {
              value: draft.defaultFormat,
              options: [
                { value: "pdf", label: "PDF" },
                { value: "png", label: "PNG" },
                { value: "html", label: "HTML" }
              ],
              onChange: (value) => setDraft({ defaultFormat: value })
            })
          ),
          createElement(
            PageInlineField,
            { label: "DPI" },
            createElement(PageInlineSelect, {
              value: draft.dpi,
              options: [
                { value: "72", label: "72" },
                { value: "150", label: "150" },
                { value: "300", label: "300" }
              ],
              onChange: (value) => setDraft({ dpi: value })
            })
          )
        ),
        createElement(ToggleSwitch, {
          label: "Include Crop Marks",
          checked: draft.includeCropMarks,
          onChange: () => setDraft({ includeCropMarks: !draft.includeCropMarks })
        }),
        createElement(PageSectionHint, null, "Adds crop marks to exported output.")
      )
    )
  );
}

function inspectorTabLabel(tab: InspectorTab): string {
  if (tab === "layout") return "Workspace";
  return tab;
}

function defaultRootObject(template?: DocumentTemplate): string {
  const first = template?.dataSchema?.fields[0]?.path;
  if (!first) return "invoice";
  return first.split(".")[0] || first;
}

function rootObjectOptions(template: DocumentTemplate, data?: Record<string, unknown>): Array<{ value: string; label: string }> {
  const roots = new Set<string>();
  for (const field of template.dataSchema?.fields ?? []) {
    roots.add(field.path.split(".")[0] || field.path);
  }
  if (data) {
    for (const key of Object.keys(data)) roots.add(key);
  }
  if (roots.size === 0) return [{ value: "invoice", label: "invoice" }];
  return Array.from(roots)
    .sort()
    .map((root) => ({ value: root, label: root }));
}

function buildPageSamplePreview(data: Record<string, unknown> | undefined, pageIndex: number, pageCount: number): string {
  const preview: Record<string, unknown> = {};

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          preview[`${key}.${nestedKey}`] = nestedValue;
        }
      } else {
        preview[key] = value;
      }
    }
  }

  preview["page.number"] = pageIndex + 1;
  preview["page.totalPages"] = pageCount;

  if (Object.keys(preview).length === 0) {
    return '{\n  "page.number": 1\n}';
  }

  return JSON.stringify(preview, null, 2);
}

function tokenColorForToken(token: string): string {
  if (token.includes("primary")) return "#5B5BD6";
  if (token.includes("danger")) return "#ef4444";
  if (token.includes("success")) return "#10b981";
  return "#94a3b8";
}

function PageDataTab({
  template,
  data,
  page,
  pageTemplate,
  pageIndex,
  targetId,
  uiState,
  dispatch,
  onDataCommit,
  onTemplateCommit,
  onPageCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  page: EditorPageModel;
  pageTemplate: PageTemplate;
  pageIndex: number;
  targetId: InspectorTargetId;
  uiState: InspectorUiState;
  dispatch: (action: InspectorUiAction) => void;
  onDataCommit?: (data: Record<string, unknown>) => void;
  onTemplateCommit: (update: (template: DocumentTemplate) => void) => void;
  onPageCommit: (update: (page: PageTemplate) => void) => void;
}): ReactElement {
  const draft = resolvePageInspectorDraft(uiState, page.id, template);
  const [variableQuery, setVariableQuery] = useState("");
  const variables = template.variables ?? [];
  const normalizedQuery = variableQuery.trim().toLowerCase();
  const visibleVariables = normalizedQuery
    ? variables.filter((variable) => `${variable.id} ${variable.name} ${variable.category ?? ""} ${variableValueSummary(variable.value)}`.toLowerCase().includes(normalizedQuery))
    : variables;

  const setDraft = (patch: Partial<PageInspectorDraft>): void => {
    dispatch({ type: "set-page-draft", pageId: page.id, patch });
  };

  const pageKey = pageTemplate.key ?? `${page.id.replace(/_/g, ".")}`;

  return createElement(
    SectionStack,
    null,
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-metadata", title: "Page Metadata" },
      createElement(
        "div",
        { style: pageDataSectionRowsStyle },
        createElement(HorizontalReadOnlyField, { label: "Page ID", value: page.id }),
        createElement(HorizontalTextField, {
          label: "Page Label",
          value: page.name,
          onCommit: (value) =>
            onPageCommit((pageDraft) => {
              pageDraft.name = value;
            })
        }),
        createElement(HorizontalTextField, {
          label: "Page Key",
          value: pageKey,
          mono: true,
          onCommit: (value) =>
            onPageCommit((pageDraft) => {
              pageDraft.key = value;
            })
        })
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-data-context", title: "Default Data Context" },
      createElement(
        "div",
        { style: pageDataSectionRowsStyle },
        createElement(HorizontalFieldRow, {
          label: "Root Object",
          control: createElement(PageInlineSelect, {
            value: draft.rootObject,
            options: rootObjectOptions(template, data),
            onChange: (value) => setDraft({ rootObject: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Page Scope",
          control: createElement(PageInlineSelect, {
            value: draft.pageScope,
            options: [
              { value: "this-page", label: "This Page" },
              { value: "document", label: "Document" },
              { value: "parent", label: "Parent Page" }
            ],
            onChange: (value) => setDraft({ pageScope: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Sample Data Source",
          control: createElement(SampleDataSourceField, {
            value: draft.sampleDataSource,
            onCommit: (value) => setDraft({ sampleDataSource: value })
          })
        })
      )
    ),
    createElement(
      InspectorSection,
      {
        targetId,
        sectionId: "page-variables",
        title: "Variables",
        headerAction: createElement(SectionHeaderIconButton, {
          icon: Add01Icon,
          title: "Add variable",
          onClick: () =>
            onTemplateCommit((templateDraft) => {
              templateDraft.variables = [...(templateDraft.variables ?? []), createDefaultVariable(templateDraft)];
            })
        })
      },
      createElement(
        "div",
        { style: pageDataSectionRowsStyle },
        createElement(VariableSearchInput, { value: variableQuery, onChange: setVariableQuery }),
        createElement(
          "div",
          { style: variableListStyle },
          visibleVariables.length === 0
            ? createElement(EmptyText, null, variables.length === 0 ? "No variables are defined yet." : "No variables match that search.")
            : visibleVariables.map((variable, index) =>
                createElement(TemplateVariableRow, {
                  key: variable.id,
                  variable,
                  isLast: index === visibleVariables.length - 1,
                  onChange: (update) =>
                    onTemplateCommit((templateDraft) => {
                      updateVariableById(templateDraft, variable.id, update);
                    }),
                  onDelete: () =>
                    onTemplateCommit((templateDraft) => {
                      templateDraft.variables = (templateDraft.variables ?? []).filter((entry) => entry.id !== variable.id);
                    })
                })
              )
        )
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-binding-defaults", title: "Binding Defaults" },
      createElement(
        "div",
        { style: pageDataSectionRowsStyle },
        createElement(HorizontalFieldRow, {
          label: "Default Date Format",
          control: createElement(PageInlineSelect, {
            value: draft.dateFormat,
            options: [
              { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
              { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
              { value: "DD MMM YYYY", label: "DD MMM YYYY" }
            ],
            onChange: (value) => setDraft({ dateFormat: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Number Format",
          control: createElement(PageInlineSelect, {
            value: draft.numberFormat,
            options: [
              { value: "1,234.56", label: "1,234.56" },
              { value: "1.234,56", label: "1.234,56" },
              { value: "1234.56", label: "1234.56" }
            ],
            onChange: (value) => setDraft({ numberFormat: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Currency",
          control: createElement(PageInlineSelect, {
            value: draft.currency,
            options: [
              { value: "usd", label: "USD ($)" },
              { value: "eur", label: "EUR (€)" },
              { value: "gbp", label: "GBP (£)" }
            ],
            onChange: (value) => setDraft({ currency: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Locale",
          control: createElement(PageInlineSelect, {
            value: draft.locale,
            options: [
              { value: "en-US", label: "en-US" },
              { value: "en-GB", label: "en-GB" },
              { value: "fr-FR", label: "fr-FR" }
            ],
            onChange: (value) => setDraft({ locale: value })
          })
        })
      )
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-sample-editor", title: "Sample Data Editor", detail: "live" },
      createElement(SampleDataEditor, {
        data,
        onCommit: onDataCommit
      })
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-sample-preview", title: "Sample Data Preview" },
      createElement(SampleDataPreview, {
        json: buildPageSamplePreview(data, pageIndex, template.pages.length)
      })
    ),
    createElement(
      InspectorSection,
      { targetId, sectionId: "page-tokens", title: "Page Tokens" },
      createElement(
        "div",
        { style: pageDataSectionRowsStyle },
        createElement(HorizontalFieldRow, {
          label: "Theme Token",
          control: createElement(PageInlineSelect, {
            value: draft.themeToken,
            options: [
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" }
            ],
            onChange: (value) => setDraft({ themeToken: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Primary Color Token",
          control: createElement(PageTokenColorSelect, {
            value: draft.primaryColorToken,
            onChange: (value) => setDraft({ primaryColorToken: value })
          })
        }),
        createElement(HorizontalFieldRow, {
          label: "Typography Token",
          control: createElement(PageInlineSelect, {
            value: draft.typographyToken,
            options: [
              { value: "type.body", label: "Type.Body" },
              { value: "type.heading", label: "Type.Heading" },
              { value: "type.caption", label: "Type.Caption" }
            ],
            onChange: (value) => setDraft({ typographyToken: value })
          })
        })
      )
    )
  );
}

function HorizontalFieldRow({ label, control }: { label: string; control: ReactNode }): ReactElement {
  return createElement(
    "div",
    { style: horizontalFieldRowStyle },
    createElement("span", { style: horizontalFieldLabelStyle }, label),
    createElement("div", { style: horizontalFieldControlStyle }, control)
  );
}

function HorizontalReadOnlyField({ label, value }: { label: string; value: string }): ReactElement {
  return createElement(
    HorizontalFieldRow,
    { label, control: createElement("span", { style: horizontalReadOnlyValueStyle }, value) }
  );
}

function HorizontalTextField({
  label,
  value,
  onCommit,
  mono
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  mono?: boolean;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    HorizontalFieldRow,
    {
      label,
      control: createElement("input", {
        value: draft,
        onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
        onFocus: () => setFocused(true),
        onBlur: () => {
          setFocused(false);
          commit();
        },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        },
        style: {
          ...horizontalTextInputStyle,
          ...(focused ? horizontalTextInputFocusStyle : horizontalTextInputBlurStyle),
          fontFamily: mono ? UI_MONO_FONT_FAMILY : UI_FONT_FAMILY
        }
      })
    }
  );
}

function SampleDataSourceField({ value, onCommit }: { value: string; onCommit: (value: string) => void }): ReactElement {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    "span",
    {
      style: {
        ...sampleDataSourceWrapStyle,
        ...(focused ? horizontalTextInputFocusStyle : horizontalTextInputBlurStyle)
      }
    },
    createElement("input", {
      value: draft,
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        commit();
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
      },
      style: sampleDataSourceInputStyle
    }),
    createElement(
      "button",
      { type: "button", title: "Open sample data source", style: sampleDataSourceLinkStyle, onClick: () => undefined },
      createElement(ToolIcon, { icon: LinkSquare02Icon, size: 14 })
    )
  );
}

function VariableSearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }): ReactElement {
  const [focused, setFocused] = useState(false);

  return createElement(
    "span",
    {
      style: {
        ...variableSearchWrapStyle,
        ...(focused ? variableSearchFocusStyle : variableSearchBlurStyle)
      }
    },
    createElement(ToolIcon, { icon: Search01Icon, size: 14 }),
    createElement("input", {
      type: "search",
      value,
      placeholder: "Search variables...",
      onChange: (event) => onChange((event.currentTarget as HTMLInputElement).value),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: variableSearchInputStyle
    })
  );
}

function VariableListRow({ field, isLast }: { field: FlatDataField; isLast?: boolean }): ReactElement {
  return createElement(
    "div",
    { style: { ...variableRowStyle, ...(isLast ? { borderBottom: 0 } : null) } },
    createElement(
      "span",
      { style: variableRowIconStyle },
      createElement(ToolIcon, { icon: ThirdBracketIcon, size: 12 })
    ),
    createElement("span", { style: variableRowPathStyle }, field.path),
    createElement("span", { style: variableTypePillStyle }, field.kind),
    createElement(
      "button",
      {
        type: "button",
        title: `Actions for ${field.path}`,
        style: variableRowMenuStyle,
        onClick: () => {
          void navigator.clipboard?.writeText(field.path);
        }
      },
      createElement(ToolIcon, { icon: MoreVerticalIcon, size: 14 })
    )
  );
}

function TemplateVariableRow({
  variable,
  isLast,
  onChange,
  onDelete
}: {
  variable: VariableDefinition;
  isLast?: boolean;
  onChange: (update: (variable: VariableDefinition) => void) => void;
  onDelete: () => void;
}): ReactElement {
  return createElement(
    "div",
    { style: { ...conditionCardStyle, ...(isLast ? { marginBottom: 0 } : null) } },
    createElement(
      "div",
      { style: conditionHeaderStyle },
      createElement("span", { style: conditionTitleStyle }, variable.name || variable.id),
      createElement(
        "div",
        { style: inlineButtonGroupStyle },
        createElement(MiniActionButton, { icon: Copy01Icon, title: "Copy variable id", onClick: () => void navigator.clipboard?.writeText(variable.id) }),
        createElement(MiniActionButton, { icon: Delete02Icon, title: "Delete variable", onClick: onDelete })
      )
    ),
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(TextControl, {
        label: "Name",
        value: variable.name,
        onCommit: (value) => onChange((draft) => (draft.name = value || draft.id))
      }),
      createElement(TextControl, {
        label: "ID",
        value: variable.id,
        mono: true,
        onCommit: (value) => onChange((draft) => (draft.id = sanitizeVariableId(value) || draft.id))
      })
    ),
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(SelectControl, {
        label: "Category",
        value: variable.category ?? "computed",
        options: ["design", "data", "computed", "runtime"].map((value) => ({ value, label: titleCase(value) })),
        onChange: (value) => onChange((draft) => (draft.category = value as VariableDefinition["category"]))
      }),
      createElement(SelectControl, {
        label: "Value Type",
        value: variable.value.kind,
        options: ["literal", "binding", "template", "formula"].map((value) => ({ value, label: titleCase(value) })),
        onChange: (value) => onChange((draft) => (draft.value = createDefaultDynamicValue(value, draft.id)))
      })
    ),
    createElement(VariableValueEditor, { value: variable.value, variableId: variable.id, onChange: (value) => onChange((draft) => (draft.value = value)) })
  );
}

function VariableValueEditor({
  value,
  variableId,
  onChange
}: {
  value: DynamicValue;
  variableId: string;
  onChange: (value: DynamicValue) => void;
}): ReactElement {
  if (value.kind === "literal") {
    return createElement(TextControl, { label: "Literal", value: value.value, onCommit: (next) => onChange({ kind: "literal", value: next }) });
  }

  if (value.kind === "binding") {
    return createElement(TextControl, {
      label: "Binding Path",
      value: value.binding.path,
      mono: true,
      placeholder: "invoice.total",
      onCommit: (path) => onChange({ kind: "binding", binding: { path } })
    });
  }

  if (value.kind === "template") {
    return createElement(TextAreaControl, {
      label: "Template",
      value: inlineContentToTemplateInput(value.parts),
      onCommit: (input) => onChange({ kind: "template", parts: templateInputToInlineContent(input) })
    });
  }

  return createElement(FormulaEditor, { formula: value.formula, variableId, onChange: (formula) => onChange({ kind: "formula", formula }) });
}

function FormulaEditor({
  formula,
  variableId,
  onChange
}: {
  formula: FormulaExpression;
  variableId: string;
  onChange: (formula: FormulaExpression) => void;
}): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement(SelectControl, {
      label: "Formula",
      value: formula.op,
      options: ["sum", "count", "add", "subtract", "multiply", "divide", "concat"].map((value) => ({ value, label: titleCase(value) })),
      onChange: (op) => onChange(createDefaultFormula(op, variableId))
    }),
    formula.op === "sum" || formula.op === "count"
      ? createElement(TextControl, {
          label: "Path",
          value: formula.path,
          mono: true,
          placeholder: "invoice.items.total",
          onCommit: (path) => onChange({ ...formula, path })
        })
      : null,
    formula.op === "add" || formula.op === "subtract" || formula.op === "multiply" || formula.op === "divide"
      ? createElement(
          "div",
          { style: twoColumnGridStyle },
          createElement(TextControl, {
            label: "Left",
            value: formulaOperandToInput(formula.left),
            mono: true,
            placeholder: "{{invoice.total}}",
            onCommit: (input) => onChange({ ...formula, left: parseFormulaOperandInput(input) })
          }),
          createElement(TextControl, {
            label: "Right",
            value: formulaOperandToInput(formula.right),
            mono: true,
            placeholder: "10",
            onCommit: (input) => onChange({ ...formula, right: parseFormulaOperandInput(input) })
          })
        )
      : null,
    formula.op === "concat"
      ? createElement(TextControl, {
          label: "Parts",
          value: formula.parts.map(formulaOperandToInput).join(", "),
          mono: true,
          placeholder: "Invoice , {{invoice.number}}",
          onCommit: (input) => onChange({ op: "concat", parts: input.split(",").map((part) => parseFormulaOperandInput(part.trim())) })
        })
      : null,
    createElement(EmptyText, null, "Use {{path}} for data paths and var:variableId for variable operands.")
  );
}

function SampleDataEditor({
  data,
  onCommit
}: {
  data?: Record<string, unknown>;
  onCommit?: (data: Record<string, unknown>) => void;
}): ReactElement {
  const serializedData = useMemo(() => JSON.stringify(data ?? {}, null, 2), [data]);
  const [draft, setDraft] = useState(serializedData);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!focused) {
      setDraft(serializedData);
    }
  }, [focused, serializedData]);

  const commit = (): void => {
    if (!onCommit || draft === serializedData) {
      setError("");
      return;
    }

    try {
      const parsed = JSON.parse(draft) as unknown;

      if (!isRecord(parsed)) {
        setError("Sample data must be a JSON object.");
        return;
      }

      setError("");
      onCommit(parsed);
      setDraft(JSON.stringify(parsed, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid JSON.");
    }
  };

  return createElement(
    "div",
    { style: sampleEditorShellStyle },
    createElement(
      "div",
      { style: sampleEditorToolbarStyle },
      createElement("span", null, error ? "Invalid JSON" : "Editing preview data"),
      createElement(
        "button",
        {
          type: "button",
          disabled: !onCommit,
          title: "Apply sample data",
          onClick: commit,
          style: {
            ...sampleEditorApplyButtonStyle,
            opacity: onCommit ? 1 : 0.5,
            cursor: onCommit ? "pointer" : "not-allowed"
          }
        },
        "Apply"
      )
    ),
    createElement("textarea", {
      value: draft,
      spellCheck: false,
      disabled: !onCommit,
      onChange: (event) => {
        setDraft((event.currentTarget as HTMLTextAreaElement).value);
        if (error) setError("");
      },
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        commit();
      },
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          commit();
        }

        if (event.key === "Escape") {
          setDraft(serializedData);
          setError("");
          event.currentTarget.blur();
        }
      },
      style: {
        ...sampleEditorTextAreaStyle,
        ...(focused ? sampleEditorTextAreaFocusStyle : null),
        borderColor: error ? "#fca5a5" : focused ? "#c7d2fe" : "#e3e6eb"
      }
    }),
    error
      ? createElement("div", { style: sampleEditorErrorStyle }, error)
      : createElement("div", { style: sampleEditorHintStyle }, "Blur or press Cmd/Ctrl+Enter to apply.")
  );
}

function SampleDataPreview({ json }: { json: string }): ReactElement {
  const lines = json.split("\n");

  return createElement(
    "div",
    { style: samplePreviewShellStyle },
    createElement(
      "button",
      {
        type: "button",
        title: "Copy sample JSON",
        style: samplePreviewCopyStyle,
        onClick: () => {
          void navigator.clipboard?.writeText(json);
        }
      },
      createElement(ToolIcon, { icon: Copy01Icon, size: 14 })
    ),
    createElement(
      "div",
      { style: samplePreviewScrollStyle },
      lines.map((line, index) =>
        createElement(
          "div",
          { key: `${index}-${line}`, style: samplePreviewLineStyle },
          createElement("span", { style: samplePreviewGutterStyle }, String(index + 1)),
          createElement("code", { style: samplePreviewCodeStyle }, renderJsonLine(line))
        )
      )
    )
  );
}

function renderJsonLine(line: string): ReactNode {
  if (!line.trim()) return line;

  const keyMatch = line.match(/^(\s*)"([^"]+)("\s*:\s*)(.*)$/);
  if (keyMatch) {
    return createElement(
      Fragment,
      null,
      keyMatch[1],
      '"',
      createElement("span", { style: sampleJsonKeyStyle }, keyMatch[2]),
      '"',
      keyMatch[3],
      renderJsonValue(keyMatch[4])
    );
  }

  return renderJsonValue(line);
}

function renderJsonValue(value: string): ReactNode {
  const trimmed = value.trim();
  if (/^".*"$/.test(trimmed)) return createElement("span", { style: sampleJsonStringStyle }, trimmed);
  if (/^-?\d+(\.\d+)?[,]?$/.test(trimmed)) return createElement("span", { style: sampleJsonNumberStyle }, trimmed);
  return value;
}

function PageTokenColorSelect({ value, onChange }: { value: string; onChange: (value: string) => void }): ReactElement {
  return createElement(
    "span",
    { style: tokenColorSelectWrapStyle },
    createElement("span", { style: { ...tokenColorDotStyle, background: tokenColorForToken(value) } }),
    createElement(PageInlineSelect, {
      value,
      options: [
        { value: "color.primary", label: "Color.Primary" },
        { value: "color.secondary", label: "Color.Secondary" },
        { value: "color.danger", label: "Color.Danger" }
      ],
      onChange
    })
  );
}

function SectionHeaderIconButton({ icon, title, onClick }: { icon: IconSvgElement; title: string; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      title,
      onClick: (event) => {
        event.stopPropagation();
        onClick();
      },
      style: sectionHeaderIconButtonStyle
    },
    createElement(ToolIcon, { icon, size: 13 })
  );
}

function PageAdvancedTab({
  targetId,
  showGrid,
  showRulers,
  snapToGrid,
  snapToGuides,
  onToggleGrid,
  onToggleRulers,
  onToggleSnapGrid,
  onToggleSnapGuides
}: {
  targetId: InspectorTargetId;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleSnapGrid: () => void;
  onToggleSnapGuides: () => void;
}): ReactElement {
  return createElement(
    SectionStack,
    null,
    createElement(
      InspectorSection,
      { targetId, sectionId: "workspace", title: "Workspace", detail: showGrid ? "grid on" : "grid off" },
      createElement(
        "div",
        { style: pageToggleStackStyle },
        createElement(ToggleSwitch, { label: "Grid", checked: showGrid, onChange: onToggleGrid }),
        createElement(ToggleSwitch, { label: "Rulers", checked: showRulers, onChange: onToggleRulers }),
        createElement(ToggleSwitch, { label: "Snap to grid", checked: snapToGrid, onChange: onToggleSnapGrid }),
        createElement(ToggleSwitch, { label: "Guides", checked: snapToGuides, onChange: onToggleSnapGuides })
      ),
      createElement(FieldRow, { label: "Grid size", value: `${GRID_SIZE}px` }),
      createElement(FieldRow, { label: "Snap threshold", value: `${SNAP_THRESHOLD}px` })
    )
  );
}

function PositionSection({ targetId, frame, onFrameCommit }: { targetId: InspectorTargetId; frame: Frame; onFrameCommit: (framePatch: Partial<Frame>) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId, sectionId: "layout-position", title: "Layout", detail: `${Math.round(frame.width)} x ${Math.round(frame.height)}` },
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(NumberControl, { label: "X", value: frame.x, onCommit: (value) => onFrameCommit({ x: value }) }),
      createElement(NumberControl, { label: "Y", value: frame.y, onCommit: (value) => onFrameCommit({ y: value }) }),
      createElement(NumberControl, { label: "Width", value: frame.width, onCommit: (value) => onFrameCommit({ width: Math.max(1, value) }) }),
      createElement(NumberControl, { label: "Height", value: frame.height, onCommit: (value) => onFrameCommit({ height: Math.max(1, value) }) })
    )
  );
}

function TextContentSection({
  template,
  data,
  item,
  nodeItems,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  node: TextNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const metadata = getInspectorMetadata(node);
  const serialized = textNodeContentValue(node);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number>(serialized.length);
  const [draft, setDraft] = useState(serialized);

  useEffect(() => {
    setDraft(serialized);
    caretRef.current = serialized.length;
  }, [serialized]);

  const fieldOptions = useMemo(
    () => buildInsertableFieldOptions(template, data, nodeItems, item),
    [template, data, nodeItems, item]
  );

  const commitValue = (value: string): void =>
    onNodeCommit((next) => {
      if (next.type === "text") next.content = parseTextContent(value);
    });

  const trackCaret = (): void => {
    const el = inputRef.current;
    if (el && el.selectionStart != null) caretRef.current = el.selectionStart;
  };

  const handleInsertField = (path: string): void => {
    if (!path) return;
    const current = inputRef.current?.value ?? draft;
    const insertion = insertBindingToken(current, path, caretRef.current);
    setDraft(insertion.value);
    caretRef.current = insertion.caret;
    commitValue(insertion.value);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(insertion.caret, insertion.caret);
      }
    });
  };

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-content", title: "Content" },
    createElement(
      NodeRow,
      { label: "Content" },
      createElement(
        "div",
        { className: UI_CHROME_CLASS, style: nodeInputShellStyle },
        createElement("input", {
          ref: inputRef,
          value: draft,
          onChange: (event) => {
            setDraft((event.currentTarget as HTMLInputElement).value);
            trackCaret();
          },
          onSelect: trackCaret,
          onClick: trackCaret,
          onKeyUp: trackCaret,
          onFocus: trackCaret,
          onBlur: () => {
            trackCaret();
            if (draft !== serialized) commitValue(draft);
          },
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(serialized);
              event.currentTarget.blur();
            }
          },
          style: { ...nodeInputFieldStyle, fontFamily: UI_MONO_FONT_FAMILY }
        })
      ),
      fieldOptions.length > 0
        ? createElement(TextInsertFieldMenu, { options: fieldOptions, onInsert: handleInsertField })
        : createElement(NodeIconButton, {
            icon: ThirdBracketIcon,
            title: "Wrap content as a field binding",
            onClick: () => {
              const current = (inputRef.current?.value ?? draft).trim();
              const wrapped = current && !/^\{\{.*\}\}$/.test(current) ? `{{${current}}}` : current || "{{field}}";
              setDraft(wrapped);
              caretRef.current = wrapped.length;
              commitValue(wrapped);
            }
          })
    ),
    createElement("span", { style: nodeHintStyle }, "Type text or insert a data field at the caret. Fields render as {{path}} chips."),
    createElement(
      NodeRow,
      { label: "Placeholder" },
      createElement(NodeInlineInput, {
        value: String(metadata.placeholder ?? ""),
        placeholder: "Delivery address",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            setInspectorMetadataValue(draft, "placeholder", value);
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Overflow" },
      createElement(NodeSegmented, {
        value: node.overflow ?? "wrap",
        options: ["clip", "wrap", "continue", "shrink"].map((value) => ({ value, label: titleCase(value) })),
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.overflow = value as TextNode["overflow"];
          })
      })
    )
  );
}

interface InsertableFieldOption {
  path: string;
  label: string;
}

function buildInsertableFieldOptions(
  template: DocumentTemplate,
  data: Record<string, unknown> | undefined,
  nodeItems: EditorNodeItem[],
  item: EditorNodeItem
): InsertableFieldOption[] {
  const model = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const options: InsertableFieldOption[] = [];
  const seen = new Set<string>();

  for (const group of model.groups) {
    for (const field of group.fields) {
      if (!field.bindable || field.kind === "array" || field.kind === "object") continue;
      if (seen.has(field.path)) continue;

      seen.add(field.path);
      options.push({ path: field.path, label: field.label });
    }
  }

  return options;
}

function TextInsertFieldMenu({
  options,
  onInsert
}: {
  options: InsertableFieldOption[];
  onInsert: (path: string) => void;
}): ReactElement {
  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: textInsertMenuShellStyle, title: "Insert data field at caret" },
    createElement(HugeiconsIcon, { icon: ThirdBracketIcon, size: 14, color: "#64748b", strokeWidth: 1.8 }),
    createElement(
      "select",
      {
        value: "",
        onChange: (event) => {
          const target = event.currentTarget as HTMLSelectElement;
          const path = target.value;
          target.value = "";
          onInsert(path);
        },
        style: textInsertSelectStyle
      },
      createElement("option", { value: "", disabled: true }, "Field"),
      options.map((option) =>
        createElement("option", { key: option.path, value: option.path }, `${option.label} · ${option.path}`)
      )
    )
  );
}

function TextTypographySection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const weightValue = String(node.style.fontWeight ?? 400);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-typography", title: "Typography" },
    createElement(
      NodeRow,
      { label: "Font Family" },
      createElement(NodeInlineSelect, {
        value: node.style.fontFamily,
        options: fontFamilyOptions(node.style.fontFamily),
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.fontFamily = value;
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Weight" },
      createElement(NodeInlineSelect, {
        value: weightValue,
        options: fontWeightOptions(weightValue),
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.fontWeight = Number.isFinite(Number(value)) ? Number(value) : value;
          })
      })
    ),
    createElement(
      "div",
      { style: nodeMetricRowStyle },
      createElement(NodeMetricField, {
        label: "Size",
        value: node.style.fontSize,
        suffix: "px",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.fontSize = Math.max(4, value);
          })
      }),
      createElement(NodeMetricField, {
        label: "Line Height",
        value: node.style.lineHeight ?? Math.round(node.style.fontSize * 1.2),
        suffix: "px",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.lineHeight = Math.max(1, value);
          })
      }),
      createElement(NodeMetricField, {
        label: "Letter Spacing",
        value: node.style.letterSpacing ?? 0,
        suffix: "px",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.letterSpacing = value;
          })
      })
    )
  );
}

function TextColorsSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const background = typeof metadata.backgroundColor === "string" ? metadata.backgroundColor : "";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-colors", title: "Colors" },
    createElement(
      NodeRow,
      { label: "Text Color" },
      createElement(NodeColorField, {
        value: node.style.color ?? "#111827",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.color = value;
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Background (editor-only)" },
      createElement(NodeColorField, {
        value: background,
        emptyLabel: "Transparent",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            setInspectorMetadataValue(draft, "backgroundColor", value);
          }),
        onClear: () =>
          onNodeCommit((draft) => {
            setInspectorMetadataValue(draft, "backgroundColor", "");
          })
      })
    ),
    createElement("span", { style: nodeHintStyle }, "Text background is an editor-only preference; preview/export rendering is unchanged.")
  );
}

function RepeatLayoutSection({ node, onNodeCommit }: { node: RepeatNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "repeat-layout", title: "Repeat Layout", detail: node.layout.direction },
    createElement(SegmentedControl, {
      label: "Direction",
      value: node.layout.direction,
      options: [
        { value: "vertical", label: "Rows" },
        { value: "horizontal", label: "Columns" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.direction = value as RepeatNode["layout"]["direction"];
        })
    }),
    createElement(NumberControl, {
      label: "Gap",
      value: node.layout.gap,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.gap = Math.max(0, value);
        })
    }),
    createElement(SegmentedControl, {
      label: "Row height",
      value: node.layout.rowSizing ?? "fixed",
      options: [
        { value: "fixed", label: "Fixed" },
        { value: "compact", label: "Compact" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.rowSizing = value as RepeatNode["layout"]["rowSizing"];
        })
    })
  );
}

function RepeatPaginationSection({ node, onNodeCommit }: { node: RepeatNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const rowSizing = node.layout.rowSizing ?? "fixed";
  const fillAvailableSpace = node.layout.fillAvailableSpace === true;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "repeat-pagination", title: "Pagination", detail: node.layout.splitItems === false ? "keep row" : "auto" },
    createElement(SegmentedControl, {
      label: "Page break",
      value: node.layout.splitItems === false ? "keep-row" : "auto",
      options: [
        { value: "auto", label: "Auto" },
        { value: "keep-row", label: "Keep row" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.splitItems = value === "keep-row" ? false : undefined;
        })
    }),
    createElement(ToggleSwitch, {
      label: "Keep row intact",
      checked: node.layout.splitItems === false,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.splitItems = draft.layout.splitItems === false ? undefined : false;
        })
    }),
    createElement(SegmentedControl, {
      label: "Row sizing",
      value: rowSizing,
      options: [
        { value: "fixed", label: "Fixed" },
        { value: "compact", label: "Compact" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.rowSizing = value === "compact" ? "compact" : undefined;
        })
    }),
    createElement(NumberControl, {
      label: "Min row height",
      value: node.layout.minRowHeight ?? 0,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type !== "repeat") return;
          const next = Math.max(0, Math.round(value));
          draft.layout.minRowHeight = next > 0 ? next : undefined;
        })
    }),
    createElement(NumberControl, {
      label: "Max shrink %",
      value: Math.round((node.layout.maxCompressionRatio ?? 0.12) * 100),
      disabled: rowSizing !== "compact",
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.maxCompressionRatio = clampRatioPercent(value);
        })
    }),
    createElement(ToggleSwitch, {
      label: "Fill available space",
      checked: fillAvailableSpace,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.fillAvailableSpace = draft.layout.fillAvailableSpace === true ? undefined : true;
        })
    }),
    createElement(NumberControl, {
      label: "Max grow %",
      value: Math.round((node.layout.maxExpansionRatio ?? 0.15) * 100),
      disabled: !fillAvailableSpace,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.layout.maxExpansionRatio = clampRatioPercent(value);
        })
    }),
    createElement(ToggleSwitch, {
      label: "Repeat header on break",
      checked: node.layout.repeatHeaderOnPageBreak === true,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat")
            draft.layout.repeatHeaderOnPageBreak =
              draft.layout.repeatHeaderOnPageBreak === true ? undefined : true;
        })
    }),
    createElement(ToggleSwitch, {
      label: "Keep block together",
      checked: node.layout.keepTogether === true,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat")
            draft.layout.keepTogether = draft.layout.keepTogether === true ? undefined : true;
        })
    }),
    node.header && node.header.length > 0
      ? undefined
      : createElement(DisabledControl, {
          label: "Header row",
          value: "Add a header row in JSON to enable"
        })
  );
}

function clampRatioPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  const ratio = percent / 100;
  return Math.max(0, Math.min(1, ratio));
}

function RepeatDataSection({
  template,
  data,
  item,
  nodeItems,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  node: RepeatNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const scopeFields = explorer.groups.find((group) => group.id === "scope")?.fields ?? [];

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "repeat-data", title: "Data", detail: node.binding.path },
    createElement(TextControl, {
      label: "Data source",
      value: node.binding.path,
      mono: true,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.binding.path = value;
        })
    }),
    createElement(TextControl, {
      label: "Alias",
      value: node.itemAlias,
      mono: true,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.itemAlias = value || "item";
        })
    }),
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(NumberControl, {
        label: "Editor rows",
        value: Number(node.metadata?.minEditorRows ?? 1),
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "repeat") draft.metadata = { ...draft.metadata, minEditorRows: Math.max(1, Math.round(value)) };
          })
      }),
      createElement(NumberControl, {
        label: "Sample rows",
        value: Number(node.metadata?.sampleRows ?? 2),
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "repeat") draft.metadata = { ...draft.metadata, sampleRows: Math.max(1, Math.round(value)) };
          })
      })
    ),
    createElement(ToggleSwitch, {
      label: "Show sample rows",
      checked: node.metadata?.showSampleRows !== false,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "repeat") draft.metadata = { ...draft.metadata, showSampleRows: draft.metadata?.showSampleRows === false ? true : false };
        })
    }),
    createElement(
      "div",
      { style: nodeFieldListStyle },
      scopeFields.length === 0
        ? createElement(EmptyText, null, "No scoped sample fields are available for this repeat yet.")
        : createElement(BindingExplorerGroupRows, {
            title: `Available ${node.itemAlias} fields`,
            fields: scopeFields,
            node,
            onBind: () => undefined
          })
    )
  );
}

function BindingFieldList({ fields, title }: { fields: FlatDataField[]; title: string }): ReactElement {
  return createElement(
    "div",
    { style: bindingListStyle },
    createElement(SectionLabel, { title }),
    fields.length === 0
      ? createElement(EmptyText, null, "No schema fields are available for this scope yet.")
      : fields.slice(0, 9).map((field) => createElement(BindingFieldButton, { key: field.path, field }))
  );
}

function BindingFieldButton({ field }: { field: FlatDataField }): ReactElement {
  const [focused, setFocused] = useState(false);

  return createElement(
    "button",
    {
      type: "button",
      title: `Copy ${field.path}`,
      onClick: () => {
        void navigator.clipboard?.writeText(field.path);
      },
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        ...bindingFieldButtonStyle,
        ...(focused ? bindingFieldButtonFocusStyle : null)
      }
    },
    createElement("span", { style: bindingFieldNameStyle }, field.label),
    createElement("span", { style: bindingFieldPathStyle }, field.path)
  );
}

function RepeatDiagnosticsSection({ data, node }: { data?: Record<string, unknown>; node: RepeatNode }): ReactElement {
  const sample = sampleValueForRawPath(data, node.binding.path);
  const rowCount = Array.isArray(sample) ? sample.length : 0;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "repeat-diagnostics", title: "Diagnostics", detail: "low risk" },
    createElement(FieldRow, { label: "Rows/page", value: "18" }),
    createElement(FieldRow, { label: "Sample rows", value: rowCount ? String(rowCount) : "none" }),
    createElement(FieldRow, { label: "Est. pages", value: rowCount > 0 ? `${Math.max(1, Math.ceil(rowCount / 18))}` : "auto" }),
    createElement(
      "div",
      { style: readOnlyRowStyle },
      createElement("span", { style: fieldLabelStyle }, "Overflow risk"),
      createElement("span", { style: lowRiskPillStyle }, "Low")
    )
  );
}

function GridStructureSection({ node, onNodeCommit }: { node: GridNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const bodyRowCount = gridBodyRowCount(node);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "grid-structure", title: "Table Structure", detail: `${node.columns.length} columns` },
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(NumberControl, {
        label: "Row height",
        value: node.rowHeight,
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") draft.rowHeight = Math.max(12, Math.round(value));
          })
      }),
      createElement(NumberControl, {
        label: "Table width",
        value: node.frame.width,
        disabled: true,
        onCommit: () => undefined
      })
    ),
    createElement(ToggleSwitch, {
      label: "Header row",
      checked: Boolean(node.header),
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "grid") setGridHeaderEnabled(draft, !draft.header);
        })
    }),
    createElement(ToggleSwitch, {
      label: "Footer row",
      checked: Boolean(node.footer),
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "grid") setGridFooterEnabled(draft, !draft.footer);
        })
    }),
    createElement(FieldRow, { label: "Rows", value: `${node.header ? 1 : 0} header / ${bodyRowCount} body / ${node.footer ? 1 : 0} footer` }),
    node.binding
      ? createElement(EmptyText, null, "Bound tables render body rows from array data. Remove the data source to author static rows.")
      : createElement(
          "div",
          { style: gridInlineActionRowStyle },
          createElement(
            "button",
            {
              type: "button",
              onClick: () =>
                onNodeCommit((draft) => {
                  if (draft.type === "grid") addGridStaticRow(draft);
                }),
              style: secondaryButtonStyle
            },
            "Add static row"
          ),
          createElement(
            "button",
            {
              type: "button",
              disabled: bodyRowCount <= 1,
              onClick: () =>
                onNodeCommit((draft) => {
                  if (draft.type === "grid") removeGridStaticRow(draft, bodyRowCount - 1);
                }),
              style: {
                ...secondaryButtonStyle,
                color: bodyRowCount <= 1 ? "#94a3b8" : "#b91c1c",
                cursor: bodyRowCount <= 1 ? "not-allowed" : "pointer"
              }
            },
            "Remove row"
          )
        ),
    createElement("span", { style: nodeHintStyle }, "Table rows and cells are editable groups on the canvas.")
  );
}

function GridColumnsSection({ node, onNodeCommit }: { node: GridNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    {
      targetId: `node:${node.id}`,
      sectionId: "grid-columns",
      title: "Columns",
      detail: `${node.columns.length}`,
      headerAction: createElement(SectionHeaderIconButton, {
        icon: Add01Icon,
        title: "Add column",
        onClick: () =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") addGridColumn(draft, { label: "Column" });
          })
      })
    },
    createElement(
      "div",
      { style: gridColumnListStyle },
      node.columns.map((column) =>
        createElement(
          "div",
          { key: column.id, style: gridColumnCardStyle },
          createElement(
            "div",
            { style: conditionHeaderStyle },
            createElement("span", { style: conditionTitleStyle }, column.label ?? titleCase(column.id)),
            createElement(
              "div",
              { style: inlineButtonGroupStyle },
              createElement(MiniActionButton, {
                icon: Copy01Icon,
                title: "Copy column id",
                onClick: () => void navigator.clipboard?.writeText(column.id)
              }),
              createElement(
                "button",
                {
                  type: "button",
                  title: node.columns.length <= 1 ? "A table needs at least one column" : "Remove column",
                  disabled: node.columns.length <= 1,
                  onClick: () =>
                    onNodeCommit((draft) => {
                      if (draft.type === "grid") removeGridColumn(draft, column.id);
                    }),
                  style: {
                    ...miniActionButtonStyle,
                    opacity: node.columns.length <= 1 ? 0.42 : 1,
                    cursor: node.columns.length <= 1 ? "not-allowed" : "pointer"
                  }
                },
                createElement(ToolIcon, { icon: Delete02Icon, size: 12 })
              )
            )
          ),
          createElement(
            "div",
            { style: twoColumnGridStyle },
            createElement(TextControl, {
              label: "Label",
              value: column.label ?? titleCase(column.id),
              onCommit: (value) =>
                onNodeCommit((draft) => {
                  if (draft.type === "grid") setGridColumnLabel(draft, column.id, value);
                })
            }),
            createElement(NumberControl, {
              label: "Width",
              value: column.width,
              onCommit: (value) =>
                onNodeCommit((draft) => {
                  if (draft.type === "grid") setGridColumnWidth(draft, column.id, value);
                })
            })
          ),
          createElement(FieldRow, { label: "Cell binding", value: `item.${column.id}` })
        )
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onNodeCommit((draft) => {
              if (draft.type === "grid") addGridColumn(draft, { label: "Column" });
            }),
          style: nodeAccentButtonStyle
        },
        createElement(ToolIcon, { icon: Add01Icon, size: 14 }),
        "Add column"
      )
    )
  );
}

function GridBehaviorSection({ node, onNodeCommit }: { node: GridNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "grid-behavior", title: "Behavior", detail: node.behavior ? "custom" : "default" },
    createElement(ToggleSwitch, {
      label: "Repeat header on break",
      checked: node.behavior?.repeatHeaderOnPageBreak === true,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "grid") setGridRepeatHeaderOnBreak(draft, draft.behavior?.repeatHeaderOnPageBreak !== true);
        })
    }),
    createElement(ToggleSwitch, {
      label: "Allow row split",
      checked: node.behavior?.allowRowSplit === true,
      onChange: () =>
        onNodeCommit((draft) => {
          if (draft.type === "grid") setGridAllowRowSplit(draft, draft.behavior?.allowRowSplit !== true);
        })
    }),
    createElement("span", { style: nodeHintStyle }, "These are renderer-backed table behavior flags.")
  );
}

function GridCellStyleSection({ node, onNodeCommit }: { node: GridNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const firstCell = firstGridCell(node);
  const firstChild = firstCell?.content[0];
  const padding = firstChild?.frame.x ?? 8;
  const style = firstCell?.style ?? {};

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "grid-cell-style", title: "Cell Appearance", detail: "all cells" },
    createElement(
      "div",
      { style: twoColumnGridStyle },
      createElement(TextControl, {
        label: "Fill",
        value: style.fill ?? "#ffffff",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") updateAllGridCells(draft, (rowKind, columnId, rowIndex) => setGridCellStyle(draft, rowKind, columnId, { fill: normalizeHexColor(value) }, rowIndex));
          })
      }),
      createElement(TextControl, {
        label: "Border",
        value: style.stroke ?? "#d8dee8",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") updateAllGridCells(draft, (rowKind, columnId, rowIndex) => setGridCellStyle(draft, rowKind, columnId, { stroke: normalizeHexColor(value) }, rowIndex));
          })
      }),
      createElement(NumberControl, {
        label: "Border width",
        value: Number(style.strokeWidth ?? 1),
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") updateAllGridCells(draft, (rowKind, columnId, rowIndex) => setGridCellStyle(draft, rowKind, columnId, { strokeWidth: Math.max(0, value) }, rowIndex));
          })
      }),
      createElement(NumberControl, {
        label: "Padding",
        value: padding,
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "grid") updateAllGridCells(draft, (rowKind, columnId, rowIndex) => setGridCellPadding(draft, rowKind, columnId, value, rowIndex));
          })
      })
    ),
    createElement("span", { style: nodeHintStyle }, "These controls mutate real cell templates and affect Preview/export.")
  );
}

function GridDataSection({
  template,
  data,
  item,
  nodeItems,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  node: GridNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const bindingPath = node.binding?.path ?? "";
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const scopeFields = explorer.groups.find((group) => group.id === "scope")?.fields ?? [];
  const bindableFields = gridColumnFieldOptions(explorer);
  const sample = sampleValueForRawPath(data, bindingPath);
  const sampleRows = Array.isArray(sample) ? sample.length : 0;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "grid-data", title: "Data", detail: bindingPath || "static" },
    createElement(BindingControl, {
      label: "Data source",
      value: bindingPath,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type !== "grid") return;
          const path = value.trim();
          draft.binding = path ? { path } : undefined;
        })
    }),
    createElement(FieldRow, { label: "Sample rows", value: sampleRows ? String(sampleRows) : formatSampleValue(sample) }),
    createElement(FieldRow, { label: "Row alias", value: "item" }),
    createElement(
      "div",
      { style: gridColumnListStyle },
      node.columns.map((column) =>
        createElement(
          "div",
          { key: column.id, style: gridColumnCardStyle },
          createElement(FieldRow, { label: "Column", value: column.label ?? titleCase(column.id) }),
          createElement(SelectControl, {
            label: "Column binding",
            value: gridColumnBindingPath(node, column.id),
            options: [{ value: "", label: "Unbound" }, ...bindableFields],
            onChange: (value) =>
              onNodeCommit((draft) => {
                if (draft.type === "grid") bindGridColumn(draft, column.id, value);
              })
          })
        )
      )
    ),
    createElement(
      "div",
      { style: nodeFieldListStyle },
      bindingPath && scopeFields.length > 0
        ? createElement(BindingExplorerGroupRows, {
            title: "Available item fields",
            fields: scopeFields,
            node,
            onBind: () => undefined
          })
        : createElement(EmptyText, null, "Bind the table to an array to expose item.* fields inside cells.")
    )
  );
}

function gridBodyRowsForInspector(node: GridNode): GridNode["row"][] {
  return node.binding ? [node.row] : node.staticRows?.length ? node.staticRows : [node.row];
}

function gridBodyRowCount(node: GridNode): number {
  return gridBodyRowsForInspector(node).length;
}

function firstGridCell(node: GridNode) {
  return node.header?.cells[0] ?? gridBodyRowsForInspector(node)[0]?.cells[0] ?? node.footer?.cells[0];
}

function updateAllGridCells(
  node: GridNode,
  update: (rowKind: "header" | "row" | "footer", columnId: string, rowIndex: number) => void,
): void {
  if (node.header) {
    for (const cell of node.header.cells) {
      update("header", cell.columnId, 0);
    }
  }

  for (const [rowIndex, row] of gridBodyRowsForInspector(node).entries()) {
    for (const cell of row.cells) {
      update("row", cell.columnId, rowIndex);
    }
  }

  if (node.footer) {
    for (const cell of node.footer.cells) {
      update("footer", cell.columnId, 0);
    }
  }
}

function gridColumnFieldOptions(explorer: DataExplorerModel): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  for (const group of explorer.groups) {
    for (const field of group.fields) {
      if (!field.bindable || field.kind === "array" || field.kind === "object" || seen.has(field.path)) {
        continue;
      }

      seen.add(field.path);
      options.push({
        value: field.path,
        label: `${field.label} · ${field.displayPath ?? field.path}`,
      });
    }
  }

  return options;
}

function gridColumnBindingPath(node: GridNode, columnId: string): string {
  for (const row of gridBodyRowsForInspector(node)) {
    const text = row.cells
      .find((cell) => cell.columnId === columnId)
      ?.content.find((child): child is TextNode => child.type === "text");
    const field = text?.content.find((part) => part.kind === "field");

    if (field?.kind === "field") {
      return field.binding.path;
    }
  }

  return "";
}

function TextLayoutSection({
  node,
  frame,
  onFrameCommit,
  onNodeCommit
}: {
  node: TextNode;
  frame: Frame;
  onFrameCommit: (framePatch: Partial<Frame>) => void;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-layout", title: "Layout" },
    createElement(
      NodePairRow,
      null,
      createElement(NodeRow, { label: "X", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.x, suffix: "px", onCommit: (value) => onFrameCommit({ x: value }) })),
      createElement(NodeRow, { label: "Y", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.y, suffix: "px", onCommit: (value) => onFrameCommit({ y: value }) }))
    ),
    createElement(
      NodePairRow,
      null,
      createElement(NodeRow, { label: "W", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.width, suffix: "px", onCommit: (value) => onFrameCommit({ width: Math.max(1, value) }) })),
      createElement(NodeRow, { label: "H", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.height, suffix: "px", onCommit: (value) => onFrameCommit({ height: Math.max(1, value) }) }))
    ),
    createElement(
      NodePairRow,
      null,
      createElement(
        NodeRow,
        { label: "Rotation", labelWidth: 52 },
        createElement(NodeInlineSelect, {
          value: String(node.rotation ?? 0),
          options: [0, 90, 180, 270].map((value) => ({ value: String(value), label: `${value}°` })),
          onChange: (value) =>
            onNodeCommit((draft) => {
              draft.rotation = Number(value) || 0;
            })
        })
      ),
      createElement(
        NodeRow,
        { label: "Opacity", labelWidth: 48 },
        createElement(NodeNumberInput, {
          value: Math.round((node.opacity ?? 1) * 100),
          suffix: "%",
          onCommit: (value) =>
            onNodeCommit((draft) => {
              draft.opacity = Math.max(0, Math.min(100, value)) / 100;
            })
        })
      )
    )
  );
}

function TextAlignmentSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const vertical = typeof metadata.verticalAlign === "string" ? metadata.verticalAlign : "top";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-alignment", title: "Alignment" },
    createElement(
      NodeRow,
      { label: "Horizontal", labelWidth: 64 },
      createElement(NodeSegmented, {
        value: node.style.align ?? "left",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" }
        ],
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.style.align = value as TextNode["style"]["align"];
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Vertical", labelWidth: 64 },
      createElement(NodeSegmented, {
        value: vertical,
        options: [
          { value: "top", label: "Top" },
          { value: "middle", label: "Middle" },
          { value: "bottom", label: "Bottom" }
        ],
        onChange: (value) =>
          onNodeCommit((draft) => {
            setInspectorMetadataValue(draft, "verticalAlign", value);
          })
      })
    )
  );
}

function TextCurrentBindingSection({
  template,
  data,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  node: TextNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const bindingPath = firstTextBinding(node);
  const scope = bindingScopeForNode(template, node);
  const sampleValue = formatSampleValue(sampleValueForPath(template, data, bindingPath));

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-current-binding", title: "Current Binding", collapsible: false },
    createElement(
      NodeRow,
      { label: "Binding Path", labelWidth: 92 },
      createElement(NodeInlineInput, {
        value: bindingPath,
        mono: true,
        placeholder: "shipment.field",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "text") draft.content = value ? [{ kind: "field", label: value, binding: { path: value } }] : [];
          })
      }),
      createElement(NodeGhostIconButton, {
        icon: Copy01Icon,
        title: "Copy binding path",
        onClick: () => {
          void navigator.clipboard?.writeText(bindingPath);
        }
      })
    ),
    createElement(NodeRow, { label: "Scope", labelWidth: 92 }, createElement(NodeReadonlyField, { value: scope, mono: true })),
    createElement(NodeRow, { label: "Sample Value", labelWidth: 92 }, createElement(NodeReadonlyField, { value: sampleValue }))
  );
}

function TextRecentSection({
  template,
  data,
  item,
  nodeItems,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  node: TextNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const bindingPath = firstTextBinding(node);
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const suggestions = explorer.groups
    .flatMap((group) => group.fields)
    .filter((field) => isFieldBindableForNode(field, node))
    .map((field) => field.path)
    .filter((path) => path !== bindingPath)
    .slice(0, 6);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-recent", title: "Recent / Suggested", collapsible: false },
    suggestions.length === 0
      ? createElement(EmptyText, null, "No suggested fields yet.")
      : createElement(
          "div",
          { style: nodeChipWrapStyle },
          suggestions.map((path) =>
            createElement(
              "button",
              {
                key: path,
                type: "button",
                title: `Bind to ${path}`,
                className: UI_BUTTON_CLASS,
                style: nodeChipButtonStyle,
                onClick: () =>
                  onNodeCommit((draft) => {
                    if (draft.type === "text") draft.content = [{ kind: "field", label: path, binding: { path } }];
                  })
              },
              path
            )
          )
        )
  );
}

function TextFormattingSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const fieldRun = node.content.find((part) => part.kind === "field");
  const transform = fieldRun?.kind === "field" && fieldRun.format?.type === "text" ? fieldRun.format.transform ?? "none" : "none";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-formatting", title: "Formatting Defaults" },
    createElement(
      NodeRow,
      { label: "Text Transform", labelWidth: 104 },
      createElement(NodeInlineSelect, {
        value: transform,
        options: [
          { value: "none", label: "None" },
          { value: "uppercase", label: "UPPERCASE" },
          { value: "lowercase", label: "lowercase" },
          { value: "capitalize", label: "Capitalize" }
        ],
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type !== "text") return;
            const target = draft.content.find((part) => part.kind === "field");
            if (target?.kind === "field") {
              target.format = { type: "text", transform: value as "none" | "uppercase" | "lowercase" | "capitalize" };
            } else {
              setInspectorMetadataValue(draft, "textTransform", value);
            }
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Prefix", labelWidth: 104 },
      createElement(NodeInlineInput, {
        value: String(metadata.prefix ?? ""),
        placeholder: "(empty)",
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "prefix", value))
      })
    ),
    createElement(
      NodeRow,
      { label: "Suffix", labelWidth: 104 },
      createElement(NodeInlineInput, {
        value: String(metadata.suffix ?? ""),
        placeholder: "(empty)",
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "suffix", value))
      })
    ),
    createElement(
      NodeRow,
      { label: "Fallback Text", labelWidth: 104 },
      createElement(NodeInlineInput, {
        value: firstTextFallback(node),
        placeholder: "Not provided",
        onCommit: (value) =>
          onNodeCommit((draft) => {
            if (draft.type !== "text") return;
            const target = draft.content.find((part) => part.kind === "field");
            if (target?.kind === "field") target.fallback = value;
            else setInspectorMetadataValue(draft, "fallbackText", value);
          })
      })
    )
  );
}

function TextSamplePreviewSection({ template, data, node }: { template: DocumentTemplate; data?: Record<string, unknown>; node: TextNode }): ReactElement {
  const json = buildTextSamplePreview(template, data, node);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-sample-preview", title: "Sample Data Preview", collapsible: false },
    createElement(NodeSamplePreview, { json })
  );
}

function TextBehaviorSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const maxLines = Number(metadata.maxLines ?? 1);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-behavior", title: "Behavior", collapsible: false },
    createElement(NodeToggleRow, {
      label: "Visible",
      checked: node.visible !== false,
      onChange: () =>
        onNodeCommit((draft) => {
          draft.visible = draft.visible === false ? true : false;
        })
    }),
    createElement(NodeToggleRow, {
      label: "Locked",
      checked: Boolean(node.locked),
      onChange: () =>
        onNodeCommit((draft) => {
          draft.locked = !draft.locked;
        })
    }),
    createElement(NodeToggleRow, {
      label: "Auto Height",
      checked: metadata.autoHeight === true,
      onChange: () =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "autoHeight", getInspectorMetadata(draft).autoHeight !== true);
        })
    }),
    createElement(
      "div",
      { style: nodeInlineControlRowStyle },
      createElement("span", { style: nodeToggleRowLabelStyle }, "Max Lines"),
      createElement(NodeStepperField, {
        value: maxLines,
        min: 0,
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "maxLines", Math.max(0, Math.round(value))))
      })
    ),
    createElement(NodeToggleRow, {
      label: "Trim Whitespace",
      checked: metadata.trimWhitespace === true,
      onChange: () =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "trimWhitespace", getInspectorMetadata(draft).trimWhitespace !== true);
        })
    })
  );
}

function ensureOption(options: Array<{ value: string; label: string }>, value: string): Array<{ value: string; label: string }> {
  if (!value || options.some((option) => option.value === value)) return options.length ? options : [{ value, label: value || "field" }];
  return [{ value, label: value }, ...options];
}

function TextAccessibilitySection({ item, onNodeCommit }: { item: EditorNodeItem; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const node = item.node;
  const metadata = getInspectorMetadata(node);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-accessibility", title: "Accessibility / Metadata" },
    createElement(NodeRow, { label: "Node ID", labelWidth: 128 }, createElement(NodeReadonlyField, { value: item.id, mono: true })),
    createElement(
      NodeRow,
      { label: "Layer Name", labelWidth: 128 },
      createElement(NodeInlineInput, {
        value: node.name ?? inspectorTitleForItem(item),
        onCommit: (value) =>
          onNodeCommit((draft) => {
            draft.name = value;
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Metadata Namespace", labelWidth: 128 },
      createElement(NodeInlineInput, {
        value: String(metadata.namespace ?? "text.nodes"),
        mono: true,
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "namespace", value))
      })
    )
  );
}

function TextDiagnosticsSection({ template, data, node }: { template: DocumentTemplate; data?: Record<string, unknown>; node: TextNode }): ReactElement {
  const bindingPath = firstTextBinding(node);
  const bound = Boolean(bindingPath);
  const sample = sampleValueForPath(template, data, bindingPath);
  const overflowRisk = node.overflow === "clip" ? "Medium" : "Low";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-diagnostics", title: "Diagnostics" },
    createElement(NodeDiagnosticRow, { label: "Binding status", value: bound ? "Valid" : "Unbound", dot: bound ? "#22c55e" : "#94a3b8" }),
    createElement(NodeDiagnosticRow, { label: "Renderer warnings", value: bound && sample === undefined ? "1" : "0" }),
    createElement(NodeDiagnosticRow, { label: "Overflow risk", value: overflowRisk, dot: overflowRisk === "Low" ? "#22c55e" : "#f59e0b" })
  );
}

function TextActionsSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "text-actions", title: "Actions", collapsible: false },
    createElement(
      "button",
      {
        type: "button",
        className: UI_BUTTON_CLASS,
        style: nodeDangerButtonStyle,
        onClick: () =>
          onNodeCommit((draft) => {
            if (draft.type !== "text") return;
            const fallback = firstTextFallback(draft);
            draft.content = [{ kind: "text", text: fallback }];
          })
      },
      createElement(ToolIcon, { icon: Delete02Icon, size: 14 }),
      createElement("span", null, "Clear Binding")
    ),
    createElement(
      "button",
      {
        type: "button",
        className: UI_BUTTON_CLASS,
        style: nodeAccentButtonStyle,
        onClick: () =>
          onNodeCommit((draft) => {
            if (draft.type !== "text") return;
            draft.style = { ...draft.style, fontWeight: 400, lineHeight: undefined, letterSpacing: 0, align: "left", color: "#111827" };
            draft.overflow = "wrap";
          })
      },
      createElement(ToolIcon, { icon: RefreshIcon, size: 14 }),
      createElement("span", null, "Reset Text Settings")
    )
  );
}

function parseTextContent(value: string): TextNode["content"] {
  return parseInlineContent(value);
}

function fontFamilyOptions(current: string): Array<{ value: string; label: string }> {
  const families = ["Inter", "Geist", "Roboto", "Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New"];
  if (current && !families.includes(current)) families.unshift(current);
  return families.map((family) => ({ value: family, label: family }));
}

function fontWeightOptions(current: string): Array<{ value: string; label: string }> {
  const weights: Array<{ value: string; label: string }> = [
    { value: "300", label: "300 Light" },
    { value: "400", label: "400 Regular" },
    { value: "500", label: "500 Medium" },
    { value: "600", label: "600 Semibold" },
    { value: "700", label: "700 Bold" }
  ];
  if (current && !weights.some((weight) => weight.value === current)) weights.unshift({ value: current, label: current });
  return weights;
}

function buildTextSamplePreview(template: DocumentTemplate, data: Record<string, unknown> | undefined, node: TextNode): string {
  const scope = bindingScopeForNode(template, node);
  if (scope && scope !== "document") {
    const value = sampleValueForRawPath(data, scope);
    if (value !== undefined) return JSON.stringify({ [scope]: value }, null, 2);
  }

  const bindingPath = firstTextBinding(node);
  const sample = sampleValueForPath(template, data, bindingPath);
  return JSON.stringify({ [bindingPath || "value"]: sample ?? "Sample value" }, null, 2);
}

function NodeRow({ label, labelWidth = 88, children }: { label: string; labelWidth?: number; children?: ReactNode }): ReactElement {
  return createElement(
    "div",
    { style: nodeRowStyle },
    createElement("span", { style: { ...nodeRowLabelStyle, width: labelWidth } }, label),
    createElement("div", { style: nodeRowControlStyle }, children)
  );
}

function NodePairRow({ children }: { children?: ReactNode }): ReactElement {
  return createElement("div", { style: nodePairRowStyle }, children);
}

function NodeInlineInput({
  value,
  onCommit,
  mono,
  suffix,
  placeholder
}: {
  value: string;
  onCommit: (value: string) => void;
  mono?: boolean;
  suffix?: string;
  placeholder?: string;
}): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: nodeInputShellStyle },
    createElement("input", {
      value: draft,
      placeholder,
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      },
      style: { ...nodeInputFieldStyle, fontFamily: mono ? UI_MONO_FONT_FAMILY : UI_FONT_FAMILY }
    }),
    suffix ? createElement("span", { style: nodeInputSuffixStyle }, suffix) : null
  );
}

function NodeNumberInput({ value, onCommit, suffix }: { value: number; onCommit: (value: number) => void; suffix?: string }): ReactElement {
  const [draft, setDraft] = useState(String(roundDisplayNumber(value)));

  useEffect(() => setDraft(String(roundDisplayNumber(value))), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    else setDraft(String(roundDisplayNumber(value)));
  };

  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: nodeInputShellStyle },
    createElement("input", {
      value: draft,
      inputMode: "decimal",
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(roundDisplayNumber(value)));
          event.currentTarget.blur();
        }
      },
      style: { ...nodeInputFieldStyle, fontFamily: UI_MONO_FONT_FAMILY }
    }),
    suffix ? createElement("span", { style: nodeInputSuffixStyle }, suffix) : null
  );
}

function NodeMetricField({ label, value, suffix, onCommit }: { label: string; value: number; suffix?: string; onCommit: (value: number) => void }): ReactElement {
  return createElement(
    "div",
    { style: nodeMetricFieldStyle },
    createElement("span", { style: nodeMetricLabelStyle }, label),
    createElement(NodeNumberInput, { value, suffix, onCommit })
  );
}

function NodeReadonlyField({ value, mono }: { value: string; mono?: boolean }): ReactElement {
  return createElement("div", { style: { ...nodeReadonlyFieldStyle, fontFamily: mono ? UI_MONO_FONT_FAMILY : UI_FONT_FAMILY } }, value);
}

function NodeInlineSelect({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(Select, { value, options, onChange, variant: "inline" });
}

function NodeSegmented({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "div",
    { style: nodeSegmentedStyle },
    options.map((option, index) => {
      const active = option.value === value;
      return createElement(
        "button",
        {
          key: option.value,
          type: "button",
          className: active ? `${UI_SEGMENT_CLASS} is-active` : UI_SEGMENT_CLASS,
          onClick: () => onChange(option.value),
          style: {
            ...nodeSegmentedButtonStyle,
            marginLeft: index > 0 ? -1 : 0,
            borderTopLeftRadius: index === 0 ? UI_CHROME_RADIUS : 0,
            borderBottomLeftRadius: index === 0 ? UI_CHROME_RADIUS : 0,
            borderTopRightRadius: index === options.length - 1 ? UI_CHROME_RADIUS : 0,
            borderBottomRightRadius: index === options.length - 1 ? UI_CHROME_RADIUS : 0
          }
        },
        option.label
      );
    })
  );
}

function NodeToggle({ checked, onChange }: { checked: boolean; onChange: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", role: "switch", "aria-checked": checked, onClick: onChange, className: UI_TOGGLE_CLASS, style: nodeBareToggleStyle },
    createElement("span", { style: { ...toggleTrackStyle, background: checked ? UI_ACCENT : "#cbd5e1" } }, createElement("span", { style: { ...toggleThumbStyle, transform: checked ? "translateX(14px)" : "translateX(0)" } }))
  );
}

function NodeToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }): ReactElement {
  return createElement(
    "div",
    { style: nodeToggleRowStyle },
    createElement("span", { style: nodeToggleRowLabelStyle }, label),
    createElement(NodeToggle, { checked, onChange })
  );
}

function NodeColorField({
  value,
  onCommit,
  emptyLabel,
  onClear
}: {
  value: string;
  onCommit: (value: string) => void;
  emptyLabel?: string;
  onClear?: () => void;
}): ReactElement {
  const hasValue = Boolean(value);

  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: nodeColorFieldStyle },
    createElement(
      "span",
      { style: nodeColorSwatchWrapStyle },
      createElement("span", { style: hasValue ? { ...nodeColorSwatchStyle, background: value } : nodeColorSwatchTransparentStyle }),
      createElement("input", {
        type: "color",
        value: normalizeHexColor(hasValue ? value : "#ffffff"),
        onChange: (event) => onCommit((event.currentTarget as HTMLInputElement).value.toUpperCase()),
        style: nodeColorInputOverlayStyle
      })
    ),
    createElement("span", { style: nodeColorTextStyle }, hasValue ? value.toUpperCase() : emptyLabel ?? "None"),
    hasValue && onClear
      ? createElement("button", { type: "button", title: "Clear color", onClick: onClear, style: nodeColorClearStyle }, createElement(ToolIcon, { icon: Cancel01Icon, size: 12 }))
      : null
  );
}

function NodeStepperField({ value, onCommit, min = 0 }: { value: number; onCommit: (value: number) => void; min?: number }): ReactElement {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== value) onCommit(Math.max(min, parsed));
    else setDraft(String(value));
  };

  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: nodeStepperShellStyle },
    createElement("input", {
      value: draft,
      inputMode: "numeric",
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, "")),
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
      },
      style: nodeStepperInputStyle
    }),
    createElement(
      "span",
      { style: nodeStepperButtonsStyle },
      createElement("button", { type: "button", "aria-label": "Increase", onClick: () => onCommit(Math.max(min, value + 1)), style: nodeStepperButtonStyle }, "+"),
      createElement("button", { type: "button", "aria-label": "Decrease", onClick: () => onCommit(Math.max(min, value - 1)), style: nodeStepperButtonStyle }, "−")
    )
  );
}

function NodeIconButton({ icon, title, onClick }: { icon: IconSvgElement; title: string; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", title, onClick, className: UI_BUTTON_CLASS, style: nodeAdjacentIconButtonStyle },
    createElement(ToolIcon, { icon, size: 14 })
  );
}

function NodeGhostIconButton({ icon, title, onClick }: { icon: IconSvgElement; title: string; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", title, onClick, className: UI_BUTTON_CLASS, style: nodeGhostIconButtonStyle },
    createElement(ToolIcon, { icon, size: 14 })
  );
}

function NodeSearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }): ReactElement {
  return createElement(
    "div",
    { className: UI_CHROME_CLASS, style: nodeSearchWrapStyle },
    createElement(ToolIcon, { icon: Search01Icon, size: 13 }),
    createElement("input", {
      type: "search",
      value,
      placeholder,
      onChange: (event) => onChange((event.currentTarget as HTMLInputElement).value),
      style: nodeSearchInputStyle
    })
  );
}

function NodeExplorerRow({
  field,
  disabled,
  collapsed,
  onToggleCollapsed,
  onCopy,
  onBind
}: {
  field: DataExplorerField;
  disabled?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onCopy: () => void;
  onBind: () => void;
}): ReactElement {
  return createElement(
    "div",
    { style: { ...nodeExplorerRowStyle, paddingLeft: 4 + field.depth * 8, opacity: disabled ? 0.55 : 1 } },
    field.hasChildren
      ? createElement(
          "button",
          {
            type: "button",
            title: collapsed ? `Expand ${field.path}` : `Collapse ${field.path}`,
            onClick: onToggleCollapsed,
            style: nodeExplorerTreeToggleStyle
          },
          createElement(
            "span",
            {
              style: {
                display: "grid",
                placeItems: "center",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease"
              }
            },
            createElement(ToolIcon, { icon: ChevronDownIcon, size: 12 })
          )
        )
      : createElement("span", { style: nodeExplorerTreeSpacerStyle }),
    createElement("span", { style: nodeExplorerIconStyle }, createElement(ToolIcon, { icon: ThirdBracketIcon, size: 12 })),
    createElement("span", { style: nodeExplorerPathStyle }, field.path),
    createElement("span", { style: nodeExplorerTypeStyle }, field.kind),
    createElement("button", { type: "button", title: `Copy ${field.path}`, onClick: onCopy, style: nodeExplorerActionStyle }, createElement(ToolIcon, { icon: Copy01Icon, size: 13 })),
    createElement(
      "button",
      {
        type: "button",
        title: disabled ? `Cannot bind ${field.kind} here` : `Bind to ${field.path}`,
        disabled,
        onClick: onBind,
        style: {
          ...nodeExplorerActionStyle,
          cursor: disabled ? "not-allowed" : "pointer"
        }
      },
      createElement(ToolIcon, { icon: ArrowRight01Icon, size: 13 })
    )
  );
}

function NodeDiagnosticRow({ label, value, dot }: { label: string; value: string; dot?: string }): ReactElement {
  return createElement(
    "div",
    { style: nodeDiagnosticRowStyle },
    createElement("span", { style: nodeToggleRowLabelStyle }, label),
    createElement(
      "span",
      { style: nodeDiagnosticValueStyle },
      dot ? createElement("span", { style: { ...nodeDiagnosticDotStyle, background: dot } }) : null,
      value
    )
  );
}

function NodeSamplePreview({ json }: { json: string }): ReactElement {
  const lines = json.split("\n");

  return createElement(
    "div",
    { style: nodeSamplePreviewShellStyle },
    createElement(
      "button",
      { type: "button", title: "Copy sample JSON", style: nodeSamplePreviewCopyStyle, onClick: () => void navigator.clipboard?.writeText(json) },
      createElement(ToolIcon, { icon: Copy01Icon, size: 12 })
    ),
    createElement(
      "div",
      { style: nodeSamplePreviewScrollStyle },
      lines.map((line, index) =>
        createElement(
          "div",
          { key: `${index}-${line}`, style: nodeSamplePreviewLineStyle },
          createElement("span", { style: nodeSamplePreviewGutterStyle }, String(index + 1)),
          createElement("code", { style: nodeSamplePreviewCodeStyle }, renderDarkJsonLine(line))
        )
      )
    )
  );
}

function renderDarkJsonLine(line: string): ReactNode {
  if (!line.trim()) return line;

  const keyMatch = line.match(/^(\s*)"([^"]+)("\s*:\s*)(.*)$/);
  if (keyMatch) {
    return createElement(
      Fragment,
      null,
      keyMatch[1],
      '"',
      createElement("span", { style: darkJsonKeyStyle }, keyMatch[2]),
      '"',
      keyMatch[3],
      renderDarkJsonValue(keyMatch[4])
    );
  }

  return renderDarkJsonValue(line);
}

function renderDarkJsonValue(value: string): ReactNode {
  const trimmed = value.trim();
  if (/^".*"[,]?$/.test(trimmed)) return createElement("span", { style: darkJsonStringStyle }, trimmed);
  if (/^-?\d+(\.\d+)?[,]?$/.test(trimmed)) return createElement("span", { style: darkJsonNumberStyle }, trimmed);
  return value;
}

function NodeSlider({ value, onChange, max = 100 }: { value: number; onChange: (value: number) => void; max?: number }): ReactElement {
  return createElement("input", {
    type: "range",
    min: 0,
    max,
    value: Math.max(0, Math.min(max, value)),
    onChange: (event) => onChange(Number((event.currentTarget as HTMLInputElement).value)),
    style: nodeSliderStyle
  });
}

function NodeAnchorGrid({ value, onChange }: { value: number; onChange: (value: number) => void }): ReactElement {
  return createElement(
    "div",
    { style: nodeAnchorGridStyle },
    Array.from({ length: 9 }).map((_, index) =>
      createElement("button", {
        key: index,
        type: "button",
        "aria-label": `Anchor ${index + 1}`,
        onClick: () => onChange(index),
        style: {
          ...nodeAnchorDotStyle,
          background: index === value ? "#5B5BD6" : "#ffffff",
          borderColor: index === value ? "#5B5BD6" : "#cbd5e1"
        }
      })
    )
  );
}

function NodeOutlineButton({ icon, label, active, onClick }: { icon: IconSvgElement; label: string; active?: boolean; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    {
      type: "button",
      onClick,
      className: UI_BUTTON_CLASS,
      style: {
        ...nodeOutlineButtonStyle,
        borderColor: active ? UI_ACCENT : UI_REST_BORDER,
        background: active ? UI_ACCENT_SOFT : UI_CARD_SURFACE,
        color: active ? UI_ACCENT : UI_TEXT_LABEL
      }
    },
    createElement(ToolIcon, { icon, size: 13 }),
    createElement("span", null, label)
  );
}

function NodeSourceCard({ name, meta, onReplace }: { name: string; meta: string; onReplace: () => void }): ReactElement {
  return createElement(
    "div",
    { style: nodeSourceCardStyle },
    createElement("span", { style: nodeSourceThumbStyle }, createElement(ToolIcon, { icon: Image01Icon, size: 20 })),
    createElement(
      "div",
      { style: nodeSourceInfoStyle },
      createElement("span", { style: nodeSourceNameStyle }, name),
      createElement("span", { style: nodeSourceMetaStyle }, meta),
      createElement(
        "button",
        { type: "button", className: UI_BUTTON_CLASS, style: nodeSourceReplaceStyle, onClick: onReplace },
        createElement(ToolIcon, { icon: RefreshIcon, size: 13 }),
        createElement("span", null, "Replace")
      )
    )
  );
}

function ImageSizePositionSection({
  node,
  frame,
  onFrameCommit,
  onNodeCommit
}: {
  node: ImageNode;
  frame: Frame;
  onFrameCommit: (framePatch: Partial<Frame>) => void;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const metadata = getInspectorMetadata(node);
  const lockAspect = metadata.lockAspect === true;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-size-position", title: "Size & Position", collapsible: false },
    createElement(
      NodePairRow,
      null,
      createElement(NodeRow, { label: "X", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.x, suffix: "px", onCommit: (value) => onFrameCommit({ x: value }) })),
      createElement(NodeRow, { label: "Y", labelWidth: 14 }, createElement(NodeNumberInput, { value: frame.y, suffix: "px", onCommit: (value) => onFrameCommit({ y: value }) }))
    ),
    createElement(
      NodePairRow,
      null,
      createElement(
        NodeRow,
        { label: "W", labelWidth: 14 },
        createElement(NodeNumberInput, {
          value: frame.width,
          suffix: "px",
          onCommit: (value) => {
            const width = Math.max(1, value);
            if (lockAspect && frame.width > 0) onFrameCommit({ width, height: Math.max(1, Math.round((width / frame.width) * frame.height)) });
            else onFrameCommit({ width });
          }
        })
      ),
      createElement(
        NodeRow,
        { label: "H", labelWidth: 14 },
        createElement(NodeNumberInput, {
          value: frame.height,
          suffix: "px",
          onCommit: (value) => {
            const height = Math.max(1, value);
            if (lockAspect && frame.height > 0) onFrameCommit({ height, width: Math.max(1, Math.round((height / frame.height) * frame.width)) });
            else onFrameCommit({ height });
          }
        })
      )
    ),
    createElement(
      NodePairRow,
      null,
      createElement(
        NodeRow,
        { label: "Rotation", labelWidth: 52 },
        createElement(NodeInlineSelect, {
          value: String(node.rotation ?? 0),
          options: [0, 90, 180, 270].map((value) => ({ value: String(value), label: `${value}°` })),
          onChange: (value) =>
            onNodeCommit((draft) => {
              draft.rotation = Number(value) || 0;
            })
        })
      ),
      createElement(NodeOutlineButton, {
        icon: LockIcon,
        label: "Lock aspect ratio",
        active: lockAspect,
        onClick: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, "lockAspect", getInspectorMetadata(draft).lockAspect !== true))
      })
    )
  );
}

function ImageAlignmentSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const horizontal = typeof metadata.horizontalAlign === "string" ? metadata.horizontalAlign : "center";
  const vertical = typeof metadata.verticalAlign === "string" ? metadata.verticalAlign : "middle";
  const anchor = typeof metadata.anchor === "number" ? metadata.anchor : 4;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-alignment", title: "Alignment" },
    createElement(
      "div",
      { style: imageAlignmentRowStyle },
      createElement(
        "div",
        { style: imageAlignmentControlsStyle },
        createElement(
          NodeRow,
          { label: "Horizontal", labelWidth: 62 },
          createElement(NodeSegmented, {
            value: horizontal,
            options: [
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" }
            ],
            onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "horizontalAlign", value))
          })
        ),
        createElement(
          NodeRow,
          { label: "Vertical", labelWidth: 62 },
          createElement(NodeSegmented, {
            value: vertical,
            options: [
              { value: "top", label: "Top" },
              { value: "middle", label: "Middle" },
              { value: "bottom", label: "Bottom" }
            ],
            onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "verticalAlign", value))
          })
        )
      ),
      createElement(
        "div",
        { style: imageAnchorColumnStyle },
        createElement("span", { style: imageAnchorLabelStyle }, "Anchor"),
        createElement(NodeAnchorGrid, {
          value: anchor,
          onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "anchor", value))
        })
      )
    )
  );
}

function ImageAppearanceSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: NodeCommitHandler }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const opacity = Math.round((node.opacity ?? 1) * 100);
  const cornerRadius = Number(metadata.cornerRadius ?? 0);
  const borderEnabled = metadata.borderEnabled === true;
  const borderWidth = Number(metadata.borderWidth ?? 1);
  const borderColor = typeof metadata.borderColor === "string" ? metadata.borderColor : "#E5E7EB";
  const borderStyle = typeof metadata.borderStyle === "string" ? metadata.borderStyle : "solid";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-appearance", title: "Appearance" },
    createElement(
      NodeRow,
      { label: "Opacity", labelWidth: 88 },
      createElement(NodeSlider, {
        value: opacity,
        max: 100,
        onChange: (value) =>
          onNodeCommit(
            (draft) => (draft.opacity = Math.max(0, Math.min(100, value)) / 100),
            { transaction: `node:${node.id}:opacity` }
          )
      }),
      createElement(NodeNumberInput, {
        value: opacity,
        suffix: "%",
        onCommit: (value) => onNodeCommit((draft) => (draft.opacity = Math.max(0, Math.min(100, value)) / 100))
      })
    ),
    createElement(
      NodeRow,
      { label: "Corner Radius (editor-only)", labelWidth: 88 },
      createElement(NodeNumberInput, {
        value: cornerRadius,
        suffix: "px",
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "cornerRadius", Math.max(0, value)))
      })
    ),
    createElement(
      "div",
      { style: nodeInlineControlRowStyle },
      createElement("span", { style: nodeToggleRowLabelStyle }, "Border (editor-only)"),
      createElement(NodeToggle, {
        checked: borderEnabled,
        onChange: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, "borderEnabled", getInspectorMetadata(draft).borderEnabled !== true))
      })
    ),
    borderEnabled
      ? createElement(
          Fragment,
          null,
          createElement(
            NodePairRow,
            null,
            createElement(
              NodeRow,
              { label: "Width", labelWidth: 42 },
              createElement(NodeNumberInput, {
                value: borderWidth,
                suffix: "px",
                onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "borderWidth", Math.max(0, value)))
              })
            ),
            createElement(
              NodeRow,
              { label: "Style", labelWidth: 42 },
              createElement(NodeInlineSelect, {
                value: borderStyle,
                options: ["solid", "dashed", "dotted"].map((value) => ({ value, label: titleCase(value) })),
                onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "borderStyle", value))
              })
            )
          ),
          createElement(
            NodeRow,
            { label: "Color", labelWidth: 42 },
            createElement(NodeColorField, {
              value: borderColor,
              onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "borderColor", value))
            })
          )
        )
      : null,
    createElement("span", { style: nodeHintStyle }, "Corner radius and border are editor-only metadata until renderer support lands.")
  );
}

function ImageLayerSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const zIndex = Number(metadata.zIndex ?? 0);
  const blendMode = typeof metadata.blendMode === "string" ? metadata.blendMode : "normal";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-layer", title: "Layer" },
    createElement(
      "div",
      { style: nodeInlineControlRowStyle },
      createElement("span", { style: nodeToggleRowLabelStyle }, "z-index"),
      createElement(NodeStepperField, { value: zIndex, min: 0, onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "zIndex", Math.max(0, Math.round(value)))) })
    ),
    createElement(
      NodeRow,
      { label: "Blend Mode", labelWidth: 88 },
      createElement(NodeInlineSelect, {
        value: blendMode,
        options: ["normal", "multiply", "screen", "overlay", "darken", "lighten"].map((value) => ({ value, label: titleCase(value) })),
        onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "blendMode", value))
      })
    )
  );
}

function ImageSourceSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const isBinding = node.source.kind === "binding";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-source", title: "Image Source", collapsible: false },
    createElement(NodeSegmented, {
      value: isBinding ? "binding" : "static",
      options: [
        { value: "static", label: "Static Image" },
        { value: "binding", label: "Data Binding" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type !== "image") return;
          if (value === "binding") draft.source = { kind: "binding", binding: { path: imageBindingPath(draft) || "content.image" } };
          else draft.source = { kind: "url", url: draft.source.kind === "url" ? draft.source.url : "" };
        })
    }),
    isBinding
      ? createElement(
          NodeRow,
          { label: "Binding Path", labelWidth: 88 },
          createElement(NodeInlineInput, {
            value: imageBindingPath(node),
            mono: true,
            placeholder: "content.image",
            onCommit: (value) =>
              onNodeCommit((draft) => {
                if (draft.type === "image") draft.source = { kind: "binding", binding: { path: value } };
              })
          })
        )
      : createElement(
          NodeRow,
          { label: "Image URL", labelWidth: 88 },
          createElement(NodeInlineInput, {
            value: node.source.kind === "url" ? node.source.url : "",
            mono: true,
            placeholder: "https://…",
            onCommit: (value) =>
              onNodeCommit((draft) => {
                if (draft.type === "image") draft.source = { kind: "url", url: value };
              })
          })
        ),
    createElement(NodeSourceCard, {
      name: imageSourceName(node),
      meta: imageSourceMeta(node),
      onReplace: () => onNodeCommit((draft) => (draft.type === "image" ? (draft.source = { kind: "url", url: "" }) : undefined))
    })
  );
}

function ImageDisplaySection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const repeat = typeof metadata.repeat === "string" ? metadata.repeat : "no-repeat";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-display", title: "Display", collapsible: false },
    createElement(
      NodeRow,
      { label: "Fit Mode", labelWidth: 78 },
      createElement(NodeInlineSelect, {
        value: node.fit ?? "contain",
        options: ["contain", "cover", "fill", "none"].map((value) => ({ value, label: titleCase(value) })),
        onChange: (value) =>
          onNodeCommit((draft) => {
            if (draft.type === "image") draft.fit = value as ImageNode["fit"];
          })
      })
    ),
    createElement(
      NodeRow,
      { label: "Repeat (editor-only)", labelWidth: 120 },
      createElement(NodeInlineSelect, {
        value: repeat,
        options: [
          { value: "no-repeat", label: "No Repeat" },
          { value: "repeat", label: "Repeat" },
          { value: "repeat-x", label: "Repeat X" },
          { value: "repeat-y", label: "Repeat Y" }
        ],
        onChange: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "repeat", value))
      })
    ),
    createElement("span", { style: nodeHintStyle }, "Repeat is stored as an editor-only preference until renderer support lands.")
  );
}

function ImageAltTextSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-alt", title: "Alt Text", collapsible: false },
    createElement(NodeInlineInput, {
      value: node.alt ?? "",
      placeholder: "Describe this image…",
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "image") draft.alt = value;
        })
    }),
    createElement("span", { style: nodeHintStyle }, "Describe the image for accessibility and screen readers.")
  );
}

function ImageBindingSection({
  template,
  data,
  node
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  node: ImageNode;
}): ReactElement {
  const bindingPath = imageBindingPath(node);
  const scope = bindingScopeForNode(template, node);
  const sampleValue = formatSampleValue(sampleValueForPath(template, data, bindingPath));

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-binding", title: "Binding Details", detail: "read-only" },
    createElement(NodeRow, { label: "Scope", labelWidth: 92 }, createElement(NodeReadonlyField, { value: scope, mono: true })),
    createElement(NodeRow, { label: "Sample Value", labelWidth: 92 }, createElement(NodeReadonlyField, { value: sampleValue }))
  );
}

function ImageLoadingSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const lazyLoad = metadata.lazyLoad !== false;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-loading", title: "Loading Behavior", detail: "editor-only", collapsible: false },
    createElement(NodeToggleRow, {
      label: "Lazy Load",
      checked: lazyLoad,
      onChange: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, "lazyLoad", getInspectorMetadata(draft).lazyLoad === false))
    }),
    createElement("span", { style: nodeHintStyle }, "Editor-only preference; preview/export rendering is unchanged.")
  );
}

function ImageVisibilitySection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-visibility", title: "Visibility", collapsible: false },
    createElement(NodeToggleRow, {
      label: "Visible",
      checked: node.visible !== false,
      onChange: () =>
        onNodeCommit((draft) => {
          draft.visible = draft.visible === false ? true : false;
        })
    }),
    createElement(NodeToggleRow, {
      label: "Locked",
      checked: Boolean(node.locked),
      onChange: () =>
        onNodeCommit((draft) => {
          draft.locked = !draft.locked;
        })
    })
  );
}

function ImageEffectsSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const effects: Array<{ key: string; label: string }> = [
    { key: "shadow", label: "Shadow" },
    { key: "innerShadow", label: "Inner Shadow" },
    { key: "blur", label: "Blur" }
  ];

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-effects", title: "Effects", detail: "editor-only" },
    ...effects.map((effect) =>
      createElement(
        "div",
        { key: effect.key, style: nodeToggleRowStyle },
          createElement("span", { style: nodeToggleRowLabelStyle }, `${effect.label} (editor-only)`),
        createElement(NodeToggle, {
          checked: metadata[effect.key] === true,
          onChange: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, effect.key, getInspectorMetadata(draft)[effect.key] !== true))
        })
      )
    ),
    createElement("span", { style: nodeHintStyle }, "Effects are stored for editor intent and do not affect preview/export yet.")
  );
}

function ImageTransformSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: NodeCommitHandler }): ReactElement {
  const metadata = getInspectorMetadata(node);
  const scaleX = Number(metadata.scaleX ?? 100);
  const scaleY = Number(metadata.scaleY ?? 100);
  const flipH = metadata.flipHorizontal === true;
  const flipV = metadata.flipVertical === true;

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-transform", title: "Transform", detail: "editor-only" },
    createElement(
      NodeRow,
      { label: "Scale X (editor-only)", labelWidth: 128 },
      createElement(NodeSlider, {
        value: scaleX,
        max: 200,
        onChange: (value) =>
          onNodeCommit(
            (draft) => setInspectorMetadataValue(draft, "scaleX", value),
            { transaction: `node:${node.id}:scale-x` }
          )
      }),
      createElement(NodeNumberInput, { value: scaleX, suffix: "%", onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "scaleX", Math.max(0, value))) })
    ),
    createElement(
      NodeRow,
      { label: "Scale Y (editor-only)", labelWidth: 128 },
      createElement(NodeSlider, {
        value: scaleY,
        max: 200,
        onChange: (value) =>
          onNodeCommit(
            (draft) => setInspectorMetadataValue(draft, "scaleY", value),
            { transaction: `node:${node.id}:scale-y` }
          )
      }),
      createElement(NodeNumberInput, { value: scaleY, suffix: "%", onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "scaleY", Math.max(0, value))) })
    ),
    createElement(
      NodePairRow,
      null,
      createElement(NodeOutlineButton, {
        icon: RefreshIcon,
        label: "Flip Horizontal",
        active: flipH,
        onClick: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, "flipHorizontal", getInspectorMetadata(draft).flipHorizontal !== true))
      }),
      createElement(NodeOutlineButton, {
        icon: RefreshIcon,
        label: "Flip Vertical",
        active: flipV,
        onClick: () => onNodeCommit((draft) => setInspectorMetadataValue(draft, "flipVertical", getInspectorMetadata(draft).flipVertical !== true))
      })
    ),
    createElement("span", { style: nodeHintStyle }, "Transform values are editor-only metadata until renderer support lands.")
  );
}

function ImageDeveloperSection({
  item,
  node,
  onNodeCommit
}: {
  item: EditorNodeItem;
  node: ImageNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const metadata = getInspectorMetadata(node);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-developer", title: "Developer" },
    createElement(NodeRow, { label: "Node ID", labelWidth: 100 }, createElement(NodeReadonlyField, { value: item.id, mono: true })),
    createElement(
      NodeRow,
      { label: "CSS Class", labelWidth: 100 },
      createElement(NodeInlineInput, {
        value: String(metadata.cssClass ?? ""),
        mono: true,
        placeholder: "image-node",
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "cssClass", value))
      })
    ),
    createElement(
      NodeRow,
      { label: "Custom ID", labelWidth: 100 },
      createElement(NodeInlineInput, {
        value: String(metadata.customId ?? ""),
        mono: true,
        placeholder: "img-hero",
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "customId", value))
      })
    ),
    createElement(
      NodeRow,
      { label: "Namespace", labelWidth: 100 },
      createElement(NodeInlineInput, {
        value: String(metadata.namespace ?? "image.nodes"),
        mono: true,
        onCommit: (value) => onNodeCommit((draft) => setInspectorMetadataValue(draft, "namespace", value))
      })
    )
  );
}

function ImageDiagnosticsSection({ template, data, node }: { template: DocumentTemplate; data?: Record<string, unknown>; node: ImageNode }): ReactElement {
  const bindingPath = imageBindingPath(node);
  const hasSource = node.source.kind === "binding" ? Boolean(bindingPath) : Boolean(imageSourceLabel(node));
  const bound = node.source.kind === "binding";
  const sample = bound ? sampleValueForPath(template, data, bindingPath) : undefined;
  const loadStatus = bound ? (sample === undefined ? "Unresolved" : "Loaded") : hasSource ? "Loaded" : "Missing";
  const warnings = node.alt ? "None" : "Missing alt text";

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-diagnostics", title: "Diagnostics" },
    createElement(NodeDiagnosticRow, { label: "Source Status", value: hasSource ? "OK" : "No source", dot: hasSource ? "#22c55e" : "#ef4444" }),
    createElement(NodeDiagnosticRow, { label: "Load Status", value: loadStatus, dot: loadStatus === "Loaded" ? "#22c55e" : loadStatus === "Missing" ? "#ef4444" : "#f59e0b" }),
    createElement(NodeDiagnosticRow, { label: "Render Warnings", value: warnings, dot: warnings === "None" ? "#22c55e" : "#f59e0b" })
  );
}

function ImageActionsSection({ node, onNodeCommit }: { node: ImageNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "image-actions", title: "Actions", collapsible: false },
    createElement(
      "button",
      {
        type: "button",
        className: UI_BUTTON_CLASS,
        style: nodeDangerButtonStyle,
        onClick: () =>
          onNodeCommit((draft) => {
            if (draft.type === "image") draft.source = { kind: "url", url: "" };
          })
      },
      createElement(ToolIcon, { icon: Delete02Icon, size: 14 }),
      createElement("span", null, "Remove Image")
    ),
    createElement(
      "button",
      {
        type: "button",
        className: UI_BUTTON_CLASS,
        style: nodeAccentButtonStyle,
        onClick: () =>
          onNodeCommit((draft) => {
            if (draft.type !== "image") return;
            draft.fit = "contain";
            draft.rotation = 0;
            draft.opacity = 1;
            const metadata = getInspectorMetadata(draft);
            const cleared = { ...metadata };
            for (const key of ["lockAspect", "cornerRadius", "borderEnabled", "borderWidth", "borderColor", "borderStyle", "zIndex", "blendMode", "scaleX", "scaleY", "flipHorizontal", "flipVertical", "shadow", "innerShadow", "blur", "displayAlignment", "repeat"]) {
              delete cleared[key];
            }
            draft.metadata = { ...draft.metadata, inspector: cleared };
          })
      },
      createElement(ToolIcon, { icon: RefreshIcon, size: 14 }),
      createElement("span", null, "Reset Image Settings")
    )
  );
}

function imageSourceName(node: ImageNode): string {
  if (node.source.kind === "binding") return node.source.binding.path;
  if (node.source.kind === "asset") return node.source.assetId;
  const url = node.source.url;
  if (!url) return "No image selected";
  const withoutQuery = url.split("?")[0];
  return withoutQuery.split("/").filter(Boolean).at(-1) || url;
}

function imageSourceMeta(node: ImageNode): string {
  if (node.source.kind === "binding") return "Resolved from bound data";
  if (node.source.kind === "asset") return "Workspace asset";
  return node.source.url ? "External URL" : "Choose a file or bind to data";
}

function CodeLayoutSection({
  node,
  onNodeCommit
}: {
  node: BarcodeNode | QrNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "code-layout", title: node.type === "qr" ? "QR Layout" : "Barcode Layout", detail: node.type === "barcode" ? node.format : "QR" },
    node.type === "barcode"
      ? createElement(TextControl, {
          label: "Symbology",
          value: node.format,
          onCommit: (value) =>
            onNodeCommit((draft) => {
              if (draft.type === "barcode") draft.format = value;
            })
        })
      : createElement(FieldRow, { label: "Symbology", value: "QR" }),
    createElement(DisabledControl, { label: "Human readable", value: "Engine support planned" })
  );
}

function CodeDataSection({
  template,
  data,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  node: BarcodeNode | QrNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const bindingPath = dynamicValueBindingPath(node.value);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "code-data", title: "Value", detail: bindingPath || "literal" },
    createElement(BindingControl, {
      label: "Value binding",
      value: bindingPath,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type === "barcode" || draft.type === "qr") draft.value = value ? { kind: "binding", binding: { path: value } } : { kind: "literal", value: "" };
        })
    }),
    createElement(FieldRow, { label: "Sample value", value: formatSampleValue(sampleValueForPath(template, data, bindingPath)) })
  );
}

function BindingExplorerSection({
  template,
  data,
  item,
  nodeItems,
  onNodeCommit,
  showCurrentBinding = true
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  onNodeCommit: (update: (node: EditableNode) => void) => void;
  showCurrentBinding?: boolean;
}): ReactElement {
  const node = item.node;
  const [search, setSearch] = useState("");
  const bindingPath = bindingPathForNode(node);
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const normalized = search.trim().toLowerCase();
  const visibleGroups = explorer.groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => `${field.label} ${field.path} ${field.displayPath ?? ""} ${field.kind}`.toLowerCase().includes(normalized))
    }))
    .filter((group) => group.fields.length > 0);
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.fields.length, 0);
  const sampleValue = formatDataSampleValue(sampleValueForBindingPath(data, bindingPath, explorer.selectedScope));
  const hint = bindingHintForNode(node);

  return createElement(
    InspectorSection,
    {
      targetId: `node:${node.id}`,
      sectionId: "binding-explorer",
      title: "Browse Fields",
      detail: explorer.selectedScope?.alias ?? "document"
    },
    showCurrentBinding ? createElement(FieldRow, { label: "Current binding", value: bindingPath || "none" }) : null,
    showCurrentBinding ? createElement(FieldRow, { label: "Sample value", value: sampleValue }) : null,
    hint ? createElement(EmptyText, null, hint) : null,
    createElement(NodeSearchInput, { value: search, onChange: setSearch, placeholder: "Search fields..." }),
    createElement(
      "div",
      { style: nodeFieldListStyle },
      visibleCount === 0
        ? createElement(EmptyText, null, explorer.allFields.length === 0 ? "No schema, sample, or variable fields are available yet." : "No fields match that search.")
        : visibleGroups.map((group) =>
            createElement(BindingExplorerGroupRows, {
              key: group.id,
              title: group.title,
              fields: group.fields,
              node,
              forceExpanded: Boolean(normalized),
              onBind: (field) => onNodeCommit((draft) => applyDataBindingToNode(draft, field.path))
            })
          )
    )
  );
}

function BindingExplorerGroupRows({
  title,
  fields,
  node,
  forceExpanded,
  onBind
}: {
  title: string;
  fields: DataExplorerField[];
  node: EditableNode;
  forceExpanded?: boolean;
  onBind: (field: DataExplorerField) => void;
}): ReactElement {
  const [collapsedFields, setCollapsedFields] = useState<Record<string, boolean>>({});
  const visibleFields = forceExpanded ? fields : visibleInspectorDataTreeFields(fields, collapsedFields);

  return createElement(
    "div",
    { style: bindingExplorerGroupStyle },
    createElement(SectionLabel, { title }),
    visibleFields.slice(0, 12).map((field) =>
      createElement(NodeExplorerRow, {
        key: field.id,
        field,
        disabled: !isFieldBindableForNode(field, node),
        collapsed: Boolean(collapsedFields[field.id]),
        onToggleCollapsed: field.hasChildren
          ? () =>
              setCollapsedFields((current) => ({
                ...current,
                [field.id]: !current[field.id]
              }))
          : undefined,
        onCopy: () => void navigator.clipboard?.writeText(field.path),
        onBind: () => onBind(field)
      })
    )
  );
}

function visibleInspectorDataTreeFields(fields: DataExplorerField[], collapsedFields: Record<string, boolean>): DataExplorerField[] {
  return fields.filter((field) => {
    let parentPath = field.parentPath;

    while (parentPath) {
      const parent = fields.find((candidate) => candidate.path === parentPath);

      if (!parent) {
        return true;
      }

      if (collapsedFields[parent.id]) {
        return false;
      }

      parentPath = parent.parentPath;
    }

    return true;
  });
}

function bindingHintForNode(node: EditableNode): string {
  if (node.type === "repeat" || node.type === "grid") return "Array data recommended.";
  if (node.type === "image") return "Image URL or asset path recommended.";
  if (node.type === "barcode" || node.type === "qr") return "Text or number recommended.";
  if (node.type === "text") return "Primitive fields create handlebars text bindings.";
  return "This node does not support direct data binding yet.";
}

function VisibilitySection({ node, onNodeCommit }: { node: EditableNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "visibility", title: "Visibility", detail: node.visible === false ? "hidden" : "visible" },
    createElement(RangeControl, {
      label: "Opacity",
      value: Math.round((node.opacity ?? 1) * 100),
      min: 0,
      max: 100,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          draft.opacity = Math.max(0, Math.min(100, value)) / 100;
        })
    }),
    createElement(ToggleSwitch, {
      label: "Visible",
      checked: node.visible !== false,
      onChange: () =>
        onNodeCommit((draft) => {
          draft.visible = draft.visible === false ? true : false;
        })
    }),
    createElement(ToggleSwitch, {
      label: "Locked",
      checked: Boolean(node.locked),
      onChange: () =>
        onNodeCommit((draft) => {
          draft.locked = !draft.locked;
        })
    })
  );
}

function AppearanceSection({ node, onNodeCommit }: { node: EditableNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const metadata = getInspectorMetadata(node);

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "appearance", title: "Appearance", detail: "editor" },
    createElement(RangeControl, {
      label: "Opacity",
      value: Math.round((node.opacity ?? 1) * 100),
      min: 0,
      max: 100,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          draft.opacity = Math.max(0, Math.min(100, value)) / 100;
        })
    }),
    createElement(NumberControl, {
      label: "Corner radius (editor-only)",
      value: Number(metadata.cornerRadius ?? 0),
      onCommit: (value) =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "cornerRadius", Math.max(0, value));
        })
    }),
    createElement(DisabledControl, { label: "Shadow", value: "Not rendered yet" })
  );
}

function RenderLogicSection({
  template,
  data,
  item,
  nodeItems,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const node = item.node;
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const currentExpression = visibleExpressionForNode(node);
  const enabled = node.type === "conditional" || Boolean(currentExpression);
  const expression = currentExpression ?? createDefaultVisibleExpression(template, explorer);
  const operator = expression.operator ?? "exists";
  const fieldOptions = ensureOption(logicFieldOptions(explorer), expression.source);
  const sampleValue = formatDataSampleValue(sampleValueForBindingPath(data, expression.source, explorer.selectedScope));
  const previewResult = logicPreviewResult(expression, data);
  const title = node.type === "conditional" ? "Condition" : "Visibility";

  return createElement(
    InspectorSection,
    {
      targetId: `node:${node.id}`,
      sectionId: "render-logic",
      title,
      detail: enabled ? expression.source : "off"
    },
    node.type !== "conditional"
      ? createElement(ToggleSwitch, {
          label: "Visible If",
          checked: enabled,
          onChange: () =>
            onNodeCommit((draft) => {
              setVisibleExpressionForNode(draft, enabled ? undefined : createDefaultVisibleExpression(template, explorer));
            })
        })
      : createElement(EmptyText, null, "This conditional node renders its child branch when this expression passes."),
    enabled
      ? createElement(
          Fragment,
          null,
          createElement(SelectControl, {
            label: "Field",
            value: expression.source,
            options: fieldOptions,
            onChange: (source) =>
              onNodeCommit((draft) => {
                setVisibleExpressionForNode(draft, { ...expression, source });
              })
          }),
          createElement(SelectControl, {
            label: "Operator",
            value: operator,
            options: logicOperators.map((value) => ({ value, label: logicOperatorLabel(value) })),
            onChange: (value) =>
              onNodeCommit((draft) => {
                setVisibleExpressionForNode(draft, normalizeLogicExpressionForOperator(expression, value as ExpressionOperator));
              })
          }),
          valueLessLogicOperators.has(operator)
            ? null
            : createElement(TextControl, {
                label: "Value",
                value: expressionValueForInput(expression),
                mono: true,
                placeholder: "Express or {{shipment.total}}",
                onCommit: (value) =>
                  onNodeCommit((draft) => {
                    setVisibleExpressionForNode(draft, updateExpressionValue(expression, value));
                  })
              }),
          createElement(FieldRow, { label: "Sample value", value: sampleValue }),
          createElement(FieldRow, { label: "Reads as", value: describeExpression(expression) }),
          previewResult === undefined
            ? null
            : createElement(FieldRow, {
                label: "With sample data",
                value: previewResult ? "Passes ✓" : "Does not pass"
              }),
          createElement(EmptyText, null, "Visible If affects Preview and export. The editor keeps the node available for editing.")
        )
      : createElement(EmptyText, null, "Enable Visible If to conditionally render this node in Preview and export.")
  );
}

/**
 * Best-effort design-time preview of whether an expression passes against the
 * document sample data. Returns undefined when the field lives in a scope the
 * editor cannot resolve at rest (e.g. a repeat item), so we avoid showing a
 * misleading pass/fail.
 */
function logicPreviewResult(
  expression: ExpressionRef,
  data?: Record<string, unknown>
): boolean | undefined {
  if (!data) {
    return undefined;
  }

  const root = expression.source.split(/[.[]/)[0]?.trim();

  if (!root || !Object.prototype.hasOwnProperty.call(data, root)) {
    return undefined;
  }

  return evaluateExpressionPreview(expression, data);
}

function RepeatFilterSection({
  template,
  data,
  item,
  nodeItems,
  node,
  onNodeCommit
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
  node: RepeatNode;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const currentExpression = node.logic?.repeatItemIf;
  const enabled = Boolean(currentExpression);
  const expression = currentExpression ?? createDefaultVisibleExpression(template, explorer);
  const operator = expression.operator ?? "exists";
  const sampleValue = formatDataSampleValue(sampleValueForBindingPath(data, expression.source, explorer.selectedScope));

  return createElement(
    InspectorSection,
    {
      targetId: `node:${node.id}`,
      sectionId: "repeat-filter",
      title: "Repeat Filter",
      detail: enabled ? expression.source : "off"
    },
    createElement(ToggleSwitch, {
      label: "Repeat If",
      checked: enabled,
      onChange: () =>
        onNodeCommit((draft) => {
          setRepeatItemExpressionForNode(draft, enabled ? undefined : createDefaultVisibleExpression(template, explorer));
        })
    }),
    enabled
      ? createElement(
          Fragment,
          null,
          createElement(SelectControl, {
            label: "Field",
            value: expression.source,
            options: ensureOption(logicFieldOptions(explorer), expression.source),
            onChange: (source) =>
              onNodeCommit((draft) => {
                setRepeatItemExpressionForNode(draft, { ...expression, source });
              })
          }),
          createElement(SelectControl, {
            label: "Operator",
            value: operator,
            options: logicOperators.map((value) => ({ value, label: logicOperatorLabel(value) })),
            onChange: (value) =>
              onNodeCommit((draft) => {
                setRepeatItemExpressionForNode(draft, normalizeLogicExpressionForOperator(expression, value as ExpressionOperator));
              })
          }),
          valueLessLogicOperators.has(operator)
            ? null
            : createElement(TextControl, {
                label: "Value",
                value: expressionValueForInput(expression),
                mono: true,
                placeholder: "true or {{item.status}}",
                onCommit: (value) =>
                  onNodeCommit((draft) => {
                    setRepeatItemExpressionForNode(draft, updateExpressionValue(expression, value));
                  })
              }),
          createElement(FieldRow, { label: "Sample value", value: sampleValue }),
          createElement(FieldRow, { label: "Keeps rows where", value: describeExpression(expression) }),
          createElement(EmptyText, null, "Repeat If filters Preview and export rows before pagination and diagnostics.")
        )
      : createElement(EmptyText, null, "Enable Repeat If to filter rendered rows while keeping the row template editable.")
  );
}

function TextValueRulesSection({ node, onNodeCommit }: { node: TextNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  const fieldRun = firstFieldRun(node);
  const formatType = fieldRun?.format?.type ?? "none";

  if (!fieldRun) {
    return createElement(
      InspectorSection,
      { targetId: `node:${node.id}`, sectionId: "value-rules", title: "Value Rules", collapsible: false },
      createElement(EmptyText, null, "Bind this text node to a field before adding fallback or formatting rules.")
    );
  }

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "value-rules", title: "Value Rules", detail: fieldRun.binding.path },
    createElement(TextControl, {
      label: "Fallback",
      value: fieldRun.fallback ?? "",
      placeholder: "Not provided",
      onCommit: (value) =>
        onNodeCommit((draft) => {
          if (draft.type !== "text") return;
          const target = firstFieldRun(draft);
          if (!target) return;
          if (value) target.fallback = value;
          else delete target.fallback;
        })
    }),
    createElement(SelectControl, {
      label: "Format",
      value: formatType,
      options: [
        { value: "none", label: "None" },
        { value: "text", label: "Text" },
        { value: "currency", label: "Currency" },
        { value: "date", label: "Date" },
        { value: "number", label: "Number" }
      ],
      onChange: (value) =>
        onNodeCommit((draft) => {
          if (draft.type !== "text") return;
          const target = firstFieldRun(draft);
          if (!target) return;
          applyDefaultFieldFormat(target, value);
        })
    }),
    formatType === "text" && fieldRun.format?.type === "text"
      ? createElement(SelectControl, {
          label: "Transform",
          value: fieldRun.format.transform ?? "none",
          options: [
            { value: "none", label: "None" },
            { value: "uppercase", label: "UPPERCASE" },
            { value: "lowercase", label: "lowercase" },
            { value: "capitalize", label: "Capitalize" }
          ],
          onChange: (value) =>
            onNodeCommit((draft) => {
              if (draft.type !== "text") return;
              const target = firstFieldRun(draft);
              if (target) target.format = { type: "text", transform: value as "none" | "uppercase" | "lowercase" | "capitalize" };
            })
        })
      : null,
    formatType === "currency" && fieldRun.format?.type === "currency"
      ? createElement(TextControl, {
          label: "Currency",
          value: fieldRun.format.currency,
          mono: true,
          onCommit: (value) =>
            onNodeCommit((draft) => {
              if (draft.type !== "text") return;
              const target = firstFieldRun(draft);
              if (target) target.format = { type: "currency", currency: value || "USD" };
            })
        })
      : null,
    formatType === "date" && fieldRun.format?.type === "date"
      ? createElement(SelectControl, {
          label: "Date Style",
          value: fieldRun.format.dateStyle ?? "medium",
          options: ["short", "medium", "long", "full"].map((value) => ({ value, label: titleCase(value) })),
          onChange: (value) =>
            onNodeCommit((draft) => {
              if (draft.type !== "text") return;
              const target = firstFieldRun(draft);
              if (target) target.format = { type: "date", dateStyle: value as "short" | "medium" | "long" | "full" };
            })
        })
      : null,
    formatType === "number" && fieldRun.format?.type === "number"
      ? createElement(
          "div",
          { style: twoColumnGridStyle },
          createElement(NumberControl, {
            label: "Min Decimals",
            value: fieldRun.format.minimumFractionDigits ?? 0,
            onCommit: (value) =>
              onNodeCommit((draft) => {
                if (draft.type !== "text") return;
                const target = firstFieldRun(draft);
                if (target) target.format = { ...(target.format?.type === "number" ? target.format : { type: "number" }), minimumFractionDigits: Math.max(0, Math.round(value)) };
              })
          }),
          createElement(NumberControl, {
            label: "Max Decimals",
            value: fieldRun.format.maximumFractionDigits ?? 2,
            onCommit: (value) =>
              onNodeCommit((draft) => {
                if (draft.type !== "text") return;
                const target = firstFieldRun(draft);
                if (target) target.format = { ...(target.format?.type === "number" ? target.format : { type: "number" }), maximumFractionDigits: Math.max(0, Math.round(value)) };
              })
          })
        )
      : null
  );
}

function VariableReferenceSection({
  template,
  data,
  item,
  nodeItems
}: {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  item: EditorNodeItem;
  nodeItems: EditorNodeItem[];
}): ReactElement {
  const node = item.node;
  const explorer = buildDataExplorerModel({ template, data, nodeItems, selectedNodeIds: [item.id] });
  const bindingPath = bindingPathForNode(node);
  const variable = (template.variables ?? []).find((entry) => entry.id === bindingPath || `variables.${entry.id}` === bindingPath);
  const sampleValue = formatDataSampleValue(sampleValueForBindingPath(data, bindingPath, explorer.selectedScope));

  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "variable-reference", title: "Variable Reference", collapsible: false },
    createElement(FieldRow, { label: "Binding", value: bindingPath || "none" }),
    createElement(FieldRow, { label: "Sample", value: sampleValue }),
    variable ? createElement(FieldRow, { label: "Variable", value: `${variable.name} (${variable.id})` }) : createElement(EmptyText, null, "Variables can be bound from the Data explorer.")
  );
}

function BehaviorSection({ node, onNodeCommit }: { node: EditableNode; onNodeCommit: (update: (node: EditableNode) => void) => void }): ReactElement {
  return createElement(
    InspectorSection,
    { targetId: `node:${node.id}`, sectionId: "behavior", title: "Behavior", detail: node.visible === false ? "hidden" : "visible" },
    createElement(ToggleSwitch, {
      label: "Visible",
      checked: node.visible !== false,
      onChange: () =>
        onNodeCommit((draft) => {
          draft.visible = draft.visible === false ? true : false;
        })
    }),
    createElement(ToggleSwitch, {
      label: "Locked",
      checked: Boolean(node.locked),
      onChange: () =>
        onNodeCommit((draft) => {
          draft.locked = !draft.locked;
        })
    })
  );
}

function MetadataSection({
  item,
  selectedCount,
  onNodeCommit
}: {
  item: EditorNodeItem;
  selectedCount: number;
  onNodeCommit: (update: (node: EditableNode) => void) => void;
}): ReactElement {
  const metadata = getInspectorMetadata(item.node);
  const anchor = typeof metadata.anchor === "number" ? metadata.anchor : 0;

  return createElement(
    InspectorSection,
    { targetId: `node:${item.id}`, sectionId: "metadata", title: "Metadata", detail: item.type },
    createElement(FieldRow, { label: "ID", value: item.id }),
    createElement(FieldRow, { label: "Path", value: item.path }),
    createElement(FieldRow, { label: "Selection", value: `${selectedCount} node${selectedCount === 1 ? "" : "s"}` }),
    createElement(TextControl, {
      label: "Alias (editor-only)",
      value: String(metadata.alias ?? `${item.id}-node`),
      mono: true,
      onCommit: (value) =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "alias", value);
        })
    }),
    createElement(TextControl, {
      label: "CSS class (editor-only)",
      value: String(metadata.cssClass ?? ""),
      mono: true,
      placeholder: "e.g. bol-header",
      onCommit: (value) =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "cssClass", value);
        })
    }),
    createElement(AnchorGrid, {
      label: "Anchor (editor-only, not exported)",
      value: anchor,
      onChange: (value) =>
        onNodeCommit((draft) => {
          setInspectorMetadataValue(draft, "anchor", value);
        })
    })
  );
}

function SectionStack({ children }: { children?: ReactNode }): ReactElement {
  return createElement("div", { style: sectionStackStyle }, children);
}

function PageSectionHint({ children }: { children: ReactNode }): ReactElement {
  return createElement("p", { style: pageSectionHintStyle }, children);
}

function PageInlineRow({ columns, children }: { columns: string; children?: ReactNode }): ReactElement {
  return createElement("div", { style: { ...pageInlineRowStyle, gridTemplateColumns: columns } }, children);
}

function PageInlineField({ label, children }: { label: string; children?: ReactNode }): ReactElement {
  return createElement(
    "div",
    { style: pageInlineFieldStyle },
    createElement("span", { style: pageInlineLabelStyle }, label),
    children
  );
}

function PageInlineSelect({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(Select, { value, options, onChange, variant: "inline" });
}

function PageInlineNumber({
  value,
  onCommit,
  disabled,
  step = 1
}: {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  step?: number;
}): ReactElement {
  const [draft, setDraft] = useState(String(roundDisplayNumber(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => setDraft(String(roundDisplayNumber(value))), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    else setDraft(String(roundDisplayNumber(value)));
  };

  const nudge = (delta: number): void => {
    onCommit(Math.max(0, roundDisplayNumber(value + delta)));
  };

  return createElement(
    "span",
    {
      style: {
        ...pageNumberWrapStyle,
        ...(focused ? pageNumberFocusStyle : pageNumberSurfaceStyle)
      }
    },
    createElement("input", {
      value: draft,
      disabled,
      inputMode: "decimal",
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        commit();
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(roundDisplayNumber(value)));
          event.currentTarget.blur();
        }
      },
      style: pageNumberInputStyle
    }),
    createElement(
      "span",
      { style: pageStepperStyle },
      createElement("button", { type: "button", disabled, onClick: () => nudge(step), style: pageStepperButtonStyle, "aria-label": "Increase" }, "+"),
      createElement("button", { type: "button", disabled, onClick: () => nudge(-step), style: pageStepperButtonStyle, "aria-label": "Decrease" }, "−")
    )
  );
}

function PageInlineColor({ value, onCommit }: { value: string; onCommit: (value: string) => void }): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    const normalized = draft.trim();
    if (normalized && normalized !== value) onCommit(normalized.startsWith("#") ? normalized.toUpperCase() : `#${normalized.toUpperCase()}`);
    else setDraft(value);
  };

  return createElement(
    "span",
    { style: pageColorWrapStyle },
    createElement("input", {
      type: "color",
      value: normalizeHexColor(value),
      onChange: (event) => onCommit((event.currentTarget as HTMLInputElement).value.toUpperCase()),
      style: pageColorSwatchInputStyle
    }),
    createElement("input", {
      value: draft,
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
      },
      style: pageColorTextStyle
    })
  );
}

function PageOrientationControl({ value, onChange }: { value: "portrait" | "landscape"; onChange: (value: "portrait" | "landscape") => void }): ReactElement {
  return createElement(
    "div",
    { style: pageSegmentedStyle },
    (["portrait", "landscape"] as const).map((option) =>
      createElement(
        "button",
        {
          key: option,
          type: "button",
          title: titleCase(option),
          onClick: () => onChange(option),
          style: {
            ...pageSegmentedButtonStyle,
            background: option === value ? "#ffffff" : "transparent",
            color: option === value ? "#5B5BD6" : "#64748b",
            boxShadow: option === value ? "0 1px 2px rgba(15, 23, 42, 0.12)" : "none"
          }
        },
        createElement(OrientationGlyph, { orientation: option })
      )
    )
  );
}

function OrientationGlyph({ orientation }: { orientation: "portrait" | "landscape" }): ReactElement {
  return createElement("span", {
    style: {
      ...orientationGlyphStyle,
      width: orientation === "portrait" ? 10 : 14,
      height: orientation === "portrait" ? 14 : 10
    }
  });
}

function PageMarginsRow({
  margin,
  linked,
  onToggleLinked,
  onCommit
}: {
  margin: Box;
  linked: boolean;
  onToggleLinked: () => void;
  onCommit: (side: keyof Box, mm: number) => void;
}): ReactElement {
  const sides: Array<{ key: keyof Box; label: string }> = [
    { key: "top", label: "Top" },
    { key: "right", label: "Right" },
    { key: "bottom", label: "Bottom" },
    { key: "left", label: "Left" }
  ];

  return createElement(
    "div",
    { style: pageMarginsRowStyle },
    createElement(
      "div",
      { style: pageMarginsGridStyle },
      sides.map(({ key, label }) =>
        createElement(
          PageInlineField,
          { key, label },
          createElement(PageInlineNumber, {
            value: mmFromPx(margin[key]),
            onCommit: (mm) => onCommit(key, mm)
          })
        )
      )
    ),
    createElement(
      "button",
      {
        type: "button",
        title: linked ? "Unlink margins" : "Link margins",
        onClick: onToggleLinked,
        style: {
          ...pageLinkButtonStyle,
          color: linked ? "#5B5BD6" : "#94a3b8",
          background: linked ? "#f5f8ff" : "#ffffff",
          boxShadow: linked ? UI_SELECTION_RING : pageLinkButtonStyle.boxShadow
        }
      },
      createElement(ToolIcon, { icon: Link01Icon, size: 14 })
    )
  );
}

function PageToggleValueRow({
  label,
  enabled,
  value,
  unit,
  onToggle,
  onCommit
}: {
  label: string;
  enabled: boolean;
  value: number;
  onToggle: () => void;
  onCommit: (value: number) => void;
  unit: string;
}): ReactElement {
  return createElement(
    "div",
    { style: pageToggleValueRowStyle },
    createElement("span", { style: pageToggleValueLabelStyle }, label),
    createElement(
      "div",
      { style: pageToggleValueControlsStyle },
      createElement(
        "button",
        {
          type: "button",
          role: "switch",
          "aria-checked": enabled,
          onClick: onToggle,
          style: pageToggleValueSwitchWrapStyle
        },
        createElement("span", { style: { ...toggleTrackStyle, background: enabled ? "#5B5BD6" : "#cbd5e1" } }, createElement("span", { style: { ...toggleThumbStyle, transform: enabled ? "translateX(14px)" : "translateX(0)" } }))
      ),
      createElement(
        "span",
        { style: pageToggleValueInputWrapStyle },
        createElement(PageInlineNumber, {
          value,
          disabled: !enabled,
          onCommit
        }),
        createElement("span", { style: pageToggleValueUnitStyle }, unit)
      )
    )
  );
}

function InspectorSection({
  targetId,
  sectionId,
  title,
  headerAction,
  collapsible = true,
  children
}: {
  targetId: InspectorTargetId;
  sectionId: string;
  title: string;
  detail?: string;
  headerAction?: ReactNode;
  collapsible?: boolean;
  children?: ReactNode;
}): ReactElement {
  const context = useContext(InspectorSectionContext);
  const open = !collapsible || !(context?.uiState.collapsedSectionsByTarget[targetId]?.[sectionId] ?? false);
  const toggle = (): void => {
    if (collapsible) context?.dispatch({ type: "toggle-section", targetId, sectionId });
  };

  return createElement(
    "section",
    { style: sectionStyle },
    createElement(
      "div",
      { style: sectionHeaderRowStyle },
      createElement(
        "button",
        {
          type: "button",
          "aria-expanded": open,
          disabled: !collapsible,
          onClick: toggle,
          style: { ...sectionHeaderToggleStyle, cursor: collapsible ? "pointer" : "default" }
        },
        createElement("span", { style: sectionTitleStyle }, title)
      ),
      createElement(
        "div",
        { style: sectionHeaderTrailingStyle },
        headerAction ?? null,
        collapsible
          ? createElement(
              "button",
              {
                type: "button",
                "aria-expanded": open,
                title: open ? "Collapse section" : "Expand section",
                onClick: toggle,
                style: sectionChevronButtonStyle
              },
              createElement(
                "span",
                { style: { ...sectionChevronStyle, transform: open ? "rotate(0deg)" : "rotate(-90deg)" } },
                createElement(SectionChevronIcon, { size: 14 })
              )
            )
          : null
      )
    ),
    open ? createElement("div", { style: sectionBodyStyle }, children) : null
  );
}

function TextControl({
  label,
  value,
  onCommit,
  mono,
  placeholder,
  disabled
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
  disabled?: boolean;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    "label",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("input", {
      value: draft,
      disabled,
      placeholder,
      onChange: (event) => setDraft((event.currentTarget as HTMLInputElement).value),
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        commit();
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      },
      style: {
        ...textInputStyle,
        ...(focused ? textInputFocusStyle : textInputBlurStyle),
        fontFamily: mono ? UI_MONO_FONT_FAMILY : UI_FONT_FAMILY,
        opacity: disabled ? 0.58 : 1
      }
    })
  );
}

function BindingControl(props: { label: string; value: string; onCommit: (value: string) => void }): ReactElement {
  return createElement(TextControl, { ...props, mono: true, placeholder: "shipment.field" });
}

function TextAreaControl({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    "label",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("textarea", {
      value: draft,
      rows: 3,
      onChange: (event) => setDraft((event.currentTarget as HTMLTextAreaElement).value),
      onBlur: commit,
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      },
      style: textAreaStyle
    })
  );
}

function NumberControl({ label, value, onCommit, disabled }: { label: string; value: number; onCommit: (value: number) => void; disabled?: boolean }): ReactElement {
  const [draft, setDraft] = useState(String(roundDisplayNumber(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => setDraft(String(roundDisplayNumber(value))), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    else setDraft(String(roundDisplayNumber(value)));
  };

  return createElement(
    "label",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement("input", {
      type: "number",
      value: draft,
      disabled,
      onChange: (event) => setDraft(event.currentTarget.value),
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        commit();
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(roundDisplayNumber(value)));
          event.currentTarget.blur();
        }
      },
      style: {
        ...textInputStyle,
        ...(focused ? textInputFocusStyle : textInputBlurStyle),
        fontFamily: UI_MONO_FONT_FAMILY,
        opacity: disabled ? 0.58 : 1
      }
    })
  );
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function SelectCheckIcon({ size }: { size: number }): ReactElement {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    createElement("polyline", { points: "20 6 9 17 4 12" })
  );
}

/**
 * Shared shadcn-style listbox. Replaces native <select> across the inspector so
 * every dropdown looks and behaves identically (rounded popover, hover states,
 * keyboard nav, checkmark on the selected item). The menu is rendered with fixed
 * positioning so it escapes the inspector's scroll clipping.
 */
function Select({
  value,
  options,
  onChange,
  variant = "field",
  ariaLabel
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  variant?: "field" | "inline";
  ariaLabel?: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    placement: "down" | "up";
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const estimatedHeight = Math.min(280, options.length * 34 + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: "down" | "up" =
      spaceBelow < estimatedHeight + 12 && rect.top > spaceBelow ? "up" : "down";

    setPos({
      left: rect.left,
      top: placement === "down" ? rect.bottom + 6 : rect.top - 6,
      width: rect.width,
      placement
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    measure();

    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleLayout = (): void => measure();

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [open, measure]);

  const openMenu = (): void => {
    const current = options.findIndex((option) => option.value === value);
    setActiveIndex(current >= 0 ? current : 0);
    setOpen(true);
  };

  const commit = (next: string): void => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number): void => {
    setActiveIndex((index) => {
      const count = options.length;
      let next = index;
      for (let step = 0; step < count; step += 1) {
        next = (next + delta + count) % count;
        if (!options[next]?.disabled) {
          return next;
        }
      }
      return index;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) {
        commit(option.value);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const trigger = createElement(
    "button",
    {
      ref: triggerRef,
      type: "button",
      className: UI_CHROME_CLASS,
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      "aria-label": ariaLabel,
      onClick: () => (open ? setOpen(false) : openMenu()),
      onKeyDown: handleKeyDown,
      style: variant === "inline" ? selectTriggerInlineStyle : selectTriggerFieldStyle
    },
    createElement(
      "span",
      { style: selectTriggerLabelStyle },
      selected ? selected.label : ""
    ),
    createElement(
      "span",
      { style: selectTriggerChevronStyle, "aria-hidden": true },
      createElement(SelectChevronIcon, { size: variant === "inline" ? 13 : 14 })
    )
  );

  const menu =
    open && pos
      ? createElement(
          "div",
          {
            ref: menuRef,
            className: UI_MENU_CLASS,
            role: "listbox",
            style: {
              position: "fixed",
              left: pos.left,
              top: pos.placement === "down" ? pos.top : undefined,
              bottom: pos.placement === "up" ? window.innerHeight - pos.top : undefined,
              minWidth: pos.width,
              zIndex: 4000
            }
          },
          options.map((option, index) =>
            createElement(
              "button",
              {
                key: option.value,
                type: "button",
                role: "option",
                "aria-selected": option.value === value,
                disabled: option.disabled,
                className:
                  index === activeIndex
                    ? `${UI_MENU_ITEM_CLASS} is-active`
                    : UI_MENU_ITEM_CLASS,
                onMouseEnter: () => setActiveIndex(index),
                onClick: () => commit(option.value)
              },
              createElement("span", { style: selectOptionLabelStyle }, option.label),
              option.value === value
                ? createElement(
                    "span",
                    { style: selectOptionCheckStyle },
                    createElement(SelectCheckIcon, { size: 14 })
                  )
                : null
            )
          )
        )
      : null;

  return createElement(
    "span",
    { style: variant === "inline" ? selectRootInlineStyle : selectRootStyle },
    trigger,
    menu
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "label",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(Select, { value, options, onChange, ariaLabel: label })
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
  options: Array<{ value: string; label: ReactNode }>;
  onChange: (value: string) => void;
}): ReactElement {
  return createElement(
    "div",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(
      "div",
      { style: segmentedStyle },
      options.map((option) =>
        createElement(
          "button",
          {
            key: option.value,
            type: "button",
            onClick: () => onChange(option.value),
            style: {
              ...segmentedButtonStyle,
              background: option.value === value ? "#ffffff" : "transparent",
              color: option.value === value ? "#5B5BD6" : "#64748b",
              boxShadow: option.value === value ? "0 1px 2px rgba(15, 23, 42, 0.12)" : "none"
            }
          },
          option.label
        )
      )
    )
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", role: "switch", "aria-checked": checked, onClick: onChange, style: toggleRowStyle },
    createElement("span", { style: toggleLabelStyle }, label),
    createElement(
      "span",
      { style: { ...toggleTrackStyle, background: checked ? "#5B5BD6" : "#cbd5e1" } },
      createElement("span", { style: { ...toggleThumbStyle, transform: checked ? "translateX(14px)" : "translateX(0)" } })
    )
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  onCommit
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return createElement(
    "div",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(
      "div",
      { style: rangeRowStyle },
      createElement("input", {
        type: "range",
        min,
        max,
        value: draft,
        onChange: (event) => setDraft(Number(event.currentTarget.value)),
        onPointerUp: commit,
        onBlur: commit,
        style: rangeStyle
      }),
      createElement("span", { style: rangeValueStyle }, `${Math.round(draft)}%`)
    )
  );
}

function ColorControl({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }): ReactElement {
  return createElement(
    "div",
    { style: colorRowWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(
      "div",
      { style: colorRowStyle },
      createElement("span", { style: { ...colorSwatchStyle, background: value || "transparent" } }),
      createElement("div", { style: { flex: 1 } }, createElement(TextControl, { label: "Hex", value, mono: true, onCommit }))
    )
  );
}

function DisabledControl({ label, value }: { label: string; value: string }): ReactElement {
  return createElement(TextControl, { label, value, disabled: true, onCommit: () => undefined });
}

function AnchorGrid({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): ReactElement {
  return createElement(
    "div",
    { style: controlWrapStyle },
    createElement("span", { style: fieldLabelStyle }, label),
    createElement(
      "div",
      { style: anchorGridStyle },
      Array.from({ length: 9 }, (_, index) =>
        createElement(
          "button",
          {
            key: index,
            type: "button",
            onClick: () => onChange(index),
            style: {
              ...anchorButtonStyle,
              background: value === index ? "#ffffff" : "transparent",
              boxShadow: value === index ? "0 1px 2px rgba(15, 23, 42, 0.12)" : "none"
            }
          },
          createElement("span", { style: { ...anchorDotStyle, background: value === index ? "#5B5BD6" : "#94a3b8", transform: value === index ? "scale(1.2)" : "scale(1)" } })
        )
      )
    )
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

function MetaPill({ label, value }: { label: string; value: string }): ReactElement {
  return createElement(
    "div",
    { style: metaPillStyle },
    createElement("span", { style: metaLabelStyle }, label),
    createElement("span", { style: metaValueStyle }, value)
  );
}

function InspectorBreadcrumb({ items }: { items: Array<{ label: string; current?: boolean }> }): ReactElement {
  return createElement(
    "nav",
    { style: breadcrumbNavStyle, "aria-label": "Breadcrumb" },
    createElement(
      "ol",
      { style: breadcrumbListStyle },
      items.flatMap((item, index) => {
        const nodes: ReactElement[] = [
          createElement(
            "li",
            { key: `${item.label}-${index}`, style: breadcrumbItemStyle },
            item.current
              ? createElement("span", { style: breadcrumbPageStyle, "aria-current": "page" }, item.label)
              : createElement("span", { style: breadcrumbLinkStyle }, item.label)
          )
        ];

        if (index < items.length - 1) {
          nodes.push(createElement("li", { key: `sep-${index}`, style: breadcrumbSeparatorItemStyle, "aria-hidden": true }, createElement(BreadcrumbSeparatorIcon)));
        }

        return nodes;
      })
    )
  );
}

function BreadcrumbSeparatorIcon(): ReactElement {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: breadcrumbSeparatorIconStyle
    },
    createElement("path", { d: "m9 18 6-6-6-6" })
  );
}

function SectionLabel({ title }: { title: string }): ReactElement {
  return createElement("span", { style: sectionLabelStyle }, title);
}

function EmptyText({ children }: { children?: ReactNode }): ReactElement {
  return createElement("p", { style: emptyTextStyle }, children);
}

function InspectorFooter({ title, status, detail }: { title: string; status: string; detail: string }): ReactElement {
  return createElement(
    "footer",
    { style: inspectorFooterStyle },
    createElement(
      "div",
      { style: footerTitleStyle },
      createElement(ToolIcon, { icon: InformationCircleIcon, size: 13 }),
      createElement("span", null, title)
    ),
    createElement(
      "div",
      { style: footerDetailStyle },
      createElement("span", null, status),
      createElement("span", null, detail)
    )
  );
}

function InspectorActionButton({
  icon,
  title,
  active,
  disabled,
  onClick
}: {
  icon: IconSvgElement;
  title: string;
  active?: boolean;
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
        ...iconButtonStyle,
        background: active ? "#eef2ff" : "transparent",
        color: active ? "#4f46e5" : "#64748b",
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }
    },
    createElement(ToolIcon, { icon, size: 13 })
  );
}

function MiniActionButton({ icon, title, onClick }: { icon: IconSvgElement; title: string; onClick: () => void }): ReactElement {
  return createElement(
    "button",
    { type: "button", title, onClick, style: miniActionButtonStyle },
    createElement(ToolIcon, { icon, size: 12 })
  );
}

function ToolIcon({ icon, size }: { icon: IconSvgElement; size: number }): ReactElement {
  return createElement(
    "span",
    { style: iconWrapStyle, "aria-hidden": true },
    createElement(HugeiconsIcon, {
      icon,
      size,
      strokeWidth: 1.75,
      color: "currentColor"
    })
  );
}

function SectionChevronIcon({ size }: { size: number }): ReactElement {
  return createElement(
    "span",
    { style: iconWrapStyle, "aria-hidden": true },
    createElement(HugeiconsIcon, {
      icon: ChevronDownIcon,
      size,
      strokeWidth: 2.25,
      color: "currentColor"
    })
  );
}

function SelectChevronIcon({ size }: { size: number }): ReactElement {
  return createElement(
    "span",
    { style: iconWrapStyle, "aria-hidden": true },
    createElement(HugeiconsIcon, {
      icon: ChevronDownIcon,
      size,
      strokeWidth: 2,
      color: "currentColor"
    })
  );
}

function pagePresetIdForSize(size: Frame | PageTemplate["size"]): string {
  const preset = Object.values(PAGE_PRESETS).find(
    (candidate) =>
      (candidate.width === size.width && candidate.height === size.height) ||
      (candidate.height === size.width && candidate.width === size.height)
  );

  return preset?.id ?? "custom";
}

function ensurePageMargin(page: PageTemplate): NonNullable<PageTemplate["margin"]> {
  page.margin ??= defaultMarginBox();
  return page.margin;
}

function defaultMarginBox(): Box {
  const px = pxFromMm(24);
  return { top: px, right: px, bottom: px, left: px };
}

function pxFromMm(mm: number): number {
  return Math.round(mm * PX_PER_MM * 100) / 100;
}

function mmFromPx(px: number): number {
  return Math.round((px / PX_PER_MM) * 100) / 100;
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#FFFFFF";
}

function inspectorTitleForItem(item: EditorNodeItem): string {
  return item.node.name ?? item.label ?? humanizeId(item.id);
}

function inspectorIconForNode(node: EditableNode): IconSvgElement {
  if (node.type === "text") return TypeCursorIcon;
  if (node.type === "repeat") return RepeatIcon;
  if (node.type === "grid") return GridTableIcon;
  if (node.type === "conditional") return ThirdBracketIcon;
  if (node.type === "image") return Image01Icon;
  if (node.type === "barcode") return BarcodeIcon;
  if (node.type === "qr") return QrCodeIcon;
  return FrameIcon;
}

function nodeKindLabel(node: EditableNode): string {
  if (node.type === "qr") return "QR Code";
  if (node.type === "flowRegion") return "Flow Region";
  return titleCase(node.type);
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeId(value: string): string {
  return titleCase(value.replace(/^\d+\./, ""));
}

function bindingPathForNode(node: EditableNode): string {
  if (node.type === "text") return firstTextBinding(node);
  if (node.type === "repeat") return node.binding.path;
  if (node.type === "grid") return node.binding?.path ?? "";
  if (node.type === "image") return imageBindingPath(node);
  if (node.type === "barcode" || node.type === "qr") return dynamicValueBindingPath(node.value);
  return "";
}

function bindingScopeForNode(template: DocumentTemplate, node: EditableNode): string {
  if (node.type === "repeat") return node.itemAlias || node.binding.path.split(".").at(-1) || "item";

  const path = bindingPathForNode(node);
  const firstSegment = path.split(".")[0] || "";

  if (firstSegment && findRepeatBindingForAlias(template, firstSegment)) {
    return firstSegment;
  }

  return firstSegment || "document";
}

function imageBindingPath(node: ImageNode): string {
  return node.source.kind === "binding" ? node.source.binding.path : "";
}

function imageSourceLabel(node: ImageNode): string {
  if (node.source.kind === "binding") return node.source.binding.path;
  if (node.source.kind === "asset") return node.source.assetId;
  return node.source.url;
}

function firstTextBinding(node: TextNode): string {
  return node.content.find((part) => part.kind === "field")?.binding.path ?? "";
}

function firstTextFallback(node: TextNode): string {
  return node.content.find((part) => part.kind === "field")?.fallback ?? "";
}

function firstFieldRun(node: TextNode): FieldRun | undefined {
  return node.content.find((part): part is FieldRun => part.kind === "field");
}

function applyDefaultFieldFormat(fieldRun: FieldRun, formatType: string): void {
  if (formatType === "none") {
    delete fieldRun.format;
    return;
  }

  if (formatType === "currency") {
    fieldRun.format = { type: "currency", currency: "USD" };
    return;
  }

  if (formatType === "date") {
    fieldRun.format = { type: "date", dateStyle: "medium" };
    return;
  }

  if (formatType === "number") {
    fieldRun.format = { type: "number", minimumFractionDigits: 0, maximumFractionDigits: 2 };
    return;
  }

  fieldRun.format = { type: "text", transform: "none" };
}

function textNodeContentValue(node: TextNode): string {
  return serializeInlineContent(node.content);
}

function dynamicValueBindingPath(value: DynamicValue): string {
  if (value.kind === "binding") return value.binding.path;
  if (value.kind === "template") return value.parts.find((part) => part.kind === "field")?.binding.path ?? "";
  return "";
}

function fieldsForScope(template: DocumentTemplate, data: Record<string, unknown> | undefined, scope: string, repeatBindingPath?: string): FlatDataField[] {
  const fields = flattenDataFields(template.dataSchema?.fields ?? []);
  const repeatPath = repeatBindingPath ?? findRepeatBindingForAlias(template, scope);

  if (repeatPath) {
    return inferFieldsFromRepeatSample(data, repeatPath, scope);
  }

  if (!scope || scope === "document") {
    return fields;
  }

  const scoped = fields.filter((field) => field.path === scope || field.path.startsWith(`${scope}.`));
  return scoped.length ? scoped : fields;
}

function inferFieldsFromRepeatSample(data: Record<string, unknown> | undefined, repeatPath: string, alias: string): FlatDataField[] {
  const sample = sampleValueForRawPath(data, repeatPath);
  const first = Array.isArray(sample) ? sample[0] : undefined;

  if (!isRecord(first)) {
    return [];
  }

  return Object.entries(first).map(([key, value]) => ({
    path: `${alias}.${key}`,
    label: titleCase(key),
    kind: fieldKindForValue(value),
    depth: 0
  }));
}

function findRepeatBindingForAlias(template: DocumentTemplate, alias: string): string | undefined {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      const found = findRepeatBindingInNodes(layer.nodes, alias);
      if (found) return found;
    }
  }

  return undefined;
}

function findRepeatBindingInNodes(nodes: Array<DocNode | FlowNode>, alias: string): string | undefined {
  for (const node of nodes) {
    if (node.type === "repeat" && node.itemAlias === alias) {
      return node.binding.path;
    }

    const children = childNodesFor(node);
    const found = children ? findRepeatBindingInNodes(children, alias) : undefined;
    if (found) return found;
  }

  return undefined;
}

function childNodesFor(node: DocNode | FlowNode): Array<DocNode | FlowNode> | undefined {
  if (node.type === "group") return node.children;
  if (node.type === "flowRegion") return node.children;
  if (node.type === "section") return node.children;
  if (node.type === "stack") return node.children;
  if (node.type === "repeat") return [...node.children, ...(node.emptyState ?? [])];
  if (node.type === "conditional") return [...node.children, ...(node.fallback ?? [])];
  return undefined;
}

function flattenDataFields(fields: DataField[], depth = 0): FlatDataField[] {
  return fields.flatMap((field) => [{ ...field, depth }, ...flattenDataFields(field.children ?? [], depth + 1)]);
}

function fieldKindForValue(value: unknown): DataField["kind"] {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "unknown";
}

function sampleValueForPath(template: DocumentTemplate, data: Record<string, unknown> | undefined, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split(".");
  const repeatPath = findRepeatBindingForAlias(template, segments[0] ?? "");

  if (repeatPath && segments.length > 1) {
    return sampleValueForRawPath(data, `${repeatPath}.${segments.slice(1).join(".")}`);
  }

  return sampleValueForRawPath(data, path);
}

function sampleValueForRawPath(data: Record<string, unknown> | undefined, path: string): unknown {
  if (!data || !path) return undefined;

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) return current[0] && typeof current[0] === "object" ? (current[0] as Record<string, unknown>)[segment] : undefined;
    if (typeof current === "object") return (current as Record<string, unknown>)[segment];
    return undefined;
  }, data);
}

function formatSampleValue(value: unknown): string {
  if (value == null) return "none";
  if (typeof value === "string") return value || "empty";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return "object";
}

function createDefaultVariable(template: DocumentTemplate): VariableDefinition {
  const id = createVariableId(template, "computedValue");
  const arrayField = (template.dataSchema?.fields ?? []).find((field) => field.kind === "array");

  return {
    id,
    name: titleCase(id),
    category: "computed",
    value: {
      kind: "formula",
      formula: {
        op: "count",
        path: arrayField?.path ?? "items"
      }
    }
  };
}

function createVariableId(template: DocumentTemplate, prefix: string): string {
  const existing = new Set((template.variables ?? []).map((variable) => variable.id));
  let index = 1;
  let candidate = prefix;

  while (existing.has(candidate)) {
    index += 1;
    candidate = `${prefix}${index}`;
  }

  return candidate;
}

function updateVariableById(template: DocumentTemplate, variableId: string, update: (variable: VariableDefinition) => void): void {
  const variables = [...(template.variables ?? [])];
  const index = variables.findIndex((variable) => variable.id === variableId);

  if (index < 0) {
    return;
  }

  const nextVariable = structuredClone(variables[index]);
  update(nextVariable);
  variables[index] = nextVariable;
  template.variables = variables;
}

function sanitizeVariableId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .replace(/\s+(.)/g, (_, letter: string) => letter.toUpperCase())
    .replace(/^\d+/, "")
    .replace(/^./, (letter) => letter.toLowerCase());
}

function variableValueSummary(value: DynamicValue): string {
  if (value.kind === "literal") return value.value;
  if (value.kind === "binding") return value.binding.path;
  if (value.kind === "template") return inlineContentToTemplateInput(value.parts);
  if (value.formula.op === "sum" || value.formula.op === "count") return `${value.formula.op} ${value.formula.path}`;
  return value.formula.op;
}

function createDefaultDynamicValue(kind: string, variableId: string): DynamicValue {
  if (kind === "binding") {
    return { kind: "binding", binding: { path: "invoice.number" } };
  }

  if (kind === "template") {
    return { kind: "template", parts: [{ kind: "text", text: titleCase(variableId) }] };
  }

  if (kind === "formula") {
    return { kind: "formula", formula: createDefaultFormula("count", variableId) };
  }

  return { kind: "literal", value: "" };
}

function createDefaultFormula(op: string, variableId: string): FormulaExpression {
  if (op === "sum" || op === "count") {
    return { op, path: "invoice.items.total" };
  }

  if (op === "concat") {
    return { op: "concat", parts: [{ kind: "literal", value: titleCase(variableId) }] };
  }

  if (op === "subtract" || op === "multiply" || op === "divide") {
    return {
      op,
      left: { kind: "literal", value: 0 },
      right: { kind: "literal", value: op === "divide" ? 1 : 0 }
    };
  }

  return {
    op: "add",
    left: { kind: "literal", value: 0 },
    right: { kind: "literal", value: 0 }
  };
}

function formulaOperandToInput(operand: FormulaOperand): string {
  if (operand.kind === "path") {
    return `{{${operand.path}}}`;
  }

  if (operand.kind === "variable") {
    return `var:${operand.id}`;
  }

  return String(operand.value);
}

function parseFormulaOperandInput(input: string): FormulaOperand {
  const trimmed = input.trim();
  const path = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed)?.[1]?.trim();

  if (path) {
    return { kind: "path", path };
  }

  if (trimmed.startsWith("var:")) {
    return { kind: "variable", id: trimmed.slice(4).trim() };
  }

  if (trimmed === "true") return { kind: "literal", value: true };
  if (trimmed === "false") return { kind: "literal", value: false };

  const number = Number(trimmed);
  if (trimmed !== "" && Number.isFinite(number)) {
    return { kind: "literal", value: number };
  }

  return { kind: "literal", value: input };
}

function inlineContentToTemplateInput(content: TextNode["content"]): string {
  return content.map((part) => (part.kind === "text" ? part.text : `{{${part.binding.path}}}`)).join("");
}

function templateInputToInlineContent(input: string): TextNode["content"] {
  const parts: TextNode["content"] = [];
  const pattern = /\{\{\s*([^}]+?)\s*\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    if (match.index > cursor) {
      parts.push({ kind: "text", text: input.slice(cursor, match.index) });
    }

    const path = match[1]?.trim() ?? "";
    parts.push({ kind: "field", label: path, binding: { path } });
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) {
    parts.push({ kind: "text", text: input.slice(cursor) });
  }

  return parts.length ? parts : [{ kind: "text", text: "" }];
}

function defaultConditionField(template: DocumentTemplate): string {
  return template.dataSchema?.fields.find((field) => field.kind !== "array" && field.kind !== "object")?.path ?? "shipment.serviceLevel";
}

function visibleExpressionForNode(node: EditableNode): ExpressionRef | undefined {
  if (node.type === "conditional") {
    return node.condition;
  }

  return node.logic?.visibleIf;
}

function setVisibleExpressionForNode(node: EditableNode, expression: ExpressionRef | undefined): void {
  if (node.type === "conditional") {
    if (expression) {
      node.condition = expression;
    }

    return;
  }

  if (expression) {
    node.logic = {
      ...node.logic,
      visibleIf: expression
    };
    return;
  }

  if (!node.logic) {
    return;
  }

  const nextLogic = { ...node.logic };
  delete nextLogic.visibleIf;
  node.logic = Object.keys(nextLogic).length > 0 ? nextLogic : undefined;
}

function setRepeatItemExpressionForNode(node: EditableNode, expression: ExpressionRef | undefined): void {
  if (node.type !== "repeat") {
    return;
  }

  if (expression) {
    node.logic = {
      ...node.logic,
      repeatItemIf: expression
    };
    return;
  }

  if (!node.logic) {
    return;
  }

  const nextLogic = { ...node.logic };
  delete nextLogic.repeatItemIf;
  node.logic = Object.keys(nextLogic).length > 0 ? nextLogic : undefined;
}

function createDefaultVisibleExpression(template: DocumentTemplate, explorer: DataExplorerModel): ExpressionRef {
  const firstField = explorer.allFields.find((field) => field.path && field.bindable && field.kind !== "array" && field.kind !== "object");

  return {
    source: firstField?.path ?? defaultConditionField(template),
    operator: "exists"
  };
}

function logicFieldOptions(explorer: DataExplorerModel): Array<{ value: string; label: string }> {
  const options = explorer.allFields
    .filter((field) => field.path && field.bindable)
    .map((field) => ({
      value: field.path,
      label: `${field.path} · ${field.kind}`
    }));

  return options.length ? options : [{ value: "shipment.serviceLevel", label: "shipment.serviceLevel" }];
}

function logicOperatorLabel(operator: ExpressionOperator): string {
  return titleCase(operator);
}

function normalizeLogicExpressionForOperator(expression: ExpressionRef, operator: ExpressionOperator): ExpressionRef {
  if (valueLessLogicOperators.has(operator)) {
    return {
      source: expression.source,
      operator
    };
  }

  const next: ExpressionRef = {
    ...expression,
    operator
  };

  if (!next.compareSource && next.value === undefined) {
    next.value = "";
  }

  return next;
}

function expressionValueForInput(expression: ExpressionRef): string {
  if (expression.compareSource) {
    return `{{${expression.compareSource}}}`;
  }

  if (expression.value == null) {
    return "";
  }

  return String(expression.value);
}

function updateExpressionValue(expression: ExpressionRef, value: string): ExpressionRef {
  const trimmed = value.trim();
  const compareSource = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed)?.[1]?.trim();

  if (compareSource) {
    return {
      source: expression.source,
      operator: expression.operator,
      compareSource
    };
  }

  return {
    source: expression.source,
    operator: expression.operator,
    value: parseExpressionLiteral(value)
  };
}

function parseExpressionLiteral(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function roundDisplayNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

const inspectorShellStyle: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: UI_FONT_FAMILY
};

const inspectorHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  display: "grid",
  gap: 8,
  padding: "12px 12px 10px",
  borderBottom: "1px solid #eef0f3",
  background: "#ffffff"
};

const inspectorSummaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0
};

const inspectorNodeSummaryStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8
};

const pageInspectorHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  display: "grid",
  gap: 10,
  padding: "14px 14px 12px",
  borderBottom: "1px solid #eef0f3",
  background: "#ffffff"
};

const pageHeaderSummaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 0
};

const pageHeaderSummaryStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "1 1 auto"
};

const pageHeaderTextStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 2
};

const pageHeaderNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 650,
  lineHeight: 1.25
};

const pageHeaderActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: "0 0 auto",
  alignSelf: "center"
};

const pageHeaderIconButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  flex: "0 0 auto"
};

const pageHeaderIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "#f7f8fa",
  color: "#64748b",
  flex: "0 0 auto"
};

const pageHeaderSubtitleStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.35
};

const pageHeaderTagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 6,
  minWidth: 0
};

const pageHeaderTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  padding: "0 7px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: 4,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  textAlign: "center",
  whiteSpace: "nowrap"
};

const inspectorNodeIconStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  background: "#f7f8fa",
  color: "#5B5BD6",
  flex: "0 0 auto"
};

const inspectorNodeTextStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1
};

const inspectorNodeNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: UI_TEXT_VALUE,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.25
};

const inspectorNodeTypeStyle: CSSProperties = {
  color: UI_TEXT_HELPER,
  fontSize: 10,
  fontWeight: 400,
  lineHeight: 1.35
};

const inspectorActionGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 1
};

const breadcrumbNavStyle: CSSProperties = {
  minWidth: 0
};

const breadcrumbListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  margin: 0,
  padding: 0,
  listStyle: "none",
  minWidth: 0
};

const breadcrumbItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0
};

const breadcrumbLinkStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 1.25
};

const breadcrumbPageStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 1.25
};

const breadcrumbSeparatorItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#94a3b8",
  flex: "0 0 auto"
};

const breadcrumbSeparatorIconStyle: CSSProperties = {
  width: 14,
  height: 14,
  display: "block"
};

const inspectorMetaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 5
};

const metaPillStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
  padding: "5px 6px",
  border: "1px solid transparent",
  borderRadius: UI_CHROME_RADIUS,
  background: "#fbfcfe",
  boxShadow: "0 0 0 1px rgba(238, 240, 243, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)"
};

const metaLabelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 9,
  lineHeight: 1.2
};

const metaValueStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#334155",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10,
  lineHeight: 1.25
};

const inspectorTabsStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  padding: "0 12px",
  borderBottom: "1px solid #eef0f3",
  background: "#ffffff"
};

const inspectorTabStyle: CSSProperties = {
  position: "relative",
  height: 34,
  border: 0,
  background: "transparent",
  font: `600 12px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const inspectorTabUnderlineStyle: CSSProperties = {
  position: "absolute",
  left: 8,
  right: 8,
  bottom: -1,
  height: 2,
  borderRadius: "2px 2px 0 0",
  background: "#5B5BD6"
};

const inspectorContentStyle: CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  display: "grid",
  alignContent: "start",
  gap: 12,
  padding: 12,
  background: UI_CARD_BODY
};

const inspectorFooterStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "9px 12px",
  borderTop: "1px solid #eef0f3",
  background: "#fbfcfe"
};

const footerTitleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "#334155",
  fontSize: 11,
  fontWeight: 650
};

const footerDetailStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  color: "#64748b",
  fontSize: 10,
  lineHeight: 1.35
};

const sectionStackStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const sectionStyle: CSSProperties = {
  display: "grid",
  padding: 16,
  borderRadius: 12,
  border: `1px solid ${UI_CARD_BORDER}`,
  background: UI_CARD_SURFACE,
  boxShadow: UI_CARD_SHADOW
};

const sectionHeaderRowStyle: CSSProperties = {
  minHeight: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: 0
};

const sectionHeaderToggleStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  minHeight: 20,
  display: "flex",
  alignItems: "center",
  padding: 0,
  border: 0,
  background: "transparent",
  color: UI_TEXT_LABEL,
  cursor: "pointer",
  font: `600 11px/1.2 ${UI_FONT_FAMILY}`,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textAlign: "left"
};

const sectionHeaderTrailingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexShrink: 0
};

const sectionChevronButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer"
};

const sectionHeaderIconButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#64748b",
  cursor: "pointer"
};

const sectionTitleStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const sectionChevronStyle: CSSProperties = {
  width: 16,
  height: 16,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#94a3b8",
  transition: "transform 80ms ease"
};

const sectionBodyStyle: CSSProperties = {
  display: "grid",
  gap: UI_ROW_GAP,
  padding: "14px 0 0"
};

const controlWrapStyle: CSSProperties = {
  display: "grid",
  gap: 4
};

const fieldLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.25
};

const textInputStyle: CSSProperties = {
  height: CTRL_H,
  width: "100%",
  minWidth: 0,
  padding: "0 8px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  outline: "none",
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#0f172a",
  font: `12px/1.2 ${UI_FONT_FAMILY}`
};

const textInputFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const textInputBlurStyle: CSSProperties = {
  borderColor: UI_CHROME_BORDER,
  boxShadow: UI_SURFACE_SHADOW
};

const textAreaStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  resize: "vertical",
  padding: 8,
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  outline: "none",
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#0f172a",
  font: `12px/1.4 ${UI_FONT_FAMILY}`
};

const selectFieldChromeStyle: CSSProperties = {
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  outline: "none"
};

const selectFieldSurfaceStyle: CSSProperties = {
  ...selectFieldChromeStyle,
  borderColor: UI_CHROME_BORDER
};

const selectFieldFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const selectFieldWrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  minWidth: 0,
  height: SELECT_H,
  overflow: "hidden"
};

const selectInnerStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  padding: "0 36px 0 12px",
  border: 0,
  outline: "none",
  background: "transparent",
  boxShadow: "none",
  color: "#0f172a",
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none"
};

const selectStyle: CSSProperties = {
  height: SELECT_H,
  width: "100%",
  minWidth: 0,
  padding: "0 36px 0 12px",
  ...selectFieldChromeStyle,
  color: "#0f172a",
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none"
};

const selectChevronStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 10,
  width: 16,
  height: 16,
  display: "grid",
  placeItems: "center",
  transform: "translateY(-50%)",
  color: "#94a3b8",
  pointerEvents: "none"
};

const selectRootStyle: CSSProperties = {
  position: "relative",
  display: "block",
  width: "100%",
  minWidth: 0
};

const selectRootInlineStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  minWidth: 0
};

const selectTriggerFieldStyle: CSSProperties = {
  height: SELECT_H,
  width: "100%",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 10px 0 12px",
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  color: UI_TEXT_VALUE,
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const selectTriggerInlineStyle: CSSProperties = {
  height: NODE_CTRL_H,
  minWidth: 0,
  maxWidth: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  padding: "0 8px 0 10px",
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  color: UI_TEXT_VALUE,
  font: `500 12px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const selectTriggerLabelStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "left"
};

const selectTriggerChevronStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  color: "#94a3b8"
};

const selectOptionLabelStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const selectOptionCheckStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  color: UI_ACCENT
};

const segmentedStyle: CSSProperties = {
  height: CTRL_H,
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(0, 1fr)",
  gap: 2,
  padding: 3,
  borderRadius: 6,
  background: "#eceef2"
};

const segmentedButtonStyle: CSSProperties = {
  height: CTRL_H - 6,
  minWidth: 0,
  display: "grid",
  placeItems: "center",
  padding: "0 6px",
  border: 0,
  borderRadius: 4,
  font: `650 11px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const toggleRowStyle: CSSProperties = {
  minHeight: CTRL_H,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  fontFamily: UI_FONT_FAMILY
};

const toggleLabelStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12
};

const toggleTrackStyle: CSSProperties = {
  position: "relative",
  width: 32,
  height: 18,
  borderRadius: 999,
  transition: "background 80ms ease",
  flex: "0 0 auto"
};

const toggleThumbStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  left: 2,
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.22)",
  transition: "transform 100ms ease"
};

const rangeRowStyle: CSSProperties = {
  height: CTRL_H,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 40px",
  alignItems: "center",
  gap: 8
};

const rangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#5B5BD6"
};

const rangeValueStyle: CSSProperties = {
  color: "#0f172a",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 11,
  textAlign: "right"
};

const twoColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8
};

const readOnlyRowStyle: CSSProperties = {
  minHeight: 24,
  display: "grid",
  gridTemplateColumns: "86px minmax(0, 1fr)",
  gap: 8,
  alignItems: "center"
};

const pageSectionRowsStyle: CSSProperties = {
  display: "grid",
  gap: INSPECTOR_ROW_GAP
};

const pageSectionHintStyle: CSSProperties = {
  margin: `${INSPECTOR_HINT_GAP}px 0 0`,
  color: "#94a3b8",
  fontSize: 10,
  lineHeight: 1.35
};

const pageInlineRowStyle: CSSProperties = {
  display: "grid",
  gap: INSPECTOR_INLINE_GAP,
  alignItems: "end"
};

const pageInlineFieldStyle: CSSProperties = {
  display: "grid",
  gap: INSPECTOR_FIELD_GAP,
  minWidth: 0
};

const pageInlineLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.25
};

const pageFieldChromeStyle: CSSProperties = {
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  outline: "none"
};

const pageSelectSurfaceStyle: CSSProperties = {
  ...pageFieldChromeStyle,
  borderColor: UI_CHROME_BORDER
};

const pageSelectWrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  minWidth: 0,
  height: PAGE_CTRL_H,
  overflow: "hidden"
};

const pageSelectInnerStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  padding: "0 36px 0 12px",
  border: 0,
  outline: "none",
  background: "transparent",
  boxShadow: "none",
  color: "#0f172a",
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none"
};

const pageSelectStyle: CSSProperties = {
  height: PAGE_CTRL_H,
  width: "100%",
  minWidth: 0,
  padding: "0 36px 0 12px",
  ...pageFieldChromeStyle,
  color: "#0f172a",
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none"
};

const pageSelectFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const pageSelectChevronStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 10,
  width: 16,
  height: 16,
  display: "grid",
  placeItems: "center",
  transform: "translateY(-50%)",
  color: "#94a3b8",
  pointerEvents: "none"
};

const pageNumberWrapStyle: CSSProperties = {
  height: PAGE_CTRL_H,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "stretch",
  overflow: "hidden"
};

const pageNumberSurfaceStyle: CSSProperties = {
  ...pageFieldChromeStyle,
  borderColor: UI_CHROME_BORDER
};

const pageNumberFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const pageNumberInputStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  padding: "0 10px",
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  font: `500 13px/1.2 ${UI_FONT_FAMILY}`
};

const pageStepperStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "1fr 1fr",
  width: 22,
  borderLeft: "1px solid #e2e8f0"
};

const pageStepperButtonStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "#f8fafc",
  color: "#64748b",
  font: `600 10px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const pageColorWrapStyle: CSSProperties = {
  height: PAGE_CTRL_H,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  padding: "0 10px 0 6px",
  ...pageFieldChromeStyle
};

const pageColorSwatchInputStyle: CSSProperties = {
  width: 20,
  height: 20,
  padding: 0,
  border: "1px solid #e2e8f0",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer"
};

const pageColorTextStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  padding: 0,
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  font: `500 12px/1.2 ${UI_MONO_FONT_FAMILY}`,
  textTransform: "uppercase"
};

const pageSegmentedStyle: CSSProperties = {
  height: PAGE_CTRL_H,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 2,
  padding: 3,
  borderRadius: UI_CHROME_RADIUS,
  border: "1px solid transparent",
  background: "#eceef2",
  boxShadow: "0 0 0 1px rgba(232, 236, 241, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)"
};

const pageSegmentedButtonStyle: CSSProperties = {
  height: PAGE_CTRL_H - 8,
  minWidth: 0,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 5,
  cursor: "pointer"
};

const orientationGlyphStyle: CSSProperties = {
  display: "block",
  border: "1.5px solid currentColor",
  borderRadius: 2,
  boxSizing: "border-box"
};

const pageMarginsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: INSPECTOR_INLINE_GAP,
  alignItems: "end"
};

const pageMarginsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: INSPECTOR_INLINE_GAP,
  minWidth: 0
};

const pageLinkButtonStyle: CSSProperties = {
  width: PAGE_CTRL_H,
  height: PAGE_CTRL_H,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "1px solid transparent",
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: "0 0 0 1px rgba(232, 236, 241, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)",
  cursor: "pointer",
  flex: "0 0 auto"
};

const pageToggleStackStyle: CSSProperties = {
  display: "grid",
  gap: INSPECTOR_TOGGLE_STACK_GAP
};

const pageToggleValueRowStyle: CSSProperties = {
  minHeight: PAGE_CTRL_H,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: INSPECTOR_INLINE_GAP,
  alignItems: "center"
};

const pageToggleValueLabelStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  lineHeight: 1.25
};

const pageToggleValueControlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "0 0 auto"
};

const pageToggleValueSwitchWrapStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer"
};

const pageToggleValueInputWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px auto",
  gap: 6,
  alignItems: "center"
};

const pageToggleValueUnitStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  whiteSpace: "nowrap"
};

const fieldValueStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 11
};

const iconButtonStyle: CSSProperties = {
  width: CTRL_H,
  height: CTRL_H,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent"
};

const iconWrapStyle: CSSProperties = {
  width: 14,
  height: 14,
  display: "grid",
  placeItems: "center"
};

const noticeStyle: CSSProperties = {
  marginTop: 10,
  padding: 8,
  borderRadius: 7,
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#3730a3",
  fontSize: 11,
  lineHeight: 1.4
};

const colorRowWrapStyle: CSSProperties = {
  display: "grid",
  gap: 4
};

const colorRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "end",
  gap: 8
};

const colorSwatchStyle: CSSProperties = {
  width: CTRL_H,
  height: CTRL_H,
  borderRadius: 6,
  border: "1px solid #e3e6eb",
  flex: "0 0 auto"
};

const bindingListStyle: CSSProperties = {
  display: "grid",
  gap: 6
};

const bindingExplorerGroupStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  paddingBottom: 8,
  borderBottom: "1px solid #eef0f3"
};

const bindingFieldButtonStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
  gap: 8,
  alignItems: "center",
  padding: "7px 8px",
  border: "1px solid transparent",
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: "0 0 0 1px rgba(238, 240, 243, 0.95), 0 1px 2px rgba(15, 23, 42, 0.03)",
  textAlign: "left",
  cursor: "pointer",
  outline: "none"
};

const bindingFieldButtonFocusStyle: CSSProperties = {
  background: UI_SELECTION_BG,
  boxShadow: UI_SELECTION_RING
};

const bindingFieldNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#334155",
  fontSize: 11,
  fontWeight: 600
};

const bindingFieldPathStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#64748b",
  fontFamily: UI_MONO_FONT_FAMILY,
  fontSize: 10
};

const sectionLabelStyle: CSSProperties = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.4
};

const lowRiskPillStyle: CSSProperties = {
  justifySelf: "start",
  padding: "2px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 10,
  fontWeight: 600
};

const secondaryButtonStyle: CSSProperties = {
  height: CTRL_H,
  justifySelf: "start",
  padding: "0 10px",
  border: "1px solid #e3e6eb",
  borderRadius: 6,
  background: "#ffffff",
  color: "#4f46e5",
  font: `600 11px/1 ${UI_FONT_FAMILY}`,
  cursor: "pointer"
};

const conditionCardStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 8,
  border: "1px solid #eef0f3",
  borderRadius: 8,
  background: "#fbfcfe"
};

const gridColumnListStyle: CSSProperties = {
  display: "grid",
  gap: 8
};

const gridColumnCardStyle: CSSProperties = {
  ...conditionCardStyle,
  gap: 8
};

const gridInlineActionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8
};

const conditionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};

const conditionTitleStyle: CSSProperties = {
  color: "#334155",
  fontSize: 11,
  fontWeight: 600
};

const inlineButtonGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2
};

const miniActionButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "1px solid #e3e6eb",
  borderRadius: 5,
  background: "#ffffff",
  color: "#64748b",
  cursor: "pointer"
};

const anchorGridStyle: CSSProperties = {
  width: "max-content",
  display: "grid",
  gridTemplateColumns: "repeat(3, 24px)",
  gap: 3,
  padding: 3,
  borderRadius: 6,
  background: "#eceef2"
};

const anchorButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: 4,
  cursor: "pointer"
};

const anchorDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  transition: "transform 100ms ease, background 100ms ease"
};

const pageDataSectionRowsStyle: CSSProperties = {
  display: "grid",
  gap: 8
};

const horizontalFieldRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "108px minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  minHeight: PAGE_CTRL_H
};

const horizontalFieldLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.25
};

const horizontalFieldControlStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center"
};

const horizontalReadOnlyValueStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: PAGE_CTRL_H,
  width: "100%",
  minWidth: 0,
  padding: "0 10px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#f8fafc",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#64748b",
  font: `500 12px/1.2 ${UI_MONO_FONT_FAMILY}`,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const horizontalTextInputStyle: CSSProperties = {
  height: PAGE_CTRL_H,
  width: "100%",
  minWidth: 0,
  padding: "0 10px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  outline: "none",
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  color: "#0f172a",
  font: `500 12px/1.2 ${UI_FONT_FAMILY}`
};

const horizontalTextInputFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const horizontalTextInputBlurStyle: CSSProperties = {
  borderColor: UI_CHROME_BORDER,
  boxShadow: UI_SURFACE_SHADOW
};

const sampleDataSourceWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  height: PAGE_CTRL_H,
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW,
  overflow: "hidden"
};

const sampleDataSourceInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: "100%",
  padding: "0 10px",
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  font: `500 12px/1.2 ${UI_FONT_FAMILY}`
};

const sampleDataSourceLinkStyle: CSSProperties = {
  width: 32,
  height: "100%",
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderLeft: `1px solid ${UI_CHROME_BORDER}`,
  background: "transparent",
  color: "#64748b",
  cursor: "pointer",
  flexShrink: 0
};

const variableSearchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: PAGE_CTRL_H,
  padding: "0 10px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#ffffff",
  boxShadow: UI_SURFACE_SHADOW
};

const variableSearchFocusStyle: CSSProperties = {
  borderColor: "#dbeafe",
  boxShadow: UI_FOCUS_RING_SHADOW
};

const variableSearchBlurStyle: CSSProperties = {
  borderColor: UI_CHROME_BORDER,
  boxShadow: UI_SURFACE_SHADOW
};

const variableSearchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: "100%",
  padding: 0,
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  font: `500 12px/1.2 ${UI_FONT_FAMILY}`
};

const variableListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  overflow: "hidden",
  boxShadow: UI_SURFACE_SHADOW
};

const variableRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr) auto 28px",
  gap: 8,
  alignItems: "center",
  minHeight: 34,
  padding: "0 8px 0 6px",
  borderBottom: `1px solid ${UI_CHROME_BORDER}`,
  background: "#ffffff"
};

const variableRowIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  color: "#94a3b8"
};

const variableRowPathStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
  font: `500 12px/1.2 ${UI_MONO_FONT_FAMILY}`
};

const variableTypePillStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.2,
  whiteSpace: "nowrap"
};

const variableRowMenuStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer"
};

const sampleEditorShellStyle: CSSProperties = {
  display: "grid",
  gap: 6
};

const sampleEditorToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 600
};

const sampleEditorApplyButtonStyle: CSSProperties = {
  height: 26,
  padding: "0 9px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: 5,
  background: "#ffffff",
  color: "#4338ca",
  boxShadow: UI_SURFACE_SHADOW,
  font: `600 11px/1 ${UI_FONT_FAMILY}`
};

const sampleEditorTextAreaStyle: CSSProperties = {
  width: "100%",
  minHeight: 190,
  maxHeight: 280,
  resize: "vertical",
  padding: "9px 10px",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  outline: "none",
  background: "#0f172a",
  color: "#e2e8f0",
  boxShadow: UI_SURFACE_SHADOW,
  font: `500 11px/1.5 ${UI_MONO_FONT_FAMILY}`,
  tabSize: 2
};

const sampleEditorTextAreaFocusStyle: CSSProperties = {
  boxShadow: UI_FOCUS_RING_SHADOW
};

const sampleEditorErrorStyle: CSSProperties = {
  color: "#b91c1c",
  fontSize: 11,
  lineHeight: 1.35
};

const sampleEditorHintStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  lineHeight: 1.35
};

const samplePreviewShellStyle: CSSProperties = {
  position: "relative",
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: UI_CHROME_RADIUS,
  background: "#f8fafc",
  boxShadow: UI_SURFACE_SHADOW,
  overflow: "hidden"
};

const samplePreviewCopyStyle: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  zIndex: 1,
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: `1px solid ${UI_CHROME_BORDER}`,
  borderRadius: 4,
  background: "#ffffff",
  color: "#64748b",
  cursor: "pointer",
  boxShadow: UI_SURFACE_SHADOW
};

const samplePreviewScrollStyle: CSSProperties = {
  maxHeight: 160,
  overflow: "auto",
  padding: "8px 0"
};

const samplePreviewLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr)",
  gap: 0,
  alignItems: "start",
  minHeight: 18
};

const samplePreviewGutterStyle: CSSProperties = {
  padding: "0 8px 0 10px",
  color: "#94a3b8",
  font: `500 11px/1.6 ${UI_MONO_FONT_FAMILY}`,
  textAlign: "right",
  userSelect: "none"
};

const samplePreviewCodeStyle: CSSProperties = {
  margin: 0,
  padding: "0 10px 0 0",
  color: "#334155",
  font: `500 11px/1.6 ${UI_MONO_FONT_FAMILY}`,
  whiteSpace: "pre"
};

const sampleJsonKeyStyle: CSSProperties = {
  color: "#c2410c"
};

const sampleJsonStringStyle: CSSProperties = {
  color: "#059669"
};

const sampleJsonNumberStyle: CSSProperties = {
  color: "#2563eb"
};

const tokenColorSelectWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minWidth: 0
};

const tokenColorDotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  flexShrink: 0,
  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)"
};

const nodeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0
};

const nodeRowLabelStyle: CSSProperties = {
  flexShrink: 0,
  color: UI_TEXT_LABEL,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.25
};

const nodeRowControlStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8
};

const nodePairRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  minWidth: 0
};

const nodeInputShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  padding: "0 12px",
  borderRadius: NODE_RADIUS
};

const nodeInputFieldStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: UI_TEXT_VALUE,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.2
};

const textInsertMenuShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: NODE_CTRL_H,
  padding: "0 8px",
  borderRadius: NODE_RADIUS,
  flexShrink: 0
};

const textInsertSelectStyle: CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  color: UI_TEXT_VALUE,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.2,
  maxWidth: 96,
  cursor: "pointer"
};

const nodeInputSuffixStyle: CSSProperties = {
  flexShrink: 0,
  color: UI_TEXT_HELPER,
  fontSize: 11,
  fontWeight: 400
};

const nodeMetricRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8
};

const nodeMetricFieldStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0
};

const nodeMetricLabelStyle: CSSProperties = {
  color: UI_TEXT_LABEL,
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.2
};

const nodeReadonlyFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  padding: "0 12px",
  borderRadius: NODE_RADIUS,
  border: `1px solid ${UI_DISABLED_BORDER}`,
  background: UI_DISABLED_BG,
  color: UI_TEXT_HELPER,
  fontSize: 12,
  fontWeight: 400,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const nodeSelectWrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  borderRadius: NODE_RADIUS,
  overflow: "hidden"
};

const nodeSelectInnerStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  padding: "0 30px 0 12px",
  border: 0,
  outline: "none",
  background: "transparent",
  color: UI_TEXT_VALUE,
  fontSize: 12,
  fontWeight: 400,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none"
};

const nodeSelectChevronStyle: CSSProperties = {
  position: "absolute",
  right: 9,
  top: "50%",
  transform: "translateY(-50%)",
  display: "grid",
  placeItems: "center",
  color: UI_TEXT_HELPER,
  pointerEvents: "none"
};

const nodeSegmentedStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minWidth: 0
};

const nodeSegmentedButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  padding: "0 4px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  position: "relative",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const nodeBareToggleStyle: CSSProperties = {
  position: "relative",
  width: 34,
  height: 20,
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  flexShrink: 0
};

const nodeToggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 24
};

const nodeToggleRowLabelStyle: CSSProperties = {
  color: UI_TEXT_LABEL,
  fontSize: 12,
  fontWeight: 400
};

const nodeInlineControlRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
};

const nodeColorFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  padding: "0 10px",
  borderRadius: NODE_RADIUS
};

const nodeColorSwatchWrapStyle: CSSProperties = {
  position: "relative",
  width: 18,
  height: 18,
  flexShrink: 0
};

const nodeColorSwatchStyle: CSSProperties = {
  display: "block",
  width: 18,
  height: 18,
  borderRadius: 4,
  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)"
};

const nodeColorSwatchTransparentStyle: CSSProperties = {
  display: "block",
  width: 18,
  height: 18,
  borderRadius: 4,
  background: "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 0 / 9px 9px",
  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)"
};

const nodeColorInputOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  padding: 0,
  border: 0,
  opacity: 0,
  cursor: "pointer"
};

const nodeColorTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: "#111827",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const nodeColorClearStyle: CSSProperties = {
  width: 20,
  height: 20,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#9ca3af",
  cursor: "pointer",
  flexShrink: 0
};

const nodeStepperShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: 84,
  height: NODE_CTRL_H,
  borderRadius: NODE_RADIUS,
  overflow: "hidden"
};

const nodeStepperInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: "100%",
  padding: "0 10px",
  border: 0,
  outline: "none",
  background: "transparent",
  color: UI_TEXT_VALUE,
  fontSize: 12,
  fontWeight: 400
};

const nodeStepperButtonsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  paddingRight: 4
};

const nodeStepperButtonStyle: CSSProperties = {
  width: 16,
  height: 13,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#9ca3af",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer"
};

const nodeAdjacentIconButtonStyle: CSSProperties = {
  width: NODE_CTRL_H + 4,
  height: NODE_CTRL_H,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  padding: 0,
  borderRadius: NODE_RADIUS,
  border: `1px solid ${UI_REST_BORDER}`,
  background: UI_CARD_SURFACE,
  color: UI_TEXT_LABEL,
  cursor: "pointer"
};

const nodeGhostIconButtonStyle: CSSProperties = {
  width: 28,
  height: NODE_CTRL_H,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: UI_TEXT_HELPER,
  cursor: "pointer"
};

const nodeSearchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: NODE_CTRL_H,
  padding: "0 12px",
  borderRadius: NODE_RADIUS,
  color: UI_TEXT_HELPER
};

const nodeSearchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: "none",
  background: "transparent",
  color: UI_TEXT_VALUE,
  fontSize: 12,
  fontWeight: 400
};

const nodeFieldListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column"
};

const nodeExplorerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 4px",
  borderBottom: "1px solid #f1f3f5"
};

const nodeExplorerTreeToggleStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer"
};

const nodeExplorerTreeSpacerStyle: CSSProperties = {
  width: 18,
  height: 18,
  flexShrink: 0
};

const nodeExplorerIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  color: "#5B5BD6",
  flexShrink: 0
};

const nodeExplorerPathStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: "#111827",
  fontSize: 12,
  fontFamily: UI_MONO_FONT_FAMILY,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const nodeExplorerTypeStyle: CSSProperties = {
  flexShrink: 0,
  color: "#9ca3af",
  fontSize: 11
};

const nodeExplorerActionStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#64748b",
  cursor: "pointer"
};

const nodeChipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const nodeChipButtonStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 7,
  border: `1px solid ${UI_REST_BORDER}`,
  background: UI_CARD_SURFACE,
  color: UI_TEXT_LABEL,
  fontSize: 11,
  fontWeight: 500,
  fontFamily: UI_MONO_FONT_FAMILY,
  cursor: "pointer"
};

const nodeHintStyle: CSSProperties = {
  margin: 0,
  color: UI_TEXT_HELPER,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.4
};

const nodeDiagnosticRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 22
};

const nodeDiagnosticValueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#111827",
  fontSize: 12
};

const nodeDiagnosticDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0
};

const nodeDangerButtonStyle: CSSProperties = {
  width: "100%",
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 9,
  border: "1px solid #ef4444",
  background: "#ffffff",
  color: "#ef4444",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer"
};

const nodeAccentButtonStyle: CSSProperties = {
  width: "100%",
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 9,
  border: "1px solid #5B5BD6",
  background: "#ffffff",
  color: "#5B5BD6",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer"
};

const nodeSamplePreviewShellStyle: CSSProperties = {
  position: "relative",
  borderRadius: 10,
  background: "#0f172a",
  padding: "12px 12px 12px 0",
  overflow: "hidden"
};

const nodeSamplePreviewCopyStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 1,
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  padding: 0,
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.06)",
  color: "#94a3b8",
  cursor: "pointer"
};

const nodeSamplePreviewScrollStyle: CSSProperties = {
  maxHeight: 180,
  overflow: "auto"
};

const nodeSamplePreviewLineStyle: CSSProperties = {
  display: "flex",
  minHeight: 18
};

const nodeSamplePreviewGutterStyle: CSSProperties = {
  width: 32,
  flexShrink: 0,
  paddingRight: 12,
  textAlign: "right",
  color: "#475569",
  userSelect: "none",
  font: `500 11px/1.7 ${UI_MONO_FONT_FAMILY}`
};

const nodeSamplePreviewCodeStyle: CSSProperties = {
  margin: 0,
  color: "#e2e8f0",
  font: `500 11px/1.7 ${UI_MONO_FONT_FAMILY}`,
  whiteSpace: "pre"
};

const darkJsonKeyStyle: CSSProperties = {
  color: "#f87171"
};

const darkJsonStringStyle: CSSProperties = {
  color: "#4ade80"
};

const darkJsonNumberStyle: CSSProperties = {
  color: "#60a5fa"
};

const nodeSliderStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 3,
  accentColor: "#5B5BD6",
  cursor: "pointer"
};

const imageAlignmentRowStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start"
};

const imageAlignmentControlsStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0
};

const imageAnchorColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "flex-start",
  flexShrink: 0
};

const imageAnchorLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 400,
  color: UI_TEXT_LABEL
};

const nodeAnchorGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  padding: 12,
  borderRadius: NODE_RADIUS,
  border: `1px solid ${UI_REST_BORDER}`,
  background: UI_CARD_SURFACE
};

const nodeAnchorDotStyle: CSSProperties = {
  width: 13,
  height: 13,
  borderRadius: 999,
  padding: 0,
  cursor: "pointer",
  border: "1.5px solid #cbd5e1"
};

const nodeOutlineButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: NODE_CTRL_H,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 12px",
  borderRadius: NODE_RADIUS,
  border: `1px solid ${UI_REST_BORDER}`,
  background: UI_CARD_SURFACE,
  color: UI_TEXT_LABEL,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer"
};

const nodeSourceCardStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  padding: 12,
  borderRadius: 10,
  border: `1px solid ${UI_REST_BORDER}`,
  background: UI_CARD_SURFACE,
  alignItems: "flex-start"
};

const nodeSourceThumbStyle: CSSProperties = {
  width: 96,
  height: 72,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
  color: "#5B5BD6"
};

const nodeSourceInfoStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
  paddingTop: 2
};

const nodeSourceNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: UI_TEXT_VALUE,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const nodeSourceMetaStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 400,
  color: UI_TEXT_HELPER
};

const nodeSourceReplaceStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  alignSelf: "flex-start",
  padding: 0,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  color: "#5B5BD6"
};
