# Building A Figma-Inspired Document Rendering Engine In React

Templara looks like a visual editor, but the hard part is not drawing boxes on a canvas.

The hard part is making those boxes mean something after real data shows up.

A normal Figma-style canvas is mostly about direct manipulation: select, drag, resize, align, group, reorder. Templara needs that same feeling, but for business documents that also have bindings, repeats, generated barcodes, QR codes, page sizes, margins, preview output, and export diagnostics.

That is why the engine is split into two rendering ideas:

- the editor canvas renders authored template structure
- the preview renderer renders final document output

React is the browser surface for both, but React is not the layout engine. React displays the result of a document model.

## The Core Shape

Templara starts with template JSON:

```ts
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
```

The editor treats that JSON like a design document. It has pages, layers, nodes, frames, and styles. That is the Figma-inspired part.

But Templara also has document-specific node types:

- text
- image
- shape
- barcode
- QR
- group
- flow region
- section
- stack
- repeat
- conditional
- grid

Those nodes let the canvas stay visual while still describing a real document runtime.

## Document Pixels

The browser is the primary authoring surface, so the internal unit is a document pixel.

```txt
1 document px = 1 CSS px = 1/96 inch
1 PDF point   = 1/72 inch
1 document px = 0.75 PDF points
```

That gives the canvas a natural coordinate system:

```ts
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
} as const;
```

The editor can position nodes exactly. Export can convert at the boundary.

## React Paints The Render Tree

The final preview path goes through `@templara/renderer` first. The renderer returns pages and render nodes. Then `@templara/react-renderer` paints those pages in the browser.

The React preview API is intentionally small:

```ts
export interface DocumentPreviewProps {
  document: RenderDocumentResult;
  scale?: number;
  className?: string;
  showDebug?: boolean;
  selectedSourceNodeId?: string;
  onNodePointerDown?: (event: PointerEvent<HTMLElement>, node: RenderNode) => void;
  onPagePointerDown?: (event: PointerEvent<HTMLElement>, page: RenderPage) => void;
}
```

A rendered page becomes a positioned browser surface:

```ts
function RenderPageView({ page, scale, showDebug }: {
  page: RenderPage;
  scale: number;
  showDebug: boolean;
}): ReactElement {
  return createElement(
    "div",
    {
      "data-templara-page-id": page.id,
      style: {
        position: "relative",
        width: page.width,
        height: page.height,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        background: "white",
        overflow: "hidden"
      }
    },
    [
      ...page.children.map((node) =>
        createElement(RenderNodeView, { key: node.id, node })
      ),
      showDebug ? createElement(DebugOverlay, { key: "debug", boxes: page.debugBoxes }) : null
    ]
  );
}
```

The important point is that React is not deciding pagination. It is not expanding repeats. It is not resolving variables. It is painting a render tree that already exists.

That keeps preview deterministic and testable.

## Nodes Become DOM

Every render node has a frame:

```ts
export interface BaseRenderNode {
  id: string;
  sourceNodeId: string;
  frame: Frame;
  rotation?: number;
  opacity?: number;
}
```

React maps that frame to absolute positioning:

```ts
const baseStyle: CSSProperties = {
  position: "absolute",
  left: node.frame.x,
  top: node.frame.y,
  width: node.frame.width,
  height: node.frame.height,
  opacity: node.opacity,
  transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
  transformOrigin: "center"
};
```

Text nodes become `div`s. Image nodes become `img`s or placeholders. Shape nodes become styled boxes. Barcode and QR nodes go through generated-code rendering hooks.

That lets the browser do what it is good at: paint pixels, load fonts, display images, and handle preview interaction.

## Debug Output Is Part Of The Engine

Business documents need explainability.

If a repeat overflows or a row moves to the next page, the user should be able to understand why. The renderer returns debug boxes:

```ts
export interface RenderDebugBox {
  id: string;
  sourceNodeId: string;
  kind: "flow-region" | "section-frame" | "repeat-frame" | "repeat-row" | "page-break" | "measured-text";
  frame: Frame;
  label: string;
  color: string;
}
```

That means the React preview can show visual layout diagnostics without becoming the layout engine itself.

This is the right separation:

```txt
renderer: decides layout and diagnostics
react-renderer: displays layout and diagnostics
```

## Why This Feels Like Figma But Is Not Figma

Templara borrows the interaction model from design tools:

- canvas
- frames
- layers
- selection
- snapping
- guides
- rulers
- inspector controls
- preview mode

But the output model is different.

Figma exports a designed artifact. Templara renders a designed template against data.

That is why the engine has to understand:

- bindings
- variables
- repeat scopes
- pagination
- generated codes
- export warnings
- missing data
- flow regions

The React layer gives Templara the responsive, browser-native product surface. The document engine gives it deterministic business output.

The result is a Figma-inspired editor, but not a Figma clone. It is a document rendering engine with a visual authoring shell.
