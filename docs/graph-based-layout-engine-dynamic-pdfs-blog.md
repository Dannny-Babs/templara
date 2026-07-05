# How I Designed A Graph-Based Layout Engine For Dynamic PDFs

Templara's layout problem is not traditional web layout.

A business document has fixed regions, dynamic regions, repeated rows, page boundaries, generated codes, and export requirements. The system has to know what depends on what.

That makes the document feel less like a page of HTML and more like a graph:

```txt
template page
  -> layers
    -> nodes
      -> bindings
      -> variables
      -> repeat scopes
      -> flow regions
      -> page-break decisions
      -> render nodes
```

The current implementation is not a general graph solver. It is a deterministic tree/graph-shaped layout pipeline. But the mental model is graph-based: every rendered box is the result of relationships between template nodes, data paths, scopes, measurements, and page constraints.

## The Layout Graph

The source graph begins in the template:

```ts
export interface PageTemplate {
  id: string;
  name?: string;
  size: Size;
  margin?: Box;
  layers: PageLayer[];
}

export interface PageLayer {
  id: string;
  kind: "background" | "fixed" | "flow";
  nodes: DocNode[];
}
```

There are two major layout paths:

- fixed layers
- flow layers

Fixed nodes render where the designer placed them. Flow nodes can move through a cursor, measure their content, and paginate.

The renderer starts each page by rendering fixed layers, then flow regions:

```ts
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
        renderFlowRegion(state, sourcePage, pageIndex, node);
      }
    }
  }
}
```

That establishes the first split in the graph: fixed content and dynamic flow content.

## Flow Regions

A flow region defines where dynamic content is allowed to grow.

```ts
export interface FlowRegionNode extends BaseNode {
  type: "flowRegion";
  flowBoundary?: "frame" | "page-margin";
  children: FlowNode[];
}
```

The renderer turns a flow region into a cursor problem:

```ts
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
```

The cursor is small, but it carries the whole pagination story. It tells the renderer where the next node should go and which page it belongs to.

```ts
let cursor: FlowCursor = {
  pageIndex: initialPageIndex,
  y: region.frame.y
};

for (const child of region.children) {
  cursor = renderFlowNode(state, context, cursor, child, emptyScope(), {
    x: region.frame.x,
    y: 0
  });
}
```

Each flow node consumes a cursor and returns the next cursor. That is the core algorithm.

## Dynamic Nodes

Flow nodes are not all the same.

```ts
export type FlowNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | BarcodeNode
  | QrNode
  | SectionNode
  | StackNode
  | RepeatNode
  | ConditionalNode
  | GridNode
  | GroupNode;
```

The renderer dispatches by node type:

```ts
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
```

This makes the layout graph explicit. A node may depend on visibility logic, current data scope, measured height, available page space, and its authored frame.

## Repeats Are Subgraphs

Repeats create a subgraph for every item in an array.

```ts
export interface RepeatNode extends BaseNode {
  type: "repeat";
  binding: BindingRef;
  itemAlias: string;
  layout: RepeatLayout;
  children: FlowNode[];
  header?: FlowNode[];
  emptyState?: FlowNode[];
}
```

At render time, the repeat resolves its binding:

```ts
const value = resolveBinding(node.binding, state, scope);
const items = Array.isArray(value) ? value : [];
const baseRows = createRepeatRowPlans(state, node, scope, items);
```

Each item gets a row plan. Each row plan has children, scope, index, count, fixed height, minimum height, and planned height.

That row plan is the graph-expanded version of the template row.

Then the renderer decides what fits on the current page and what moves to continuation pages.

## Pagination Is A Constraint

The layout engine needs to satisfy page constraints:

- first page flow bottom
- continuation page top
- continuation page bottom
- row height
- gap
- keep-together behavior
- unbreakable overflow warnings

That is why `FlowContext` carries both first-page and continuation-page boundaries.

The renderer can then answer questions like:

- Does this row fit here?
- Should the section break before this node?
- Does a repeat block fit together on a fresh page?
- Is the content taller than any available page area?
- How many overflow rows remain?

The output includes repeat-fit analysis:

```ts
export interface RepeatFitAnalysis {
  sourceNodeId: string;
  bindingPath: string;
  itemCount: number;
  rowsFitOnStartPage: number;
  overflowItemCount: number;
  continuationPageCapacity: number;
  estimatedTotalPages: number;
  pagePlan: RepeatPageFit[];
}
```

This is not just for tests. It is product UX. The preview should be able to explain why the document paginated the way it did.

## From Render Tree To PDF

The renderer does not directly print a PDF. It creates a render tree:

```ts
export interface RenderDocumentResult {
  pages: RenderPage[];
  warnings: RenderWarning[];
  repeatAnalyses: RepeatFitAnalysis[];
  fonts: RenderFontDefinition[];
  selectedFontFamily?: string;
}
```

That render tree can feed:

- React preview
- browser-first PDF export
- future image export
- future server rendering
- tests and snapshots

That separation matters. PDF export should consume a planned document, not re-run its own layout semantics.

## Why Graph-Based Thinking Helps

Calling this graph-based is less about using a graph database or a complex solver. It is about respecting dependencies.

A rendered text box depends on:

- the source text node
- field runs
- data values
- variable values
- formatting
- measurement
- flow position
- page constraints

A rendered repeat row depends on:

- the repeat node
- its array binding
- item scope
- child nodes
- row height
- gap
- pagination state

A final PDF page depends on:

- page preset
- fixed nodes
- flow region decisions
- render warnings
- export preflight

Once you see the system that way, the architecture becomes clearer. The renderer is not a DOM painter. It is a deterministic graph expansion and layout pipeline for business documents.
