# P5 — Records & the object model (RObject / fields / connections / serialize)

Read-only discovery. Paths relative to the `platform-components` checkout.

---

## 1. The object / field definition system (RObject)

Rose Rocket objects are TypeScript classes extending `RRecord`, decorated with `@RObject`,
whose members are decorated field/connection declarations. Decorators live in
`@roserocket/platform-model/decorators`; the runtime metadata they build is
`RObjectConfig` / `RFieldConfig` (from `@roserocket/interpreter`). The `Invoice` class is a
representative, feature-complete example:

```183:282:recipes/base/objects/platformInvoice.ts
@RObject({
    label: 'Invoice',
    description: `Invoices are a form of record keeping ...`,
    stability: ObjectStability.stable,
    level: ObjectLevel.primary,
    events: InvoiceEvents,
})
export class Invoice extends RRecord implements PaymentAllocationCalculation {
    @RFullId('INVOICE-{1}')
    fullId: string;

    @RText({
        label: 'Name',
        description: 'Name of the invoice',
    })
    name: string;

    @RField<StatusField>({
        type: ObjectFieldType.StatusField,
        label: 'Status',
        description: 'Status of the invoice',
        isNullable: false,
        defaultValue: InvoiceStatus.created,
        options: [ ... ],
    })
    status: InvoiceStatus;
    ...
    @RLocalDateTime({
        isRange: false,
        label: 'Invoice date',
        description: 'The date the financial invoice was issued',
    })
    invoiceDate: DateTimeValue;
```

### Field-declaration decorators (metadata: `label`, `description`, `type`, options…)

| Decorator | Field kind | Notes |
|---|---|---|
| `@RText` / `@RNumber` / `@RToggle` | scalar text / number / boolean | |
| `@RSelect` / `@RField<StatusField>` / `@RMultiSelect` | enum-like; carry `options: [{value, labelId, color?}]` | labelId is what doc rendering resolves to (P3 §5.5) |
| `@RLocalDateTime` / `@RUTCDateTime` | date/time → `DateTimeValue` (`{dateTimeInLocation, dateTimeInLocationEnd}`) | `isRange` controls single vs range |
| `@RMoney` / `MoneyField` | `{amount, currencyCode}` | |
| `@RFullId('INVOICE-{1}')` | formatted human id | template arg extracted for indexing |
| `@RAny` | opaque JSON blob | |
| `@RMeasurement` | unit-aware quantity/weight | rendered via `convertRTypeFieldToStringHelper` |

### Connections (relations) — `@RConnection`

`@RConnection` uses **positional** args `(relationshipKey, cardinality, config)` OR a single
config object with `type` (target objectKey). Cardinality is only `OneToOne` or `OneToMany`.
From `Invoice`:

```267:381:recipes/base/objects/platformInvoice.ts
    @RConnection({
        type: 'customer',
        label: 'Customer',
        description: 'The customer from which the balance of the invoice is owed',
    })
    customer?: Customer | null;
    ...
    @RConnection({
        type: 'address',
        label: 'Invoice to address',
        description: 'Address of the recipient (who will be billed) for this invoice',
    })
    invoiceToAddress?: Address | null;
    ...
    @RConnection({
        type: 'financialLineItem',
        label: 'Line items',
        description: 'Line items on the invoice',
    })
    lineItems: FinancialLineItem[];
```

The `type` string names the **target objectKey** — this is the connection metadata that a
UI/editor uses to know it can "drill into" that object's fields.

### Derived & lookup fields — `@RDerived`, `@RLookup`

`@RDerived('depPath1', 'depPath2', …, {FIELD_TYPE, cardinalityType, objectKey})` declares a
computed getter with explicit dependency paths (used to decide what to `$load`). These are
the doc-builder virtual fields the invoice template relies on:

```519:549:recipes/base/objects/platformInvoice.ts
    @RDerived<ConnectionField>(
        'orderLineItems',
        'lineItems.order',
        'lineItems.order.poNum',
        'lineItems.order.shipper',
        'lineItems.order.consignee',
        'lineItems.order.commodities',
        'lineItems.order.totalAmount',
        'lineItems.order.stops',
        {
            isHidden: true,
            label: 'Orders with details (for doc builder)',
            description: 'All orders associated with this invoice (through the line items).',
            FIELD_TYPE: ObjectFieldType.ConnectionField,
            cardinalityType: CardinalityType.OneToMany,
            objectKey: 'order',
        }
    )
    get ordersDocBuilder(): Order[] {
        const orders: Order[] = [];
        const uniqueOrderIds = [] as string[];
        for (const lineItem of this.orderLineItems || []) {
            const order = lineItem?.order;
            const orderId = order?.$id;
            if (order && orderId && !uniqueOrderIds.includes(orderId)) {
                uniqueOrderIds.push(orderId);
                orders.push(order);
            }
        }
        return orders;
    }
```

The `orderLineItems` / `miscLineItems` split (order-bearing vs order-less FLIs) that P4's
context relies on:

```929:962:recipes/base/objects/platformInvoice.ts
    @RDerived(
        'lineItems.itemHistory',
        'lineItems.itemHistory.historicalLineItems.order',
        ...
        {
            label: 'Order line items',
            description: 'Line items associated with orders on this invoice.',
            FIELD_TYPE: ObjectFieldType.ConnectionField,
            cardinalityType: CardinalityType.OneToMany,
            objectKey: 'financialLineItem',
        }
    )
    get orderLineItems(): FinancialLineItem[] {
        const items = FinancialLineItem.getBookedHistoricalLineItemsWithOrder(this.lineItems || []);
        return items.sort(...);
    }
```

`@RLookup({path, label, description})` reaches through connections to surface a leaf (e.g.
`Invoice.orderTags` = `orders.tags`).

### System `$`-field mixins (composed into EVERY object)

Two mixins are declared with `@RMixin({ targetKey: '*' })`, so their fields are composed
onto every object type. This is the origin of the repeated `$id/$externalId/...` blocks.

```1:20:platform-model/src/runtime/config/recipes/system/objects/identity.ts
@RMixin({ targetKey: '*' })
export class Identity {
    @RField<RTypeKey.text>({ type: RTypeKey.text, label: 'TODO', description: 'TODO' })
    public $id?: string;

    @RText({
        label: 'External ID',
        description: 'The external ID of the object',
    })
    public $externalId?: string;
}
```

```13:113:platform-model/src/runtime/config/recipes/system/objects/audit.ts
@RMixin({ targetKey: '*' })
export class Audit {
    @RUTCDateTime({ label: 'Created at', ... }) public $createdAt?: Date;
    @RText({ label: 'Created by user id', ... }) public $createdBy?: string;
    @RText({ label: 'Created by', ... }) public $createdByFullName?: string;
    @RUTCDateTime({ label: 'Updated at', ... }) public $updatedAt?: Date;
    @RText({ label: 'Updated by user id', ... }) public $updatedBy?: string;
    @RText({ label: 'Updated by', ... }) public $updatedByFullName?: string;
    @RUTCDateTime({ label: 'Deleted at', ... }) public $deletedAt?: Date;
    @RText({ label: 'Deleted by', ... }) public $deletedBy?: string;
    @RText({ label: 'Owner', ... }) public $ownerId?: string;
    @RNumber({ label: 'Object version', ... }) public $version?: number;
    @RText({ label: 'Source', ... }) public $source?: string;
}
```

So **every** object (and therefore every connected object) carries at minimum a
**13-field system block**: `$id`, `$externalId` (Identity) + `$createdAt`, `$createdBy`,
`$createdByFullName`, `$updatedAt`, `$updatedBy`, `$updatedByFullName`, `$deletedAt`,
`$deletedBy`, `$ownerId`, `$version`, `$source` (Audit).

---

## 2. How a record becomes document data

There are **two** materialization mechanisms; Doc Builder 1 templates use the first.

### 2a. Path-driven materializer (Doc Builder 1) — `$getValue` walk

`getRecordContextForDocument` loads the record with only the template's field paths
(`$byIdOrThrow({ id, paths })`), then `buildRecordContext` walks each path with
`record.$getValue(fieldKey)` and `record.$config.getField(fieldKey)`, descending into
`RRecord` / `RRecord[]` connection values and formatting leaves. Full code + behaviour in
**P3 §2**. Depth = the depth of the deepest `{{...}}` token; connections are only traversed
where referenced. The authoritative behavioural spec is
`recipes/base/helpers/__tests__/documentContext.test.ts` (order → tasks → subTasks → stops →
address, arbitrarily deep).

### 2b. Generic `serialize()` — used by legacy assemblers + the search index

`platform-model/src/runtime/rrecord.serializer.ts`. Walks the object graph and emits plain
JSON. Two modes:

- **With a `fields` map** (built by `parseAssocs(['a', 'b.c', …])`): expands only the named
  connections/leaves — the legacy invoice/BOL/bill/rate-con assemblers use this
  (`recipes/base/actions/documentGeneration.ts`).
- **Without `fields`**: serializes the **entire** graph, guarding cycles via a `seen` set
  that collapses a re-visited record to `{id, objectKey, orgId}`.

```104:123:platform-model/src/runtime/rrecord.serializer.ts
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
```

Every serialized node starts with the system block (this is what makes each connection in a
serialized graph carry `id/objectKey/orgId/source/externalId`):

```80:101:platform-model/src/runtime/rrecord.serializer.ts
        const output = {
            id: record.$id,
            objectKey: record.$objectKey,
            orgId: record.$context.orgId,
            source: record.$source,
            errors: record.$errors,
            ...
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
```

**Connection traversal & depth:** for each field, if the value is an `RRecord` it recurses
(`serializeInternal(value, fields[key] || {})`); if it's an `RRecord[]` it maps and recurses
per element; otherwise it serializes the primitive. Depth is bounded either by the `fields`
map (explicit) or by the cycle guard (full graph).

---

## 3. Real large example records (JSON)

- **Invoice**: [`fixtures/invoice-record.serialized.json`](fixtures/invoice-record.serialized.json)
  — Invoice → customer, invoiceToAddress, remitToAddress, lineItems[] → (taxRate →
  taxRateComponents, order → shipper/consignee/commodities/stops→location). Shows the `$`
  system block on every node and an order-less FLI (misc line item).
- **Order**: [`fixtures/order-record.serialized.json`](fixtures/order-record.serialized.json)
  — Order → customer, shipper, consignee, commodities[], stops[]→location, lineItems[].

Both are **[SYNTHESIZED]** but key/shape-faithful to `serialize()` and the object
definitions. (The built *context* an invoice template actually receives — the collapsed,
pre-formatted form — is [`fixtures/invoice-context.json`](fixtures/invoice-context.json).)

---

## 4. Why an Order can surface ~3,474 fields in editors (the giant field list)

The editor field list is **not** the serialized record — it is the object *config* graph
flattened by walking connections. Two multiplying factors:

1. **Every object carries the 13-field `$` system block** (Identity + Audit, §1). That block
   repeats on the root object *and on every connected object you drill into*. This is the
   `$id/$externalId/$createdAt/...` repetition the brief calls out.

2. **Every `@RConnection` expands to its target object's full field set**, which itself
   contains more connections. The Order object alone declares (measured in
   `recipes/base/objects/order.ts`):
   - ~135 directly-decorated members (via `@RText/@RNumber/@RConnection/@RDerived/@RLookup/…`),
   - **29 `@RConnection`s** (targets include `address`, `customer`, `user`, `partner`,
     `tag`, `task`, `shipment`, `stop`, `quote`, `financialLineItem`, `document`,
     `exchangeRate`, `assetType`, `partnerService`, …),
   - **83 `@RDerived`** getters and 1 `@RLookup`.

   Each of those 29 connections is itself an object with its own dozens of fields + the
   13-field system block. So a one-level flatten is already
   `~135 + Σ(target_fields + 13)` over 29 targets; a two-level flatten multiplies again
   (e.g. `order.customer.<all customer fields incl. customer's own connections>`,
   `order.stops.location.<all address fields>`). A few thousand entries at a bounded drill
   depth is the expected combinatorial result — hence "~3,474 fields," most of which are
   repeated `$id/$externalId/$createdAt/...` blocks contributed by every connected object.

### How the in-repo editor avoids exploding all at once

The token autocomplete does **not** pre-flatten the whole tree — it drills **one connection
level at a time**, loading a target object's user-visible fields on demand:

```84:107:ui/src/scripts/platform/core/FieldInputV2/fields/TextFieldInput/useTemplateTokenAutocomplete.ts
    const loadFields = useCallback(
        async (objectKey: string): Promise<Field[]> => {
            if (!objectKey) {
                return [];
            }
            const objectConfig = await fetchConfig({
                ingredientKey: IngredientKey.objects,
                configKey: objectKey,
            });
            const fields = objectConfig.fields
                .filter(isUserVisibleField)
                .map(
                    fieldConfig =>
                        getFieldFromConfig(objectConfig.key, fieldConfig) as FieldWithArray
                );
            fields.forEach(field => {
                if (field.connectionKey && field.isArray) {
                    arrayConnections.current.add(connKey(field.objectKey, field.key));
                }
            });
            return fields;
        },
        [fetchConfig]
    );
```

And it emits array connections with a `.[0]` index so the backend resolver renders the
first element:

```58:63:ui/src/scripts/platform/core/FieldInputV2/fields/TextFieldInput/useTemplateTokenAutocomplete.ts
export const buildToken = (path: Field[], arrayConnections: Set<string>): string => {
    const segments = path.map(seg =>
        arrayConnections.has(connKey(seg.objectKey, seg.key)) ? `${seg.key}.[0]` : seg.key
    );
    return `{{record.${segments.join('.')}}}`;
};
```

The external `@roserocket/components.document-template-editor` field-picker exposes the same
config-driven field tree; a picker that eagerly enumerates all reachable fields to a fixed
depth is what produces the multi-thousand count. The `isUserVisibleField` filter is the main
lever that trims (hidden/`isHidden` and `$`-system fields can be filtered out for display,
but they still exist on every node).

---

## 5. Relevance to Templara

- **Persisted contract is the object model, not the template.** `RObjectConfig`/`RFieldConfig`
  (labels, types, connection targets, `options[].labelId`) is the stable, migration-sensitive
  surface. Templara can and should read the same config graph the picker uses.
- **The `$`-system block is universal.** Any Templara token resolver must expect `$id`,
  `$externalId`, and the audit fields to exist on every node, and (like the current editor)
  should filter them out of the *picker* while keeping them resolvable.
- **Two existing materializers to reuse or mirror:** the path-driven `buildRecordContext`
  (best fit — lazy, pre-formatted leaves) and the generic `serialize()` (full/partial graph).
  Prefer the path-driven one; it already encodes every formatting rule Templara must match.
