import { validateTemplate } from "@templara/core";
import type { DocumentTemplate } from "@templara/core";
import { collectExportDiagnostics } from "@templara/pdf";
import type { RenderDocumentResult } from "@templara/renderer";

export type EditorDiagnosticSeverity = "blocking" | "warning" | "info";
export type EditorDiagnosticSource = "validation" | "renderer" | "export";

export interface EditorDiagnostic {
  code: string;
  severity: EditorDiagnosticSeverity;
  source: EditorDiagnosticSource;
  message: string;
  nodeId?: string;
  pageId?: string;
  path?: string;
}

export interface EditorDiagnosticsSummary {
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  diagnostics: EditorDiagnostic[];
}

const severityRank: Record<EditorDiagnosticSeverity, number> = {
  blocking: 3,
  warning: 2,
  info: 1,
};

export function buildEditorDiagnostics(
  template: DocumentTemplate,
  renderResult: RenderDocumentResult,
): EditorDiagnosticsSummary {
  const validation = validateTemplate(template);
  const exportPreflight = collectExportDiagnostics(renderResult);
  const diagnostics = dedupeDiagnostics([
    ...validation.issues.map((issue): EditorDiagnostic => ({
      code: issue.code,
      severity: issue.severity === "error" ? "blocking" : "warning",
      source: "validation",
      message: issue.message,
      nodeId: issue.nodeId,
      path: issue.path,
    })),
    ...renderResult.warnings.map((warning): EditorDiagnostic => ({
      code: warning.code,
      severity: "warning",
      source: "renderer",
      message: warning.message,
      nodeId: warning.nodeId,
      pageId: warning.pageId,
    })),
    ...exportPreflight.diagnostics.map((diagnostic): EditorDiagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity === "error" ? "blocking" : diagnostic.severity,
      source: "export",
      message: diagnostic.message,
      nodeId: diagnostic.nodeId,
      pageId: diagnostic.pageId,
    })),
  ]);

  return {
    blockingCount: diagnostics.filter((diagnostic) => diagnostic.severity === "blocking").length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    infoCount: diagnostics.filter((diagnostic) => diagnostic.severity === "info").length,
    diagnostics,
  };
}

function dedupeDiagnostics(diagnostics: EditorDiagnostic[]): EditorDiagnostic[] {
  const byKey = new Map<string, EditorDiagnostic>();

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.nodeId ?? ""}:${diagnostic.pageId ?? ""}:${diagnostic.path ?? ""}:${diagnostic.message}`;
    const current = byKey.get(key);

    if (!current || severityRank[diagnostic.severity] >= severityRank[current.severity]) {
      byKey.set(key, diagnostic);
    }
  }

  return [...byKey.values()].sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.code.localeCompare(b.code));
}
