# @templara/pdf

Browser-first PDF export helpers for rendered Templara previews.

The current export path clones already-rendered preview page elements into an isolated print surface, applies exact page sizing, waits for fonts/images, and invokes the browser print/save-to-PDF workflow.

## Export

```ts
import { buildExportFontCss, collectExportDiagnostics, exportPreviewToPdf } from "@templara/pdf";
import type { RenderDocumentResult } from "@templara/renderer";

async function exportRenderedPreview(document: RenderDocumentResult) {
  const diagnostics = collectExportDiagnostics(document);
  const blocking = diagnostics.diagnostics.filter((item) => item.severity === "error");

  if (blocking.length > 0) {
    return { status: "blocked" as const, message: blocking[0].message };
  }

  const pageElements = Array.from(
    window.document.querySelectorAll<HTMLElement>("[data-templara-page-id]"),
  );

  return exportPreviewToPdf(
    pageElements,
    document.pages.map((page) => ({ width: page.width, height: page.height })),
    { title: "Templara Document", fontCss: buildExportFontCss(document) },
  );
}
```

## Scope

This package does not re-render documents. It validates and exports the preview surface produced by the renderer and React preview.
