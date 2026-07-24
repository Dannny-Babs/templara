import type { CSSProperties } from "react";

/**
 * Host-supplied chrome tokens for an embedded DocumentEditor.
 *
 * Prefer CSS-variable inheritance when the host already exposes design tokens on
 * `:root` (e.g. Zinnia `--zinnia-*`). Pass this object when the editor needs
 * explicit JS/inline values (iframe, shadow DOM, or non-cascading hosts).
 *
 * All fields are optional; unset keys keep Templara defaults via CSS fallbacks.
 * Shape is aligned with the minimal contract in docs/discovery/P6-design-tokens.md.
 */
export interface HostDesignTokens {
  /** UI chrome font stack. When omitted in embedded mode, inherits the host font. */
  fontFamily?: string;
  fontFamilyMono?: string;
  color?: {
    /** Editor shell / board background */
    bg?: string;
    /** Elevated surfaces (panels, toolbar) */
    bgElevated?: string;
    /** Primary chrome text */
    content?: string;
    /** Chrome borders / dividers */
    border?: string;
    /** Accent (selection, primary actions) */
    accent?: string;
    accentSoft?: string;
    buttonPrimary?: string;
    buttonPrimaryHover?: string;
  };
  radii?: {
    control?: string;
    panel?: string;
  };
  shadow?: {
    surface?: string;
    focus?: string;
  };
}

/** CSS custom properties set on the editor shell root. */
export const TEMPLARA_TOKEN_VARS = {
  fontFamily: "--templara-font-family",
  fontFamilyMono: "--templara-font-family-mono",
  colorBg: "--templara-color-bg",
  colorBgElevated: "--templara-color-bg-elevated",
  colorContent: "--templara-color-content",
  colorBorder: "--templara-color-border",
  colorAccent: "--templara-color-accent",
  colorAccentSoft: "--templara-color-accent-soft",
  colorButtonPrimary: "--templara-color-button-primary",
  colorButtonPrimaryHover: "--templara-color-button-primary-hover",
  radiusControl: "--templara-radius-control",
  radiusPanel: "--templara-radius-panel",
  shadowSurface: "--templara-shadow-surface",
  shadowFocus: "--templara-shadow-focus",
} as const;

export const DEFAULT_UI_FONT_FAMILY =
  'Geist, "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const DEFAULT_UI_MONO_FONT_FAMILY =
  '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const DEFAULT_UI_COLOR_BG = "#eef2f6";
export const DEFAULT_UI_COLOR_CONTENT = "#111827";
export const DEFAULT_UI_COLOR_BORDER = "#e8ecf1";
export const DEFAULT_UI_RADIUS_CONTROL = "6px";

/**
 * Workspace canvas aids. Visual overlays default OFF; snap stays ON because it
 * does not paint chrome on the page.
 */
export const DEFAULT_WORKSPACE_AIDS = {
  showGrid: false,
  showRulers: false,
  snapToGrid: true,
  snapToGuides: true,
} as const;

/**
 * Whether the default Templara wordmark + cube mark should appear.
 * Host brand nodes (`brandLogo`) replace the lockup entirely. `brandLogoSrc`
 * alone still renders an image mark when branding is hidden (host mark only).
 */
export function shouldShowTemplaraBrand(options: {
  embedded?: boolean;
  hideBrand?: boolean;
  brandLogo?: unknown;
}): boolean {
  if (options.brandLogo != null) {
    return false;
  }
  if (options.hideBrand === true || options.embedded === true) {
    return false;
  }
  return true;
}

/**
 * Builds inline CSS variable declarations for the editor shell from host tokens.
 * When `embedded` and no `fontFamily` is provided, sets font to `inherit` so the
 * host product font cascades into chrome.
 */
export function hostDesignTokensToCssVars(
  tokens: HostDesignTokens | undefined,
  options?: { embedded?: boolean },
): CSSProperties {
  const vars: Record<string, string> = {};
  const embedded = options?.embedded === true;

  if (tokens?.fontFamily) {
    vars[TEMPLARA_TOKEN_VARS.fontFamily] = tokens.fontFamily;
  } else if (embedded) {
    vars[TEMPLARA_TOKEN_VARS.fontFamily] = "inherit";
  }

  if (tokens?.fontFamilyMono) {
    vars[TEMPLARA_TOKEN_VARS.fontFamilyMono] = tokens.fontFamilyMono;
  }

  const color = tokens?.color;
  if (color?.bg) vars[TEMPLARA_TOKEN_VARS.colorBg] = color.bg;
  if (color?.bgElevated) vars[TEMPLARA_TOKEN_VARS.colorBgElevated] = color.bgElevated;
  if (color?.content) vars[TEMPLARA_TOKEN_VARS.colorContent] = color.content;
  if (color?.border) vars[TEMPLARA_TOKEN_VARS.colorBorder] = color.border;
  if (color?.accent) vars[TEMPLARA_TOKEN_VARS.colorAccent] = color.accent;
  if (color?.accentSoft) vars[TEMPLARA_TOKEN_VARS.colorAccentSoft] = color.accentSoft;
  if (color?.buttonPrimary) {
    vars[TEMPLARA_TOKEN_VARS.colorButtonPrimary] = color.buttonPrimary;
  }
  if (color?.buttonPrimaryHover) {
    vars[TEMPLARA_TOKEN_VARS.colorButtonPrimaryHover] = color.buttonPrimaryHover;
  }

  if (tokens?.radii?.control) {
    vars[TEMPLARA_TOKEN_VARS.radiusControl] = tokens.radii.control;
  }
  if (tokens?.radii?.panel) {
    vars[TEMPLARA_TOKEN_VARS.radiusPanel] = tokens.radii.panel;
  }
  if (tokens?.shadow?.surface) {
    vars[TEMPLARA_TOKEN_VARS.shadowSurface] = tokens.shadow.surface;
  }
  if (tokens?.shadow?.focus) {
    vars[TEMPLARA_TOKEN_VARS.shadowFocus] = tokens.shadow.focus;
  }

  return vars as CSSProperties;
}

/** Resolved chrome font with CSS-var fallback chain for inline styles. */
export function chromeFontFamily(fallback = DEFAULT_UI_FONT_FAMILY): string {
  return `var(${TEMPLARA_TOKEN_VARS.fontFamily}, ${fallback})`;
}

export function chromeBackground(fallback = DEFAULT_UI_COLOR_BG): string {
  return `var(${TEMPLARA_TOKEN_VARS.colorBg}, ${fallback})`;
}

export function chromeContentColor(fallback = DEFAULT_UI_COLOR_CONTENT): string {
  return `var(${TEMPLARA_TOKEN_VARS.colorContent}, ${fallback})`;
}

export function chromeBorderColor(fallback = DEFAULT_UI_COLOR_BORDER): string {
  return `var(${TEMPLARA_TOKEN_VARS.colorBorder}, ${fallback})`;
}

export function chromeControlRadius(fallback = DEFAULT_UI_RADIUS_CONTROL): string {
  return `var(${TEMPLARA_TOKEN_VARS.radiusControl}, ${fallback})`;
}
