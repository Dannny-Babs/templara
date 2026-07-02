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
    style
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

export const invoiceTemplate = shipmentBolTemplate;
