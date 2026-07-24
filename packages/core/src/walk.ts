import type { DocNode, FlowNode } from "./index.js";

export type AnyNode = DocNode | FlowNode;

/**
 * Depth-first walk of a node list. Shared by validation and binding extraction
 * so child recursion stays in sync (including grid `staticRows`).
 */
export function forEachNode(
  nodes: AnyNode[],
  visit: (node: AnyNode, path: string) => void,
  prefix = "",
): void {
  nodes.forEach((node, index) => {
    const nodePath = `${prefix}node:${node.id || index}`;
    visit(node, nodePath);

    for (const children of childCollections(node)) {
      forEachNode(children, visit, `${nodePath}.`);
    }
  });
}

/**
 * Direct child collections for a node. Order is stable but not semantically
 * significant — callers should not rely on visit order beyond parent-before-child.
 */
export function childCollections(node: AnyNode): AnyNode[][] {
  switch (node.type) {
    case "shape":
      return node.children ? [node.children] : [];
    case "group":
    case "flowRegion":
    case "section":
    case "stack":
      return [node.children];
    case "repeat": {
      const collections: AnyNode[][] = [node.children];
      if (node.header) {
        collections.push(node.header);
      }
      if (node.emptyState) {
        collections.push(node.emptyState);
      }
      return collections;
    }
    case "conditional":
      return node.fallback ? [node.children, node.fallback] : [node.children];
    case "grid": {
      const collections: AnyNode[][] = [];
      const rows = [node.header, node.row, node.footer, ...(node.staticRows ?? [])];

      for (const row of rows) {
        if (!row) {
          continue;
        }

        for (const cell of row.cells) {
          collections.push(cell.content);
        }
      }

      return collections;
    }
    default:
      return [];
  }
}
