import { PAGE_PRESETS } from "@templara/core";
import type {
  BarcodeNode,
  DocumentTemplate,
  DynamicValue,
  FieldRun,
  QrNode,
  ShapeNode,
  TextNode,
  TextStyle
} from "@templara/core";

const fonts = [
  {
    id: "geist",
    family: "Geist",
    source: { kind: "google-font", family: "Geist", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], display: "swap" },
    fallback: "Inter, ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: "geist-mono",
    family: "Geist Mono",
    source: { kind: "google-font", family: "Geist Mono", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], display: "swap" },
    fallback: "Roboto Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  {
    id: "inter",
    family: "Inter",
    source: { kind: "google-font", family: "Inter", weights: [400, 500, 700, 800], display: "swap" },
    fallback: "ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: "space-grotesk",
    family: "Space Grotesk",
    source: { kind: "google-font", family: "Space Grotesk", weights: [400, 500, 700], display: "swap" },
    fallback: "ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: "source-serif-4",
    family: "Source Serif 4",
    source: { kind: "google-font", family: "Source Serif 4", weights: [400, 600, 700], display: "swap" },
    fallback: "Georgia, serif"
  },
  {
    id: "roboto-mono",
    family: "Roboto Mono",
    source: { kind: "google-font", family: "Roboto Mono", weights: [400, 500, 700], display: "swap" },
    fallback: "ui-monospace, SFMono-Regular, Menlo, monospace"
  }
] satisfies DocumentTemplate["fonts"];

const labelStyle: TextStyle = {
  fontFamily: "Geist",
  fontSize: 9,
  fontWeight: 800,
  lineHeight: 1.2,
  color: "#475569"
};

const bodyStyle: TextStyle = {
  fontFamily: "Geist",
  fontSize: 10,
  fontWeight: 500,
  lineHeight: 1.25,
  color: "#111827"
};

const smallStyle: TextStyle = {
  fontFamily: "Geist",
  fontSize: 9,
  fontWeight: 400,
  lineHeight: 1.25,
  color: "#334155"
};

const valueStyle: TextStyle = {
  fontFamily: "Geist",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.1,
  color: "#111827"
};

function field(label: string, path: string, format?: FieldRun["format"]): FieldRun {
  return {
    kind: "field",
    label,
    binding: { path },
    fallback: "",
    format
  };
}

function bindingValue(path: string): DynamicValue {
  return {
    kind: "binding",
    binding: { path }
  };
}

function templateValue(parts: TextNode["content"]): DynamicValue {
  return {
    kind: "template",
    parts
  };
}

function textNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: TextNode["content"],
  style = bodyStyle
): TextNode {
  return {
    id,
    type: "text",
    frame: { x, y, width, height },
    content,
    style: { ...style }
  };
}

function rect(id: string, x: number, y: number, width: number, height: number, fill = "#ffffff", stroke = "#d8dee8"): ShapeNode {
  return {
    id,
    type: "shape",
    shape: "rectangle",
    frame: { x, y, width, height },
    style: { fill, stroke, strokeWidth: 1, radius: 0 }
  };
}

function barcodeNode(id: string, format: string, x: number, y: number, width: number, height: number, value: DynamicValue): BarcodeNode {
  return {
    id,
    type: "barcode",
    format,
    frame: { x, y, width, height },
    value
  };
}

function qrNode(id: string, x: number, y: number, size: number, value: DynamicValue): QrNode {
  return {
    id,
    type: "qr",
    frame: { x, y, width: size, height: size },
    value
  };
}

export const shipmentBolTemplate: DocumentTemplate = {
  id: "shipment-bol",
  version: "0.0.1",
  unit: "px",
  metadata: {
    name: "Shipment BOL Template"
  },
  fonts,
  pages: [
    {
      id: "page-1",
      name: "Shipment BOL",
      size: PAGE_PRESETS.letter,
      margin: { top: 48, right: 48, bottom: 48, left: 48 },
      layers: [
        {
          id: "background",
          kind: "background",
          nodes: [
            rect("page-border", 36, 36, 744, 984, "#ffffff", "#cbd5e1"),
            rect("header-band", 36, 36, 744, 112, "#f8fafc", "#cbd5e1"),
            rect("accent-rule", 36, 146, 744, 4, "#0f766e", "#0f766e")
          ]
        },
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            textNode("business-name", 64, 58, 300, 28, [field("Business Name", "business.name")], {
              fontFamily: "Geist",
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1,
              color: "#0f172a"
            }),
            textNode("business-address", 64, 92, 316, 34, [field("Business Address", "business.address")], smallStyle),
            textNode(
              "business-contact",
              64,
              126,
              316,
              14,
              [
                field("Business Phone", "business.phone"),
                { kind: "text", text: "  |  " },
                field("Business Email", "business.email")
              ],
              smallStyle
            ),
            textNode("bol-title", 420, 58, 244, 32, [{ kind: "text", text: "BILL OF LADING" }], {
              fontFamily: "Geist",
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1,
              color: "#111827",
              align: "right"
            }),
            textNode("bol-number-label", 420, 96, 80, 13, [{ kind: "text", text: "BOL NUMBER" }], labelStyle),
            textNode("bol-number", 420, 112, 112, 18, [field("BOL Number", "shipment.bolNumber")], valueStyle),
            barcodeNode("bol-number-barcode", "code128", 536, 98, 128, 40, bindingValue("shipment.bolNumber")),
            qrNode("tracking-qr", 690, 64, 62, bindingValue("shipment.trackingUrl")),

            rect("shipper-card", 64, 176, 216, 128, "#ffffff", "#cbd5e1"),
            textNode("shipper-label", 78, 190, 180, 12, [{ kind: "text", text: "SHIPPER" }], labelStyle),
            textNode("shipper-name", 78, 208, 180, 16, [field("Shipper Name", "shipment.shipper.name")], bodyStyle),
            textNode("shipper-address", 78, 230, 184, 40, [field("Shipper Address", "shipment.shipper.address")], smallStyle),
            textNode("shipper-phone", 78, 276, 184, 14, [field("Shipper Phone", "shipment.shipper.phone")], smallStyle),

            rect("recipient-card", 300, 176, 216, 128, "#ffffff", "#cbd5e1"),
            textNode("recipient-label", 314, 190, 180, 12, [{ kind: "text", text: "RECIPIENT" }], labelStyle),
            textNode("recipient-name", 314, 208, 180, 16, [field("Recipient Name", "shipment.recipient.name")], bodyStyle),
            textNode("recipient-address", 314, 230, 184, 40, [field("Recipient Address", "shipment.recipient.address")], smallStyle),
            textNode("recipient-phone", 314, 276, 184, 14, [field("Recipient Phone", "shipment.recipient.phone")], smallStyle),

            rect("delivery-card", 536, 176, 216, 128, "#ffffff", "#cbd5e1"),
            textNode("delivery-label", 550, 190, 180, 12, [{ kind: "text", text: "DELIVERY ADDRESS" }], labelStyle),
            textNode("delivery-location", 550, 208, 180, 16, [field("Delivery Location", "shipment.delivery.location")], bodyStyle),
            textNode("delivery-address", 550, 230, 184, 40, [field("Delivery Address", "shipment.delivery.address")], smallStyle),
            textNode("delivery-window", 550, 276, 184, 14, [field("Delivery Window", "shipment.delivery.window")], smallStyle),

            rect("detail-strip", 64, 322, 688, 64, "#f8fafc", "#cbd5e1"),
            textNode("pro-label", 80, 336, 96, 12, [{ kind: "text", text: "PRO / TRACKING" }], labelStyle),
            textNode("pro-value", 80, 354, 118, 16, [field("PRO Number", "shipment.proNumber")], bodyStyle),
            textNode("po-label", 220, 336, 96, 12, [{ kind: "text", text: "PO NUMBER" }], labelStyle),
            textNode("po-value", 220, 354, 118, 16, [field("PO Number", "shipment.poNumber")], bodyStyle),
            textNode("pickup-label", 360, 336, 96, 12, [{ kind: "text", text: "PICKUP DATE" }], labelStyle),
            textNode(
              "pickup-value",
              360,
              354,
              118,
              16,
              [field("Pickup Date", "shipment.pickupDate", { type: "date", dateStyle: "medium" })],
              bodyStyle
            ),
            textNode("service-label", 500, 336, 96, 12, [{ kind: "text", text: "SERVICE" }], labelStyle),
            textNode("service-value", 500, 354, 110, 16, [field("Service Level", "shipment.serviceLevel")], bodyStyle),
            textNode("mode-label", 632, 336, 80, 12, [{ kind: "text", text: "MODE" }], labelStyle),
            textNode("mode-value", 632, 354, 96, 16, [field("Mode", "shipment.mode")], bodyStyle)
          ]
        },
        {
          id: "flow",
          kind: "flow",
          nodes: [
            {
              id: "body",
              type: "flowRegion",
              frame: { x: 64, y: 414, width: 688, height: 540 },
              flowBoundary: "page-margin",
              children: [
                textNode("handling-title", 0, 0, 380, 20, [{ kind: "text", text: "Handling Units / Commodities" }], {
                  ...valueStyle,
                  fontSize: 16
                }),
                {
                  id: "freight-header",
                  type: "group",
                  frame: { x: 0, y: 30, width: 688, height: 34 },
                  children: [
                    rect("freight-header-bg", 0, 0, 688, 34, "#ecfdf5", "#94a3b8"),
                    textNode("header-pieces", 12, 10, 54, 12, [{ kind: "text", text: "Pieces" }], labelStyle),
                    textNode("header-type", 76, 10, 62, 12, [{ kind: "text", text: "Type" }], labelStyle),
                    textNode("header-description", 150, 10, 250, 12, [{ kind: "text", text: "Description" }], labelStyle),
                    textNode("header-weight", 416, 10, 70, 12, [{ kind: "text", text: "Weight" }], labelStyle),
                    textNode("header-class", 502, 10, 58, 12, [{ kind: "text", text: "Class" }], labelStyle),
                    textNode("header-nmfc", 574, 10, 58, 12, [{ kind: "text", text: "NMFC" }], labelStyle),
                    textNode("header-hazmat", 642, 10, 40, 12, [{ kind: "text", text: "HM" }], labelStyle)
                  ]
                },
                {
                  id: "handling-units-repeat",
                  type: "repeat",
                  frame: { x: 0, y: 0, width: 688, height: 34 },
                  binding: { path: "shipment.handlingUnits" },
                  itemAlias: "unit",
                  layout: {
                    direction: "vertical",
                    gap: 0,
                    splitItems: false,
                    rowSizing: "compact",
                    minRowHeight: 30,
                    maxCompressionRatio: 0.12,
                    fillAvailableSpace: true,
                    maxExpansionRatio: 0.15
                  },
                  children: [
                    rect("freight-row-bg", 0, 0, 688, 34, "#ffffff", "#d8dee8"),
                    textNode("unit-pieces", 12, 10, 54, 12, [field("Pieces", "unit.pieces", { type: "number" })], bodyStyle),
                    textNode("unit-type", 76, 10, 62, 12, [field("Type", "unit.type")], bodyStyle),
                    textNode("unit-description", 150, 10, 250, 12, [field("Description", "unit.description")], bodyStyle),
                    textNode("unit-weight", 416, 10, 70, 12, [field("Weight", "unit.weight", { type: "number" })], bodyStyle),
                    textNode("unit-class", 502, 10, 58, 12, [field("Class", "unit.freightClass")], bodyStyle),
                    textNode("unit-nmfc", 574, 10, 58, 12, [field("NMFC", "unit.nmfc")], bodyStyle),
                    textNode("unit-hazmat", 642, 10, 40, 12, [field("Hazmat", "unit.hazmat")], bodyStyle)
                  ]
                },
                {
                  id: "bol-summary",
                  type: "group",
                  frame: { x: 0, y: 24, width: 688, height: 218 },
                  children: [
                    rect("instructions-box", 0, 0, 410, 86, "#f8fafc", "#cbd5e1"),
                    textNode("instructions-label", 14, 12, 160, 12, [{ kind: "text", text: "SPECIAL INSTRUCTIONS" }], labelStyle),
                    textNode("instructions", 14, 32, 376, 36, [field("Special Instructions", "shipment.instructions")], smallStyle),

                    rect("totals-box", 430, 0, 258, 86, "#ffffff", "#cbd5e1"),
                    textNode("total-pieces-label", 446, 14, 110, 12, [{ kind: "text", text: "TOTAL PIECES" }], labelStyle),
                    textNode("total-pieces", 572, 12, 88, 16, [field("Total Pieces", "shipment.totals.pieces", { type: "number" })], bodyStyle),
                    textNode("total-weight-label", 446, 42, 110, 12, [{ kind: "text", text: "TOTAL WEIGHT" }], labelStyle),
                    textNode("total-weight", 572, 40, 88, 16, [field("Total Weight", "shipment.totals.weight", { type: "number" })], bodyStyle),

                    textNode("pdf417-label", 0, 104, 200, 12, [{ kind: "text", text: "MACHINE READABLE SHIPMENT PAYLOAD" }], labelStyle),
                    barcodeNode(
                      "shipment-pdf417",
                      "pdf417",
                      0,
                      122,
                      300,
                      64,
                      templateValue([
                        { kind: "text", text: "BOL:" },
                        field("BOL Number", "shipment.bolNumber"),
                        { kind: "text", text: "|PRO:" },
                        field("PRO Number", "shipment.proNumber"),
                        { kind: "text", text: "|PIECES:" },
                        field("Total Pieces", "shipment.totals.pieces", { type: "number" }),
                        { kind: "text", text: "|WEIGHT:" },
                        field("Total Weight", "shipment.totals.weight", { type: "number" })
                      ])
                    ),

                    textNode("shipper-sign-label", 336, 108, 140, 12, [{ kind: "text", text: "SHIPPER SIGNATURE" }], labelStyle),
                    rect("shipper-sign-line", 336, 160, 156, 1, "#111827", "#111827"),
                    textNode("carrier-sign-label", 532, 108, 140, 12, [{ kind: "text", text: "CARRIER SIGNATURE" }], labelStyle),
                    rect("carrier-sign-line", 532, 160, 156, 1, "#111827", "#111827"),
                    textNode("legal-note", 336, 180, 352, 26, [field("Terms", "shipment.terms")], smallStyle)
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  dataSchema: {
    fields: [
      { path: "business.name", label: "Business Name", kind: "string" },
      { path: "business.address", label: "Business Address", kind: "string" },
      { path: "business.phone", label: "Business Phone", kind: "string" },
      { path: "business.email", label: "Business Email", kind: "string" },
      { path: "shipment.bolNumber", label: "BOL Number", kind: "string" },
      { path: "shipment.proNumber", label: "PRO Number", kind: "string" },
      { path: "shipment.poNumber", label: "PO Number", kind: "string" },
      { path: "shipment.pickupDate", label: "Pickup Date", kind: "date" },
      { path: "shipment.serviceLevel", label: "Service Level", kind: "string" },
      { path: "shipment.mode", label: "Mode", kind: "string" },
      { path: "shipment.trackingUrl", label: "Tracking URL", kind: "string" },
      { path: "shipment.shipper", label: "Shipper", kind: "object" },
      { path: "shipment.recipient", label: "Recipient", kind: "object" },
      { path: "shipment.delivery", label: "Delivery", kind: "object" },
      { path: "shipment.handlingUnits", label: "Handling Units", kind: "array" },
      { path: "shipment.totals.pieces", label: "Total Pieces", kind: "number" },
      { path: "shipment.totals.weight", label: "Total Weight", kind: "number" },
      { path: "shipment.instructions", label: "Special Instructions", kind: "string" },
      { path: "shipment.terms", label: "Terms", kind: "string" }
    ]
  }
};

export const shipmentBolSampleData = {
  business: {
    name: "Northstar Freight Co.",
    address: "425 Lakeshore Blvd W\nToronto, ON M5V 1A1",
    phone: "416-555-0188",
    email: "dispatch@northstarfreight.example"
  },
  shipment: {
    bolNumber: "BOL-2026-0718",
    proNumber: "NSF-984421",
    poNumber: "PO-45009312",
    pickupDate: "2026-07-01",
    serviceLevel: "LTL Priority",
    mode: "Dry Van",
    trackingUrl: "https://track.example/NSF-984421",
    shipper: {
      name: "Harbor Foods Ltd.",
      address: "88 Market Street\nToronto, ON M5E 1A9",
      phone: "416-555-0134"
    },
    recipient: {
      name: "Prairie Retail Group",
      address: "2100 Centre Ave SE\nCalgary, AB T2A 2L5",
      phone: "403-555-0177"
    },
    delivery: {
      location: "Calgary DC Dock 14",
      address: "55 Distribution Way\nCalgary, AB T2C 5R9",
      window: "Jul 3, 2026, 08:00-12:00"
    },
    handlingUnits: Array.from({ length: 26 }, (_, index) => ({
      pieces: (index % 3) + 1,
      type: index % 4 === 0 ? "Crate" : "Pallet",
      description: [
        "Temperature controlled packaged foods",
        "Retail display fixtures",
        "Shelf-stable grocery cartons",
        "Wrapped mixed freight"
      ][index % 4],
      weight: 320 + index * 18,
      freightClass: ["70", "85", "92.5", "100"][index % 4],
      nmfc: `NS${1800 + index}`,
      hazmat: index % 11 === 0 ? "Y" : "N"
    })),
    totals: {
      pieces: 53,
      weight: 14170
    },
    instructions: "Call receiving 30 minutes before arrival. Driver must check in with security and retain signed POD.",
    terms:
      "Received subject to individually determined rates or written contracts. Carrier liability follows applicable tariff limits unless declared otherwise."
  }
} satisfies Record<string, unknown>;

export const invoiceTemplate: DocumentTemplate = {
  id: "invoice",
  version: "0.0.1",
  unit: "px",
  metadata: {
    name: "Invoice Template"
  },
  fonts,
  variables: [
    {
      id: "invoiceItemCount",
      name: "Invoice Item Count",
      category: "computed",
      value: { kind: "formula", formula: { op: "count", path: "invoice.items" } }
    },
    {
      id: "invoiceComputedSubtotal",
      name: "Computed Subtotal",
      category: "computed",
      value: { kind: "formula", formula: { op: "sum", path: "invoice.items.total" } }
    }
  ],
  pages: [
    {
      id: "page-1",
      name: "Invoice",
      size: PAGE_PRESETS.letter,
      margin: { top: 48, right: 48, bottom: 48, left: 48 },
      layers: [
        {
          id: "background",
          kind: "background",
          nodes: [
            rect("invoice-page-border", 36, 36, 744, 984, "#ffffff", "#cbd5e1"),
            rect("invoice-header-band", 36, 36, 744, 126, "#f8fafc", "#cbd5e1"),
            rect("invoice-accent-rule", 36, 160, 744, 4, "#4f46e5", "#4f46e5")
          ]
        },
        {
          id: "fixed",
          kind: "fixed",
          nodes: [
            textNode("invoice-business-name", 64, 58, 300, 28, [field("Business Name", "business.name")], {
              fontFamily: "Geist",
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1,
              color: "#0f172a"
            }),
            textNode("invoice-business-address", 64, 92, 316, 34, [field("Business Address", "business.address")], smallStyle),
            textNode(
              "invoice-business-contact",
              64,
              128,
              316,
              14,
              [
                field("Business Phone", "business.phone"),
                { kind: "text", text: "  |  " },
                field("Business Email", "business.email")
              ],
              smallStyle
            ),
            textNode("invoice-title", 508, 58, 244, 34, [{ kind: "text", text: "INVOICE" }], {
              fontFamily: "Geist",
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1,
              color: "#111827",
              align: "right"
            }),
            textNode("invoice-number-label", 510, 104, 86, 12, [{ kind: "text", text: "INVOICE NO." }], labelStyle),
            textNode("invoice-number", 610, 100, 142, 18, [field("Invoice Number", "invoice.number")], {
              ...valueStyle,
              align: "right"
            }),
            barcodeNode("invoice-number-barcode", "code128", 588, 124, 164, 28, bindingValue("invoice.number")),

            rect("bill-to-card", 64, 192, 216, 136, "#ffffff", "#cbd5e1"),
            textNode("bill-to-label", 80, 208, 120, 12, [{ kind: "text", text: "BILL TO" }], labelStyle),
            textNode("customer-name", 80, 230, 184, 16, [field("Customer Name", "customer.name")], bodyStyle),
            textNode("customer-address", 80, 252, 184, 44, [field("Customer Address", "customer.address")], smallStyle),
            textNode("customer-email", 80, 300, 184, 14, [field("Customer Email", "customer.email")], smallStyle),

            rect("ship-to-card", 300, 192, 216, 136, "#ffffff", "#cbd5e1"),
            textNode("ship-to-label", 316, 208, 120, 12, [{ kind: "text", text: "SHIP TO" }], labelStyle),
            textNode("ship-to-name", 316, 230, 184, 16, [field("Ship To Name", "delivery.name")], bodyStyle),
            textNode("ship-to-address", 316, 252, 184, 44, [field("Ship To Address", "delivery.address")], smallStyle),
            textNode("ship-to-window", 316, 300, 184, 14, [field("Delivery Window", "delivery.window")], smallStyle),

            rect("invoice-meta-card", 536, 192, 216, 136, "#ffffff", "#cbd5e1"),
            textNode("invoice-date-label", 552, 210, 74, 12, [{ kind: "text", text: "DATE" }], labelStyle),
            textNode("invoice-date", 640, 208, 88, 14, [field("Invoice Date", "invoice.date", { type: "date", dateStyle: "medium" })], bodyStyle),
            textNode("invoice-due-label", 552, 238, 74, 12, [{ kind: "text", text: "DUE DATE" }], labelStyle),
            textNode("invoice-due", 640, 236, 88, 14, [field("Due Date", "invoice.dueDate", { type: "date", dateStyle: "medium" })], bodyStyle),
            textNode("invoice-terms-label", 552, 266, 74, 12, [{ kind: "text", text: "TERMS" }], labelStyle),
            textNode("invoice-terms", 640, 264, 88, 14, [field("Terms", "invoice.terms")], bodyStyle),
            textNode("invoice-po-label", 552, 294, 74, 12, [{ kind: "text", text: "PO NO." }], labelStyle),
            textNode("invoice-po", 640, 292, 88, 14, [field("PO Number", "invoice.poNumber")], bodyStyle)
          ]
        },
        {
          id: "flow",
          kind: "flow",
          nodes: [
            {
              id: "invoice-body",
              type: "flowRegion",
              frame: { x: 64, y: 364, width: 688, height: 568 },
              flowBoundary: "page-margin",
              children: [
                {
                  id: "invoice-items-header",
                  type: "group",
                  frame: { x: 0, y: 0, width: 688, height: 34 },
                  children: [
                    rect("invoice-items-header-bg", 0, 0, 688, 34, "#eef2ff", "#a5b4fc"),
                    textNode("invoice-header-description", 14, 10, 314, 12, [{ kind: "text", text: "Description" }], labelStyle),
                    textNode("invoice-header-qty", 356, 10, 70, 12, [{ kind: "text", text: "Qty" }], labelStyle),
                    textNode("invoice-header-rate", 456, 10, 86, 12, [{ kind: "text", text: "Unit Price" }], labelStyle),
                    textNode("invoice-header-total", 596, 10, 76, 12, [{ kind: "text", text: "Total" }], {
                      ...labelStyle,
                      align: "right"
                    })
                  ]
                },
                {
                  id: "invoice-items-repeat",
                  type: "repeat",
                  frame: { x: 0, y: 0, width: 688, height: 34 },
                  binding: { path: "invoice.items" },
                  itemAlias: "item",
                  layout: {
                    direction: "vertical",
                    gap: 0,
                    splitItems: false,
                    rowSizing: "compact",
                    minRowHeight: 30,
                    maxCompressionRatio: 0.1,
                    fillAvailableSpace: true,
                    maxExpansionRatio: 0.15
                  },
                  children: [
                    rect("invoice-item-row-bg", 0, 0, 688, 34, "#ffffff", "#e2e8f0"),
                    textNode("invoice-item-description", 14, 10, 314, 12, [field("Description", "item.description")], bodyStyle),
                    textNode("invoice-item-qty", 356, 10, 70, 12, [field("Quantity", "item.quantity", { type: "number" })], bodyStyle),
                    textNode("invoice-item-rate", 456, 10, 86, 12, [field("Unit Price", "item.unitPrice", { type: "currency", currency: "USD" })], bodyStyle),
                    textNode("invoice-item-total", 596, 10, 76, 12, [field("Line Total", "item.total", { type: "currency", currency: "USD" })], {
                      ...bodyStyle,
                      align: "right"
                    })
                  ]
                },
                {
                  id: "invoice-summary",
                  type: "group",
                  frame: { x: 0, y: 24, width: 688, height: 250 },
                  children: [
                    rect("invoice-notes-box", 0, 0, 390, 92, "#f8fafc", "#cbd5e1"),
                    textNode("invoice-notes-label", 14, 14, 160, 12, [{ kind: "text", text: "NOTES" }], labelStyle),
                    textNode("invoice-notes", 14, 36, 352, 36, [field("Notes", "invoice.notes")], smallStyle),

                    rect("invoice-totals-box", 430, 0, 258, 132, "#ffffff", "#cbd5e1"),
                    textNode("invoice-subtotal-label", 448, 18, 110, 12, [{ kind: "text", text: "Subtotal" }], bodyStyle),
                    textNode("invoice-subtotal", 586, 16, 78, 16, [field("Subtotal", "invoice.totals.subtotal", { type: "currency", currency: "USD" })], {
                      ...bodyStyle,
                      align: "right"
                    }),
                    textNode("invoice-tax-label", 448, 48, 110, 12, [{ kind: "text", text: "Tax" }], bodyStyle),
                    textNode("invoice-tax", 586, 46, 78, 16, [field("Tax", "invoice.totals.tax", { type: "currency", currency: "USD" })], {
                      ...bodyStyle,
                      align: "right"
                    }),
                    textNode("invoice-balance-label", 448, 88, 110, 14, [{ kind: "text", text: "Balance Due" }], {
                      ...valueStyle,
                      fontSize: 12
                    }),
                    textNode("invoice-balance", 574, 84, 90, 18, [field("Balance Due", "invoice.totals.total", { type: "currency", currency: "USD" })], {
                      ...valueStyle,
                      fontSize: 14,
                      align: "right"
                    }),

                    textNode("payment-label", 0, 128, 188, 12, [{ kind: "text", text: "PAYMENT LINK" }], labelStyle),
                    qrNode("payment-qr", 0, 148, 64, bindingValue("invoice.paymentUrl")),
                    textNode("payment-url", 82, 154, 284, 28, [field("Payment URL", "invoice.paymentUrl")], smallStyle),
                    textNode("thank-you", 0, 224, 688, 18, [{ kind: "text", text: "Thank you for your business." }], {
                      ...bodyStyle,
                      align: "center"
                    })
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  dataSchema: {
    fields: [
      { path: "business.name", label: "Business Name", kind: "string" },
      { path: "business.address", label: "Business Address", kind: "string" },
      { path: "business.phone", label: "Business Phone", kind: "string" },
      { path: "business.email", label: "Business Email", kind: "string" },
      { path: "customer.name", label: "Customer Name", kind: "string" },
      { path: "customer.address", label: "Customer Address", kind: "string" },
      { path: "customer.email", label: "Customer Email", kind: "string" },
      { path: "delivery.name", label: "Delivery Name", kind: "string" },
      { path: "delivery.address", label: "Delivery Address", kind: "string" },
      { path: "delivery.window", label: "Delivery Window", kind: "string" },
      { path: "invoice.number", label: "Invoice Number", kind: "string" },
      { path: "invoice.date", label: "Invoice Date", kind: "date" },
      { path: "invoice.dueDate", label: "Due Date", kind: "date" },
      { path: "invoice.terms", label: "Terms", kind: "string" },
      { path: "invoice.poNumber", label: "PO Number", kind: "string" },
      { path: "invoice.items", label: "Invoice Items", kind: "array" },
      { path: "invoice.totals.subtotal", label: "Subtotal", kind: "number" },
      { path: "invoice.totals.tax", label: "Tax", kind: "number" },
      { path: "invoice.totals.total", label: "Balance Due", kind: "number" },
      { path: "invoice.notes", label: "Notes", kind: "string" },
      { path: "invoice.paymentUrl", label: "Payment URL", kind: "string" }
    ]
  }
};

export const invoiceSampleData = {
  business: {
    name: "Acme Logistics",
    address: "123 Industrial Way\nToronto, ON M5V 2T6",
    phone: "416-555-0123",
    email: "billing@acmelogistics.example"
  },
  customer: {
    name: "Prairie Retail Group",
    address: "2100 Centre Ave SE\nCalgary, AB T2A 2L5",
    email: "ap@prairieretail.example"
  },
  delivery: {
    name: "Prairie Retail Group DC",
    address: "55 Distribution Way\nCalgary, AB T2C 5R9",
    window: "Jul 3, 2026, 08:00-12:00"
  },
  invoice: {
    number: "INV-2026-1048",
    date: "2026-07-01",
    dueDate: "2026-07-31",
    terms: "Net 30",
    poNumber: "PO-45009312",
    items: [
      { description: "Freight service - Toronto to Calgary", quantity: 1, unitPrice: 1850, total: 1850 },
      { description: "Fuel surcharge", quantity: 1, unitPrice: 265.5, total: 265.5 },
      { description: "Residential delivery appointment", quantity: 1, unitPrice: 95, total: 95 },
      { description: "Additional handling units", quantity: 4, unitPrice: 42, total: 168 },
      { description: "Proof of delivery documentation", quantity: 1, unitPrice: 35, total: 35 }
    ],
    totals: {
      subtotal: 2413.5,
      tax: 313.76,
      total: 2727.26
    },
    notes: "Please include the invoice number with remittance. Late payments may be subject to service charges.",
    paymentUrl: "https://pay.example/invoices/INV-2026-1048"
  }
} satisfies Record<string, unknown>;
