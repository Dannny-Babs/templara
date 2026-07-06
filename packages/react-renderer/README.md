# @templara/react-renderer

React preview surface for rendered Templara documents.

This package takes a `RenderDocumentResult` from `@templara/renderer` and paints it in the browser. It supports text, shapes, images, barcodes, QR codes, debug overlays, and source-node selection callbacks.

## Preview

```tsx
import { DocumentPreview } from "@templara/react-renderer";
import { renderDocument } from "@templara/renderer";
import { shipmentBolSampleData, shipmentBolTemplate } from "@templara/templates";

const document = renderDocument({
  template: shipmentBolTemplate,
  data: shipmentBolSampleData,
  mode: "preview",
});

export function Preview() {
  return <DocumentPreview document={document} scale={1} showDebug={false} />;
}
```

## Notes

- This package is visual only; it does not own pagination or binding logic.
- Barcode and QR rendering use `bwip-js` in the browser.
- For PDF export, render pages first and pass the page elements to `@templara/pdf`.
