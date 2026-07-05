# Creating A Custom Document Engine Instead Of Using HTML Templates

The obvious shortcut for Templara would have been HTML templates.

Use HTML. Add handlebars. Render data. Print to PDF.

That path is tempting because the browser already knows layout, styling, fonts, images, and printing. For many products, that is enough.

It was not enough for Templara.

Templara is trying to become a browser-native visual authoring platform for structured business documents. The user edits a template like a design file, binds it to data, previews it, and exports deterministic output.

That product needs a document engine, not just HTML.

## The Problem With HTML As The Source Of Truth

HTML is a great output format. It is not a great authoring format for this product.

Templara needs to understand:

- pages
- page presets
- margins
- layers
- authored nodes
- fixed frames
- flow regions
- repeat templates
- data schemas
- variables
- bindings
- field formatting
- conditionals
- generated codes
- validation
- migrations
- export diagnostics

If the template is raw HTML, most of those concepts become conventions hidden inside markup.

That makes the editor harder to build. It also makes validation and migration harder.

## JSON Gives Templara A Document Language

Templara uses JSON as the source of truth:

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
```

That gives the engine a stable contract.

A page is a page. A layer is a layer. A repeat is a repeat. A barcode is a barcode. A binding is a structured reference, not a string hidden in the DOM.

For example, text content is structured:

```ts
export type InlineContent = TextRun | FieldRun;

export interface FieldRun {
  kind: "field";
  label: string;
  binding: BindingRef;
  fallback?: string;
  format?: FieldFormat;
}
```

That is much easier to inspect than parsing text nodes for `{{...}}` patterns.

## Repeats Need Semantics

Repeats are one of the strongest reasons not to use HTML as the primary template format.

In Templara, a repeat is a real node:

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

The editor can show that node as one editable template row.

The renderer can expand it into many rows.

The pagination engine can measure those rows and move overflow to continuation pages.

The diagnostics system can report that the repeat binding did not resolve to an array.

If this were just HTML, all of that behavior would need to be inferred from markup conventions.

## The Editor Needs Authored Structure

The editor cannot show final rendered output as its main canvas.

If sample data has 100 invoice line items, the editor should not show 100 rows as editable design objects. It should show one template row.

That is why the editor reads authored template JSON and builds an editor page model:

```ts
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
```

The editor needs template structure. HTML output cannot be the only truth.

## The Renderer Needs Determinism

The renderer accepts template JSON and data JSON:

```ts
export interface RenderDocumentInput {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
  mode?: RenderMode;
  measurement?: MeasurementProvider;
  fonts?: FontDefinition[];
  fontFamily?: string;
}
```

It returns a render result:

```ts
export interface RenderDocumentResult {
  pages: RenderPage[];
  warnings: RenderWarning[];
  repeatAnalyses: RepeatFitAnalysis[];
  fonts: RenderFontDefinition[];
  selectedFontFamily?: string;
}
```

This is a stronger contract than "here is some HTML, print it."

The renderer can be tested with fixtures. It can return warnings. It can expose repeat-fit analysis. It can support browser preview and future server rendering from the same output shape.

## HTML Can Still Be An Output

This is not an anti-HTML argument.

HTML is still useful for:

- browser preview
- export surfaces
- embeddable display
- future HTML output

But HTML should be downstream of the document engine.

The authoring format should be the structured template. The renderer should produce a render tree. React or HTML can display that render tree.

```txt
Template JSON + Data JSON
        |
        v
Deterministic Renderer
        |
        v
Render Tree
        |
        +--> React Preview
        +--> Browser PDF
        +--> HTML Export later
```

That keeps the product flexible.

## The Tradeoff

Building a custom document engine costs more upfront.

You have to define:

- schema
- validation
- renderer semantics
- measurement
- pagination
- diagnostics
- editor model
- export preflight

But the payoff is control.

Templara can make repeats first-class. It can keep the editor and renderer separate. It can validate templates. It can migrate old templates. It can explain page breaks. It can expose package APIs for embedding.

That is the reason for the custom engine.

HTML can render documents. Templara needs to author, understand, validate, paginate, debug, and export them.
