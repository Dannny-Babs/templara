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

## Host Responsibilities

- Persist projects outside the editor.
- Validate and migrate templates before loading saved JSON.
- Export through preview/render packages.
- Keep the renderer/editor split intact.
