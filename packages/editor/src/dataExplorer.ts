import type {
  BarcodeNode,
  DataField,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  FlowNode,
  Frame,
  GridNode,
  ImageNode,
  QrNode,
  RepeatNode,
  TextNode
} from "@templara/core";
import type { EditorNodeItem } from "./editorModel";

export type EditableNode = DocNode | FlowNode;
export type DataExplorerKind = "text" | "number" | "date" | "boolean" | "image" | "array" | "object" | "unknown";
export type DataExplorerSource = "schema" | "sample" | "scope" | "variable";
export type DataExplorerGroupId = "scope" | "document" | "variables";

export interface DataExplorerField {
  id: string;
  label: string;
  path: string;
  kind: DataExplorerKind;
  source: DataExplorerSource;
  depth: number;
  bindable: boolean;
  parentPath?: string;
  hasChildren?: boolean;
  childCount?: number;
  displayPath?: string;
}

export interface DataExplorerGroup {
  id: DataExplorerGroupId;
  title: string;
  detail?: string;
  fields: DataExplorerField[];
}

export interface DataScope {
  alias: string;
  bindingPath: string;
  source: "repeat" | "grid";
}

export interface DataExplorerModel {
  groups: DataExplorerGroup[];
  selectedScope?: DataScope;
  allFields: DataExplorerField[];
}

export interface BuildDataExplorerOptions {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  nodeItems?: EditorNodeItem[];
  selectedNodeIds?: string[];
}

const TEXT_NODE_STYLE: TextNode["style"] = {
  fontFamily: "Geist",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.2,
  color: "#111827"
};

export function buildDataExplorerModel({
  template,
  data,
  nodeItems = [],
  selectedNodeIds = []
}: BuildDataExplorerOptions): DataExplorerModel {
  const selectedScope = resolveSelectedDataScope(nodeItems, selectedNodeIds);
  const documentFields = decorateFieldHierarchy(
    mergeExplorerFields(
      flattenSchemaFields(template.dataSchema?.fields ?? [], "schema"),
      inferFieldsFromSample(data, "", 0, "sample")
    )
  );
  const variableFields = decorateFieldHierarchy(fieldsFromVariables(template));
  const scopeFields = selectedScope ? fieldsForScope(template, data, selectedScope) : [];
  const groups: DataExplorerGroup[] = [];

  if (scopeFields.length > 0 && selectedScope) {
    groups.push({
      id: "scope",
      title: "Current Scope",
      detail: `${selectedScope.alias} from ${selectedScope.bindingPath}`,
      fields: scopeFields
    });
  }

  groups.push({
    id: "document",
    title: "Document Data",
    detail: `${documentFields.length} fields`,
    fields: documentFields
  });

  if (variableFields.length > 0) {
    groups.push({
      id: "variables",
      title: "Variables",
      detail: `${variableFields.length} variables`,
      fields: variableFields
    });
  }

  return {
    groups,
    selectedScope,
    allFields: groups.flatMap((group) => group.fields)
  };
}

export function resolveSelectedDataScope(nodeItems: EditorNodeItem[], selectedNodeIds: string[]): DataScope | undefined {
  if (selectedNodeIds.length !== 1) {
    return undefined;
  }

  const selected = nodeItems.find((item) => item.id === selectedNodeIds[0]);

  if (!selected) {
    return undefined;
  }

  const ancestors = nodeItems
    .filter((item) => item.id === selected.id || selected.path.startsWith(`${item.path}.`))
    .filter((item) => item.node.type === "repeat" || item.node.type === "grid")
    .sort((a, b) => b.path.length - a.path.length);
  const nearest = ancestors[0];

  if (!nearest) {
    return undefined;
  }

  if (nearest.node.type === "repeat") {
    const alias = nearest.node.itemAlias || nearest.node.binding.path.split(".").at(-1) || "item";

    return {
      alias,
      bindingPath: nearest.node.binding.path,
      source: "repeat"
    };
  }

  if (nearest.node.type === "grid" && nearest.node.binding?.path) {
    return {
      alias: "item",
      bindingPath: nearest.node.binding.path,
      source: "grid"
    };
  }

  return undefined;
}

export function applyDataBindingToNode(node: EditableNode, path: string): void {
  if (node.type === "text") {
    node.content = path ? [{ kind: "field", label: path, binding: { path } }] : [];
    return;
  }

  if (node.type === "repeat") {
    node.binding.path = path;
    return;
  }

  if (node.type === "grid") {
    node.binding = path ? { path } : undefined;
    return;
  }

  if (node.type === "image") {
    node.source = path ? { kind: "binding", binding: { path } } : { kind: "url", url: "" };
    return;
  }

  if (node.type === "barcode" || node.type === "qr") {
    node.value = path ? { kind: "binding", binding: { path } } : { kind: "literal", value: "" };
  }
}

export function isNodeBindable(node: EditableNode): node is TextNode | RepeatNode | GridNode | ImageNode | BarcodeNode | QrNode {
  return node.type === "text" || node.type === "repeat" || node.type === "grid" || node.type === "image" || node.type === "barcode" || node.type === "qr";
}

export function isFieldBindableForNode(field: DataExplorerField, node?: EditableNode): boolean {
  if (!field.bindable) {
    return false;
  }

  if (!node) {
    return field.kind !== "array" && field.kind !== "object";
  }

  if (node.type === "repeat" || node.type === "grid") {
    return field.kind === "array";
  }

  if (node.type === "text" || node.type === "barcode" || node.type === "qr" || node.type === "image") {
    return field.kind !== "array" && field.kind !== "object";
  }

  return false;
}

export function createBoundTextNode(id: string, path: string, point: Pick<Frame, "x" | "y">): TextNode {
  return {
    id,
    type: "text",
    frame: {
      x: Math.max(0, Math.round(point.x)),
      y: Math.max(0, Math.round(point.y)),
      width: Math.max(132, Math.min(280, path.length * 7 + 28)),
      height: 20
    },
    content: [{ kind: "field", label: path, binding: { path } }],
    style: TEXT_NODE_STYLE
  };
}

export function sampleValueForBindingPath(
  data: Record<string, unknown> | undefined,
  path: string,
  scope?: DataScope
): unknown {
  if (!path) {
    return undefined;
  }

  if (scope && path.startsWith(`${scope.alias}.`)) {
    return valueAtPath(data, `${scope.bindingPath}.${path.slice(scope.alias.length + 1)}`);
  }

  return valueAtPath(data, path);
}

export function formatDataSampleValue(value: unknown): string {
  if (value == null) return "none";
  if (typeof value === "string") return value || "empty";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return "object";
}

function fieldsForScope(template: DocumentTemplate, data: Record<string, unknown> | undefined, scope: DataScope): DataExplorerField[] {
  const sampleFields = inferScopeFieldsFromSample(data, scope);
  const schemaFields = inferScopeFieldsFromSchema(template.dataSchema?.fields ?? [], scope);

  return decorateFieldHierarchy(
    mergeExplorerFields(schemaFields, sampleFields).map((field) => ({
      ...field,
      source: "scope" as const
    }))
  );
}

function inferScopeFieldsFromSchema(fields: DataField[], scope: DataScope): DataExplorerField[] {
  const matched = findSchemaField(fields, scope.bindingPath);

  if (matched?.children?.length) {
    return flattenSchemaFields(matched.children, "scope").map((field) => {
      const scopedPath = field.path.startsWith(`${scope.bindingPath}.`)
        ? `${scope.alias}.${field.path.slice(scope.bindingPath.length + 1)}`
        : joinDataPath(scope.alias, field.path);

      return {
        ...field,
        id: `scope:${scopedPath}`,
        path: scopedPath,
        source: "scope" as const
      };
    });
  }

  const descendants = flattenSchemaFields(fields, "scope")
    .filter((field) => field.path.startsWith(`${scope.bindingPath}.`))
    .map((field) => ({
      ...field,
      path: `${scope.alias}.${field.path.slice(scope.bindingPath.length + 1)}`,
      id: `scope:${scope.alias}.${field.path.slice(scope.bindingPath.length + 1)}`,
      depth: Math.max(0, field.depth - 1),
      source: "scope" as const
    }));

  return descendants;
}

function inferScopeFieldsFromSample(data: Record<string, unknown> | undefined, scope: DataScope): DataExplorerField[] {
  const sample = valueAtPath(data, scope.bindingPath);
  const first = Array.isArray(sample) ? sample[0] : undefined;

  if (!isRecord(first)) {
    return [];
  }

  return inferFieldsFromSample(first, scope.alias, 0, "scope");
}

function flattenSchemaFields(fields: DataField[], source: DataExplorerSource, pathPrefix?: string, depth = 0): DataExplorerField[] {
  return fields.flatMap((field) => {
    const path = joinDataPath(pathPrefix, field.path);
    const current = fieldFromDataField(field, path, source, depth);

    return [current, ...flattenSchemaFields(field.children ?? [], source, path, depth + 1)];
  });
}

function fieldFromDataField(field: DataField, path: string, source: DataExplorerSource, depth: number): DataExplorerField {
  const kind = explorerKindFromSchemaKind(field.kind);

  return {
    id: `${source}:${path}`,
    label: field.label,
    path,
    kind,
    source,
    depth,
    bindable: kind !== "object",
    displayPath: source === "variable" ? `variables.${path}` : undefined
  };
}

function inferFieldsFromSample(value: unknown, basePath: string, depth: number, source: DataExplorerSource): DataExplorerField[] {
  if (!isRecord(value)) {
    return [];
  }

  const fields: DataExplorerField[] = [];

  for (const [key, childValue] of Object.entries(value)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const kind = explorerKindForValue(childValue);

    fields.push({
      id: `${source}:${path}`,
      label: titleCase(key),
      path,
      kind,
      source,
      depth,
      bindable: kind !== "object",
      parentPath: basePath || undefined,
      displayPath: source === "variable" ? `variables.${path}` : undefined
    });

    if (isRecord(childValue)) {
      fields.push(...inferFieldsFromSample(childValue, path, depth + 1, source));
    } else if (Array.isArray(childValue) && isRecord(childValue[0])) {
      fields.push(...inferFieldsFromSample(childValue[0], path, depth + 1, source));
    }
  }

  return fields;
}

function fieldsFromVariables(template: DocumentTemplate): DataExplorerField[] {
  return (template.variables ?? []).map((variable) => {
    const kind = kindForDynamicValue(variable.value);

    return {
      id: `variable:${variable.id}`,
      label: variable.name,
      path: variable.id,
      kind,
      source: "variable",
      depth: 0,
      bindable: true,
      displayPath: `variables.${variable.id}`
    };
  });
}

function kindForDynamicValue(value: DynamicValue): DataExplorerKind {
  if (value.kind === "literal") return "text";
  if (value.kind === "binding") return "unknown";
  if (value.kind === "formula") return value.formula.op === "concat" ? "text" : "number";
  return "text";
}

function mergeExplorerFields(primary: DataExplorerField[], fallback: DataExplorerField[]): DataExplorerField[] {
  const seen = new Set<string>();
  const merged: DataExplorerField[] = [];

  for (const field of [...primary, ...fallback]) {
    if (seen.has(field.path)) {
      continue;
    }

    seen.add(field.path);
    merged.push(field);
  }

  return merged;
}

function decorateFieldHierarchy(fields: DataExplorerField[]): DataExplorerField[] {
  const byPath = new Map(fields.map((field) => [field.path, field]));
  const fieldsWithParent = fields.map((field) => {
    const parentPath = nearestExistingParentPath(field.path, byPath) ?? field.parentPath;

    return {
      ...field,
      parentPath
    };
  });
  const childrenByParent = new Map<string, DataExplorerField[]>();

  for (const field of fieldsWithParent) {
    if (!field.parentPath) {
      continue;
    }

    childrenByParent.set(field.parentPath, [...(childrenByParent.get(field.parentPath) ?? []), field]);
  }

  const byUpdatedPath = new Map(fieldsWithParent.map((field) => [field.path, field]));
  const roots = fieldsWithParent.filter((field) => !field.parentPath || !byUpdatedPath.has(field.parentPath));
  const visited = new Set<string>();
  const ordered: DataExplorerField[] = [];

  function visit(field: DataExplorerField, depth: number): void {
    if (visited.has(field.path)) {
      return;
    }

    visited.add(field.path);
    const children = childrenByParent.get(field.path) ?? [];
    ordered.push({
      ...field,
      depth,
      hasChildren: children.length > 0,
      childCount: children.length || undefined
    });

    for (const child of children) {
      visit(child, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  for (const field of fieldsWithParent) {
    if (!visited.has(field.path)) {
      visit(field, field.depth);
    }
  }

  return ordered;
}

function nearestExistingParentPath(path: string, fields: Map<string, DataExplorerField>): string | undefined {
  const segments = path.split(".");

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const candidate = segments.slice(0, index).join(".");

    if (fields.has(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function findSchemaField(fields: DataField[], path: string): DataField | undefined {
  for (const field of fields) {
    if (field.path === path) {
      return field;
    }

    const found = findSchemaField(field.children ?? [], path);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function explorerKindFromSchemaKind(kind: DataField["kind"]): DataExplorerKind {
  if (kind === "string") return "text";
  return kind;
}

function explorerKindForValue(value: unknown): DataExplorerKind {
  if (typeof value === "string") return looksLikeImagePath(value) ? "image" : "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  return "unknown";
}

function looksLikeImagePath(value: string): boolean {
  return /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(value);
}

function valueAtPath(data: Record<string, unknown> | undefined, path: string): unknown {
  if (!data || !path) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) return isRecord(current[0]) ? current[0][segment] : undefined;
    if (isRecord(current)) return current[segment];
    return undefined;
  }, data);
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function joinDataPath(prefix: string | undefined, path: string): string {
  if (!prefix) return path;
  if (path === prefix || path.startsWith(`${prefix}.`)) return path;
  return `${prefix}.${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
