import type { DocNode, DocumentTemplate, FlowNode, Frame, GridNode } from "@templara/core";
import type { EditableNode, EditorNodeItem } from "./editorModel";

export interface EditorClipboardNode {
  node: EditableNode;
}

export interface EditorClipboard {
  nodes: EditorClipboardNode[];
  origin: Pick<Frame, "x" | "y">;
}

export function createEditorClipboard(
  items: EditorNodeItem[],
): EditorClipboard | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const origin = {
    x: Math.min(...items.map((item) => item.absoluteFrame.x)),
    y: Math.min(...items.map((item) => item.absoluteFrame.y)),
  };

  return {
    origin,
    nodes: items.map((item) => {
      const node = structuredClone(item.node);
      node.frame = { ...node.frame, ...item.absoluteFrame };
      return { node };
    }),
  };
}

export function pasteEditorClipboardNodes(
  template: DocumentTemplate,
  clipboard: EditorClipboard,
  offset = 24,
): { nodes: DocNode[]; ids: string[] } {
  const existingIds = collectTemplateNodeIds(template);
  const nodes = clipboard.nodes.map((entry) => {
    const node = structuredClone(entry.node);
    node.frame = {
      ...node.frame,
      x: roundFrameValue(node.frame.x + offset),
      y: roundFrameValue(node.frame.y + offset),
    };
    assignFreshNodeIds(node, existingIds);
    return node as DocNode;
  });

  return {
    nodes,
    ids: nodes.map((node) => node.id),
  };
}

function collectTemplateNodeIds(template: DocumentTemplate): Set<string> {
  const ids = new Set<string>();

  for (const page of template.pages) {
    for (const layer of page.layers) {
      for (const node of layer.nodes) {
        collectNodeIds(node, ids);
      }
    }
  }

  return ids;
}

function collectNodeIds(node: EditableNode, ids: Set<string>): void {
  ids.add(node.id);

  for (const children of childCollectionsForNode(node)) {
    for (const child of children) {
      collectNodeIds(child, ids);
    }
  }
}

function assignFreshNodeIds(node: EditableNode, existingIds: Set<string>): void {
  node.id = nextNodeId(node.id, existingIds);
  existingIds.add(node.id);

  for (const children of childCollectionsForNode(node)) {
    for (const child of children) {
      assignFreshNodeIds(child, existingIds);
    }
  }
}

function nextNodeId(baseId: string, existingIds: Set<string>): string {
  let candidate = `${baseId}-copy`;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-copy-${index}`;
    index += 1;
  }

  return candidate;
}

function childCollectionsForNode(node: EditableNode): EditableNode[][] {
  if (node.type === "shape") {
    return node.children ? [node.children] : [];
  }

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
    if (node.header) collections.push(node.header);
    if (node.emptyState) collections.push(node.emptyState);
    return collections;
  }

  if (node.type === "conditional") {
    return node.fallback ? [node.children, node.fallback] : [node.children];
  }

  if (node.type === "grid") {
    return gridChildCollections(node);
  }

  return [];
}

function gridChildCollections(node: GridNode): EditableNode[][] {
  const bodyRows = node.staticRows?.length ? node.staticRows : [node.row];
  const rows = [node.header, ...bodyRows, node.footer].filter(
    (row): row is GridNode["row"] => Boolean(row),
  );

  return rows.flatMap((row) =>
    row.cells.map((cell) => cell.content as EditableNode[]),
  );
}

function roundFrameValue(value: number): number {
  return Math.round(value * 100) / 100;
}
