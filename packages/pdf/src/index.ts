import type { DocumentTemplate } from "@templara/core";

export interface ExportPdfInput {
  template: DocumentTemplate;
  data?: Record<string, unknown>;
}

export interface ExportPdfResult {
  status: "queued";
  strategy: "browser-print";
}

export function exportPdf(_input: ExportPdfInput): ExportPdfResult {
  return {
    status: "queued",
    strategy: "browser-print"
  };
}
