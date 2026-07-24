import type {
  AssetDefinition,
  BarcodeNode,
  BindingRef,
  DocNode,
  DocumentTemplate,
  DynamicValue,
  FlowNode,
  Frame,
  GridNode,
  GroupNode,
  ImageNode,
  ImageSource,
  InlineContent,
  PageLayer,
  PageTemplate,
  QrNode,
  RepeatNode,
  SectionNode,
  ShapeNode,
  Size,
  StackNode,
  TextNode,
  TextStyle,
} from "@templara/core";

export type EditableNode = DocNode | FlowNode;

export type EditorVisual =
  | { kind: "text"; text: string; style: TextStyle }
  | {
      kind: "shape";
      shape: ShapeNode["shape"];
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      radius?: number;
    }
  | {
      kind: "image";
      src: string;
      fit?: ImageNode["fit"];
      alt?: string;
      placeholder?: string;
    }
  | {
      kind: "code";
      codeType: "barcode" | "qr";
      value: string;
      format?: string;
      placeholder?: string;
    }
  | {
      kind: "container";
      label: string;
      tone:
        | "flow"
        | "section"
        | "repeat"
        | "group"
        | "stack"
        | "conditional"
        | "grid";
    };

export interface EditorRenderNode {
  id: string;
  sourceNodeId: string;
  nodeType: EditableNode["type"];
  label: string;
  frame: Frame;
  localFrame: Frame;
  layerId: string;
  layerKind: PageLayer["kind"];
  depth: number;
  parentId?: string;
  visual: EditorVisual;
}

export interface EditorNodeItem {
  id: string;
  type: string;
  label: string;
  depth: number;
  pageId: string;
  layerId: string;
  layerKind: PageLayer["kind"];
  path: string;
  frame: Frame;
  absoluteFrame: Frame;
  node: EditableNode;
}

export interface EditorPageModel {
  id: string;
  name: string;
  size: Size;
  margin?: PageTemplate["margin"];
  nodes: EditorRenderNode[];
}

export type AlignmentCommand =
  | "align-left"
  | "align-center-x"
  | "align-right"
  | "align-top"
  | "align-center-y"
  | "align-bottom"
  | "distribute-x"
  | "distribute-y";

export interface AlignmentSubject {
  id: string;
  frame: Frame;
  absoluteFrame: Frame;
}

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export interface ResizeOptions {
  minSize?: number;
  lockAspect?: boolean;
  snap?: (value: number) => number;
}

const DEFAULT_MIN_RESIZE = 8;

export function getResizeFramePatch(
  start: Frame,
  handle: ResizeHandle,
  delta: Pick<Frame, "x" | "y">,
  options: ResizeOptions = {},
): Partial<Frame> {
  const minSize = Math.max(1, options.minSize ?? DEFAULT_MIN_RESIZE);
  const lockAspect = options.lockAspect === true;
  // Aspect-locked resize keeps an exact ratio, so grid snapping is skipped
  // during a locked gesture to avoid fighting the ratio constraint.
  const snap = lockAspect ? (value: number) => value : (options.snap ?? identity);

  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";
  const isCorner =
    (movesLeft || movesRight) && (movesTop || movesBottom);

  let left = start.x;
  let right = start.x + start.width;
  let top = start.y;
  let bottom = start.y + start.height;

  if (movesLeft) {
    left = snap(start.x + delta.x);
  }

  if (movesRight) {
    right = snap(start.x + start.width + delta.x);
  }

  if (movesTop) {
    top = snap(start.y + delta.y);
  }

  if (movesBottom) {
    bottom = snap(start.y + start.height + delta.y);
  }

  if (right - left < minSize) {
    if (movesLeft) {
      left = right - minSize;
    } else {
      right = left + minSize;
    }
  }

  if (bottom - top < minSize) {
    if (movesTop) {
      top = bottom - minSize;
    } else {
      bottom = top + minSize;
    }
  }

  if (lockAspect && isCorner && start.height > 0 && start.width > 0) {
    const ratio = start.width / start.height;
    const width = right - left;
    const lockedHeight = Math.max(minSize, width / ratio);

    if (movesTop) {
      top = bottom - lockedHeight;
    } else {
      bottom = top + lockedHeight;
    }
  }

  const patch: Partial<Frame> = {};

  if (movesLeft || movesRight) {
    patch.width = roundFrameValue(right - left);
  }

  if (movesTop || movesBottom) {
    patch.height = roundFrameValue(bottom - top);
  }

  if (movesLeft) {
    patch.x = roundFrameValue(left);
  }

  if (movesTop) {
    patch.y = roundFrameValue(top);
  }

  return patch;
}

function identity(value: number): number {
  return value;
}

function roundFrameValue(value: number): number {
  return Math.round(value);
}

interface RenderContext {
  pageId: string;
  layerId: string;
  layerKind: PageLayer["kind"];
  depth: number;
  parentPath: string;
  parentId?: string;
  origin: Pick<Frame, "x" | "y">;
  assets: Map<string, AssetDefinition>;
}

interface FlowLayoutResult {
  nodes: EditorRenderNode[];
  height: number;
}

export function buildEditorPageModel(
  template: DocumentTemplate,
  pageId?: string,
): EditorPageModel {
  const page = findPage(template, pageId);
  const assets = new Map(template.assets?.map((asset) => [asset.id, asset]));
  const nodes = page.layers.flatMap((layer) =>
    renderNodeCollection(layer.nodes, {
      pageId: page.id,
      layerId: layer.id,
      layerKind: layer.kind,
      depth: 0,
      parentPath: `${page.id}.${layer.id}`,
      origin: { x: 0, y: 0 },
      assets,
    }),
  );

  return {
    id: page.id,
    name: page.name ?? page.id,
    size: page.size,
    margin: page.margin,
    nodes,
  };
}

/**
 * Human-readable layer / inspector title for a node.
 * Prefers authored `name`, then content/type-aware fallbacks, then
 * `Type · shortId` — never a raw UUID as the primary label.
 */
export function friendlyLayerLabel(node: EditableNode): string {
  const authored = typeof node.name === "string" ? node.name.trim() : "";
  if (authored) {
    return authored;
  }

  if (node.type === "text") {
    const content = truncateLabel(resolveInlineContent(node.content));
    if (content) {
      return content;
    }
    return typedShortLabel("Text", node.id);
  }

  if (node.type === "grid") {
    return gridLabel(node);
  }

  if (node.type === "section") {
    return sectionLabel(node);
  }

  if (node.type === "stack") {
    return stackLabel(node);
  }

  if (node.type === "repeat") {
    const pathTail = node.binding.path.split(".").at(-1);
    if (pathTail) {
      return `Repeat · ${pathTail}`;
    }
    return typedShortLabel("Repeat", node.id);
  }

  if (node.type === "image") {
    const alt = node.alt?.trim();
    if (alt) {
      return alt;
    }
    return typedShortLabel("Image", node.id);
  }

  if (node.type === "barcode") {
    return typedShortLabel("Barcode", node.id);
  }

  if (node.type === "qr") {
    return typedShortLabel("QR", node.id);
  }

  if (node.type === "shape") {
    return typedShortLabel(titleCaseType(node.shape), node.id);
  }

  if (node.type === "group") {
    return typedShortLabel("Group", node.id);
  }

  if (node.type === "flowRegion") {
    return typedShortLabel("Flow", node.id);
  }

  if (node.type === "conditional") {
    return typedShortLabel("Condition", node.id);
  }

  // Future node types stay readable instead of falling back to raw ids.
  return typedShortLabel("Layer", (node as EditableNode).id);
}

export function collectPageNodeItems(
  template: DocumentTemplate,
  pageId?: string,
): EditorNodeItem[] {
  const page = findPage(template, pageId);

  return page.layers.flatMap((layer) =>
    collectNodes(layer.nodes, {
      pageId: page.id,
      layerId: layer.id,
      layerKind: layer.kind,
      depth: 0,
      parentPath: `${page.id}.${layer.id}`,
      origin: { x: 0, y: 0 },
    }),
  );
}

export function updateNodeById(
  template: DocumentTemplate,
  nodeId: string,
  update: (node: EditableNode) => void,
): boolean {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      if (updateNodeInCollection(layer.nodes, nodeId, update)) {
        return true;
      }
    }
  }

  return false;
}

export function updateNodesById(
  template: DocumentTemplate,
  updates: Record<string, Partial<Frame>>,
): boolean {
  let changed = false;

  for (const page of template.pages) {
    for (const layer of page.layers) {
      changed = updateNodeFramesInCollection(layer.nodes, updates) || changed;
    }
  }

  return changed;
}

export type ReorderCommand = "front" | "back" | "forward" | "backward";

export function findEditableNode(
  template: DocumentTemplate,
  nodeId: string,
): EditableNode | undefined {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      const found = findNodeInCollection(layer.nodes, nodeId);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function findNodeInCollection(
  nodes: EditableNode[],
  nodeId: string,
): EditableNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    for (const children of getChildCollections(node)) {
      const found = findNodeInCollection(children, nodeId);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

/**
 * Moves a node within its containing collection (layer or nested children).
 * Later positions render on top. Returns true when the order changed.
 */
export function reorderNodeInTemplate(
  template: DocumentTemplate,
  nodeId: string,
  command: ReorderCommand,
): boolean {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      if (reorderInCollection(layer.nodes, nodeId, command)) {
        return true;
      }
    }
  }

  return false;
}

function reorderInCollection(
  nodes: EditableNode[],
  nodeId: string,
  command: ReorderCommand,
): boolean {
  const index = nodes.findIndex((node) => node.id === nodeId);

  if (index >= 0) {
    const last = nodes.length - 1;

    if ((command === "front" || command === "forward") && index === last) {
      return false;
    }

    if ((command === "back" || command === "backward") && index === 0) {
      return false;
    }

    const [node] = nodes.splice(index, 1);
    const target =
      command === "front"
        ? nodes.length
        : command === "back"
          ? 0
          : command === "forward"
            ? index + 1
            : index - 1;
    nodes.splice(target, 0, node);
    return true;
  }

  for (const node of nodes) {
    for (const children of getChildCollections(node)) {
      if (reorderInCollection(children, nodeId, command)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Wraps a set of direct sibling nodes in a new group. The group frame is the
 * bounding box of the selection, and each child's frame is rebased to the group
 * origin. Only succeeds when every id is a direct child of the same collection.
 * Returns the new group id, or undefined if the selection cannot be grouped.
 */
export function groupNodesInTemplate(
  template: DocumentTemplate,
  nodeIds: string[],
  groupId: string,
): string | undefined {
  if (nodeIds.length < 2) {
    return undefined;
  }

  for (const page of template.pages) {
    for (const layer of page.layers) {
      if (groupSiblingsInCollection(layer.nodes, nodeIds, groupId)) {
        return groupId;
      }
    }
  }

  return undefined;
}

function groupSiblingsInCollection(
  nodes: EditableNode[],
  nodeIds: string[],
  groupId: string,
): boolean {
  const idSet = new Set(nodeIds);
  const indices = nodes
    .map((node, index) => (idSet.has(node.id) ? index : -1))
    .filter((index) => index >= 0);

  if (indices.length !== nodeIds.length) {
    for (const node of nodes) {
      for (const children of getChildCollections(node)) {
        if (groupSiblingsInCollection(children, nodeIds, groupId)) {
          return true;
        }
      }
    }

    return false;
  }

  const selected = indices.map((index) => nodes[index]);
  const bounds = getBounds(selected.map((node) => node.frame));
  const group: GroupNode = {
    id: groupId,
    type: "group",
    frame: bounds,
    children: selected.map((node) => ({
      ...node,
      frame: {
        ...node.frame,
        x: node.frame.x - bounds.x,
        y: node.frame.y - bounds.y,
      },
    })) as DocNode[],
  };
  const insertAt = Math.min(...indices);

  for (const index of [...indices].sort((a, b) => b - a)) {
    nodes.splice(index, 1);
  }

  nodes.splice(insertAt, 0, group);
  return true;
}

/**
 * Replaces a group with its children, rebasing child frames back into the
 * parent coordinate space. Returns the freed child ids, or undefined when no
 * matching group exists.
 */
export function ungroupNodeInTemplate(
  template: DocumentTemplate,
  groupId: string,
): string[] | undefined {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      const ids = ungroupInCollection(layer.nodes, groupId);

      if (ids) {
        return ids;
      }
    }
  }

  return undefined;
}

function ungroupInCollection(
  nodes: EditableNode[],
  groupId: string,
): string[] | undefined {
  const index = nodes.findIndex(
    (node) => node.id === groupId && node.type === "group",
  );

  if (index >= 0) {
    const group = nodes[index] as GroupNode;
    const children = group.children.map((child) => ({
      ...child,
      frame: {
        ...child.frame,
        x: child.frame.x + group.frame.x,
        y: child.frame.y + group.frame.y,
      },
    }));

    nodes.splice(index, 1, ...(children as EditableNode[]));
    return children.map((child) => child.id);
  }

  for (const node of nodes) {
    for (const children of getChildCollections(node)) {
      const ids = ungroupInCollection(children, groupId);

      if (ids) {
        return ids;
      }
    }
  }

  return undefined;
}

export type MoveNodePosition = "before" | "after" | "inside";

export interface MoveNodeTarget {
  referenceId: string;
  position: MoveNodePosition;
}

/**
 * Moves a node to a new location expressed relative to a reference node:
 * dropped `before`/`after` a sibling, or `inside` a container as its last
 * child. Frames are rebased from the node's current absolute position into the
 * target parent's coordinate space (mirroring group/ungroup rebasing), so the
 * node stays visually put when it changes parents. Moving a container into its
 * own subtree is rejected. Returns true when the template changed.
 */
export function moveNodeInTemplate(
  template: DocumentTemplate,
  nodeId: string,
  target: MoveNodeTarget,
): boolean {
  if (nodeId === target.referenceId && target.position !== "inside") {
    return false;
  }

  const itemMap = new Map<string, EditorNodeItem>();
  for (const page of template.pages) {
    for (const item of collectPageNodeItems(template, page.id)) {
      itemMap.set(item.id, item);
    }
  }

  const movedItem = itemMap.get(nodeId);
  const referenceItem = itemMap.get(target.referenceId);

  if (!movedItem || !referenceItem) {
    return false;
  }

  // Never allow a node to be dropped into its own subtree.
  const descendantIds = collectDescendantIds(movedItem.node);
  if (
    target.referenceId === nodeId ||
    descendantIds.has(target.referenceId)
  ) {
    return false;
  }

  const contentOrigin =
    target.position === "inside"
      ? getContainerContentOrigin(referenceItem, itemMap)
      : {
          x: referenceItem.absoluteFrame.x - referenceItem.frame.x,
          y: referenceItem.absoluteFrame.y - referenceItem.frame.y,
        };

  if (!contentOrigin) {
    return false;
  }

  const movedAbsolute = movedItem.absoluteFrame;
  const removed = removeNodeFromTemplate(template, nodeId);

  if (!removed) {
    return false;
  }

  removed.frame = {
    ...removed.frame,
    x: movedAbsolute.x - contentOrigin.x,
    y: movedAbsolute.y - contentOrigin.y,
  };

  if (target.position === "inside") {
    const container = findEditableNode(template, target.referenceId);
    const collection = container
      ? getWritableChildCollection(container)
      : undefined;

    if (!collection) {
      return false;
    }

    collection.push(removed);
    return true;
  }

  const location = findCollectionContaining(template, target.referenceId);

  if (!location) {
    return false;
  }

  const referenceIndex = location.collection.findIndex(
    (node) => node.id === target.referenceId,
  );

  if (referenceIndex < 0) {
    return false;
  }

  const insertAt =
    target.position === "before" ? referenceIndex : referenceIndex + 1;
  location.collection.splice(insertAt, 0, removed);
  return true;
}

function getContainerContentOrigin(
  container: EditorNodeItem,
  itemMap: Map<string, EditorNodeItem>,
): { x: number; y: number } | undefined {
  if (container.node.type === "grid") {
    return gridPrimaryContentOrigin(container.node, container.absoluteFrame);
  }

  const collections = getChildCollections(container.node);
  const firstChild = collections[0]?.[0];
  const childItem = firstChild ? itemMap.get(firstChild.id) : undefined;

  if (childItem) {
    return {
      x: childItem.absoluteFrame.x - childItem.frame.x,
      y: childItem.absoluteFrame.y - childItem.frame.y,
    };
  }

  if (!isContainerNode(container.node)) {
    return undefined;
  }

  // Empty container (e.g. a shape with no children yet): fall back to the
  // container's own absolute origin. Padded containers may be off by their
  // padding, but this only affects the very first child dropped in.
  return { x: container.absoluteFrame.x, y: container.absoluteFrame.y };
}

function collectDescendantIds(node: EditableNode): Set<string> {
  const ids = new Set<string>();

  const walk = (current: EditableNode): void => {
    for (const children of getChildCollections(current)) {
      for (const child of children) {
        ids.add(child.id);
        walk(child);
      }
    }
  };

  walk(node);
  return ids;
}

function removeNodeFromTemplate(
  template: DocumentTemplate,
  nodeId: string,
): EditableNode | undefined {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      const removed = removeNodeFromCollection(layer.nodes, nodeId);

      if (removed) {
        return removed;
      }
    }
  }

  return undefined;
}

function removeNodeFromCollection(
  nodes: EditableNode[],
  nodeId: string,
): EditableNode | undefined {
  const index = nodes.findIndex((node) => node.id === nodeId);

  if (index >= 0) {
    const [removed] = nodes.splice(index, 1);
    return removed;
  }

  for (const node of nodes) {
    for (const children of getChildCollections(node)) {
      const removed = removeNodeFromCollection(children, nodeId);

      if (removed) {
        return removed;
      }
    }
  }

  return undefined;
}

function findCollectionContaining(
  template: DocumentTemplate,
  nodeId: string,
): { collection: EditableNode[] } | undefined {
  for (const page of template.pages) {
    for (const layer of page.layers) {
      const found = findCollectionInNodes(layer.nodes, nodeId);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function findCollectionInNodes(
  nodes: EditableNode[],
  nodeId: string,
): { collection: EditableNode[] } | undefined {
  if (nodes.some((node) => node.id === nodeId)) {
    return { collection: nodes };
  }

  for (const node of nodes) {
    for (const children of getChildCollections(node)) {
      const found = findCollectionInNodes(children, nodeId);

      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

export function getAlignmentFramePatches(
  subjects: AlignmentSubject[],
  selectedIds: string[],
  command: AlignmentCommand,
  pageSize: Size,
): Record<string, Partial<Frame>> {
  const selected = selectedIds
    .map((id) => subjects.find((subject) => subject.id === id))
    .filter((subject): subject is AlignmentSubject => Boolean(subject));

  if (selected.length === 0) {
    return {};
  }

  if (
    (command === "distribute-x" || command === "distribute-y") &&
    selected.length < 3
  ) {
    return {};
  }

  const bounds =
    selected.length === 1
      ? { x: 0, y: 0, width: pageSize.width, height: pageSize.height }
      : getBounds(selected.map((subject) => subject.absoluteFrame));
  const patches: Record<string, Partial<Frame>> = {};

  if (command === "distribute-x") {
    const sorted = [...selected].sort(
      (a, b) => a.absoluteFrame.x - b.absoluteFrame.x,
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      return patches;
    }

    const totalWidth = sorted.reduce(
      (sum, subject) => sum + subject.absoluteFrame.width,
      0,
    );
    const gap =
      (last.absoluteFrame.x +
        last.absoluteFrame.width -
        first.absoluteFrame.x -
        totalWidth) /
      (sorted.length - 1);
    let nextX = first.absoluteFrame.x;

    for (const subject of sorted) {
      patches[subject.id] = {
        x: subject.frame.x + (nextX - subject.absoluteFrame.x),
      };
      nextX += subject.absoluteFrame.width + gap;
    }

    return patches;
  }

  if (command === "distribute-y") {
    const sorted = [...selected].sort(
      (a, b) => a.absoluteFrame.y - b.absoluteFrame.y,
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      return patches;
    }

    const totalHeight = sorted.reduce(
      (sum, subject) => sum + subject.absoluteFrame.height,
      0,
    );
    const gap =
      (last.absoluteFrame.y +
        last.absoluteFrame.height -
        first.absoluteFrame.y -
        totalHeight) /
      (sorted.length - 1);
    let nextY = first.absoluteFrame.y;

    for (const subject of sorted) {
      patches[subject.id] = {
        y: subject.frame.y + (nextY - subject.absoluteFrame.y),
      };
      nextY += subject.absoluteFrame.height + gap;
    }

    return patches;
  }

  for (const subject of selected) {
    const patch: Partial<Frame> = {};

    if (command === "align-left") {
      patch.x = subject.frame.x + (bounds.x - subject.absoluteFrame.x);
    }

    if (command === "align-center-x") {
      patch.x =
        subject.frame.x +
        (bounds.x +
          bounds.width / 2 -
          (subject.absoluteFrame.x + subject.absoluteFrame.width / 2));
    }

    if (command === "align-right") {
      patch.x =
        subject.frame.x +
        (bounds.x +
          bounds.width -
          (subject.absoluteFrame.x + subject.absoluteFrame.width));
    }

    if (command === "align-top") {
      patch.y = subject.frame.y + (bounds.y - subject.absoluteFrame.y);
    }

    if (command === "align-center-y") {
      patch.y =
        subject.frame.y +
        (bounds.y +
          bounds.height / 2 -
          (subject.absoluteFrame.y + subject.absoluteFrame.height / 2));
    }

    if (command === "align-bottom") {
      patch.y =
        subject.frame.y +
        (bounds.y +
          bounds.height -
          (subject.absoluteFrame.y + subject.absoluteFrame.height));
    }

    patches[subject.id] = patch;
  }

  return patches;
}

function findPage(template: DocumentTemplate, pageId?: string): PageTemplate {
  return (
    template.pages.find((page) => page.id === pageId) ??
    template.pages[0] ??
    emptyPage()
  );
}

function emptyPage(): PageTemplate {
  return {
    id: "empty-page",
    name: "Empty Page",
    size: { width: 816, height: 1056 },
    layers: [],
  };
}

function renderNodeCollection(
  nodes: EditableNode[],
  context: RenderContext,
): EditorRenderNode[] {
  return nodes.flatMap((node, index) =>
    renderNode(node, context, `${context.parentPath}.${node.id || index}`),
  );
}

function renderNode(
  node: EditableNode,
  context: RenderContext,
  path: string,
): EditorRenderNode[] {
  if (node.visible === false) {
    return [];
  }

  if (node.type === "flowRegion") {
    const absoluteFrame = offsetFrame(node.frame, context.origin);
    const flowNodes = renderFlowChildren(node.children, {
      ...context,
      depth: context.depth + 1,
      parentPath: path,
      parentId: node.id,
      origin: { x: absoluteFrame.x, y: absoluteFrame.y },
    });

    return [
      createContainerNode(node, context, absoluteFrame, "flow", "Flow region"),
      ...flowNodes.nodes,
    ];
  }

  if (node.type === "group") {
    return renderGroupLikeNode(
      node,
      context,
      path,
      "group",
      "Group",
      node.children,
    );
  }

  if (node.type === "section") {
    return renderSectionNode(node, context, path);
  }

  if (node.type === "stack") {
    return renderStackNode(node, context, path);
  }

  if (node.type === "conditional") {
    return renderGroupLikeNode(
      node,
      context,
      path,
      "conditional",
      "Condition",
      node.children,
    );
  }

  if (node.type === "repeat") {
    return renderRepeatNode(node, context, path);
  }

  if (node.type === "grid") {
    return renderGridNode(node, context, path);
  }

  return [
    createLeafNode(node, context, offsetFrame(node.frame, context.origin)),
  ];
}

function renderFlowChildren(
  nodes: FlowNode[],
  context: RenderContext,
): FlowLayoutResult {
  return renderFlowChildrenWithGap(nodes, context, 0);
}

function renderFlowChildrenWithGap(
  nodes: FlowNode[],
  context: RenderContext,
  gap: number,
): FlowLayoutResult {
  const rendered: EditorRenderNode[] = [];
  let cursorY = 0;

  for (const [index, node] of nodes.entries()) {
    const nodeHeight = measureEditorFlowNodeHeight(node);
    const nodeOrigin = {
      x: context.origin.x,
      y: context.origin.y + cursorY,
    };

    rendered.push(
      ...renderNode(
        node,
        { ...context, origin: nodeOrigin },
        `${context.parentPath}.${node.id || index}`,
      ),
    );
    cursorY += node.frame.y + nodeHeight + (index < nodes.length - 1 ? gap : 0);
  }

  return {
    nodes: rendered,
    height: cursorY,
  };
}

function renderGroupLikeNode(
  node: GroupNode | StackNode | Extract<EditableNode, { type: "conditional" }>,
  context: RenderContext,
  path: string,
  tone: Extract<EditorVisual, { kind: "container" }>["tone"],
  label: string,
  children: FlowNode[] | DocNode[],
): EditorRenderNode[] {
  const absoluteFrame = offsetFrame(node.frame, context.origin);
  const childContext: RenderContext = {
    ...context,
    depth: context.depth + 1,
    parentPath: path,
    parentId: node.id,
    origin: { x: absoluteFrame.x, y: absoluteFrame.y },
  };

  return [
    createContainerNode(node, context, absoluteFrame, tone, label),
    ...renderNodeCollection(children, childContext),
  ];
}

function renderRepeatNode(
  node: RepeatNode,
  context: RenderContext,
  path: string,
): EditorRenderNode[] {
  const absoluteFrame = editorFrameForNode(node, context.origin);
  const header = node.header ?? [];
  const headerHeight = header.length > 0 ? measureChildrenBottom(header) : 0;
  const headerContext: RenderContext = {
    ...context,
    depth: context.depth + 1,
    parentPath: path,
    parentId: node.id,
    origin: { x: absoluteFrame.x, y: absoluteFrame.y },
  };
  const rowContext: RenderContext = {
    ...headerContext,
    origin: { x: absoluteFrame.x, y: absoluteFrame.y + headerHeight },
  };

  return [
    createContainerNode(
      node,
      context,
      absoluteFrame,
      "repeat",
      `Repeat: ${node.binding.path}`,
    ),
    ...(header.length > 0 ? renderNodeCollection(header, headerContext) : []),
    ...renderNodeCollection(node.children, rowContext),
  ];
}

function renderGridNode(
  node: GridNode,
  context: RenderContext,
  path: string,
): EditorRenderNode[] {
  const absoluteFrame = editorFrameForNode(node, context.origin);
  const children: EditorRenderNode[] = [];
  let rowY = absoluteFrame.y;

  if (node.header) {
    children.push(
      ...renderGridRowTemplate(node, node.header, context, path, rowY, "header"),
    );
    rowY += measureEditorGridRowHeight(node, node.header);
  }

  for (const [index, row] of editorGridBodyRows(node).entries()) {
    children.push(
      ...renderGridRowTemplate(node, row, context, `${path}.row.${index}`, rowY, "row"),
    );
    rowY += measureEditorGridRowHeight(node, row);
  }

  if (node.footer) {
    children.push(
      ...renderGridRowTemplate(node, node.footer, context, path, rowY, "footer"),
    );
  }

  return [
    createContainerNode(node, context, absoluteFrame, "grid", gridLabel(node)),
    ...children,
  ];
}

function renderGridRowTemplate(
  node: GridNode,
  row: GridNode["row"],
  context: RenderContext,
  path: string,
  rowY: number,
  rowKind: "header" | "row" | "footer",
): EditorRenderNode[] {
  const rendered: EditorRenderNode[] = [];
  const gridAbsolute = editorFrameForNode(node, context.origin);
  let columnX = 0;

  for (const column of node.columns) {
    const cell = findGridCell(row, column.id);

    if (cell) {
      rendered.push(
        ...renderNodeCollection(cell.content, {
          ...context,
          depth: context.depth + 1,
          parentPath: `${path}.${rowKind}.${column.id}`,
          parentId: node.id,
          origin: {
            x: gridAbsolute.x + columnX,
            y: rowY,
          },
        }),
      );
    }

    columnX += column.width;
  }

  return rendered;
}

function renderSectionNode(
  node: SectionNode,
  context: RenderContext,
  path: string,
): EditorRenderNode[] {
  const absoluteFrame = editorFrameForNode(node, context.origin);
  const padding = sectionPadding(node);
  const childContext: RenderContext = {
    ...context,
    depth: context.depth + 1,
    parentPath: path,
    parentId: node.id,
    origin: {
      x: absoluteFrame.x + padding.left,
      y: absoluteFrame.y + padding.top,
    },
  };
  const children = renderFlowChildrenWithGap(
    node.children,
    childContext,
    node.layout?.gap ?? 0,
  );

  return [
    createContainerNode(
      node,
      context,
      absoluteFrame,
      "section",
      sectionLabel(node),
    ),
    ...children.nodes,
  ];
}

function renderStackNode(
  node: StackNode,
  context: RenderContext,
  path: string,
): EditorRenderNode[] {
  const absoluteFrame = editorFrameForNode(node, context.origin);
  const childContext: RenderContext = {
    ...context,
    depth: context.depth + 1,
    parentPath: path,
    parentId: node.id,
    origin: {
      x: absoluteFrame.x,
      y: absoluteFrame.y,
    },
  };
  const children = renderStackChildren(node, childContext);

  return [
    createContainerNode(
      node,
      context,
      absoluteFrame,
      "stack",
      stackLabel(node),
    ),
    ...children.nodes,
  ];
}

function renderStackChildren(
  node: StackNode,
  context: RenderContext,
): FlowLayoutResult {
  if (node.direction === "vertical") {
    return renderFlowChildrenWithGap(node.children, context, node.gap);
  }

  const rendered: EditorRenderNode[] = [];
  let cursorX = 0;
  let height = 0;

  for (const [index, child] of node.children.entries()) {
    const childOrigin = {
      x: context.origin.x + cursorX,
      y: context.origin.y,
    };

    rendered.push(
      ...renderNode(
        child,
        { ...context, origin: childOrigin },
        `${context.parentPath}.${child.id || index}`,
      ),
    );
    cursorX +=
      Math.max(0, child.frame.x) +
      measureEditorFlowNodeWidth(child) +
      (index < node.children.length - 1 ? node.gap : 0);
    height = Math.max(
      height,
      child.frame.y + measureEditorFlowNodeHeight(child),
    );
  }

  return {
    nodes: rendered,
    height: Math.max(node.frame.height, height),
  };
}

function createLeafNode(
  node: EditableNode,
  context: RenderContext,
  absoluteFrame: Frame,
): EditorRenderNode {
  return {
    id: `${context.layerId}.${node.id}`,
    sourceNodeId: node.id,
    nodeType: node.type,
    label: friendlyLayerLabel(node),
    frame: absoluteFrame,
    localFrame: node.frame,
    layerId: context.layerId,
    layerKind: context.layerKind,
    depth: context.depth,
    parentId: context.parentId,
    visual: createVisual(node, context.assets),
  };
}

function createContainerNode(
  node: EditableNode,
  context: RenderContext,
  absoluteFrame: Frame,
  tone: Extract<EditorVisual, { kind: "container" }>["tone"],
  label: string,
): EditorRenderNode {
  return {
    ...createLeafNode(node, context, absoluteFrame),
    visual: {
      kind: "container",
      label,
      tone,
    },
  };
}

function createVisual(
  node: EditableNode,
  assets: Map<string, AssetDefinition>,
): EditorVisual {
  if (node.type === "text") {
    return {
      kind: "text",
      text: resolveInlineContent(node.content),
      style: node.style,
    };
  }

  if (node.type === "image") {
    return {
      kind: "image",
      ...resolveImageSource(node.source, assets),
      fit: node.fit,
      alt: node.alt,
    };
  }

  if (node.type === "shape") {
    return {
      kind: "shape",
      shape: node.shape,
      fill: node.style.fill,
      stroke: node.style.stroke,
      strokeWidth: node.style.strokeWidth,
      radius: node.style.radius,
    };
  }

  if (node.type === "barcode" || node.type === "qr") {
    return {
      kind: "code",
      codeType: node.type,
      value: resolveDynamicValue(node.value),
      format: node.type === "barcode" ? node.format : undefined,
      placeholder: dynamicValueHasBinding(node.value)
        ? resolveDynamicValue(node.value)
        : undefined,
    };
  }

  if (node.type === "grid") {
    return {
      kind: "container",
      label: gridLabel(node),
      tone: "grid",
    };
  }

  if (node.type === "section") {
    return {
      kind: "container",
      label: sectionLabel(node),
      tone: "section",
    };
  }

  return {
    kind: "container",
    label: humanizeId(node.type),
    tone: node.type === "stack" ? "stack" : "group",
  };
}

function collectNodes(
  nodes: EditableNode[],
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
): EditorNodeItem[] {
  return nodes.flatMap((node, index) => {
    const path = `${context.parentPath}.${node.id || index}`;
    const absoluteFrame = editorFrameForNode(node, context.origin);
    const current: EditorNodeItem = {
      id: node.id,
      type: node.type,
      label: friendlyLayerLabel(node),
      depth: context.depth,
      pageId: context.pageId,
      layerId: context.layerId,
      layerKind: context.layerKind,
      path,
      frame: node.frame,
      absoluteFrame,
      node,
    };

    if (node.type === "flowRegion") {
      const children = collectFlowNodes(node.children, {
        ...context,
        depth: context.depth + 1,
        parentPath: path,
        origin: { x: absoluteFrame.x, y: absoluteFrame.y },
      });

      return [current, ...children];
    }

    if (node.type === "section") {
      const padding = sectionPadding(node);
      const children = collectFlowNodesWithGap(
        node.children,
        {
          ...context,
          depth: context.depth + 1,
          parentPath: path,
          origin: {
            x: absoluteFrame.x + padding.left,
            y: absoluteFrame.y + padding.top,
          },
        },
        node.layout?.gap ?? 0,
      );

      return [current, ...children];
    }

    if (node.type === "stack") {
      return [
        current,
        ...collectStackNodes(node, {
          ...context,
          depth: context.depth + 1,
          parentPath: path,
          origin: { x: absoluteFrame.x, y: absoluteFrame.y },
        }),
      ];
    }

    if (node.type === "grid") {
      return [
        current,
        ...collectGridNodes(node, {
          ...context,
          depth: context.depth + 1,
          parentPath: path,
          origin: absoluteFrame,
        }),
      ];
    }

    const children = getChildCollections(node).flatMap(
      (childNodes, childIndex) =>
        collectNodes(childNodes, {
          ...context,
          depth: context.depth + 1,
          parentPath: `${path}.${childIndex}`,
          origin: { x: absoluteFrame.x, y: absoluteFrame.y },
        }),
    );

    return [current, ...children];
  });
}

function collectFlowNodes(
  nodes: FlowNode[],
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
): EditorNodeItem[] {
  return collectFlowNodesWithGap(nodes, context, 0);
}

function collectFlowNodesWithGap(
  nodes: FlowNode[],
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
  gap: number,
): EditorNodeItem[] {
  const items: EditorNodeItem[] = [];
  let cursorY = 0;

  for (const [index, node] of nodes.entries()) {
    const nodeOrigin = {
      x: context.origin.x,
      y: context.origin.y + cursorY,
    };

    items.push(
      ...collectNodes([node], {
        ...context,
        parentPath: `${context.parentPath}.${node.id || index}`,
        origin: nodeOrigin,
      }),
    );
    cursorY +=
      node.frame.y +
      measureEditorFlowNodeHeight(node) +
      (index < nodes.length - 1 ? gap : 0);
  }

  return items;
}

function collectStackNodes(
  node: StackNode,
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
): EditorNodeItem[] {
  if (node.direction === "vertical") {
    return collectFlowNodesWithGap(node.children, context, node.gap);
  }

  const items: EditorNodeItem[] = [];
  let cursorX = 0;

  for (const [index, child] of node.children.entries()) {
    const nodeOrigin = {
      x: context.origin.x + cursorX,
      y: context.origin.y,
    };

    items.push(
      ...collectNodes([child], {
        ...context,
        parentPath: `${context.parentPath}.${child.id || index}`,
        origin: nodeOrigin,
      }),
    );
    cursorX +=
      Math.max(0, child.frame.x) +
      measureEditorFlowNodeWidth(child) +
      (index < node.children.length - 1 ? node.gap : 0);
  }

  return items;
}

function collectGridNodes(
  node: GridNode,
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
): EditorNodeItem[] {
  const items: EditorNodeItem[] = [];
  let rowY = context.origin.y;

  if (node.header) {
    items.push(
      ...collectGridRowNodes(node, node.header, {
        ...context,
        parentPath: `${context.parentPath}.header`,
        origin: { x: context.origin.x, y: rowY },
      }),
    );
    rowY += measureEditorGridRowHeight(node, node.header);
  }

  for (const [index, row] of editorGridBodyRows(node).entries()) {
    items.push(
      ...collectGridRowNodes(node, row, {
        ...context,
        parentPath: `${context.parentPath}.row.${index}`,
        origin: { x: context.origin.x, y: rowY },
      }),
    );
    rowY += measureEditorGridRowHeight(node, row);
  }

  if (node.footer) {
    items.push(
      ...collectGridRowNodes(node, node.footer, {
        ...context,
        parentPath: `${context.parentPath}.footer`,
        origin: { x: context.origin.x, y: rowY },
      }),
    );
  }

  return items;
}

function collectGridRowNodes(
  node: GridNode,
  row: GridNode["row"],
  context: Pick<
    EditorNodeItem,
    "pageId" | "layerId" | "layerKind" | "depth"
  > & { parentPath: string; origin: Pick<Frame, "x" | "y"> },
): EditorNodeItem[] {
  const items: EditorNodeItem[] = [];
  let columnX = 0;

  for (const column of node.columns) {
    const cell = findGridCell(row, column.id);

    if (cell) {
      items.push(
        ...collectNodes(cell.content, {
          ...context,
          parentPath: `${context.parentPath}.${column.id}`,
          origin: {
            x: context.origin.x + columnX,
            y: context.origin.y,
          },
        }),
      );
    }

    columnX += column.width;
  }

  return items;
}

function updateNodeInCollection(
  nodes: EditableNode[],
  nodeId: string,
  update: (node: EditableNode) => void,
): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.id === nodeId) {
      // Isolate the node before mutating. Templates often share nested objects
      // (e.g. a common `style` reference across many text nodes), and
      // structuredClone preserves that aliasing, so an in-place edit would
      // otherwise leak into every sibling that shares the reference.
      const isolated = structuredClone(node);
      update(isolated);
      nodes[index] = isolated;
      return true;
    }

    for (const children of getChildCollections(node)) {
      if (updateNodeInCollection(children, nodeId, update)) {
        return true;
      }
    }
  }

  return false;
}

function updateNodeFramesInCollection(
  nodes: EditableNode[],
  updates: Record<string, Partial<Frame>>,
): boolean {
  let changed = false;

  for (const node of nodes) {
    const update = updates[node.id];

    if (update) {
      node.frame = {
        ...node.frame,
        ...update,
      };
      changed = true;
    }

    for (const children of getChildCollections(node)) {
      changed = updateNodeFramesInCollection(children, updates) || changed;
    }
  }

  return changed;
}

function getChildCollections(node: EditableNode): EditableNode[][] {
  switch (node.type) {
    case "shape":
      return node.children ? [node.children] : [];
    case "group":
    case "flowRegion":
    case "section":
    case "stack":
      return [node.children];
    case "repeat": {
      const collections: EditableNode[][] = [node.children];
      if (node.header) {
        collections.push(node.header);
      }
      if (node.emptyState) {
        collections.push(node.emptyState);
      }
      return collections;
    }
    case "grid":
      return gridChildCollections(node);
    case "conditional":
      return node.fallback ? [node.children, node.fallback] : [node.children];
    default:
      return [];
  }
}

/**
 * Whether a node can hold children (and therefore accept "inside" drops and
 * show a collapse caret in the layers panel). Shapes are included so they can
 * be used as containers/backgrounds.
 */
function isContainerNode(node: EditableNode): boolean {
  switch (node.type) {
    case "shape":
    case "group":
    case "flowRegion":
    case "section":
    case "stack":
    case "repeat":
    case "conditional":
    case "grid":
      return true;
    default:
      return false;
  }
}

/**
 * Returns the primary child collection to insert into, initializing the array
 * for shapes (whose `children` starts undefined) so the first "inside" drop has
 * somewhere to land. Returns undefined for non-container nodes.
 */
function getWritableChildCollection(
  node: EditableNode,
): EditableNode[] | undefined {
  if (node.type === "shape") {
    if (!node.children) {
      node.children = [];
    }
    return node.children as EditableNode[];
  }

  if (node.type === "grid") {
    return getGridPrimaryContentCollection(node);
  }

  return getChildCollections(node)[0];
}

function measureEditorFlowNodeHeight(node: FlowNode): number {
  if (node.type === "group") {
    return Math.max(node.frame.height, measureChildrenBottom(node.children));
  }

  if (node.type === "stack") {
    return Math.max(node.frame.height, measureStackHeight(node));
  }

  if (node.type === "section") {
    return Math.max(node.frame.height, measureSectionHeight(node));
  }

  if (node.type === "conditional") {
    return Math.max(node.frame.height, measureChildrenBottom(node.children));
  }

  if (node.type === "repeat") {
    return repeatEditorHeight(node);
  }

  if (node.type === "grid") {
    return gridEditorHeight(node);
  }

  return node.frame.height;
}

function measureChildrenBottom(children: Array<DocNode | FlowNode>): number {
  return children.reduce(
    (bottom, child) =>
      Math.max(bottom, child.frame.y + measureNodeHeight(child)),
    0,
  );
}

function measureNodeHeight(node: DocNode | FlowNode): number {
  if (
    node.type === "group" ||
    node.type === "flowRegion" ||
    node.type === "conditional"
  ) {
    return Math.max(node.frame.height, measureChildrenBottom(node.children));
  }

  if (node.type === "section") {
    return Math.max(node.frame.height, measureSectionHeight(node));
  }

  if (node.type === "stack") {
    return Math.max(node.frame.height, measureStackHeight(node));
  }

  if (node.type === "grid") {
    return gridEditorHeight(node);
  }

  return node.frame.height;
}

function measureStackHeight(node: StackNode): number {
  if (node.direction === "horizontal") {
    const childrenBottom = node.children.reduce((bottom, child) => {
      return Math.max(bottom, child.frame.y + measureNodeHeight(child));
    }, 0);

    return Math.max(node.frame.height, childrenBottom);
  }

  const childrenHeight = node.children.reduce((height, child, index) => {
    return (
      height +
      (index === 0 ? 0 : node.gap) +
      child.frame.y +
      measureNodeHeight(child)
    );
  }, 0);

  return Math.max(node.frame.height, childrenHeight);
}

function measureEditorFlowNodeWidth(node: FlowNode): number {
  if (node.type === "stack") {
    return measureStackWidth(node);
  }

  return node.frame.width;
}

function measureStackWidth(node: StackNode): number {
  if (node.direction === "vertical") {
    const childrenRight = node.children.reduce((right, child) => {
      return Math.max(right, child.frame.x + measureEditorFlowNodeWidth(child));
    }, 0);

    return Math.max(node.frame.width, childrenRight);
  }

  const childrenWidth = node.children.reduce((width, child, index) => {
    return (
      width +
      (index === 0 ? 0 : node.gap) +
      Math.max(0, child.frame.x) +
      measureEditorFlowNodeWidth(child)
    );
  }, 0);

  return Math.max(node.frame.width, childrenWidth);
}

function measureSectionHeight(node: SectionNode): number {
  const padding = sectionPadding(node);
  const gap = node.layout?.gap ?? 0;
  const childrenHeight = node.children.reduce((height, child, index) => {
    return (
      height +
      (index === 0 ? 0 : gap) +
      child.frame.y +
      measureNodeHeight(child)
    );
  }, 0);

  return padding.top + childrenHeight + padding.bottom;
}

function sectionPadding(node: SectionNode) {
  return node.layout?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
}

function resolveInlineContent(content: InlineContent[]): string {
  return content
    .map((part) => {
      if (part.kind === "text") {
        return part.text;
      }

      return bindingPlaceholder(part.binding);
    })
    .join("");
}

function resolveDynamicValue(value: DynamicValue): string {
  if (value.kind === "literal") {
    return value.value;
  }

  if (value.kind === "binding") {
    return bindingPlaceholder(value.binding);
  }

  if (value.kind === "formula") {
    return "{{formula}}";
  }

  return resolveInlineContent(value.parts);
}

function resolveImageSource(
  source: ImageSource,
  assets: Map<string, AssetDefinition>,
): { src: string; placeholder?: string } {
  if (source.kind === "url") {
    return { src: source.url };
  }

  if (source.kind === "asset") {
    return { src: assets.get(source.assetId)?.source ?? "" };
  }

  return {
    src: "",
    placeholder: bindingPlaceholder(source.binding),
  };
}

function dynamicValueHasBinding(value: DynamicValue): boolean {
  if (value.kind === "binding") {
    return true;
  }

  return (
    value.kind === "template" &&
    value.parts.some((part) => part.kind === "field")
  );
}

function gridLabel(node: GridNode): string {
  return `Grid: ${node.columns.length} columns`;
}

function sectionLabel(node: SectionNode): string {
  return node.name ?? "Section";
}

function stackLabel(node: StackNode): string {
  return (
    node.name ??
    (node.direction === "horizontal" ? "Horizontal stack" : "Vertical stack")
  );
}

function repeatEditorHeight(node: RepeatNode): number {
  const headerHeight = node.header?.length ? measureChildrenBottom(node.header) : 0;
  return Math.max(
    node.frame.height,
    headerHeight + measureChildrenBottom(node.children) + 92,
  );
}

function gridEditorHeight(node: GridNode): number {
  const headerHeight = node.header
    ? measureEditorGridRowHeight(node, node.header)
    : 0;
  const bodyHeight = editorGridBodyRows(node).reduce(
    (height, row) => height + measureEditorGridRowHeight(node, row),
    0,
  );
  const footerHeight = node.footer
    ? measureEditorGridRowHeight(node, node.footer)
    : 0;

  return Math.max(node.frame.height, headerHeight + bodyHeight + footerHeight);
}

function measureEditorGridRowHeight(
  node: GridNode,
  row: GridNode["row"],
): number {
  const contentBottom = row.cells.reduce((bottom, cell) => {
    const cellBottom = cell.content.reduce(
      (max, child) =>
        Math.max(max, child.frame.y + measureEditorFlowNodeHeight(child)),
      0,
    );
    return Math.max(bottom, cellBottom);
  }, 0);

  return Math.max(node.rowHeight, contentBottom);
}

function gridChildCollections(node: GridNode): EditableNode[][] {
  const rows = [node.header, ...editorGridBodyRows(node), node.footer].filter(
    (row): row is GridNode["row"] => Boolean(row),
  );

  return rows.flatMap((row) =>
    row.cells.map((cell) => cell.content as EditableNode[]),
  );
}

function getGridPrimaryContentCollection(
  node: GridNode,
): EditableNode[] | undefined {
  const firstColumn = node.columns[0];
  const bodyRow = editorGridBodyRows(node)[0] ?? node.row;
  const cell = firstColumn
    ? findGridCell(bodyRow, firstColumn.id)
    : bodyRow.cells[0];

  return cell?.content as EditableNode[] | undefined;
}

function gridPrimaryContentOrigin(
  node: GridNode,
  absoluteFrame: Pick<Frame, "x" | "y">,
): Pick<Frame, "x" | "y"> | undefined {
  const firstColumn = node.columns[0];
  const bodyRow = editorGridBodyRows(node)[0] ?? node.row;
  const cell = firstColumn
    ? findGridCell(bodyRow, firstColumn.id)
    : bodyRow.cells[0];

  if (!cell) {
    return undefined;
  }

  const headerHeight = node.header
    ? measureEditorGridRowHeight(node, node.header)
    : 0;

  return {
    x: absoluteFrame.x,
    y: absoluteFrame.y + headerHeight,
  };
}

function findGridCell(row: GridNode["row"], columnId: string) {
  return row.cells.find((cell) => cell.columnId === columnId);
}

function editorGridBodyRows(node: GridNode): GridNode["row"][] {
  return node.binding ? [node.row] : node.staticRows?.length ? node.staticRows : [node.row];
}

function bindingPlaceholder(binding: BindingRef): string {
  return `{{${binding.path}}}`;
}

function offsetFrame(frame: Frame, origin: Pick<Frame, "x" | "y">): Frame {
  return {
    ...frame,
    x: origin.x + frame.x,
    y: origin.y + frame.y,
  };
}

function editorFrameForNode(
  node: EditableNode,
  origin: Pick<Frame, "x" | "y">,
): Frame {
  const frame = offsetFrame(node.frame, origin);

  if (node.type === "repeat") {
    return {
      ...frame,
      height: repeatEditorHeight(node),
    };
  }

  if (node.type === "section") {
    return {
      ...frame,
      height: Math.max(node.frame.height, measureSectionHeight(node)),
    };
  }

  if (node.type === "stack") {
    return {
      ...frame,
      width: measureStackWidth(node),
      height: measureStackHeight(node),
    };
  }

  if (node.type === "grid") {
    return {
      ...frame,
      height: gridEditorHeight(node),
    };
  }

  return frame;
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

function humanizeId(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function typedShortLabel(typeLabel: string, id: string): string {
  const short = shortNodeId(id);
  return short ? `${typeLabel} · ${short}` : typeLabel;
}

/** Prefer a compact id fragment for UUID-ish keys; drop noise from short slugs. */
function shortNodeId(id: string): string | undefined {
  const trimmed = id.trim();
  if (!trimmed) {
    return undefined;
  }

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    ) || /^[0-9a-f]{16,}$/i.test(trimmed);

  if (uuidLike) {
    return trimmed.slice(0, 8);
  }

  // Already human-ish ids (title, page-two-title) stay readable via type label alone.
  if (/^[a-z][a-z0-9_-]{0,24}$/i.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return undefined;
  }

  return trimmed.length > 10 ? trimmed.slice(0, 8) : trimmed;
}

function truncateLabel(value: string, max = 40): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }
  if (collapsed.length <= max) {
    return collapsed;
  }
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

function titleCaseType(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
