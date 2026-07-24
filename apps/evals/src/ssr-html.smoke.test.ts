import { PAGE_PRESETS, type DocumentTemplate } from "@templara/core";
import { renderTemplateToHtml } from "@templara/react-renderer/ssr";
import { describe, expect, it } from "vitest";

function smokeTemplate(): DocumentTemplate {
  return {
    id: "evals-ssr-smoke",
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
                id: "greeting",
                type: "text",
                frame: { x: 48, y: 48, width: 480, height: 32 },
                content: [
                  { kind: "text", text: "Hello " },
                  {
                    kind: "field",
                    label: "Name",
                    binding: { path: "customer.name" },
                  },
                ],
                style: { fontFamily: "Geist", fontSize: 16 },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("SSR HTML smoke (B1)", () => {
  it("renders a simple template to HTML via @templara/react-renderer/ssr", () => {
    const html = renderTemplateToHtml(smokeTemplate(), {
      customer: { name: "Templara Wave 2" },
    });

    expect(html).toContain("Hello Templara Wave 2");
    expect(html).toContain('data-templara-page-id="page-1"');
  });
});
