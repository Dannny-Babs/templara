import { createElement, useEffect, useMemo } from "react";
import type { CSSProperties, PointerEvent, ReactElement } from "react";
import bwipjs from "bwip-js/browser";
import type { RenderDebugBox, RenderDocumentResult, RenderGeneratedNode, RenderNode, RenderPage } from "@templara/renderer";

const MAX_GENERATED_CODE_TEXT_LENGTH = 2048;
const BWIP_SYMBOL_IDS = new Set(bwipjs.symbolList.map((symbol) => symbol.bcid));

export interface DocumentPreviewProps {
  document: RenderDocumentResult;
  scale?: number;
  className?: string;
  showDebug?: boolean;
  selectedSourceNodeId?: string;
  onNodePointerDown?: (event: PointerEvent<HTMLElement>, node: RenderNode) => void;
  onPagePointerDown?: (event: PointerEvent<HTMLElement>, page: RenderPage) => void;
}

export function DocumentPreview({
  document,
  scale = 1,
  className,
  showDebug = false,
  selectedSourceNodeId,
  onNodePointerDown,
  onPagePointerDown
}: DocumentPreviewProps): ReactElement {
  const fontImports = buildFontImports(document);

  useEffect(() => {
    if (!fontImports || typeof window === "undefined") {
      return;
    }

    const styleId = "templara-render-fonts";
    let styleElement = window.document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = window.document.createElement("style");
      styleElement.id = styleId;
      window.document.head.appendChild(styleElement);
    }

    styleElement.textContent = fontImports;
  }, [fontImports]);

  // In-tree <style> so SSR (renderToStaticMarkup) includes font @imports;
  // useEffect still mirrors into document.head for client preview.
  const fontStyle =
    fontImports.length > 0
      ? createElement("style", {
          "data-templara-fonts": "true",
          dangerouslySetInnerHTML: { __html: fontImports }
        })
      : null;

  return createElement(
    "div",
    {
      className,
      "data-templara-document": "true",
      style: {
        display: "grid",
        gap: 24,
        justifyContent: "center"
      }
    },
    fontStyle,
    document.pages.map((page) =>
      createElement(RenderPageView, {
        key: page.id,
        page,
        scale,
        showDebug,
        selectedSourceNodeId,
        onNodePointerDown,
        onPagePointerDown
      })
    )
  );
}

function RenderPageView({
  page,
  scale,
  showDebug,
  selectedSourceNodeId,
  onNodePointerDown,
  onPagePointerDown
}: {
  page: RenderPage;
  scale: number;
  showDebug: boolean;
  selectedSourceNodeId?: string;
  onNodePointerDown?: (event: PointerEvent<HTMLElement>, node: RenderNode) => void;
  onPagePointerDown?: (event: PointerEvent<HTMLElement>, page: RenderPage) => void;
}): ReactElement {
  return createElement(
    "div",
    {
      "data-templara-page-id": page.id,
      style: {
        position: "relative",
        width: page.width,
        height: page.height,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        background: "white",
        border: "1px solid #d8dee8",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        overflow: "hidden"
      },
      onPointerDown: onPagePointerDown ? (event: PointerEvent<HTMLElement>) => onPagePointerDown(event, page) : undefined
    },
    [
      ...page.children.map((node) =>
        createElement(RenderNodeView, {
          key: node.id,
          node,
          selected: node.sourceNodeId === selectedSourceNodeId,
          onPointerDown: onNodePointerDown
        })
      ),
      showDebug ? createElement(DebugOverlay, { key: "debug", boxes: page.debugBoxes }) : null
    ]
  );
}

function RenderNodeView({
  node,
  selected,
  onPointerDown
}: {
  node: RenderNode;
  selected: boolean;
  onPointerDown?: (event: PointerEvent<HTMLElement>, node: RenderNode) => void;
}): ReactElement | null {
  const baseStyle: CSSProperties = {
    position: "absolute",
    left: node.frame.x,
    top: node.frame.y,
    width: node.frame.width,
    height: node.frame.height,
    opacity: node.opacity,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    transformOrigin: "center",
    outline: selected ? "2px solid #2563eb" : undefined,
    outlineOffset: selected ? 2 : undefined,
    cursor: onPointerDown ? "move" : undefined,
    userSelect: onPointerDown ? "none" : undefined
  };
  const pointerProps = onPointerDown
    ? {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
          event.stopPropagation();
          onPointerDown(event, node);
        }
      }
    : {};
  const nodeProps = {
    ...pointerProps,
    "data-templara-node-id": node.id,
    "data-templara-source-node-id": node.sourceNodeId,
    "data-templara-node-type": node.type,
    "data-templara-selected": selected ? "true" : undefined
  };

  if (node.type === "text") {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeight,
        color: node.style.color,
        textAlign: node.style.align,
        letterSpacing: node.style.letterSpacing,
        whiteSpace: "pre-wrap"
      },
      children: node.text
    });
  }

  if (node.type === "image") {
    if (!node.src && node.placeholder) {
      return createElement("div", {
        ...nodeProps,
        style: {
          ...baseStyle,
          display: "grid",
          placeItems: "center",
          border: "1px dashed #94a3b8",
          background: "#f8fafc",
          color: "#475569",
          font: "11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
          textAlign: "center",
          padding: 6
        },
        children: node.placeholder
      });
    }

    return createElement("img", {
      ...nodeProps,
      src: node.src,
      alt: node.alt ?? "",
      style: {
        ...baseStyle,
        objectFit: node.fit ?? "contain"
      }
    });
  }

  if (node.type === "shape") {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        background: node.fill,
        border: node.stroke ? `${node.strokeWidth ?? 1}px solid ${node.stroke}` : undefined,
        borderRadius: node.shape === "ellipse" ? "999px" : node.radius
      }
    });
  }

  if (node.type === "barcode" || node.type === "qr") {
    return createElement(GeneratedCodeView, { node, baseStyle, nodeProps });
  }

  return createElement("div", {
    ...nodeProps,
    style: {
      ...baseStyle,
      display: "grid",
      placeItems: "center",
      border: "1px solid #cbd5e1",
      color: "#475569",
      font: "12px sans-serif"
    },
    children: `${node.type}: ${node.value}`
  });
}

function GeneratedCodeView({
  node,
  baseStyle,
  nodeProps
}: {
  node: RenderGeneratedNode;
  baseStyle: CSSProperties;
  nodeProps: Record<string, unknown>;
}): ReactElement {
  const generated = useMemo(() => generateCodeSvgDataUrl(node), [node.format, node.type, node.value]);

  if (node.placeholder) {
    return createElement("div", {
      ...nodeProps,
      style: {
        ...baseStyle,
        display: "grid",
        placeItems: "center",
        border: "1px dashed #94a3b8",
        background: "#f8fafc",
        color: "#475569",
        font: "10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
        textAlign: "center",
        padding: 4
      },
      children: node.placeholder
    });
  }

  if (!generated.ok) {
    return createElement("div", {
      ...nodeProps,
      title: generated.error,
      style: {
        ...baseStyle,
        display: "grid",
        placeItems: "center",
        border: "1px solid #fca5a5",
        background: "#fef2f2",
        color: "#991b1b",
        font: "10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
        textAlign: "center",
        padding: 4
      },
      children: generated.label
    });
  }

  return createElement("img", {
    ...nodeProps,
    src: generated.src,
    alt: generated.alt,
    style: {
      ...baseStyle,
      objectFit: "contain"
    }
  });
}

function DebugOverlay({ boxes }: { boxes: RenderDebugBox[] }): ReactElement {
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1000
      }
    },
    boxes.map((box) => createElement(DebugBoxView, { key: box.id, box }))
  );
}

function DebugBoxView({ box }: { box: RenderDebugBox }): ReactElement {
  return createElement(
    "div",
    {
      title: `${box.kind}: ${box.label}`,
      style: {
        position: "absolute",
        left: box.frame.x,
        top: box.frame.y,
        width: box.frame.width,
        height: box.frame.height,
        border: `1px dashed ${box.color}`,
        background: withAlpha(box.color, 0.06)
      }
    },
    createElement("span", {
      style: {
        position: "absolute",
        left: 3,
        top: -17,
        padding: "1px 4px",
        borderRadius: 3,
        background: box.color,
        color: "white",
        font: "10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "nowrap"
      },
      children: box.label
    })
  );
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildFontImports(document: RenderDocumentResult): string {
  const cssUrls = new Set(document.fonts.map((font) => font.cssUrl).filter((url): url is string => Boolean(url)));

  return [...cssUrls].map((url) => `@import url("${url.replace(/"/g, '\\"')}");`).join("\n");
}

type GeneratedCodeResult =
  | { ok: true; src: string; alt: string }
  | { ok: false; label: string; error: string };

function generateCodeSvgDataUrl(node: RenderGeneratedNode): GeneratedCodeResult {
  const text = sanitizeCodeText(node.value);
  const bcid = node.type === "qr" ? "qrcode" : normalizeBcid(node.format ?? "code128");

  if (!BWIP_SYMBOL_IDS.has(bcid)) {
    return {
      ok: false,
      label: `Unsupported ${bcid}`,
      error: `Unsupported bwip-js barcode format: ${bcid}`
    };
  }

  try {
    const options: Parameters<typeof bwipjs.toSVG>[0] = {
      bcid,
      text,
      scale: 2,
      includetext: shouldIncludeHumanReadableText(bcid),
      textxalign: "center",
      textsize: 9,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
      barcolor: "111827",
      textcolor: "111827"
    };

    if (!isTwoDimensionalCode(bcid)) {
      options.height = 12;
    }

    const svg = bwipjs.toSVG(options);

    return {
      ok: true,
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      alt: `${bcid} code for ${text}`
    };
  } catch (error) {
    return {
      ok: false,
      label: `${bcid} failed`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function sanitizeCodeText(value: string): string {
  const text = value.trim();
  return (text.length > 0 ? text : "MISSING").slice(0, MAX_GENERATED_CODE_TEXT_LENGTH);
}

function normalizeBcid(format: string): string {
  const normalized = format.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (normalized === "upc") {
    return "upca";
  }

  return normalized;
}

function isTwoDimensionalCode(bcid: string): boolean {
  return (
    bcid.includes("qrcode") ||
    bcid.includes("pdf417") ||
    bcid.includes("datamatrix") ||
    bcid.includes("aztec") ||
    bcid.includes("maxicode")
  );
}

function shouldIncludeHumanReadableText(bcid: string): boolean {
  return !isTwoDimensionalCode(bcid);
}
