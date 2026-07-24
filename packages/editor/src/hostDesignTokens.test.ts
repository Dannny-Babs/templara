import { describe, expect, it } from "vitest";
import { initialInspectorUiState, resolvePageInspectorDraft } from "./inspector/index.js";
import {
  DEFAULT_WORKSPACE_AIDS,
  TEMPLARA_TOKEN_VARS,
  chromeBackground,
  chromeFontFamily,
  hostDesignTokensToCssVars,
  shouldShowTemplaraBrand,
} from "./hostDesignTokens.js";

describe("DEFAULT_WORKSPACE_AIDS", () => {
  it("defaults visual canvas chrome off and keeps snap on", () => {
    expect(DEFAULT_WORKSPACE_AIDS.showGrid).toBe(false);
    expect(DEFAULT_WORKSPACE_AIDS.showRulers).toBe(false);
    expect(DEFAULT_WORKSPACE_AIDS.snapToGrid).toBe(true);
    expect(DEFAULT_WORKSPACE_AIDS.snapToGuides).toBe(true);
  });
});

describe("resolvePageInspectorDraft layout aids", () => {
  it("defaults bleed, margins, printable area, safe area, shadow, and crop marks off", () => {
    const draft = resolvePageInspectorDraft(initialInspectorUiState, "page-1");

    expect(draft.showMarginGuides).toBe(false);
    expect(draft.showPrintableArea).toBe(false);
    expect(draft.pageShadow).toBe(false);
    expect(draft.safeAreaEnabled).toBe(false);
    expect(draft.bleedEnabled).toBe(false);
    expect(draft.includeCropMarks).toBe(false);
    expect(draft.bleedMm).toBe(3);
    expect(draft.safeAreaMm).toBe(24);
  });

  it("preserves explicit overrides when aids are re-enabled", () => {
    const draft = resolvePageInspectorDraft(
      {
        ...initialInspectorUiState,
        pageDraftSettingsByPageId: {
          "page-1": {
            showMarginGuides: true,
            bleedEnabled: true,
            bleedMm: 5,
          },
        },
      },
      "page-1",
    );

    expect(draft.showMarginGuides).toBe(true);
    expect(draft.bleedEnabled).toBe(true);
    expect(draft.bleedMm).toBe(5);
  });
});

describe("shouldShowTemplaraBrand", () => {
  it("shows Templara brand in standalone mode", () => {
    expect(shouldShowTemplaraBrand({})).toBe(true);
  });

  it("hides Templara brand when embedded or hideBrand", () => {
    expect(shouldShowTemplaraBrand({ embedded: true })).toBe(false);
    expect(shouldShowTemplaraBrand({ hideBrand: true })).toBe(false);
  });

  it("hides Templara wordmark when a host brandLogo node is provided", () => {
    expect(shouldShowTemplaraBrand({ brandLogo: "Host" })).toBe(false);
  });
});

describe("hostDesignTokensToCssVars", () => {
  it("maps host tokens onto Templara CSS variables", () => {
    const vars = hostDesignTokensToCssVars({
      fontFamily: "Noto Sans, sans-serif",
      color: {
        bg: "#f6f9fb",
        accent: "#225ed2",
      },
      radii: { control: "0.4rem" },
    });

    expect(vars).toMatchObject({
      [TEMPLARA_TOKEN_VARS.fontFamily]: "Noto Sans, sans-serif",
      [TEMPLARA_TOKEN_VARS.colorBg]: "#f6f9fb",
      [TEMPLARA_TOKEN_VARS.colorAccent]: "#225ed2",
      [TEMPLARA_TOKEN_VARS.radiusControl]: "0.4rem",
    });
  });

  it("inherits host font when embedded without an explicit fontFamily", () => {
    const vars = hostDesignTokensToCssVars(undefined, { embedded: true });
    expect(vars).toMatchObject({
      [TEMPLARA_TOKEN_VARS.fontFamily]: "inherit",
    });
  });

  it("does not force inherit font in standalone mode", () => {
    const vars = hostDesignTokensToCssVars(undefined, { embedded: false });
    expect(vars[TEMPLARA_TOKEN_VARS.fontFamily as keyof typeof vars]).toBeUndefined();
  });

  it("chrome helpers reference CSS vars with Templara fallbacks", () => {
    expect(chromeFontFamily()).toContain(TEMPLARA_TOKEN_VARS.fontFamily);
    expect(chromeFontFamily()).toContain("Geist");
    expect(chromeBackground()).toContain(TEMPLARA_TOKEN_VARS.colorBg);
    expect(chromeBackground()).toContain("#eef2f6");
  });
});
