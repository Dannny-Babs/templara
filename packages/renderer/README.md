# @templara/renderer

Deterministic document renderer for Templara templates.

`renderDocument()` converts a template and JSON data into a paginated render tree. It resolves bindings, variables, visibility logic, repeats, semantic grids, generated codes, and render warnings. It does not render DOM.

## Render

```ts
import { renderDocument } from "@templara/renderer";
import { invoiceSampleData, invoiceTemplate } from "@templara/templates";

const result = renderDocument({
  template: invoiceTemplate,
  data: invoiceSampleData,
  mode: "preview",
});

console.log(result.pages.length);
console.log(result.warnings);
```

## Modes

- `template`: keeps authored structure visible for editor-style use.
- `preview`: resolves sample data and expands dynamic content.
- `export`: same deterministic output path intended for final export.

## Output

The render tree is consumed by `@templara/react-renderer` for browser preview and by export helpers for preflight/PDF workflows.
