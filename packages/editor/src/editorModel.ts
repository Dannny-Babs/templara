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
  const childContext: RenderContext = {
    ...context,
    depth: context.depth + 1,
    parentPath: path,
    parentId: node.id,
    origin: { x: absoluteFrame.x, y: absoluteFrame.y },
  };

  return [
    createContainerNode(
      node,
      context,
      absoluteFrame,
      "repeat",
      `Repeat: ${node.binding.path}`,
    ),
    ...renderNodeCollection(node.children, childContext),
  ];
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
    label: node.name ?? humanizeId(node.id),
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
      label: node.name ?? humanizeId(node.id),
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
    case "group":
    case "flowRegion":
    case "section":
    case "stack":
      return [node.children];
    case "repeat":
      return node.emptyState
        ? [node.children, node.emptyState]
        : [node.children];
    case "conditional":
      return node.fallback ? [node.children, node.fallback] : [node.children];
    default:
      return [];
  }
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
  return Math.max(node.frame.height, measureChildrenBottom(node.children) + 92);
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
