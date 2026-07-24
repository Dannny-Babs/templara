# P3 — The Doc Builder 1 Context Builder (THE CRUX)

Read-only discovery. All paths are relative to the `platform-components` checkout.
Everything below is quoted verbatim from the current code unless explicitly marked
**[SYNTHESIZED]**.

---

## 0. TL;DR / corrections to the shared-context assumptions

| Shared-context claim | Verdict | Evidence |
|---|---|---|
| Template is a Handlebars STRING on `DocumentTemplate.templateData` | ✅ Confirmed | `documentTemplate.ts` field `templateData?: string` |
| `document-generator` compiles Handlebars → HTML → PDF via headless Chrome | ✅ Confirmed (but the compile happens in a **separate microservice**, not in this repo) | `getHTML`/`getPDF` POST to `http://document-generator:8080/api/v1/docs/platform/...` |
| Context is roughly `{ org, record: serialize(record), document }` | ⚠️ **Partially wrong.** The shape is `{ org, record, document }`, but `record` is **NOT** produced by `serialize(record)`. It is built by a bespoke, path-driven materializer `buildRecordContext`. `serialize()` exists and IS used, but only by the **legacy** per-doc-type assemblers (`createInvoice`, `createBOL`, `createBill`…) and the search index — not by the Doc Builder 1 template path. | `document.helpers.ts` `getDocumentDataAndContext`; contrast with `documentGeneration.ts` `createBill`/`serialize` |
| Context is built LAZILY and PATH-DRIVEN off `{{...}}` references | ✅ Confirmed exactly | `extractTemplatePaths` → `normalizeRecordPaths` → `$byIdOrThrow({paths})` → `buildRecordContext` |
| Money/dates are PRE-FORMATTED STRINGS at suffix leaves | ✅ Confirmed | `applyRecordValue` money/date branches |
| Editor is external Bit package `@roserocket/components.document-template-editor` | ✅ Consistent (the in-repo autocomplete drills the same object/field config; see P5) | `useTemplateTokenAutocomplete.ts` |

Two extra facts worth carrying into Templara design:

1. **`$`-prefixed money format token includes a `$` glyph.** The shared context example
   said `record.total.withDecimalsAndCurrencyCode` → `"4,590.00 USD"`. The real code
   hardcodes a `$` and the unit test asserts `"$140.00 USD"` (see the money table below).
   So the real leaf value is `"$4,590.00 USD"`, not `"4,590.00 USD"`.
2. **Org address key mismatch bug.** `getOrgAddress` emits `postal`, but the invoice
   template reads `{{org.orgAddress.postalCode}}` → renders blank. (Record addresses use
   `postalCode`; org addresses use `postal`.) Details in P4.

---

## 1. Entry point: `getDocumentDataAndContext`

`platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts`

This is the `getDocumentDataAndContext`-style function referenced in the brief. It
orchestrates: resolve template string → build org context → normalize parent id →
extract loop-sort configs → build record context → assemble `{org, record, document}` →
strip sort encoding → return.

```24:132:platform-model/src/runtime/config/recipes/system/helpers/document.helpers.ts
export const getDocumentDataAndContext = async ({
    systemDocParentId,
    documentType,
    documentContext,
    templateData: templateDataProps,
    showPageNumbersOverride,
    ctx,
}: {
    systemDocParentId: string;
    documentType: string;
    documentContext?: Partial<DocumentContext>;
    templateData?: string;
    showPageNumbersOverride?: boolean;
    ctx: InvocationContext;
}): Promise<{
    templateData: string | undefined;
    context: DocumentTemplateContext;
    options?: DocumentGenerationOptions;
}> => {
    let templateData = templateDataProps;
    let showPageNumbers = false;
    const documentTypeConfig = (await ctx.recipe).documentTypes.get(documentType);

    // If template data is not passed, fetch default template.
    // Whitespace-only strings count as missing — otherwise "\n" is truthy and breaks preview.
    const isMissingTemplateOverride =
        templateDataProps == null ||
        (typeof templateDataProps === 'string' && templateDataProps.trim() === '');

    if (isMissingTemplateOverride) {
        const defaultConfig = await DocumentTemplateConfig.getDefaultDocumentTemplate({
            documentType,
            ctx,
        });
        templateData = defaultConfig?.documentTemplate?.templateData;
        showPageNumbers = defaultConfig?.documentTemplate?.showPageNumbers ?? false;

        // No default template config exists, use in-code base templates
        if (!templateData) {
            templateData = await findBaseTemplateData({
                documentTypeConfig,
                ctx,
            });
        }

        if (!templateData) {
            throw new NotFoundException(
                `No default template exists for document type: ${documentType}`
            );
        }
    }

    const orgContext = await getOrgContextForDocument({ ctx });

    // Document types may register a server-side parent-id normalizer (e.g. base's `invoice` type
    // resolving a legacy Order id to its first Invoice id). Terminal-agnostic by design: types
    // without a normalizer use the id unchanged.
    const normalizedSystemDocParentId =
        (await documentTypeConfig.normalizeParentId?.({ systemDocParentId, ctx })) ??
        systemDocParentId;

    const loopSortConfigs = extractLoopSortConfigs(templateData ?? '');

    const recordContext = await getRecordContextForDocument({
        systemDocParentId: normalizedSystemDocParentId,
        objectKey: documentTypeConfig.objectKey,
        templateData,
        ctx,
        loopSortConfigs,
    });

    const formattedDocumentContext = formatDocumentContext({ documentContext });

    const context = {
        [ContextKeys.org]: orgContext,
        [ContextKeys.record]: recordContext,
        [ContextKeys.document]: formattedDocumentContext,
    };

    // Strip sort encoding before sending to document-generator so it receives clean Handlebars
    let cleanedTemplateData = templateData?.replace(/\s+###sortBy:[^\s})]+/g, '');

    // Upgrade terms_conditions fields to triple-stash so sanitized HTML renders unescaped
    cleanedTemplateData = cleanedTemplateData?.replace(
        /(?<!\{)\{\{(org\.documentTerms\.[^}]*\.terms_conditions)\}\}(?!\})/g,
        '{{{$1}}}'
    );

    const options: DocumentGenerationOptions | undefined =
        showPageNumbersOverride !== undefined
            ? { showPageNumbers: showPageNumbersOverride }
            : showPageNumbers
              ? { showPageNumbers }
              : undefined;

    return {
        templateData: cleanedTemplateData,
        context,
        ...(options && { options }),
    };
};
```

Template resolution order: (1) explicit `templateData` override → (2)
`DocumentTemplateConfig.getDefaultDocumentTemplate` (the org's saved
`DocumentTemplate.templateData`) → (3) in-code base `.handlebars` file
(`findBaseTemplateData` reads `documentTypeConfig.template` from disk with `fs.readFile`).

Where the compiled result goes (the actual Handlebars→HTML→PDF hop lives in a separate
service — this repo only POSTs the `{templateData, context, options}` payload):

```32:36:platform-model/src/services/documents/documents.controller.ts
    public static readonly documentServiceBaseEndpoint =
        process.env.DOCUMENT_SERVICE_URL ??
        process.env.DOCS_LISTEN_ADDRESS ??
        'http://document-generator:8080';
    public static readonly documentServiceGenerateEndpoint = '/api/v1/docs/platform';
```

```102:152:platform-model/src/runtime/documents/document.ts
export const getPDF = async (
    documentData: object,
    documentId: string,
    ctx: InvocationContext | Context
): Promise<Buffer | undefined> => {
    const endpoint = `${DocumentsController.documentServiceBaseEndpoint}${DocumentsController.documentServiceGenerateEndpoint}/${documentId}/pdf`;
    const [resp, error] = await of(
        superagent
            .post(endpoint)
            .set({
                Accept: 'application/pdf',
                'Content-Type': 'application/json',
                [authHeader]: `Bearer ${ctx.token}`,
            })
            .send(documentData)
            .buffer(true)
    );
    ...
    return resp?.body;
};
```

For Doc Builder 1 templates the `documentId` path segment is the literal
`'generate-document'` (see `getQuote`/`downloadQuote`/`downloadShipmentBOL` in
`recipes/base/actions/documentGeneration.ts`). The legacy assemblers use fixed ids like
`DocumentIds.invoice = 'invoice'` which select a template baked into the doc service.

---

## 2. WHERE `{{...}}` references are parsed & HOW they drive materialization

### 2a. `getRecordContextForDocument` — the pipeline

`documentContext.helpers.ts`. Note the exact ordering: extract → normalize (drop non-`record.`
paths) → drop invalid paths → (optional) drop field-view-denied paths → strip formatting
suffixes for the DB read → `$byIdOrThrow({ id, paths })` → `buildRecordContext`.

```160:210:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
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

    if (enforceFieldView) {
        const deniedFieldPaths = await getViewDeniedPaths({
            objectKey,
            paths: [...new Set(recordPaths.map(templatePathToFieldPath))],
            ctx,
        });
        recordPaths = recordPaths.filter(
            path => !deniedFieldPaths.has(templatePathToFieldPath(path))
        );
    }

    const paths = stripFormattingPathSuffixes(recordPaths);

    const code = config.getObjectCtor<typeof RRecord>();

    const record = await code.$byIdOrThrow({ id: systemDocParentId, paths }, ctx);

    return buildRecordContext(record, recordPaths, loopSortConfigs);
};
```

**Key insight for Templara:** the record is loaded with `$byIdOrThrow({ id, paths })`
where `paths` are exactly (and only) the field paths mentioned in the template, minus
formatting suffixes. There is **no full serialize** — the ORM only hydrates connections
that a `{{...}}` token references. This is the "lazy / path-driven" behaviour.

### 2b. `TemplateVisitor` — the parser that collects `{{...}}` paths

`templateVisitor.helpers.ts`. It regex-scans for `{{...}}` blocks, then walks them,
tracking `#each` loop scope so that `this.*` and `../` resolve to the right prefix.

```1:150:platform-model/src/runtime/config/recipes/system/helpers/templateVisitor.helpers.ts
import { ContextKeys } from './documentContext.types';

const HANDLEBARS_BLOCK_REGEX = /{{(\s*([^}]+)\s*)}}/g; // finds instances of '{{x}}'
const HANDLEBARS_PREV_SCOPE_REGEX = /\.\.\//g; // matches instances of '../'
const ARRAY_ACCESS_REGEX = /\[[^[\]]*\]/g; // matches instances of '[x]'
const SPACES_REGEX = /\s+/;

export class TemplateVisitor {
    paths: string[];
    templateBlocks: string[];
    prefixes: string[];

    constructor(templateData: string) {
        const rawMatches = Array.from(templateData.match(HANDLEBARS_BLOCK_REGEX) || []);
        this.templateBlocks = rawMatches.map(match =>
            match.replace('{{', '').replace('}}', '').trim()
        );
        this.paths = [];
        this.prefixes = [];
        this.visit(0);

        this.paths = this.cleanupDuplicatePaths(this.paths);
    }

    visit(i: number) {
        if (i >= this.templateBlocks.length) {
            return;
        }

        const block = this.templateBlocks[i];
        const args = block.split(SPACES_REGEX);

        if (args.length > 1) {
            switch (args[0]) {
                case '#each':
                    this.startLoopBlock(this.extractLoopPath(args.slice(1).join(' ')));
                    break;
                case 'else':
                    this.elseBlock(args.slice(1));
                    break;
                default:
                    this.addPath(args[1]);
                    break;
            }
        } else if (args.length === 1) {
            switch (args[0]) {
                case '/each':
                    this.endLoopBlock();
                    break;
                case 'else':
                case '/if':
                case '/with':
                case '/unless':
                    break;
                default:
                    this.addPath(args[0]);
                    break;
            }
        }
        this.visit(i + 1);
    }

    addPath(path: string) {
        const resolvedPath = this.resolvePath(path);
        if (!resolvedPath) {
            return;
        }

        this.paths.push(resolvedPath);
    }

    resolvePath(path: string): string {
        const pathJumps = path.match(HANDLEBARS_PREV_SCOPE_REGEX);
        const cleanPath = pathJumps
            ? `${this.getPrefix(pathJumps?.length)}.${path.substring(path.lastIndexOf('../') + 3)}`
            : path;
        const pathParts = cleanPath.split('.').filter(part => !part.match(ARRAY_ACCESS_REGEX));

        if (pathParts[0] === 'this') {
            pathParts[0] = this.getPrefix(pathJumps?.length);
        }

        const resolvedPath = pathParts.filter(value => !!value).join('.');

        return resolvedPath;
    }

    extractLoopPath(arg: string): string {
        // Strip sort suffix. Stops before ')' to preserve subexpression closing paren
        const cleanArg = arg.replace(/\s+###sortBy:[^\s)]+/, '').trim();
        const subexpressionRegex = /^\((\w+)\s+(.+)\)$/;
        const subexprMatch = cleanArg.match(subexpressionRegex);
        if (subexprMatch) {
            return subexprMatch[2].trim();
        }
        return cleanArg;
    }

    startLoopBlock(path: string) {
        const fieldKeys = path.split('.');
        switch (fieldKeys[0]) {
            case 'this':
                fieldKeys[0] = this.getPrefix(0);
                this.prefixes.push(
                    this.resolvePath(
                        fieldKeys[0] ? fieldKeys.join('.') : fieldKeys.slice(1).join('.')
                    )
                );
                break;
            default:
                this.prefixes.push(this.resolvePath(fieldKeys.join('.')));
        }

        this.addPath(this.getPrefix(0));
    }

    endLoopBlock() {
        this.prefixes.pop();
    }

    elseBlock(args: string[]) {
        if (!args.length) {
            return;
        }
        if (args.length > 1 && args[0] === 'if') {
            this.addPath(args[1]);
        }
    }

    getPrefix(nestingLevel?: number): string {
        const rollUpIndex = nestingLevel || 0;
        return this.prefixes?.[this.prefixes.length - rollUpIndex - 1] || '';
    }

    cleanupDuplicatePaths(paths: string[]): string[] {
        if (paths.length < 2) {
            return paths;
        }

        return paths.filter(path => !paths.some(p => p !== path && p.startsWith(`${path}.`)));
    }
}

export const extractTemplatePaths = (template: string): string[] => {
    if (!template) {
        return [];
    }

    const visitor = new TemplateVisitor(template);
    return visitor.paths;
};
```

Behavioural notes derived from the code:
- **Regex-based, not a real Handlebars AST.** It matches `{{ ... }}` blocks and splits
  on whitespace. Helpers like `{{#if x}}` push `x` as a path (via `args[1]`); bare
  `{{x}}` pushes `x`; `{{#each y}}` opens a loop scope whose prefix is `y`.
- **`this.` and `../` are resolved against the loop prefix stack** (`prefixes`), so a token
  `{{this.location.city}}` inside `{{#each record.ordersDocBuilder}} {{#each this.origins}}`
  resolves to `record.ordersDocBuilder.origins.location.city`.
- **Array indices `[0]` are stripped** (`ARRAY_ACCESS_REGEX`) — indexing is a render-time
  concern; materialization is index-agnostic (the whole array is built).
- **`cleanupDuplicatePaths` drops ancestors** when a descendant path is present (keeps the
  deepest reference), so `record.total` is dropped if `record.total.withDecimalsAndCurrencyCode`
  exists.

### 2c. `normalizeRecordPaths` — the `record.` / `org.` split

Only `record.`-prefixed paths drive DB materialization; `org.*` and `document.*` are
sourced separately (see §3).

```227:241:platform-model/src/runtime/config/recipes/system/helpers/templateVisitor.helpers.ts
export const normalizeRecordPaths = (paths: string[]): string[] => {
    const prefix = `${ContextKeys.record}.`;
    const pathLengthToCut = prefix.length;
    const normalizedPaths = paths
        .filter(path => path.startsWith(prefix))
        .map(path => path.substring(pathLengthToCut));
    return normalizedPaths;
};
```

### 2d. Suffix stripping for the DB read

Formatting suffixes (`.shortDate`, `.withDecimalsAndCurrencyCode`, `.dateTimeInLocation.longDate`,
etc.) are NOT real fields, so they are stripped before the ORM read, longest-match first.

```218:263:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
export const excludeInvalidPaths = (paths: string[], config: RObjectConfig): string[] => {
    return paths.filter(path => {
        try {
            let pathToTest = path;
            for (const suffix of suffixesToStrip) {
                if (path.endsWith(`.${suffix}`)) {
                    const candidate = path.slice(0, -suffix.length - 1); // -1 to remove the dot
                    if (candidate.length < pathToTest.length) {
                        pathToTest = candidate;
                    }
                }
            }

            tip(config, pathToTest);
            return true;
        } catch {
            return false;
        }
    });
};

export const stripFormattingPathSuffix = (path: string): string => {
    let stripped = path;
    for (const suffix of suffixesToStrip) {
        if (path.endsWith(`.${suffix}`)) {
            const candidate = path.slice(0, -suffix.length - 1);
            if (candidate.length < stripped.length) {
                stripped = candidate;
            }
        }
    }
    return stripped;
};

export const stripFormattingPathSuffixes = (paths: string[]): string[] => {
    return Array.from(new Set(paths.map(stripFormattingPathSuffix)));
};
```

The suffix allowlist (this is the exhaustive list of "magic" leaves the resolver knows):

```709:725:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
const rangeSuffixes = Object.keys(DateTimeValueFormatRangeType);
const propertySuffixes = Object.keys(DateTimeValueProperties);
const formatSuffixes = Object.keys(DateTimeValueFormatType);
const suffixesToStrip = rangeSuffixes
    .concat(propertySuffixes)
    .concat(formatSuffixes.map(suffix => `${DateTimeValueProperties.dateTimeInLocation}.${suffix}`))
    .concat(
        formatSuffixes.map(suffix => `${DateTimeValueProperties.dateTimeInLocationEnd}.${suffix}`)
    )
    .concat(
        formatSuffixes.map(suffix => `${DateTimeValueProperties.dateTimeInLocationEnd}.${suffix}`)
    )
    .concat(formatSuffixes)
    .concat(MoneyFormatType.withCurrencyCode)
    .concat(MoneyFormatType.withDecimalsAndCurrencyCode)
    .concat(MoneyFormatType.unroundedWithoutCurrencyCode)
    .concat('url');
```

### 2e. `buildRecordContext` / `buildRecordPathContext` / `applyRecordValue`

This is the materializer. For every template path it walks the record with `$getValue`,
descending connections, and writes a plain-JSON leaf. Verbatim:

```285:320:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
export const buildRecordContext = async (
    record: RObjectRecord,
    templateRecordPaths: string[],
    loopSortConfigs?: LoopSortConfig[]
): Promise<Record<string, unknown>> => {
    const data: Record<string, unknown> = {};
    for (const path of templateRecordPaths) {
        await buildRecordPathContext(record, path, data, loopSortConfigs);
    }
    return data;
};

const buildRecordPathContext = async (
    record: RObjectRecord,
    path: string,
    data: Record<string, unknown>,
    loopSortConfigs?: LoopSortConfig[]
): Promise<Record<string, unknown>> => {
    const parts = path.split('.');
    const fieldKey = parts.shift();
    const newPath = parts.join('.');
    if (fieldKey) {
        const value = record.$getValue(fieldKey);
        const fieldConfig = record.$config.getField(fieldKey);
        await applyRecordValue(fieldKey, value, newPath, data, fieldConfig, loopSortConfigs);
    }
    return data;
};
```

`applyRecordValue` (the whole value-formatting switch) — this is the single most
important function for Templara because it defines every pre-formatted leaf shape:

```331:567:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
export const applyRecordValue = async (
    fieldKey: string,
    value: unknown,
    newPath: string,
    data: Record<string, unknown>,
    fieldConfig: RFieldConfig,
    loopSortConfigs?: LoopSortConfig[]
) => {
    if (isRObjectRecord(value)) {
        if (!newPath && data[fieldKey] == null) {
            data[fieldKey] = {};
            return;
        }

        if (value.$config.key === 'file' && newPath === 'url') {
            data[fieldKey] = {
                ...(data[fieldKey] || {}),
                url: await getFileDownloadURL(value as unknown as File),
            };
        } else {
            const existingData = (data[fieldKey] as Record<string, unknown>) || {};
            data[fieldKey] = await buildRecordPathContext(
                value,
                newPath,
                existingData,
                loopSortConfigs
            );
        }
    } else if (isRObjectRecordArray(value)) {
        const sortConfig = loopSortConfigs?.find(c => c.loopPath === fieldKey);
        const sortedValue: RObjectRecord[] =
            sortConfig?.sortRules && sortConfig.sortRules.length > 0
                ? orderBy(
                      value,
                      sortConfig.sortRules.map(r => (item: RObjectRecord) => {
                          const v = item.$getValue(r.sortBy);
                          return typeof v === 'string' ? v.toLowerCase() : (v ?? '');
                      }),
                      sortConfig.sortRules.map(r => r.sortDirection)
                  )
                : value;
        if (!newPath && data[fieldKey] == null) {
            data[fieldKey] = sortedValue.map(() => ({}));
            return;
        }
        const existingData = (data[fieldKey] as Record<string, unknown>[]) || [];
        data[fieldKey] = await buildRecordArrayPathContext(sortedValue, newPath, existingData);
    } else {
        if (isMoney(value)) {
            if (newPath === MoneyFormatType.withCurrencyCode) {
                const formattedAmount = formatNumber({
                    value: value.amount,
                    minDecimalsLength: 0,
                    maxDecimalsLength: 4,
                    currencyId: value.currencyCode,
                });
                data[fieldKey] = { withCurrencyCode: `${formattedAmount}` };
            } else if (newPath === MoneyFormatType.withDecimalsAndCurrencyCode) {
                const formattedAmount = formatNumber({
                    value: value.amount,
                    minDecimalsLength: 2,
                    maxDecimalsLength: 2,
                    currencyId: value.currencyCode,
                });
                data[fieldKey] = { withDecimalsAndCurrencyCode: `${formattedAmount}` };
            } else if (newPath === MoneyFormatType.unroundedWithoutCurrencyCode) {
                const formattedAmount = formatNumber({
                    value: value.amount,
                    minDecimalsLength: 0,
                    maxDecimalsLength: 4,
                });
                data[fieldKey] = { unroundedWithoutCurrencyCode: `$${formattedAmount}` };
            } else {
                const formattedAmount = formatNumber({
                    value: value.amount,
                    minDecimalsLength: 2,
                    maxDecimalsLength: 2,
                });
                data[fieldKey] = `$${formattedAmount}`;
            }
        } else if (isMultiCurrencyMoney(value)) {
            // ... builds a "\n"-joined multi-line string; if a money suffix is present,
            //     nests it under { [suffix]: "<line1>\n<line2>" } (see full code)
        } else if (isDateTimeValue(value)) {
            const existingData = (data[fieldKey] as FormattedDateTimeValue) || {};
            data[fieldKey] = formatDatetimeValueForDocumentRendering(value, newPath, existingData);
        } else if (
            fieldConfig.fieldTypeKey === RTypeKey.date &&
            typeof value === 'string' &&
            newPath &&
            isValueOfStringEnum(DateTimeValueFormatType, newPath)
        ) {
            try {
                const formatted = format(
                    parseISO(value),
                    formatMap[newPath as DateTimeValueFormatType]
                );
                const existingData = (data[fieldKey] as Record<string, string>) || {};
                data[fieldKey] = { ...existingData, [newPath]: formatted };
            } catch {
                // Invalid date string — render blank rather than throw.
            }
        } else if (isMeasurement(value)) {
            data[fieldKey] = convertRTypeFieldToStringHelper(value, fieldConfig);
        } else if (!newPath) {
            let formattedValue = value;
            switch (fieldConfig.fieldTypeKey) {
                case RTypeKey.select:
                    // resolve option.value -> option.labelId (falls back to raw value)
                    ...
                    break;
                case RTypeKey.status:
                    // resolve status option.value -> labelId
                    ...
                    break;
                case RTypeKey.multiSelect:
                    // resolve each selected value -> labelId, returns string[]
                    ...
                    break;
                case RTypeKey.time:
                    if (typeof value === 'number') {
                        formattedValue = formatSecondsToTime(value); // 32400 -> "09:00"
                    }
                    break;
            }
            data[fieldKey] = formattedValue;
        }
    }
};
```

Array descent (`buildRecordArrayPathContext`) merges leaves per-index, so multiple
template paths against the same loop (`this.type`, `this.description`, `this.subTotal`…)
accumulate onto the same row object:

```577:597:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
const buildRecordArrayPathContext = async (
    record: RObjectRecord[],
    path: string,
    data: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> => {
    const parts = path.split('.');
    const fieldKey = parts.shift();
    const newPath = parts.join('.');
    if (fieldKey) {
        const result: Record<string, unknown>[] = [];
        for (const [i, subrecord] of record.entries()) {
            const subData = data[i] || {};
            const value = subrecord.$getValue(fieldKey);
            const fieldConfig = subrecord.$config.getField(fieldKey);
            await applyRecordValue(fieldKey, value, newPath, subData, fieldConfig);
            result.push(subData);
        }
        return result;
    }
    return data;
};
```

**Loop sort** is encoded in the template as `{{#each record.x ###sortBy:field:dir}}`,
extracted by `extractLoopSortConfigs`, applied here via lodash `orderBy`, and the
`###sortBy:` marker is scrubbed from the template before it is sent to the doc service.

---

## 3. The exact SHAPE of the final context object

Types: `documentContext.types.ts`

```3:18:platform-model/src/runtime/config/recipes/system/helpers/documentContext.types.ts
export const enum ContextKeys {
    document = 'document',
    org = 'org',
    record = 'record',
}

export type DocumentTemplateContext = {
    [ContextKeys.org]: Record<string, unknown>;
    [ContextKeys.record]: object;
    [ContextKeys.document]?: DocumentContext;
};

export type DocumentContext = {
    signatures?: { [key: string]: { url?: string; signedAt?: string; signedBy?: string } };
    currentDate: Record<DateTimeValueFormatType, string>;
};
```

### `org` — built by `getOrgContextForDocument`

```52:99:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
export const getOrgContextForDocument = async ({ ctx }): Promise<Record<string, unknown>> => {
    ...
    return {
        orgId: ctx.orgId,
        logoUrl: org?.logo_url,
        orgAddress,          // { companyName, address1, address2, postal, city, state, country }
        remitToAddress,      // same shape
        orgPhone: org?.phone,
        orgEmail: org?.email,
        /** @deprecated use `documentTerms` instead */
        terms: documentTerms?.[ORG_DOC_TERMS_CATEGORY_KEYS.bol_regular]?.terms_conditions,
        documentTerms,       // { [category]: { created_at, updated_at, terms_conditions } }
    };
};
```

`documentTerms` categories seen in code: `bol_regular`, `invoice_regular`,
`rate_confirmation_regular`, `quote_regular`. Each `terms_conditions` is passed through
`sanitizeAndAutolinkHtml`, and the whole `{{org.documentTerms.*.terms_conditions}}` token
is rewritten to a triple-stash `{{{...}}}` so the HTML is not escaped.

### `document` — built by `formatDocumentContext`

```101:128:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
export const formatDocumentContext = (params: { documentContext?: Partial<DocumentContext>; }): DocumentContext => {
    const { documentContext } = params;
    const formattedSignatures = formatSignatures(documentContext?.signatures);
    const dateTimeNow = new Date();
    const currentDate: Record<string, string> = {};
    for (const [key, value] of Object.entries(DateTimeValueFormatType)) {
        if (!formatMap[value]) { continue; }
        currentDate[key] = format(dateTimeNow, formatMap[value]);
    }
    return { ...documentContext, signatures: formattedSignatures, currentDate };
};
```

So `document` always carries `currentDate` (all six date formats of "now") plus optional
`signatures` (per-key `{ url?, signedAt (formatted longDateTime), signedBy? }`).

### `record` — built by `buildRecordContext` (§2e), path-driven

Full worked example: see `fixtures/invoice-context.json` (built context Handlebars
receives) and P4.

**Whole context skeleton:**
```jsonc
{
  "org": {
    "orgId": "...", "logoUrl": "...", "orgPhone": "...", "orgEmail": "...",
    "orgAddress":    { "companyName","address1","address2","postal","city","state","country" },
    "remitToAddress":{ "companyName","address1","address2","postal","city","state","country" },
    "terms": "<deprecated bol terms html>",
    "documentTerms": { "invoice_regular": { "created_at","updated_at","terms_conditions" }, ... }
  },
  "record": { /* only the leaves referenced by {{record.*}} tokens, pre-formatted */ },
  "document": {
    "currentDate": { "standardDate","standardDateTime","shortDate","shortDateTime","longDate","longDateTime" },
    "signatures": { "<key>": { "url?","signedAt?","signedBy?" } }
  }
}
```

---

## 4. How `serialize(record)` works, and how DEEP the record context goes

### 4a. Doc Builder 1 does NOT call `serialize()` — depth is per-referenced-path

The Doc Builder 1 `record` context is materialized **on demand, per template path**.
Depth = length of the deepest `{{...}}` token, resolved through `$getValue` one connection
hop at a time (`applyRecordValue` recurses into `RRecord` and `RRecord[]`). There is no
fixed "N levels" — the invoice template reaches e.g.
`record.ordersDocBuilder.origins.location.city` (3 connection hops deep) simply because a
token names it.

The unit test `recipes/base/helpers/__tests__/documentContext.test.ts` proves arbitrarily
deep nesting works (order → tasks → subTasks → stops → address → street). That is the
authoritative fixture for the path-driven materializer.

### 4b. The generic `serialize()` (used by the LEGACY assemblers and the search index)

`platform-model/src/runtime/rrecord.serializer.ts`. This is the function the shared
context was thinking of. It DOES walk the object graph, and **when `fields` is omitted it
serializes the ENTIRE graph** (guarding against cycles with a `seen` set that collapses
revisited records to `{id, objectKey, orgId}`). When a `fields` map is passed (via
`parseAssocs([...])`) it only expands the named connections/leaves.

```46:123:platform-model/src/runtime/rrecord.serializer.ts
export function serialize(
    record: RRecord,
    fields?: any,
    opts: { ... } = {}
): object {
    const seen = new Set<RRecord>();

    function serializeInternal(record: RRecord, fields?: any): object {
        ...
        const config = record.$config;
        const output = {
            id: record.$id,
            objectKey: record.$objectKey,
            orgId: record.$context.orgId,
            source: record.$source,
            errors: record.$errors,
            ...(!opts.isDenormalized
                ? {
                      widgets: (record as WidgetRecord).$widgets,
                      widgetToOpen: (record as WidgetRecord).$widgetToOpen,
                      ephemeralWidgets: (record as WidgetRecord).$ephemeralWidgets,
                      externalId: record.$externalId ?? undefined,
                  }
                : {}),
            ...(objectConfigType ? { objectConfigType } : {}),
        } as any;
        let defaultFields = false;

        if (!fields) {
            defaultFields = true;
            if (opts.isDenormalized) {
                fields = {};
                for (const fieldKey of defaultDenormPaths) {
                    if (config.hasField(fieldKey)) {
                        fields[fieldKey] = undefined;
                    }
                }
            } else {
                fields = Object.fromEntries(
                    config.fields
                        .filter(
                            field =>
                                '$id' !== field.key && (field.type.isPrimitive || !field.reverse)
                        )
                        .map(f => [f.key, undefined])
                );
            }
        }
        ...
    }
    ...
}
```

The legacy invoice/BOL/bill/rate-con path uses it like this (note `parseAssocs` turning a
path array into the `fields` map — same idea as Doc Builder 1's path list, but a different
mechanism):

```542:568:recipes/base/actions/documentGeneration.ts
        stops = manifest.stops?.map(stop => {
            return serialize(
                stop,
                parseAssocs([
                    'ordinal',
                    'tasks.taskType',
                    'uniqueCommodities.commodityType',
                    ...
                    'location.postalCode',
                ])
            );
        });
```

**Takeaway:** two code paths coexist. Doc Builder 1 (the one Templara replaces) = template
string + `buildRecordContext`. Legacy fixed docs = hand-written assembler + `serialize()`
+ a template baked into the doc-generator service.

---

## 5. FORMATTING rules per value type — the master table

Concrete outputs are taken from the unit tests
(`documentContext.test.ts`, `documentContext.helpers.test.ts`) so they are ground truth,
not guesses.

### 5.1 Money (`isMoney` → `{ amount:number, currencyCode:string }`)

`{{record.foo}}` with an optional suffix leaf. The pre-formatted leaf shapes:

| Template token | Built context shape | Example input | Example output |
|---|---|---|---|
| `{{record.total}}` (no suffix) | `total: "<string>"` | `{amount:140.33, currencyCode:'USD'}` | `"$140.33"` |
| `{{record.total.withDecimalsAndCurrencyCode}}` | `total: { withDecimalsAndCurrencyCode: "<string>" }` | `{amount:140, USD}` | `"$140.00 USD"` |
| `{{record.total.withCurrencyCode}}` | `total: { withCurrencyCode: "<string>" }` | `{amount:140.3333, USD}` | `"$140.3333 USD"` (≤4 dp, no trailing zeros) |
| `{{record.total.unroundedWithoutCurrencyCode}}` | `total: { unroundedWithoutCurrencyCode: "<string>" }` | `{amount:140.3333, USD}` | `"$140.3333"` |

The **only** money suffix leaves are: `withCurrencyCode`, `withDecimalsAndCurrencyCode`,
`unroundedWithoutCurrencyCode` (enum `MoneyFormatType`). No-suffix default = 2 dp, `$`
prefix, no code. All variants hardcode the `$` glyph (currency symbol lookup is a TODO in
the code).

Line-item money in the invoice template: `{{this.subTotal}}` (no suffix → `"$140.00"`) and
`{{this.rate.unroundedWithoutCurrencyCode}}` (→ `"$140"`). The order/invoice grand totals
use `withDecimalsAndCurrencyCode`.

### 5.2 MultiCurrencyMoney (`isMultiCurrencyMoney` → `{ USD:{amount,currencyCode}, CAD:{...} }`)

Rendered as a single `\n`-joined string of the per-currency amounts (one row per currency),
because Doc Builder can't loop a nested object. With a money suffix present the string is
nested under that suffix key.

| Token | Output (2-currency example) |
|---|---|
| `{{record.totalAmount}}` | `"$140.00\n$196.00"` |
| `{{record.totalAmount.withCurrencyCode}}` | `{ withCurrencyCode: "$140 USD\n$196 CAD" }` |
| `{{record.totalAmount.withDecimalsAndCurrencyCode}}` | `{ withDecimalsAndCurrencyCode: "$140.00 USD\n$196.00 CAD" }` |

### 5.3 DateTimeValue (`isDateTimeValue` → `{ dateTimeInLocation?, dateTimeInLocationEnd? }` ISO strings)

Requires a **property + format** (or a range format). Property leaves:
`dateTimeInLocation`, `dateTimeInLocationEnd`. Format leaves (enum `DateTimeValueFormatType`):
`standardDate`, `standardDateTime`, `shortDate`, `shortDateTime`, `longDate`, `longDateTime`.
Range leaves (enum `DateTimeValueFormatRangeType`) are applied directly on the field:
`standardDateRange`, `standardDateTimeRange`, `shortDateRange`, `shortDateTimeRange`,
`shortDateTimeRangeCompact`, `longDateRange`, `longDateTimeRange`.

| Token | Built context shape | Output (for `2021-01-01T14:00:00` / range `..T08:00` → `..T17:00`) |
|---|---|---|
| `{{record.d.dateTimeInLocation.shortDate}}` | `d: { dateTimeInLocation: { shortDate } }` | `"Jan 1, 2021"` |
| `.dateTimeInLocation.standardDate` | " | `"2021-01-01"` |
| `.dateTimeInLocation.standardDateTime` | " | `"2021-01-01 14:00"` |
| `.dateTimeInLocation.shortDateTime` | " | `"Feb 1, 2021 @ 14:00"` |
| `.dateTimeInLocation.longDate` | " | `"February 10th, 2021"` |
| `.dateTimeInLocation.longDateTime` | " | `"March 21st, 2021 @ 14:00"` |
| `.dateTimeInLocationEnd.<fmt>` | `d: { dateTimeInLocationEnd: { ... } }` | same formats, end value |
| `{{record.d.shortDateTimeRange}}` | `d: { shortDateTimeRange }` | `"Feb 1, 2021 @ 08:00 - Feb 2, 2021 @ 17:00"` |
| `{{record.d.shortDateTimeRangeCompact}}` (same day) | `d: { shortDateTimeRangeCompact }` | `"Feb 1, 2021 @ 08:00 - 17:00"` |
| `{{record.d.standardDateRange}}` | `d: { standardDateRange }` | `"2021-02-01 - 2021-02-02"` |
| `{{record.d.longDateTimeRange}}` | `d: { longDateTimeRange }` | `"February 1st, 2021 @ 08:00 - February 2nd, 2021 @ 17:00"` |

Format strings (verbatim):
```673:688:platform-model/src/runtime/config/recipes/system/helpers/documentContext.helpers.ts
const standardDateFormatString = 'yyyy-MM-dd';
const standardDateTimeFormatString = 'yyyy-MM-dd HH:mm';
const shortDateFormatString = 'MMM d, yyyy';
const shortDateTimeFormatString = 'MMM d, yyyy @ HH:mm';
const shortTimeFormatString = 'HH:mm';
const longDateFormatString = 'MMMM do, yyyy';
const longDateTimeFormatString = 'MMMM do, yyyy @ HH:mm';
```

Plus a scalar `@RDate` string branch: if the field is an `RTypeKey.date` and the value is a
raw ISO string, `{{field.shortDate}}` etc. formats directly onto `{ [fmt]: "..." }`
(e.g. `payDate.shortDate` → `"Jul 1, 2026"`).

### 5.4 Addresses — individual fields, no `formattedAddress`

There is **no `formattedAddress`** helper anywhere in the Doc Builder 1 pipeline. Templates
concatenate individual leaves with literal separators in HTML.

- **Org addresses** come from `getOrgContextForDocument` → `getOrgAddress`, shape:
  `{ companyName, address1, address2, postal, city, state, country }` (note `postal`, and
  `remit_to_*` fallback logic). `latitude/longitude/suite` are in the `RRAddress` type but
  never populated by `getOrgAddress`.
```11:25:platform-model/src/runtime/config/recipes/system/helpers/documentOrg.helpers.ts
export const getOrgAddress = (addressType: OrgAddressTypes, org: RROrg): RRAddress => {
    const shouldShowRemitTo: boolean =
        !!org?.remit_to_address_1 && addressType === OrgAddressTypes.remitToAddress;
    return {
        companyName: shouldShowRemitTo ? org?.remit_to_org_name : org?.name,
        address1: shouldShowRemitTo ? org?.remit_to_address_1 : org?.address_1,
        address2: shouldShowRemitTo ? org?.remit_to_address_2 : org?.address_2,
        postal: shouldShowRemitTo ? org?.remit_to_postal : org?.postal,
        city: shouldShowRemitTo ? org?.remit_to_city : org?.city,
        state: shouldShowRemitTo && org?.remit_to_city ? org.remit_to_state : org?.state,
        country: shouldShowRemitTo && org?.remit_to_city ? org.remit_to_country : org?.country,
    };
};
```
- **Record addresses** come from the object graph via `$getValue` (an `address` RObject
  connection, e.g. `invoiceToAddress`, `remitToAddress`, stop `location`). These use
  `postalCode` (not `postal`), plus the usual `companyName/address1/address2/city/state/country`.
- ⚠️ **Live mismatch**: the invoice template reads `{{org.orgAddress.postalCode}}` but the org
  source only sets `postal` → the org postal code renders blank today. (Record addresses are
  fine because they genuinely have `postalCode`.)

### 5.5 Other special-cased types

| Type (`fieldConfig.fieldTypeKey`) | Rule | Example |
|---|---|---|
| `select` | value → matching `option.labelId` (falls back to raw value if no label) | `'option1'` → `"Option 1"` |
| `status` | value → `option.labelId` (fallback raw) | `'status1'` → `"Status 1"` |
| `multiSelect` | array of values → array of `labelId`s | `['a','b']` → `["A","Bee"]` |
| `time` (number, secs since midnight) | `formatSecondsToTime` → `HH:mm` | `32400` → `"09:00"` |
| `measurement` (`isMeasurement`) | `convertRTypeFieldToStringHelper(value, fieldConfig)` — unit-aware string | weight/quantity → e.g. `"500 lbs"` (unit from field config) |
| `file` connection + `.url` leaf | resolves a presigned download URL (`getFileDownloadURL`) | `{ url: "https://..." }` |
| everything else with no suffix | passed through as the raw scalar | text/number as-is |

There is **no dedicated phone or percentage formatter** in the Doc Builder 1 pipeline —
`org.orgPhone` is the raw org phone string, and percentages like the invoice's
`{{this.taxRate.effectiveTaxRate}}` are raw numbers with the literal `%` typed into the HTML
around the token.

---

## 6. What this means for Templara (Doc Builder 2)

- The "context contract" Templara must reproduce is: `{ org, record, document }` where
  every money/date/enum/measurement leaf is a **pre-formatted string** (or a
  `{ suffixKey: string }` object), and connections are materialized only where referenced.
- The set of magic suffix leaves is small and closed (see §2d/§5): 3 money, 6 date formats
  × 2 properties, 7 range formats, `url`. A JSON engine can enumerate these deterministically.
- Because materialization is path-driven off a regex scan (not a Handlebars AST), any
  Templara token syntax that can be enumerated to a list of `record.*` field paths can reuse
  `buildRecordContext` unchanged — the record side is engine-agnostic. Only the template
  parser (`TemplateVisitor`) is Handlebars-specific.
