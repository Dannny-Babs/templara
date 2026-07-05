import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DocumentEditor } from "@templara/editor";
import type { DocumentTemplate } from "@templara/core";
import {
  invoiceSampleData,
  invoiceTemplate,
  payStubSampleData,
  payStubTemplate,
  receiptSampleData,
  receiptTemplate,
  shipmentBolSampleData,
  shipmentBolTemplate,
  shippingLabelSampleData,
  shippingLabelTemplate,
} from "@templara/templates";

interface TemplateChoice {
  id: string;
  label: string;
  template: DocumentTemplate;
  data: Record<string, unknown>;
}

const CHOICES: TemplateChoice[] = [
  { id: "invoice", label: "Invoice", template: invoiceTemplate, data: invoiceSampleData },
  { id: "shipment-bol", label: "Shipment BOL", template: shipmentBolTemplate, data: shipmentBolSampleData },
  { id: "receipt", label: "Receipt", template: receiptTemplate, data: receiptSampleData },
  { id: "pay-stub", label: "Pay Stub", template: payStubTemplate, data: payStubSampleData },
  { id: "shipping-label", label: "Shipping Label", template: shippingLabelTemplate, data: shippingLabelSampleData },
];

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 30,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  font: "400 13px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const triggerLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const chevronStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRight: "1.5px solid #94a3b8",
  borderBottom: "1.5px solid #94a3b8",
  transform: "rotate(45deg)",
  marginTop: -3,
  marginLeft: 2,
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 200,
  padding: 6,
  borderRadius: 10,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

function optionStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 7,
    border: "none",
    background: active ? "#f1f5f9" : "transparent",
    color: active ? "#0f172a" : "#334155",
    font: "400 13px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
  };
}

function TemplatePicker({
  choice,
  onSelect,
}: {
  choice: TemplateChoice;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent): void {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" style={triggerStyle} onClick={() => setOpen((value) => !value)}>
        <span style={triggerLabelStyle}>Template</span>
        <span>{choice.label}</span>
        <span style={chevronStyle} aria-hidden />
      </button>
      {open ? (
        <div style={menuStyle} role="menu">
          {CHOICES.map((entry) => {
            const active = entry.id === choice.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                style={optionStyle(active)}
                onClick={() => {
                  onSelect(entry.id);
                  setOpen(false);
                }}
              >
                <span>{entry.label}</span>
                {active ? <span style={{ color: "#4f46e5" }}>✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function App() {
  const [choiceId, setChoiceId] = useState<string>(CHOICES[0].id);
  const choice = CHOICES.find((entry) => entry.id === choiceId) ?? CHOICES[0];

  return (
    <DocumentEditor
      key={choice.id}
      value={choice.template}
      data={choice.data}
      toolbarAccessory={<TemplatePicker choice={choice} onSelect={setChoiceId} />}
    />
  );
}
