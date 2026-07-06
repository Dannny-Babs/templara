# @templara/templates

Starter templates and sample data for Templara demos, tests, and local project creation.

## Use A Starter

```ts
import { invoiceSampleData, invoiceTemplate } from "@templara/templates";

const project = {
  name: "Invoice",
  template: structuredClone(invoiceTemplate),
  data: structuredClone(invoiceSampleData),
};
```

## Included Starters

- Invoice
- Shipment BOL
- Receipt
- Pay Stub
- Shipping Label

Host apps should clone starter templates before editing so the shared starter definitions stay immutable.
