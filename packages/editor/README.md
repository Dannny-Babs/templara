# @templara/editor

Embeddable browser editor for authoring Templara document templates.

The editor is controlled by the host app. It shows authored template structure on one active page and leaves pagination, repeat expansion, and final data resolution to `@templara/renderer`.

## Embed

```tsx
import { useState } from "react";
import { DocumentEditor } from "@templara/editor";
import { invoiceSampleData, invoiceTemplate } from "@templara/templates";

export function TemplateStudio() {
  const [template, setTemplate] = useState(invoiceTemplate);
  const [data, setData] = useState(invoiceSampleData);

  return (
    <DocumentEditor
      value={template}
      data={data}
      documentTitle="Invoice Template"
      documentStatus="draft"
      embedded
      hideBrand
      hostDesignTokens={{
        fontFamily: "Noto Sans, sans-serif",
        color: {
          bg: "#f6f9fb",
          accent: "#225ed2",
          buttonPrimary: "#225ed2",
        },
        radii: { control: "0.4rem" },
      }}
      onChange={setTemplate}
      onDataChange={setData}
      onSave={(nextTemplate, nextData) => {
        setTemplate(nextTemplate);
        setData(nextData ?? {});
      }}
    />
  );
}
```

## Public Props

- `value`: controlled `DocumentTemplate`.
- `data`: sample JSON used by preview and data binding tools.
- `onChange`: template update callback.
- `onDataChange`: sample data update callback.
- `documentTitle`: optional title for the top toolbar.
- `documentStatus`: `"draft"`, `"dirty"`, or `"saved"`.
- `onSave`: host-owned save callback.
- `initialPageId`: initial active page.
- `onActivePageChange`: active page callback.
- `brandLogo` / `brandLogoSrc`: optional host brand mark for the toolbar.
- `embedded`: when true, omit the default Templara wordmark and inherit the host font unless `hostDesignTokens.fontFamily` is set.
- `hideBrand`: when true, omit the default Templara wordmark (standalone Studio stays branded unless this or `embedded` is set). Hosts may still pass `brandLogo` / `brandLogoSrc`.
- `hostDesignTokens`: optional chrome tokens (fonts, colors, radii, shadows). Applied as `--templara-*` CSS variables on the editor shell with Templara fallbacks. Prefer cascading host `:root` CSS vars when available; pass this prop for iframe/shadow-DOM or explicit overrides.
- `toolbarAccessory`: optional host control beside the document title.

## Defaults (embed-friendly)

- Canvas layout aids (`showGrid`, rulers, bleed, margin guides, printable area, safe area, page shadow, crop marks) default **off** so authors see a clean template. Snap-to-grid/guides stay on (no painted overlays). Users can re-enable aids from the inspector/workspace toggles.

## Host Responsibilities

- Persist projects outside the editor.
- Validate and migrate templates before loading saved JSON.
- Export through preview/render packages.
- Keep the renderer/editor split intact.
- When embedding in a host product, set `embedded` (and/or `hideBrand`) and optionally `hostDesignTokens` so chrome matches the host design system.
