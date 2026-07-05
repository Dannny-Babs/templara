import type {
  RenderDocumentResult,
  RenderNode,
  RenderPage,
} from "@templara/renderer";

export type ExportDiagnosticSeverity = "error" | "warning" | "info";

export interface ExportDiagnostic {
  code: string;
  severity: ExportDiagnosticSeverity;
  message: string;
  nodeId?: string;
  pageId?: string;
}

export interface ExportPreflight {
  /** True when there are no blocking (error) diagnostics and at least one page. */
  ok: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  pageCount: number;
  diagnostics: ExportDiagnostic[];
}

/**
 * Renderer warning codes that make an export unreliable rather than merely
 * imperfect. These are surfaced as blocking errors in the export preflight.
 */
const BLOCKING_WARNING_CODES = new Set<string>([
  "layout.unbreakable_overflow",
  "variable.cycle",
  "flow.unsupported_root",
]);

/**
 * Inspects a rendered document and produces the export readiness report shown
 * before download. Pure and side-effect free so it can run in tests and in the
 * preview panel without touching the DOM.
 */
export function collectExportDiagnostics(
  document: RenderDocumentResult,
): ExportPreflight {
  const diagnostics: ExportDiagnostic[] = [];

  if (document.pages.length === 0) {
    diagnostics.push({
      code: "export.empty_document",
      severity: "error",
      message: "The document has no pages to export.",
    });
  }

  for (const warning of document.warnings) {
    diagnostics.push({
      code: warning.code,
      severity: BLOCKING_WARNING_CODES.has(warning.code)
        ? "error"
        : "warning",
      message: warning.message,
      nodeId: warning.nodeId,
      pageId: warning.pageId,
    });
  }

  for (const page of document.pages) {
    for (const node of page.children) {
      const unresolved = describeUnresolvedNode(node);

      if (unresolved) {
        diagnostics.push({
          code: unresolved.code,
          severity: "warning",
          message: unresolved.message,
          nodeId: node.sourceNodeId,
          pageId: page.id,
        });
      }
    }
  }

  const errorCount = countSeverity(diagnostics, "error");
  const warningCount = countSeverity(diagnostics, "warning");
  const infoCount = countSeverity(diagnostics, "info");

  return {
    ok: errorCount === 0 && document.pages.length > 0,
    errorCount,
    warningCount,
    infoCount,
    pageCount: document.pages.length,
    diagnostics,
  };
}

function describeUnresolvedNode(
  node: RenderNode,
): { code: string; message: string } | null {
  if ((node.type === "barcode" || node.type === "qr") && node.placeholder) {
    return {
      code: "export.unresolved_code",
      message: `${node.type === "qr" ? "QR code" : "Barcode"} "${node.sourceNodeId}" has no resolved value and will export a placeholder.`,
    };
  }

  if (node.type === "image" && node.placeholder && !node.src) {
    return {
      code: "export.unresolved_image",
      message: `Image "${node.sourceNodeId}" has no resolved source and will export a placeholder.`,
    };
  }

  return null;
}

function countSeverity(
  diagnostics: ExportDiagnostic[],
  severity: ExportDiagnosticSeverity,
): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity)
    .length;
}

/**
 * Builds `@import` font declarations for an isolated export surface from the
 * fonts a rendered document declares.
 */
export function buildExportFontCss(document: RenderDocumentResult): string {
  const cssUrls = new Set(
    document.fonts
      .map((font) => font.cssUrl)
      .filter((url): url is string => Boolean(url)),
  );

  return [...cssUrls]
    .map((url) => `@import url("${url.replace(/"/g, '\\"')}");`)
    .join("\n");
}

export interface PageSize {
  width: number;
  height: number;
}

export interface BrowserPdfExportOptions {
  title?: string;
  fontCss?: string;
  /** Milliseconds to wait for images/fonts before printing anyway. */
  assetTimeoutMs?: number;
}

export interface BrowserPdfExportResult {
  status: "printed" | "blocked" | "unsupported";
  message?: string;
}

const DEFAULT_ASSET_TIMEOUT_MS = 4000;

/**
 * Browser-first PDF export. Clones the already-rendered preview page elements
 * into an isolated print surface with exact `@page` sizing, waits for images
 * and fonts, then invokes the browser print/save-to-PDF workflow. This keeps
 * the export visually identical to the on-screen preview.
 */
export async function exportPreviewToPdf(
  pageElements: HTMLElement[],
  pageSizes: PageSize[],
  options: BrowserPdfExportOptions = {},
): Promise<BrowserPdfExportResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      status: "unsupported",
      message: "PDF export requires a browser environment.",
    };
  }

  if (pageElements.length === 0) {
    return { status: "blocked", message: "There are no rendered pages to export." };
  }

  const primarySize = pageSizes[0] ?? measureElementSize(pageElements[0]);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return {
      status: "unsupported",
      message: "Could not open an isolated export surface.",
    };
  }

  frameDocument.open();
  frameDocument.write(
    buildExportShell(primarySize, options.title, options.fontCss),
  );
  frameDocument.close();

  const body = frameDocument.body;

  pageElements.forEach((element, index) => {
    const size = pageSizes[index] ?? primarySize;
    const pageWrap = frameDocument.createElement("div");
    pageWrap.className = "templara-export-page";
    pageWrap.style.width = `${size.width}px`;
    pageWrap.style.height = `${size.height}px`;

    const clone = element.cloneNode(true) as HTMLElement;
    // The on-screen preview scales pages down; the export must render at 1:1.
    clone.style.transform = "none";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    clone.style.border = "none";
    pageWrap.appendChild(clone);
    body.appendChild(pageWrap);
  });

  await waitForAssets(
    frameWindow,
    options.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS,
  );

  // Give the browser a frame to finish layout before printing; printing too
  // eagerly can produce a blank sheet in some engines.
  await nextFrame(frameWindow);

  try {
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    iframe.remove();
    return printViaNewWindow(pageElements, pageSizes, primarySize, options, {
      status: "blocked",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const cleanup = (): void => {
    iframe.remove();
  };

  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  // Fallback cleanup in case afterprint never fires (some browsers).
  window.setTimeout(cleanup, 60000);

  return { status: "printed" };
}

function nextFrame(frameWindow: Window): Promise<void> {
  return new Promise((resolve) => {
    const raf =
      frameWindow.requestAnimationFrame ?? window.requestAnimationFrame;
    if (typeof raf === "function") {
      raf(() => resolve());
    } else {
      window.setTimeout(resolve, 32);
    }
  });
}

/**
 * Fallback used when the isolated iframe surface refuses to print (some
 * browsers block `iframe.contentWindow.print()`). Opens a real window with the
 * same page markup so the user still reaches a Save-as-PDF dialog.
 */
function printViaNewWindow(
  pageElements: HTMLElement[],
  pageSizes: PageSize[],
  primarySize: PageSize,
  options: BrowserPdfExportOptions,
  onBlocked: BrowserPdfExportResult,
): BrowserPdfExportResult {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    return {
      status: "blocked",
      message:
        onBlocked.message ??
        "Couldn't open the export surface. Allow pop-ups, or use your browser's Print (Cmd/Ctrl+P) on the preview.",
    };
  }

  const pagesHtml = pageElements
    .map((element, index) => {
      const size = pageSizes[index] ?? primarySize;
      return `<div class="templara-export-page" style="width:${size.width}px;height:${size.height}px">${element.outerHTML}</div>`;
    })
    .join("");

  printWindow.document.open();
  printWindow.document.write(
    buildExportShell(primarySize, options.title, options.fontCss).replace(
      "</body></html>",
      `${pagesHtml}</body></html>`,
    ),
  );
  printWindow.document.close();
  printWindow.focus();

  const triggerPrint = (): void => {
    try {
      printWindow.print();
    } catch {
      // If printing still fails the user can print manually from the window.
    }
  };

  printWindow.addEventListener("load", triggerPrint, { once: true });
  printWindow.setTimeout(triggerPrint, 600);

  return { status: "printed" };
}

function buildExportShell(
  pageSize: PageSize,
  title?: string,
  fontCss?: string,
): string {
  const safeTitle = escapeHtml(title ?? "Templara Export");

  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8" />',
    `<title>${safeTitle}</title>`,
    "<style>",
    fontCss ?? "",
    `@page { size: ${pageSize.width}px ${pageSize.height}px; margin: 0; }`,
    "html, body { margin: 0; padding: 0; background: #ffffff; }",
    ".templara-export-page { position: relative; overflow: hidden; page-break-after: always; background: #ffffff; }",
    ".templara-export-page:last-child { page-break-after: auto; }",
    // The on-screen preview scales pages down; the export must render at 1:1.
    ".templara-export-page > * { transform: none !important; margin: 0 !important; box-shadow: none !important; border: none !important; }",
    "</style></head><body></body></html>",
  ].join("");
}

function measureElementSize(element: HTMLElement): PageSize {
  return {
    width: element.offsetWidth || 816,
    height: element.offsetHeight || 1056,
  };
}

async function waitForAssets(
  frameWindow: Window,
  timeoutMs: number,
): Promise<void> {
  const frameDocument = frameWindow.document;
  const images = Array.from(frameDocument.images);
  const imagePromises = images.map((image) =>
    image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
  );

  const fontsReady: Promise<unknown> =
    "fonts" in frameDocument &&
    frameDocument.fonts &&
    typeof frameDocument.fonts.ready?.then === "function"
      ? frameDocument.fonts.ready
      : Promise.resolve();

  const assetsReady = Promise.all([...imagePromises, fontsReady]).then(
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => {
    frameWindow.setTimeout(resolve, timeoutMs);
  });

  await Promise.race([assetsReady, timeout]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates a filesystem-safe export filename from a document title.
 */
export function buildExportFileName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "document"}.pdf`;
}
