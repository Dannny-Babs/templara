import type { DocumentTemplate } from "@templara/core";
import { PAGE_PRESETS } from "@templara/core";
import { describe, expect, it } from "vitest";
import { renderTemplateToHtml } from "./ssr.js";

function simpleTemplate(): DocumentTemplate {
  return {
    id: "ssr-smoke",
    version: "0.0.1",
    unit: "px",
    pages: [
      {
        id: "page-1",
        size: PAGE_PRESETS.letter,
        layers: [
          {
            id: "fixed",
            kind: "fixed",
            nodes: [
              {
                id: "hello",
                type: "text",
                frame: { x: 40, y: 40, width: 400, height: 40 },
                content: [
                  {
                    kind: "field",
                    label: "Title",
                    binding: { path: "doc.title" },
                  },
                ],
                style: { fontFamily: "Geist", fontSize: 14 },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("renderTemplateToHtml", () => {
  it("serializes DocumentPreview-equivalent HTML for a simple template", () => {
    const html = renderTemplateToHtml(simpleTemplate(), { doc: { title: "Wave2 SSR Smoke" } });

    expect(html).toContain('data-templara-document="true"');
    expect(html).toContain('data-templara-page-id="page-1"');
    expect(html).toContain("Wave2 SSR Smoke");
  });
});
