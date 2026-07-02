export type DocumentUnit = "px";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Frame extends Point, Size {}

export interface PagePreset extends Size {
  id: "letter" | "a4" | string;
  label: string;
  unit: DocumentUnit;
}

export const PAGE_PRESETS = {
  letter: {
    id: "letter",
    label: "Letter",
    width: 816,
    height: 1056,
    unit: "px"
  },
  a4: {
    id: "a4",
    label: "A4",
    width: 794,
    height: 1123,
    unit: "px"
  }
} as const satisfies Record<string, PagePreset>;

export type LayerKind = "background" | "fixed" | "flow";

export interface DocumentTemplate {
  id: string;
  version: string;
  unit: DocumentUnit;
  pages: PageTemplate[];
  fonts?: FontDefinition[];
  assets?: AssetDefinition[];
  variables?: VariableDefinition[];
  dataSchema?: DataSchema;
  metadata?: Record<string, unknown>;
}

export interface PageTemplate {
  id: string;
  name?: string;
  size: Size;
  margin?: Box;
  layers: PageLayer[];
}

export interface PageLayer {
  id: string;
  kind: LayerKind;
  nodes: DocNode[];
}

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type DocNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | BarcodeNode
  | QrNode
  | GroupNode
  | FlowRegionNode
  | StackNode
  | RepeatNode
  | ConditionalNode
  | GridNode;

export interface BaseNode {
  id: string;
  type: string;
  frame: Frame;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface TextNode extends BaseNode {
  type: "text";
  content: InlineContent[];
  style: TextStyle;
  overflow?: "clip" | "wrap" | "shrink" | "continue";
}

export type InlineContent = TextRun | FieldRun;

export interface TextRun {
  kind: "text";
  text: string;
}

export interface FieldRun {
  kind: "field";
  label: string;
  binding: BindingRef;
  fallback?: string;
  format?: FieldFormat;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  lineHeight?: number;
  color?: string;
  align?: "left" | "center" | "right" | "justify";
  letterSpacing?: number;
}

export type FieldFormat =
  | { type: "text"; transform?: "none" | "uppercase" | "lowercase" | "capitalize" }
  | { type: "currency"; currency: string; locale?: string }
  | { type: "date"; locale?: string; dateStyle?: "short" | "medium" | "long" | "full" }
  | { type: "number"; locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number };

export interface ImageNode extends BaseNode {
  type: "image";
  source: ImageSource;
  fit?: "cover" | "contain" | "fill" | "none";
  alt?: string;
}

export type ImageSource =
  | { kind: "asset"; assetId: string }
  | { kind: "url"; url: string }
  | { kind: "binding"; binding: BindingRef };

export interface ShapeNode extends BaseNode {
  type: "shape";
  shape: "rectangle" | "ellipse" | "line";
  style: ShapeStyle;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export interface BarcodeNode extends BaseNode {
  type: "barcode";
  format: "code128" | "ean13" | "upc" | string;
  value: DynamicValue;
}

export interface QrNode extends BaseNode {
  type: "qr";
  value: DynamicValue;
}

export interface GroupNode extends BaseNode {
  type: "group";
  children: DocNode[];
}

export interface FlowRegionNode extends BaseNode {
  type: "flowRegion";
  flowBoundary?: "frame" | "page-margin";
  children: FlowNode[];
}

export type FlowNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | BarcodeNode
  | QrNode
  | StackNode
  | RepeatNode
  | ConditionalNode
  | GridNode
  | GroupNode;

export interface StackNode extends BaseNode {
  type: "stack";
  direction: "vertical" | "horizontal";
  gap: number;
  children: FlowNode[];
}

export interface RepeatNode extends BaseNode {
  type: "repeat";
  binding: BindingRef;
  itemAlias: string;
  layout: RepeatLayout;
  children: FlowNode[];
  emptyState?: FlowNode[];
}

export interface RepeatLayout {
  direction: "vertical" | "horizontal";
  gap: number;
  splitItems?: boolean;
  rowSizing?: "fixed" | "compact";
  minRowHeight?: number;
  maxCompressionRatio?: number;
  fillAvailableSpace?: boolean;
  maxExpansionRatio?: number;
}

export interface ConditionalNode extends BaseNode {
  type: "conditional";
  condition: ExpressionRef;
  children: FlowNode[];
  fallback?: FlowNode[];
}

export interface GridNode extends BaseNode {
  type: "grid";
  binding?: BindingRef;
  columns: GridColumn[];
  rowHeight: number;
  header?: GridRowTemplate;
  row: GridRowTemplate;
  footer?: GridRowTemplate;
  behavior?: GridBehavior;
}

export interface GridColumn {
  id: string;
  label?: string;
  width: number;
}

export interface GridRowTemplate {
  cells: GridCellTemplate[];
}

export interface GridCellTemplate {
  columnId: string;
  content: FlowNode[];
  style?: ShapeStyle;
}

export interface GridBehavior {
  repeatHeaderOnPageBreak?: boolean;
  allowRowSplit?: boolean;
}

export interface BindingRef {
  path: string;
}

export interface ExpressionRef {
  source: string;
}

export type DynamicValue =
  | { kind: "literal"; value: string }
  | { kind: "binding"; binding: BindingRef }
  | { kind: "template"; parts: InlineContent[] };

export interface VariableDefinition {
  id: string;
  name: string;
  value: DynamicValue;
  category?: "design" | "data" | "computed" | "runtime";
}

export interface AssetDefinition {
  id: string;
  kind: "image" | "font";
  name: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface FontDefinition {
  id: string;
  family: string;
  source?: FontSource;
  fallback?: string;
  weights?: Array<number | string>;
}

export type FontSource =
  | { kind: "css-url"; url: string }
  | { kind: "google-font"; family: string; weights?: Array<number | string>; display?: "auto" | "block" | "swap" | "fallback" | "optional" }
  | { kind: "system" };

export interface DataSchema {
  fields: DataField[];
}

export interface DataField {
  path: string;
  label: string;
  kind: "string" | "number" | "boolean" | "date" | "array" | "object" | "image" | "unknown";
  children?: DataField[];
}
