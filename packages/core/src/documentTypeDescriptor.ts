/**
 * Host-facing contract shape for registering a Templara document type in
 * Rose Rocket's `RDocumentTypeConfig` (keyed by `objectKey`). This is a
 * descriptor only — no registry runtime lives in `@templara/*`.
 *
 * See docs/orchestration/tickets/D1-doc-type-registry.md and
 * docs/orchestration/host-runbook.md.
 */
export type TemplaraDocumentRenderMode = "ssr-html" | "client-preview";

export interface TemplaraDocumentTypeDescriptor {
  /** Host object key, e.g. `invoice`, `order`, `shipment`. */
  objectKey: string;
  /** Human label shown in document-process UI. */
  label: string;
  /** Stable Templara template id (or host template record id). */
  templateId: string;
  /**
   * How the host should produce print HTML.
   * Wave 2+: prefer `ssr-html` via `@templara/react-renderer/ssr`.
   */
  renderMode: TemplaraDocumentRenderMode;
  /** Optional notes for host engineers (auth, PDF options, etc.). */
  notes?: string;
}

export function isTemplaraDocumentTypeDescriptor(
  value: unknown,
): value is TemplaraDocumentTypeDescriptor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.objectKey === "string" &&
    candidate.objectKey.length > 0 &&
    typeof candidate.label === "string" &&
    candidate.label.length > 0 &&
    typeof candidate.templateId === "string" &&
    candidate.templateId.length > 0 &&
    (candidate.renderMode === "ssr-html" || candidate.renderMode === "client-preview")
  );
}
