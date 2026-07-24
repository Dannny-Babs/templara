# P1 — Document Builder (Editor) Architecture — "Doc Builder 1" (Handlebars)

Read-only discovery of Rose Rocket's **current** document editing system, produced as prep for
integrating the JSON-based "Templara"/Doc Builder 2 engine alongside it. Every claim below is backed
by a file path and a verbatim excerpt. Contradictions with the briefing assumptions are called out in
the final section.

Repo root: `/Users/danielbabalola/RoseRocket/src/github.com/RoseRocket/platform-components`

---

## 1. Architecture summary

Doc Builder 1 is a **Handlebars-string** editor. A `DocumentTemplate` record stores the template as an
HTML/Handlebars **string** on the `templateData` field. The authoring surface is an external Bit/npm
package, `@roserocket/components.document-template-editor` (a Lexical-based WYSIWYG rich-text editor),
mounted by a thin host integration in `ui/src/scripts/platform/core/DocumentBuilderAdmin/`. There is
also a **second, code-mode editor** (Monaco) built entirely in the host repo for raw Handlebars editing.

Key pieces:

- **Route / screen**: `#/ops/document-builder-admin/:templateId` (hash route inside the Ops app), guarded
  by `FourBuildersAccessACLRoute`. Renders `DocumentBuilderContainer` with `recordId = templateId`.
- **Host container**: `DocumentBuilderContainer.tsx` → `useDocumentBuilderContext(recordId)` (all data +
  actions) → presentational `DocumentBuilder.tsx`.
- **Two editors, mutually exclusive** (toggled by `isCodeMode`):
  - Visual: `<DocumentTemplateEditor>` from the external package (Lexical WYSIWYG).
  - Code: `<DocumentCodeEditor>` — Monaco + live split-pane preview, built in-repo.
- **Load**: RR2 SDK action `documentTemplate/readTemplate/1.0` returns `templateData`, doc type, root
  object, page-number flag, `isCodeMode`, and up to 10 recent records for preview cycling.
- **Save**: `rr2sdk.objectRecord.updateById(recordId, …)` writes `{ templateData, showPageNumbers,
  [isCodeMode] }` onto the `documentTemplate` object record. There is **no** dedicated "save" action —
  it's a generic object-record update.
- **Field picker**: fed by the host, not the server. `useIngredientObjectFields()` reads the current
  recipe's `objects` ingredient (client-side, via React Query) and flattens fields into a `Field[]`.
  Depth is **one level** (root object fields + a `connectionKey` marker); the picker resolves deeper
  paths lazily through the same flat list.
- **Preview**: always a **server** round-trip to an external **document-generator** service. Visual
  editor → HTML preview (`documentGeneration/getBOLPreview/1.0`). Code editor → PDF preview
  (`documentTemplate/previewPdf/1.0`). Both build a Handlebars context server-side and POST it to
  `document-generator` over HTTP.
- **Gating**: org-level entitlement flags (`builders.access.secondaryBuilderBundle` OR
  `builders.access.fullAccess`) plus a role allow-list. No per-doc-type feature flag on the editor
  itself. Server actions enforce record-level `viewer`/`editor` permissions.

### `documentContext.helpers.ts` — where does it fit?

`platform-model/.../system/helpers/documentContext.helpers.ts` is **not** the field-list source for the
picker (the briefing's framing is slightly off — see Contradictions). It is the **server-side record
context builder** used at **preview/generation** time. `getRecordContextForDocument` parses the template
string for `{{…}}` paths (`extractTemplatePaths`), validates them against the object config, reads only
those paths off the record, and formats values (money, datetime, select/status labels, measurements)
into the Handlebars context object. So it governs *which record data reaches the renderer*, not *which
fields the author can pick*.

---

## 2. Data-flow diagram (load → edit → field insert → preview → save)

```
                         ┌──────────────────────────────────────────────────────────────┐
                         │  Route: #/ops/document-builder-admin/:templateId               │
                         │  (OpsRoutes.js, FourBuildersAccessACLRoute)                     │
                         └───────────────────────────────┬──────────────────────────────┘
                                                         │ recordId = templateId
                                                         ▼
                         ┌──────────────────────────────────────────────────────────────┐
                         │  DocumentBuilderContainer.tsx                                   │
                         │   → useDocumentBuilderContext(recordId)                         │
                         └───────────────────────────────┬──────────────────────────────┘
                                                         │
   ┌─────────────────────── LOAD ───────────────────────┼──────────────── FIELDS (client) ───────────┐
   │ rr2sdk.action.invoke('documentTemplate/readTemplate/1.0', {recordId})                             │
   │   → { templateData, documentType, rootObjectKey/Label, showPageNumbers,                           │
   │       isCodeMode, latestRecordId, recentRecords[≤10] }                                            │
   │ (+ board lookup + objectRecord.getById → isDefault)                                               │
   │                                                                                                   │
   │ useIngredientObjectFields()  → useCurrentRecipeIngredient(objects)  → selectFieldsFromObjects()   │
   │   → Field[] (objectKey, key, label, description, connectionKey)                                   │
   └───────────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                        ▼
                         ┌──────────────────────────────────────────────────────────────┐
                         │  DocumentBuilder.tsx  (isCodeMode ? code : visual)             │
                         └───────────────┬───────────────────────────────┬──────────────┘
                                         │                               │
                    visual (WYSIWYG)     ▼                               ▼   code (Handlebars)
        ┌────────────────────────────────────────┐      ┌────────────────────────────────────────┐
        │ <DocumentTemplateEditor>                │      │ <DocumentCodeEditor> (Monaco)            │
        │  @roserocket/components.                │      │  in-repo, split pane + live preview      │
        │  document-template-editor (Lexical)     │      │                                          │
        │  pluginConfig.fieldSelect  → insert     │      │  Format button (js-beautify)             │
        │    {{path}} merge fields                │      │  record nav (recentRecords)              │
        │  pluginConfig.fieldCode    → barcodes   │      │                                          │
        │  pluginConfig.previewOutput → HTML view │      │                                          │
        │  editorRef.getHTML()                    │      │  codeEditorRef.getCode()                 │
        └───────────────┬────────────────────────┘      └───────────────┬─────────────────────────┘
                        │ PREVIEW (HTML)                                 │ PREVIEW (PDF)
                        ▼                                                ▼
   rr2sdk.action.invoke('documentGeneration/          rr2sdk.action.invoke('documentTemplate/
     getBOLPreview/1.0',                                 previewPdf/1.0',
     {recordId, templateData, documentType})            {recordId, templateData, documentType,
        │                                                 showPageNumbers})
        ▼                                                     │
   getDocumentDataAndContext() ── builds context ────────────┤
     • orgContext  (getOrgContextForDocument)                │
     • recordContext (getRecordContextForDocument =          │
        parse {{paths}} → read record → format values)       │
     • documentContext (signatures, currentDate)             │
        │                                                     │
        ▼                                                     ▼
   getHTMLPreview() ──POST──►  document-generator      getPDFWithCodeReplacement()
     /api/v1/docs/platform/generate-document/preview     → getPDF()/getHTML() ──POST──► document-generator
        │                                                  /api/v1/docs/platform/generate-document[/pdf]
        ▼                                                     │
   { html }  → visual preview pane                        { pdfBase64 } → <embed> PDF in code pane

   ┌─────────────────────── SAVE ───────────────────────────────────────────────────────────────────┐
   │ DocumentBuilder._onClick():                                                                       │
   │   visual → editorRef.getHTML()   ┐                                                                │
   │   code   → codeEditorRef.getCode()┘ → onSave(templateData, isCodeMode?)                           │
   │ useDocumentBuilderContext._onSave():                                                              │
   │   rr2sdk.objectRecord.updateById(recordId, { boardId, objectKey:'documentTemplate',              │
   │       json: { templateData, showPageNumbers, [isCodeMode:true] } })                              │
   └─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The editor package: `@roserocket/components.document-template-editor`

### 3.1 Where it lives

- **Source of truth (upstream):** a separate repo — `component-library`, package directory
  `packages/organisms/components.document-template-editor`. From the resolved
  `node_modules/@roserocket/components.document-template-editor/package.json`:

```json
"repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/RoseRocket/component-library.git",
    "directory": "packages/organisms/components.document-template-editor"
},
```

- **Resolved in this repo:** `node_modules/@roserocket/components.document-template-editor/`,
  **version `4.6.4`**, published to GitHub Packages (`https://npm.pkg.github.com/`). It is a Lexical-based
  rich-text editor (`lexical`, `@lexical/*` `^0.39.0`, and `@roserocket/components.rich-text-input`).

Package entry points (`node_modules/@roserocket/components.document-template-editor/package.json`):

```json
"exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./DocumentTemplateRenderer": { "types": "./dist/DocumentTemplateRenderer/index.d.ts", "default": "./dist/DocumentTemplateRenderer/index.js" },
    "./styles": { "types": "./dist/styles/index.d.ts", "default": "./dist/styles/index.js" },
    "./conversionUtils": { "types": "./dist/conversionUtils/index.d.ts", "default": "./dist/conversionUtils/index.js" },
    "./testUtils": { "types": "./dist/testUtils.d.ts", "default": "./dist/testUtils.js" }
},
```

Built-in plugin surface (dist folders):
`FieldSelectPlugin`, `FieldCodePlugin`, `FieldImagePlugin`, `PreviewOutputPlugin`, `ControlFlowPlugin`,
`HTMLSourceCodePlugin`, `PageBreakPlugin`, `ViewModePlugin`.

### 3.2 Public API / props (resolved `.d.ts`)

Top-level exports — `dist/index.d.ts`:

```ts
export { DocumentTemplateEditor, type DocumentTemplateEditorAPI, type DocumentTemplateEditorPluginConfig, type DocumentTemplateEditorProps, type OnDocumentTemplateEditorChangeHandler, } from './DocumentTemplateEditor';
```

Component + props + imperative API — `dist/DocumentTemplateEditor/types.d.ts` (`index.d.ts` re-exports it):

```ts
import { type OnRichTextInputChangeHandler, type RichTextInputAPI, type RichTextInputProps } from '@roserocket/components.rich-text-input';
import React from 'react';
import { type HTMLPluginAPI } from './plugins/HTMLSourceCodePlugin/context';
import { type DocumentTemplateEditorPluginConfig } from './types';
export { type DocumentTemplateEditorPluginConfig, OnRichTextInputChangeHandler as OnDocumentTemplateEditorChangeHandler, };
export interface DocumentTemplateEditorAPI extends RichTextInputAPI, HTMLPluginAPI {
}
export type DocumentTemplateEditorProps = Omit<RichTextInputProps, 'plugins' | 'toolbar' | 'initialState'> & {
    /**
     * Initial HTML with which to populate the editor. Note that importing HTML into the editor
     * is a lossy process. Not all HTML elements or attributes will be preserved.
     *
     * If both initialState and initialHTML is set, initialState takes precedence.
     */
    initialHTML?: string;
    /**
     * Initial Lexical editor state as a serialized JSON string. This takes precedence over initialHTML
     * when both are provided. The state should be a valid Lexical editor state that can be parsed
     * and loaded into the editor.
     */
    initialState?: string;
    /**
     * Configuration object for customizing the behavior of built-in plugins. This allows you to
     * configure features like field selection, preview output, and other plugin-specific settings
     * to match your application's requirements.
     */
    pluginConfig?: DocumentTemplateEditorPluginConfig;
};
```

> Note: `initialState` accepts a **serialized Lexical editor-state JSON string** and takes precedence
> over `initialHTML`. The host does not use it today (it passes `initialHTML`), but this is a hook the
> editor already exposes for a JSON-state model — relevant to Templara.

Plugin config shape — `dist/DocumentTemplateEditor/types.d.ts`:

```ts
import { type FieldCodePluginConfig } from './plugins/FieldCodePlugin/context';
import { type FieldSelectPluginConfig } from './plugins/FieldSelectPlugin/context';
import { type PreviewOutputPluginConfig } from './plugins/PreviewOutputPlugin/context';
export interface DocumentTemplateEditorPluginConfig {
    fieldSelect?: FieldSelectPluginConfig;
    fieldCode?: FieldCodePluginConfig;
    /**
     * When set, we render a readOnly mode selector in the top-right of the toolbar.
     * Keep in mind this will let the user override readOnly
     */
    previewOutput?: PreviewOutputPluginConfig;
}
```

Field-select plugin config — `dist/DocumentTemplateEditor/plugins/FieldSelectPlugin/context.d.ts`:

```ts
import type { FieldPath, OnLoadFields } from '@roserocket/design.object-field-select-input';
import React from 'react';
export interface FieldSelectPluginConfig {
    objectKey: string;
    objectLabel: string;
    initialPath: FieldPath;
    onLoadFields: OnLoadFields;
}
```

Field-code plugin config (barcode/QR + loop contexts) —
`dist/DocumentTemplateEditor/plugins/FieldCodePlugin/context.d.ts`:

```ts
import type { FieldPath, OnLoadFields } from '@roserocket/design.object-field-select-input';
import React from 'react';
export interface LoopContextConfig {
    /** Loop variable prefix as used in handlebars, e.g. "item" or "this". */
    loopVariable: string;
    /** Human-readable label shown in context selector, e.g. "Shipment item". */
    objectLabel: string;
    initialPath: FieldPath;
    onLoadFields: OnLoadFields;
}
export interface FieldCodePluginConfig {
    objectKey: string;
    objectLabel: string;
    initialPath: FieldPath;
    onLoadFields: OnLoadFields;
    loopContexts?: LoopContextConfig[];
}
```

Preview-output plugin config (+ view modes) —
`dist/DocumentTemplateEditor/plugins/PreviewOutputPlugin/context.d.ts`:

```ts
import React from 'react';
export declare enum ViewMode {
    edit = "edit",
    preview = "preview",
    html = "html"
}
export interface PreviewOutputPluginConfig {
    recordFullId?: string;
    objectKey?: string;
    onGetPreview?: () => Promise<{
        html: string;
    }>;
}
```

Companion SSR renderer — `dist/DocumentTemplateRenderer/index.d.ts` (used to render trusted HTML the same
way the editor renders in read-only mode; note the "trusted input" caveat):

```ts
export interface DocumentTemplateRendererProps {
    className?: string;
    'data-test'?: string | null | undefined;
    /** HTML to render. The HTML should be trusted input and properly sanitized. */
    html?: string;
    maxHeight?: string;
    document?: Document;
    injectGlobalStyles?: boolean;
}
```

### 3.3 How the host mounts it

`ui/src/scripts/platform/core/DocumentBuilderAdmin/components/DocumentBuilder.tsx` (imports + mount):

```tsx
import {
    DocumentTemplateEditor,
    type DocumentTemplateEditorAPI,
    type DocumentTemplateEditorPluginConfig,
} from '@roserocket/components.document-template-editor';
```

```tsx
                ) : (
                    <DocumentTemplateEditor
                        key={`visual-${editorSessionKey}`}
                        ref={editorRef}
                        initialHTML={effectiveTemplate}
                        pluginConfig={pluginConfig}
                        onChange={() => {
                            setHasBeenModified(true);
                        }}
                    />
                )}
```

The imperative handle (`editorRef.current.getHTML()`) is how the host pulls the current HTML back out at
save time and for the visual-editor preview call.

> **Types gap worth noting:** the host's `documentBuilder.types.ts` derives `FieldCodePluginConfig` by
> conditional inference because the installed package types "do not yet export a `fieldCode` key" per its
> comment — but the resolved `4.6.4` `.d.ts` *does* export `fieldCode` (see 3.2). So the defensive cast
> in `useDocumentBuilderContext.ts` is now redundant against `4.6.4`. File:
> `ui/src/scripts/platform/core/DocumentBuilderAdmin/documentBuilder.types.ts`:

```ts
export type FieldCodePluginConfig = DocumentTemplateEditorPluginConfig extends {
    fieldCode?: infer T;
}
    ? T
    : unknown;
```

---

## 4. Host integration: screen/route, load, save

### 4.1 Route / screen

`ui/src/scripts/routes/ops/OpsRoutes.js`:

```js
const DocumentBuilder = createLoadable(
    () => import(/* webpackChunkName: "OpsDocumentBuilder" */ 'platform/core/DocumentBuilderAdmin')
);
```

```jsx
                    <FourBuildersAccessACLRoute
                        roles={[
                            USER_ROLES.superAdmin,
                            USER_ROLES.admin,
                            USER_ROLES.operations,
                            USER_ROLES.csr,
                            USER_ROLES.manager,
                        ]}
                        path={`${match.path}/document-builder-admin/:templateId`}
                        render={({ match }) => (
                            <DocumentBuilder recordId={match.params.templateId} />
                        )}
                    />
```

The entry point exported by the folder is the container —
`ui/src/scripts/platform/core/DocumentBuilderAdmin/index.ts`:

```ts
import Component from './DocumentBuilderContainer';

export default Component;
```

The `DocumentTemplate` object exposes the deep-link the boards use to open this screen —
`platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts`:

```ts
    get editorUrl(): string {
        return `_/#/ops/document-builder-admin/${this.$id}`;
    }
```

Breadcrumb "back" target from the editor —
`ui/src/scripts/platform/core/DocumentBuilderAdmin/documentBuilder.constants.tsx`:

```tsx
export const DOC_BUILDER_URL = '#/ops/settings/documentBuilder';
```

### 4.2 The field that holds the template

Confirmed: the template is a **Handlebars/HTML string** on `DocumentTemplate.templateData`.
`platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts`:

```ts
    @RText({
        label: 'Template data',
        description: 'Data used to generate document content.',
    })
    templateData?: string;
```

Related fields on the same object relevant to the editor:

```ts
    @RToggle({
        defaultValue: false,
        label: 'Show page numbers',
        description: 'Display page numbers in the footer of generated PDF documents.',
    })
    showPageNumbers: boolean;

    @RToggle({
        isHidden: true,
        defaultValue: false,
        label: 'Is code mode',
        description:
            'Indicates this template was last saved via the developer code editor and is not compatible with the visual editor.',
    })
    isCodeMode: boolean;

    @RText({
        isHidden: true,
        defaultValue: '1',
        label: 'Data format version',
        description: 'Version of the template data format.',
    })
    dataFormatVersion?: string;
```

> `dataFormatVersion` (default `'1'`) is a latent hook for versioning template payloads — directly
> relevant when Templara introduces a JSON format that must coexist with Handlebars v1.

The object is defined in the **system** recipe and marked `ObjectStability.experimental`,
`ObjectLevel.secondary`.

### 4.3 Load path (trace)

`ui/src/scripts/platform/core/DocumentBuilderAdmin/hooks/useDocumentBuilderContext.ts`:

```ts
const objectKey = 'documentTemplate';
```

```ts
    const _onGetInitTemplateData = useCallback(async () => {
        setEditorState(prev => ({ ...prev, isLoading: true }));
        cachedHtmlPreviewRef.current = null;
        cachedPdfPreviewRef.current = null;
        try {
            const templateResp: {
                rootObjectKey: string;
                rootObjectLabel: string;
                documentType: string;
                templateData: string;
                latestRecordId: string;
                latestRecordFullId: string;
                showPageNumbers: boolean;
                isCodeMode: boolean;
                recentRecords: { id: string; label: string }[];
            } = await rr2sdk.action.invoke(
                `${objectKey}/readTemplate/1.0`,
                {
                    recordId,
                },
                ''
            );

            const board = await rr2sdk.board.findRecipeBoardByObjectKey(objectKey);
            const templateRecord = await rr2sdk.objectRecord.getById({
                id: recordId,
                objectKey,
                boardId: board.id,
            });

            setData(prev => ({
                ...prev,
                ...templateResp,
                isDefaultTemplate: templateRecord.isDefault,
                boardId: board.id,
            }));
            setEditorState(prev => ({ ...prev, isLoading: false }));
        } catch (error: unknown) {
            setEditorState(prev => ({ ...prev, isLoading: false }));
            toastActions.error(`Failed to load template data: ${(error as Error).message}`);
        }
    }, [recordId, rr2sdk, toastActions]);
```

Server side — `recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts`, `readTemplate` action.
Notable: if `templateData` is empty it falls back to a **base template file on disk** via
`findBaseTemplateData`, and it eagerly fetches up to **10 recent records** (most-recently-updated) of the
doc type's object for preview cycling:

```ts
    async readTemplate(
        params: z.infer<typeof RecordIdParam>,
        ctx: InvocationContext
    ): Promise<{
        rootObjectKey?: string;
        rootObjectLabel?: string;
        documentType: string;
        templateData?: string;
        latestRecordId?: string;
        latestRecordFullId?: string;
        showPageNumbers: boolean;
        isCodeMode: boolean;
        recentRecords: { id: string; label: string }[];
    }> {
        const { recordId } = params;
        const template = await DocumentTemplate.$byIdOrThrow<DocumentTemplate>(
            { id: recordId },
            ctx
        );
        const documentTypeConfig = (await ctx.recipe).documentTypes.find(template.documentType);

        let templateData = template.templateData;
        if (!templateData && documentTypeConfig) {
            templateData = await findBaseTemplateData({ documentTypeConfig, ctx });
        }

        // Fetch recent records for HTML preview (and preview cycling in developer mode)
        let latestRecordId = '';
        let latestRecordFullId = '';
        const recentRecords: { id: string; label: string }[] = [];

        if (
            documentTypeConfig?.objectKey &&
            ![GENERIC_OBJECT_KEY, invalidObjectKey].includes(documentTypeConfig.objectKey)
        ) {
            const recipe = await ctx.recipe;
            const config = recipe.objects.get(documentTypeConfig.objectKey);
            const code = config.getObjectCtor<typeof RRecord>();
            const records = await code.$read(
                {
                    filter: [],
                    paths: [],
                    count: 10,
                    offset: 0,
                    orderBy: {
                        $updatedAt: SortDirection.desc,
                    },
                },
                ctx
            );
            ...
```

`readTemplate` permission: record-level `viewer`.

```ts
    @RAction<z.infer<typeof RecordIdParam>>({
        params: RecordIdParam,
        summary: 'Read action for document template editor.',
        permission: { type: PermissionType.viewer, recordIdField: 'recordId' },
    })
```

### 4.4 Save path (trace)

The presentational component pulls the current text out of whichever editor is active, then delegates —
`ui/src/scripts/platform/core/DocumentBuilderAdmin/components/DocumentBuilder.tsx`:

```tsx
    const _onClick = useCallback(async () => {
        if (isCodeMode) {
            const code = codeEditorRef.current?.getCode();
            onSave(code, true);
        } else {
            const innerHTML = await editorRef.current?.getHTML();
            onSave(innerHTML);
        }
    }, [isCodeMode, codeEditorRef, editorRef, onSave]);
```

The save itself is a **generic object-record update** (there is no dedicated write action) —
`ui/src/scripts/platform/core/DocumentBuilderAdmin/hooks/useDocumentBuilderContext.ts`:

```ts
    const _onSave = useCallback(
        async (templateData: string | undefined, isCodeMode?: boolean) => {
            setEditorState(prev => ({ ...prev, isSaving: true }));

            const json: Record<string, unknown> = {
                templateData,
                showPageNumbers: data.showPageNumbers,
            };
            if (isCodeMode) {
                json.isCodeMode = true;
            }

            const [, err] = await of(
                rr2sdk.objectRecord.updateById(recordId, {
                    boardId: data.boardId!,
                    objectKey: objectKey,
                    json,
                })
            );
            if (err) {
                toastActions.onShowToastError('Failed to save template changes');
            } else {
                toastActions.onShowToastSuccess('Successfully saved template changes');
                if (isCodeMode) {
                    setData(prev => ({ ...prev, isCodeMode: true }));
                }
            }

            setEditorState(prev => ({ ...prev, isSaving: false }));
        },
        [recordId, rr2sdk, data.boardId, data.showPageNumbers, toastActions]
    );
```

**"Discard changes"** simply re-runs the load (`onDiscardChanges: _onGetInitTemplateData`). There is a
one-way trap door: switching to code mode is a destructive action gated by a confirmation dialog, and
once saved with `isCodeMode = true` the visual editor is considered unsafe to reuse (per the field
description). The dialog wiring is in `DocumentBuilder.tsx` (`_onEnableDeveloperMode`,
`_onSwitchToVisualMode`).

---

## 5. How available data FIELDS are exposed to the author

### 5.1 The field list is built client-side from the recipe `objects` ingredient

`ui/src/scripts/platform/core/DocumentBuilderAdmin/hooks/useIngredientObjectFields.ts`:

```ts
export const useIngredientObjectFields = () => {
    return useCurrentRecipeIngredient({
        ingredientKey: IngredientKey.objects,
        options: {
            select: selectFieldsFromObjects,
        },
    });
};

export const selectFieldsFromObjects = <T extends IngredientKey>(
    objects: RecipeGetConfigsResponse<T>
): Field[] => {
    const allFields: Field[] = [];
    for (const object of objects) {
        if ('fields' in object === false || object.isMixin) {
            continue;
        }
        const fields = getFields(object);
        allFields.push(...fields);
    }
    return allFields;
};
```

Per-object flattening — same file. Hidden fields, path-derived fields, and `any`/`invalid`-typed fields
are skipped. Object connections are marked with `connectionKey` so the picker can descend into related
objects:

```ts
const getFields = (
    object:
        | JSObjectConfig
        // Wrong type required because generic type on useCurrentRecipeIngredient does not
        // infer JSObjectConfig type
        | JSWidgetConfig
): Field[] => {
    if (!object.fields?.length) {
        return [];
    }

    const fields: Field[] = [];

    for (const field of object.fields) {
        if (
            field.isHidden ||
            'path' in field ||
            typeof field.type !== 'object' ||
            field.type.key === RTypeKey.any ||
            field.type.key === RTypeKey.invalid
        ) {
            continue;
        }

        fields.push({
            objectKey: object.key,
            key: field.key,
            label: field.label,
            description: field.description,
            connectionKey: getConnectionKey(field),
        });
    }

    return fields;
};

const getConnectionKey = (field: JSFieldConfig): string | undefined => {
    if (typeof field.type !== 'object' || field.type.configKey !== RRootConfigKey.object) {
        return undefined;
    }
    return field.type.key;
};
```

### 5.2 How the field list is fed to the editor

`useDocumentBuilderContext.ts` maps the flat `Field[]` into the editor's plugin configs. `fieldSelect`
drives the merge-field inserter; `fieldCode` drives barcode/QR insertion and adds a `this`-scoped
**loop context** so fields inserted inside a Handlebars loop emit `{{this.fieldKey}}`:

```ts
    const { isInitialLoading: isLoadingFields, data: fields = [] } = useIngredientObjectFields();
    const fieldSelectPluginConfig: DocumentTemplateEditorPluginConfig['fieldSelect'] = useMemo(
        () => ({
            objectKey: data.rootObjectKey,
            objectLabel: data.rootObjectLabel ?? data.rootObjectKey,
            initialPath: [],
            onLoadFields: async () => fields,
        }),
        [data.rootObjectKey, data.rootObjectLabel, fields]
    );
    const fieldCodePluginConfig: FieldCodePluginConfig = useMemo(
        () =>
            ({
                objectKey: data.rootObjectKey,
                objectLabel: data.rootObjectLabel ?? data.rootObjectKey,
                initialPath: [],
                onLoadFields: async () => fields,
                // The field picker builds Handlebars paths from connectionPath + objectKey.
                // Inside a loop, we want {{this.fieldKey}}, not {{this.order.fieldKey}}.
                // Stamping objectKey = rootObjectKey on each field forces connectionPath to []
                // so the picker emits just the leaf key after the loop variable prefix.
                loopContexts: [
                    {
                        loopVariable: 'this',
                        objectLabel: 'Loop item',
                        initialPath: [],
                        onLoadFields: async () =>
                            fields.map(f => ({ ...f, objectKey: data.rootObjectKey })),
                    },
                ],
                // Cast needed until component-library exports fieldCode on DocumentTemplateEditorPluginConfig.
                // See documentBuilder.types.ts — conditional inference resolves to unknown without the key.
            }) as FieldCodePluginConfig,
        [data.rootObjectKey, data.rootObjectLabel, fields]
    );
```

### 5.3 How deep does it go?

- **Client picker breadth:** the flat `Field[]` contains fields from **all** non-mixin objects in the
  recipe (one entry per field). It is not pre-nested. Connection fields carry `connectionKey`, letting
  the picker walk from the root object into related objects **one hop at a time**, on demand — depth is
  effectively unbounded by traversal but each level is a flat lookup keyed by `objectKey`. The
  `onLoadFields` callbacks return the *same full list* every time; the picker itself scopes by
  `objectKey`/`connectionKey`. (There's a `@TODO refactor to fetch one object at a time on demand`
  comment on the hook.)
- **Server context depth (at render):** decoupled from the picker. `getRecordContextForDocument`
  (`documentContext.helpers.ts`) parses the *actual* `{{paths}}` used in the template and reads exactly
  those, recursively, off the record — so nesting depth at generation time is driven by what the author
  typed, not by the picker.

### 5.4 `documentContext.helpers.ts` — what it actually builds

This is the **server-side** record-context builder invoked during preview/generation, not the picker
source. It extracts `{{…}}` paths from the template, validates them against the object config, strips
formatting suffixes, reads the record, and formats values (money, datetime ranges, select/status label
resolution, measurements, time-of-day) — `platform-model/.../system/helpers/documentContext.helpers.ts`:

```ts
export const getRecordContextForDocument = async ({
    systemDocParentId,
    objectKey,
    templateData,
    ctx,
    loopSortConfigs,
    enforceFieldView = false,
}: {
    systemDocParentId: string;
    objectKey: string;
    templateData?: string;
    ctx: InvocationContext;
    loopSortConfigs?: LoopSortConfig[];
    /**
     * Drop record paths the actor cannot view so their tokens render blank. Off by
     * default (doc generation runs as System); the read-time resolver opts in.
     */
    enforceFieldView?: boolean;
}): Promise<Record<string, unknown>> => {
    if (!templateData) {
        return {};
    }

    const recipe = await ctx.recipe;
    const config = recipe.objects.get(objectKey);

    const allPaths = extractTemplatePaths(templateData);
    let recordPaths = normalizeRecordPaths(allPaths);
    recordPaths = excludeInvalidPaths(recordPaths, config);
    ...
    const paths = stripFormattingPathSuffixes(recordPaths);

    const code = config.getObjectCtor<typeof RRecord>();

    const record = await code.$byIdOrThrow({ id: systemDocParentId, paths }, ctx);

    return buildRecordContext(record, recordPaths, loopSortConfigs);
};
```

It also supports **field-view permission enforcement** (`enforceFieldView`) to blank out tokens the
acting user can't see, and rich formatting suffixes the author can append to a path, e.g.
`{{invoiceDate.dateTimeInLocation.shortDate}}`, `{{manifest.costs.withCurrencyCode}}`,
`{{...shortDateTimeRangeCompact}}` (enums `DateTimeValueFormatType`, `MoneyFormatType`,
`DateTimeValueFormatRangeType`).

---

## 6. How PREVIEW works today

**Always a server round-trip to an external `document-generator` service.** Never client-side Handlebars
rendering. It uses a **real record** (not synthetic sample data) — one of the recent records fetched by
`readTemplate`. Two distinct preview paths:

### 6.1 Visual editor → HTML preview

`useDocumentBuilderContext.ts` (`onGetPreview`, "visual editor plugin call" branch). The visual editor's
`previewOutput` plugin calls `onGetPreview()` with no args; the host detects that and hits the HTML
preview action:

```ts
            if (isVisualEditorPluginCall) {
                const currentTemplateData =
                    (await editorRef.current?.getHTML()) ?? data.templateData ?? '';

                const htmlCache = cachedHtmlPreviewRef.current;
                if (
                    !invalidateCache &&
                    htmlCache &&
                    htmlCache.templateData === currentTemplateData
                ) {
                    return { html: htmlCache.html };
                }

                const previewRecordId = data.latestRecordId;
                try {
                    const previewResp: { html: string } = await rr2sdk.action.invoke(
                        `documentGeneration/getBOLPreview/1.0`,
                        {
                            recordId: previewRecordId,
                            rootObjectKey: data.rootObjectKey,
                            templateData: currentTemplateData,
                            documentType: data.documentType,
                        },
                        ''
                    );
                    cachedHtmlPreviewRef.current = {
                        templateData: currentTemplateData,
                        html: previewResp.html,
                    };
                    return previewResp;
                } catch {
                    toastActions.error('Failed to generate document preview');
                    return { html: '' };
                }
            }
```

Server action `documentGeneration/getBOLPreview/1.0` (despite the "BOL" name it is generic — takes any
`documentType`) — `recipes/moduleDocumentBuilderTms/actions/mixins/documentGeneration-DocumentBuilderTier1.ts`:

```ts
    @RAction({
        summary: 'Get BOL PDF preview',
        permission: { roles: [SystemRole.admin] },
    })
    public async getBOLPreview(
        params: {
            recordId: string;
            /** @deprecated not needed anymore */
            rootObjectKey?: string;
            templateData: string;
            documentType: string;
        },
        ctx: InvocationContext
    ): Promise<{ html: string }> {
        const { templateData, documentType, recordId } = params;

        const documentData = await getDocumentDataAndContext({
            systemDocParentId: recordId,
            documentType,
            templateData,
            ctx,
        });
        const resp = await getHTMLPreview(documentData, 'generate-document', ctx);
        const html = typeof resp?.html === 'string' ? resp.html.trim() : '';
        if (!html) {
            throw new Error('Failed to generate HTML document');
        }
        return { html: await replaceCodeComponents(html) };
    }
```

The HTML string is returned to the client and rendered by the editor's `previewOutput` plugin (visual
preview pane).

### 6.2 Code editor → PDF preview

`useDocumentBuilderContext.ts` (the fall-through / explicit-args branch), targeting the PDF action:

```ts
            try {
                const previewResp: { pdfBase64: string } = await rr2sdk.action.invoke(
                    `documentTemplate/previewPdf/1.0`,
                    {
                        recordId: previewRecordId,
                        templateData: currentTemplateData,
                        documentType: data.documentType,
                        showPageNumbers: data.showPageNumbers,
                    },
                    ''
                );
                cachedPdfPreviewRef.current = {
                    templateData: currentTemplateData,
                    recordId: previewRecordId,
                    pdfBase64: previewResp.pdfBase64,
                };
                return previewResp;
            } catch {
                toastActions.error('Failed to generate document preview');
                return { pdfBase64: '' };
            }
```

Server action `documentTemplate/previewPdf/1.0` — `recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts`.
This runs the *same pipeline as a real download* (incl. page breaks/margins) and returns base64 PDF:

```ts
    async previewPdf(
        params: z.infer<typeof PreviewPdfParams>,
        ctx: InvocationContext
    ): Promise<{ pdfBase64: string }> {
        const { recordId, templateData, documentType, showPageNumbers } = params;

        const documentData = await getDocumentDataAndContext({
            systemDocParentId: recordId,
            documentType,
            templateData,
            ...(showPageNumbers !== undefined && { showPageNumbersOverride: showPageNumbers }),
            ctx,
        });

        const pdf = await getPDFWithCodeReplacement(documentData, 'generate-document', ctx);
        if (!pdf?.length) {
            throw new BadRequestException('Failed to generate PDF preview');
        }
        ...
        return { pdfBase64: pdf.toString('base64') };
    }
```

The code editor turns the base64 into a blob and shows it via `<embed type="application/pdf">`; HTML
previews (when returned) render via a sandboxed `<iframe srcDoc>` —
`ui/src/scripts/platform/core/DocumentBuilderAdmin/components/codeEditor/DocumentCodeEditor.tsx`
(`_refreshPreview`).

### 6.3 Where the actual rendering happens (external service)

Both actions build the context via `getDocumentDataAndContext` (org + record + document context) and then
POST it to the **`document-generator`** service. `platform-model/src/runtime/documents/document.ts`:

```ts
export const getHTMLPreview = async (
    documentData: object,
    documentId: string,
    ctx: InvocationContext
): Promise<{ html?: string }> => {
    const [resp, error] = await of(
        superagent
            .post(
                `${DocumentsController.documentServiceBaseEndpoint}${DocumentsController.documentServiceGenerateEndpoint}/${documentId}/preview`
            )
            .set({
                Accept: 'application/json',
                'Content-Type': 'application/json',
                [authHeader]: `Bearer ${ctx.token}`,
            })
            .send(documentData)
    );
    ...
    return resp?.body;
};
```

Endpoint constants — `platform-model/src/services/documents/documents.controller.ts`:

```ts
    public static readonly documentServiceBaseEndpoint =
        process.env.DOCUMENT_SERVICE_URL ??
        process.env.DOCS_LISTEN_ADDRESS ??
        'http://document-generator:8080';
    public static readonly documentServiceGenerateEndpoint = '/api/v1/docs/platform';
```

So the effective preview endpoints are:
- HTML: `POST http://document-generator:8080/api/v1/docs/platform/generate-document/preview`
- PDF:  `POST http://document-generator:8080/api/v1/docs/platform/generate-document/pdf`

Payload (`documentData`) shape is `{ templateData, context: { org, record, document }, options? }` —
built by `getDocumentDataAndContext` (`platform-model/.../system/helpers/document.helpers.ts`), which
also strips `###sortBy:` loop-sort encoding and upgrades `org.documentTerms.*.terms_conditions` to
triple-stash before sending. The `document-generator` service is what actually compiles the Handlebars.

The code editor additionally supports **preview cycling** across the `recentRecords` list (prev/next),
so the author can eyeball the template against multiple real records — `DocumentCodeEditor.tsx`.

---

## 7. Feature flags, permissions, doc-type gating

### 7.1 Route-level gating (org entitlement + role)

The editor route is wrapped by `FourBuildersAccessACLRoute`, which requires an org entitlement flag —
`builders.access.secondaryBuilderBundle` **OR** `builders.access.fullAccess` — plus RR/CC-user bypass,
and then an inner role ACL. `ui/src/scripts/routes/ops/OpsRoutes.js`:

```js
const FourBuildersAccessACLRoute = ({ children, ...props }) => {
    const isMeRRUser = useSelector(getIsMeRRUser);
    const isMeCCUser = useSelector(getIsMeCCUser);
    const orgFeatureFlags = useSelector(getMyOrgFeatureFlags);
    const isFetchingMyOrg = useSelector(state => state?.app?.isFetchingMyOrg);

    if (!isMeRRUser && !isMeCCUser && isFetchingMyOrg) {
        return null;
    }

    const isAuthorized = hasFourBuildersOrgAccess({
        isFourBuildersOrgFlagEnabled:
            orgFeatureFlags?.[FFKey.BuildersAccessSecondaryBuilderBundle]?.enabled,
        isBuildersFullAccessEnabled: orgFeatureFlags?.[FFKey.BuildersAccessFullAccess]?.enabled,
        isRRUser: isMeRRUser,
        isCCUser: isMeCCUser,
    });

    if (!isAuthorized) {
        return <Redirect to={URLS.accessDeniedPage} />;
    }

    return <ACLRoute {...props}>{children}</ACLRoute>;
};
```

Roles allowed on the editor route: `superAdmin`, `admin`, `operations`, `csr`, `manager` (see the route
excerpt in 4.1). These `FFKey.BuildersAccess*` are **org entitlement flags**, not `ff_enrolment_list.yml`
enrolment flags — a search of `ff_enrolment_list.yml` for `documentBuilder`/`documentTemplate` returns
**no matches**, i.e. the editor has no dedicated per-feature enrolment flag.

### 7.2 Action-level permissions (server)

- `documentTemplate/readTemplate/1.0` — record-level `viewer` (`recordIdField: 'recordId'`).
- `documentTemplate/previewPdf/1.0` — record-level `viewer`.
- `documentGeneration/getBOLPreview/1.0` — role-gated: `permission: { roles: [SystemRole.admin] }`.
- `documentTemplate/getOrgDefault` / `clearOrgDefault` — board-scoped `viewer`/`editor`.
- `documentTemplate/setOrgDefault` — record-level `editor`.
- Save uses generic `objectRecord.updateById`, so it inherits the object's normal record-`editor`
  permission model rather than a bespoke action permission.

There is also a **field-level** permission hook at render time (`enforceFieldView` in
`getRecordContextForDocument`) that can blank tokens the actor cannot view (default off for generation,
which runs as System).

### 7.3 Doc-type gating

Doc-type gating happens through the object model, not feature flags:

- `DocumentTemplate.documentType` is an `@RConfigSelect` over `RRootConfigKey.documentType`, filtered to
  `config.isCustomizable`:

```ts
    @RConfigSelect({
        label: 'Document type',
        description: 'Type of document this template is for.',
        rootConfigKey: RRootConfigKey.documentType,
        filterOptions: ({ config }) => !!config.isCustomizable,
    })
    documentType: string;
```

- `readTemplate` only computes a `rootObjectKey`/recent records when the doc type resolves to a concrete
  object (excluding `GENERIC_OBJECT_KEY` / `invalidObjectKey`). On non-TMS terminals (e.g. boreal) no TMS
  document types are composed, so those branches no-op (documented at length in the object's commit
  hooks).

---

## 8. Contradictions / corrections vs. the briefing assumptions

1. **"A document template is a Handlebars STRING on `DocumentTemplate.templateData`."** ✅ **Confirmed.**
   `templateData` is an `@RText` (string) field; the editor round-trips HTML/Handlebars text through it.
   (Additional nuance: an empty `templateData` falls back to an on-disk base template file via
   `findBaseTemplateData`, and `DocumentTemplate.dataFormatVersion` defaults to `'1'` — a latent version
   hook for a future JSON format.)

2. **"The editor is an external Bit package `@roserocket/components.document-template-editor`."**
   ✅ **Confirmed**, with detail: it's a **Lexical-based** rich-text editor published from the
   `component-library` repo to GitHub Packages, resolved here at **v4.6.4**. ⚠️ **Correction:** it is not
   the *only* editor. The **code mode** editor (`DocumentCodeEditor`, Monaco) is built **in this repo**
   under `components/codeEditor/` and is a first-class, mutually-exclusive alternative selected by
   `isCodeMode`. Any Templara integration has to account for two existing editors, not one.

3. **"Host integration lives in `ui/src/scripts/platform/core/DocumentBuilderAdmin/` (…files…)."**
   ✅ **Confirmed** — all listed files exist and match their described roles. Additional relevant files in
   that folder not in the briefing: `components/DocumentBuilder.styled.tsx`,
   `components/codeEditor/handlebarsBlockFolding.ts`, `components/codeEditor/formatDocumentTemplateHtml.ts`,
   and `index.ts` (default-exports the container).

4. **"Context builder for field-list origins: `documentContext.helpers.ts`."** ⚠️ **Partially incorrect.**
   `documentContext.helpers.ts` is the **server-side record-context builder for preview/generation** — it
   turns a template's `{{paths}}` + a real record into the Handlebars data context. It is **not** the
   origin of the author's field-picker list. The **field-picker list** originates **client-side** from the
   recipe `objects` ingredient via `useIngredientObjectFields.ts` →
   `useCurrentRecipeIngredient(IngredientKey.objects)` → `selectFieldsFromObjects`. The two are
   independent: the picker decides *what you can insert*; `documentContext.helpers.ts` decides *what data
   is resolved* for the paths you actually used.

5. **Preview is server-side, not client-side.** The briefing left preview open ("server call? client-side
   render? sample vs real record?"). Answer: **server call, against a REAL record** (the most-recently-
   updated record of the doc type's object, fetched by `readTemplate`), rendered by the external
   `document-generator` service. Visual mode → HTML (`getBOLPreview`), code mode → PDF (`previewPdf`).
   No client-side Handlebars compilation exists in the host.

6. **Types drift on `fieldCode`.** The host (`documentBuilder.types.ts` + a cast in
   `useDocumentBuilderContext.ts`) defends against the package *not* exporting `fieldCode` on
   `DocumentTemplateEditorPluginConfig`. In the resolved **v4.6.4** types, `fieldCode` **is** exported, so
   that defensive inference/cast is now dead weight (not a bug, just stale).

---

## Appendix — file index (verbatim sources cited)

Host (UI):
- `ui/src/scripts/routes/ops/OpsRoutes.js` — route + `FourBuildersAccessACLRoute` gating
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/index.ts`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/DocumentBuilderContainer.tsx`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/components/DocumentBuilder.tsx`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/components/codeEditor/DocumentCodeEditor.tsx`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/hooks/useDocumentBuilderContext.ts`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/hooks/useIngredientObjectFields.ts`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/documentBuilder.types.ts`
- `ui/src/scripts/platform/core/DocumentBuilderAdmin/documentBuilder.constants.tsx`

Editor package (resolved node_modules, v4.6.4):
- `node_modules/@roserocket/components.document-template-editor/package.json`
- `.../dist/index.d.ts`
- `.../dist/DocumentTemplateEditor/types.d.ts`
- `.../dist/DocumentTemplateEditor/plugins/FieldSelectPlugin/context.d.ts`
- `.../dist/DocumentTemplateEditor/plugins/FieldCodePlugin/context.d.ts`
- `.../dist/DocumentTemplateEditor/plugins/PreviewOutputPlugin/context.d.ts`
- `.../dist/DocumentTemplateRenderer/index.d.ts`
- `.../dist/DocumentTemplateEditor/builtinPlugins.d.ts`

Server (platform-model + recipes):
- `platform-model/src/runtime/config/recipes/system/objects/documentTemplate.ts`
- `platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts`
- `platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts`
- `platform-model/src/runtime/documents/document.ts`
- `platform-model/src/services/documents/documents.controller.ts`
- `recipes/moduleDocumentBuilderTier1/actions/documentTemplate.ts`
- `recipes/moduleDocumentBuilderTms/actions/mixins/documentGeneration-DocumentBuilderTier1.ts`

Config:
- `ff_enrolment_list.yml` (no documentBuilder/documentTemplate enrolment flag — confirmed absent)
