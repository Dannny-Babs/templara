/**
 * Node-safe SSR-to-HTML entry for A′-lite (POST HTML → host generate-document).
 *
 * Uses the same DocumentPreview paint path as the browser. Import from
 * `@templara/react-renderer/ssr` so client bundles do not pull `react-dom/server`.
 *
 * Spike notes (B0):
 * - Prefer `renderToStaticMarkup` for print HTML (no React checksum attrs / no hydration).
 * - Streaming APIs are unnecessary for a full-string print POST.
 * - `bwip-js/browser` resolves and runs `toSVG` under Node (verified); barcodes OK for SSR.
 * - Fonts: DocumentPreview emits in-tree `<style>` with @import (useEffect alone is SSR-noop).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentTemplate } from "@templara/core";
import { renderDocument, type RenderMode } from "@templara/renderer";
import { DocumentPreview } from "./index.js";

export interface RenderTemplateToHtmlOptions {
  scale?: number;
  showDebug?: boolean;
  /** Renderer mode; defaults to preview. */
  mode?: RenderMode;
}

/**
 * Serialize a template + data to an HTML string equivalent to DocumentPreview.
 */
export function renderTemplateToHtml(
  template: DocumentTemplate,
  data: unknown,
  options: RenderTemplateToHtmlOptions = {},
): string {
  const document = renderDocument({
    template,
    data: (data ?? {}) as Record<string, unknown>,
    mode: options.mode ?? "preview",
  });

  const element = createElement(DocumentPreview, {
    document,
    scale: options.scale ?? 1,
    showDebug: options.showDebug ?? false,
  });

  return renderToStaticMarkup(element);
}
