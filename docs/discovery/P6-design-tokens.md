# P6 — Design Tokens (so Templara can INHERIT the platform UI)

Read-only discovery of Rose Rocket's design-token system so an embedded 3rd-party editor ("Templara") can visually match the host. All values pasted below are **real**, resolved from `node_modules` (the token source is an external Bit/SDK package, not in-repo).

---

## 0. TL;DR

- The design system is **"Zinnia"**. Tokens live in `@roserocket-sdk/zinnia-particles`, re-exported by `@roserocket/design.tokens`.
- Two token tiers:
  - **`global`** — primitive/raw values (hex colors, rem sizes). e.g. `color.blue.500 = #225ed2`, `spacing.md = 1.6rem`.
  - **`reference`** — semantic tokens that resolve to **CSS custom properties** (`var(--zinnia-color-...)`). e.g. `color.bg.button.primary.default → var(--zinnia-color-bg-button-primary-default)`.
- Runtime exposure is via a **CSS stylesheet** (`@roserocket/design.tokens/dist/stylesheet.css`) that declares the `--zinnia-*` custom properties on `:root`, plus a typed **JS token object** (`tokens` from zinnia-particles) for use in styled-components.
- **Font:** `Noto Sans, sans-serif`. Root font-size trick: `html { font-size: 62.5% }` so `1rem = 10px`; body default `1.4rem` (14px), weight 400.
- Primitives (`@roserocket/design.button`, `.text-input`, `.select-input`, `.popover`, `.typography`, …) are separate Bit packages that consume the `--zinnia-*` CSS vars.

**Recommendation for Templara (§5):** accept a small typed `HostDesignTokens` prop *and* rely on the host's `--zinnia-*` CSS variables being in scope. The cheapest correct approach is: mount Templara inside the host DOM (so `:root` `--zinnia-*` vars cascade in) and pass a `HostDesignTokens` object only for values the editor needs in JS (e.g. inline canvas styling).

---

## 1. WHERE tokens live

| Concern | Package / file |
|---|---|
| Canonical token SDK (values) | `@roserocket-sdk/zinnia-particles` → `node_modules/@roserocket-sdk/zinnia-particles/lib/autogen/web/index.js` (+ `index.d.ts`) |
| Platform re-export | `@roserocket/design.tokens` (`^2.3.10`) → `node_modules/@roserocket/design.tokens/dist/index.d.ts` |
| CSS custom properties + resets | `node_modules/@roserocket/design.tokens/dist/stylesheet.css` |
| Colors (standalone) | `@roserocket/colors` (`^3.0.0`), `@roserocket/colors-js` (`^3.0.0`) |
| Typography component + scale | `@roserocket/design.typography` (`^1.5.40`) → `dist/typography.constants.d.ts` |

`@roserocket/design.tokens` is a thin re-export:

```ts
// node_modules/@roserocket/design.tokens/dist/index.d.ts
export * from '@roserocket-sdk/zinnia-particles';
```

And zinnia's token object shape:

```ts
// node_modules/@roserocket-sdk/zinnia-particles/lib/index.d.ts
export { type GlobalTokens, type ReferenceTokens, tokens } from './autogen/web';
```

At runtime `tokens` has two members:

```js
require('@roserocket-sdk/zinnia-particles').tokens // → { global, reference }
```

- `tokens.global` — raw values.
- `tokens.reference` — semantic values as `var(--zinnia-…)` strings.

### 1.1 Token category inventory (top-level keys of `GlobalTokens`)

From `node_modules/@roserocket-sdk/zinnia-particles/lib/autogen/web/index.d.ts`:

```
type          // typography composites (body/heading/caption/button/avatar → "weight size/lh family")
borderRadius  // none, sm, md, round
borderWidth   // sm, md
color         // blue/cyan/green/grey/orange/pink/purple/red/teal/yellow (+ *Alpha) 50..900, gradient, transparent
fontFamily    // "Noto Sans, sans-serif"
fontSize      // 50,100,200,300,400,500,600,700
fontWeight    // regular, semibold, bold
letterSpacing // default
lineHeight    // 100..600
opacity       // 0..500
shadow        // sm, md, lg, xl, focus
sizing        // xxxs..xxl (control heights, scalable)
spacing       // none, xxxs..xxl
staticSizing  // xxxs..xxl (non-scaling)
```

`ReferenceTokens` mirrors the semantic layer: `{ color: { bg, border, content, … }, opacity: {…} }` — every leaf is a `var(--zinnia-…)`.

---

## 2. HOW tokens are exposed at runtime

### 2.1 Concrete GLOBAL values (verbatim, resolved from `tokens.global`)

```
fontFamily: "Noto Sans, sans-serif"

fontSize:   { 50:"0.8rem", 100:"1rem", 200:"1.2rem", 300:"1.4rem", 400:"1.6rem",
              500:"1.8rem", 600:"2.2rem", 700:"2.8rem" }

fontWeight: { regular:"400", semibold:"600", bold:"700" }

lineHeight: { 100:"1.2rem", 200:"1.6rem", 300:"2rem", 400:"2.4rem", 500:"3.2rem", 600:"4rem" }

letterSpacing: { default: … }

spacing:    { none:"0rem", xxxs:"0.2rem", xxs:"0.4rem", xs:"0.8rem", sm:"1.2rem",
              md:"1.6rem", lg:"2.4rem", xl:"3.2rem", xxl:"4rem" }

sizing:     { xxxs:"1.2rem", xxs:"1.6rem", xs:"2rem", sm:"2.4rem", md:"3.2rem",
              lg:"4rem", xl:"4.8rem", xxl:"6.4rem" }     // control heights

borderRadius: { none:"0rem", sm:"0.4rem", md:"0.8rem", round:"99.9rem" }
borderWidth:  { sm:"0.1rem", md:"0.2rem" }

shadow: {
  sm:    "0px 2px 4px 0px rgb(23 31 48 / 22%)",
  md:    "0px 4px 8px 0px rgb(23 31 48 / 15%)",
  lg:    "0px 8px 16px 0px rgb(23 31 48 / 12%)",
  xl:    "0px 16px 32px 0px rgb(0 0 0 / 10%)",
  focus: "0px 0px 0px 2px rgb(34 94 210 / 30%)"
}
```

> **Note on "rem":** because `html { font-size: 62.5% }` (10px base), all these rem values are effectively "value × 10 px". `spacing.md = 1.6rem = 16px`; `fontSize.300 = 1.4rem = 14px`.

Color ramp example (`tokens.global.color.blue`, brand hue):

```
blue: { 50:#f6fafe, 100:#ecf3fe, 200:#d2e2ff, 300:#a0c1ff, 400:#6398ff,
        500:#225ed2, 600:#11419b, 700:#0c337e, 800:#062154, 900:#021538 }
```

Ramps exist for `blue, cyan, green, grey, orange, pink, purple, red, teal, yellow` (each 50–900) plus `*Alpha` variants, `gradient`, `transparent`.

Typography composites (`tokens.global.type`) are ready-to-use `font` shorthands:

```
type.body.paragraph.regular  = "400 1.4rem/1.43 'Noto Sans', sans-serif"
type.body.paragraph.semibold = "600 1.4rem/1.43 'Noto Sans', sans-serif"
type.body.title.regular      = "400 1.4rem/1.14 'Noto Sans', sans-serif"
type.heading1.bold           = "700 1.8rem/1.33 'Noto Sans', sans-serif"
```

### 2.2 Concrete REFERENCE (semantic) tokens → CSS vars

`tokens.reference` maps semantic names to CSS vars, e.g.:

```
reference.color.bg.accent.blue.bold    = "var(--zinnia-color-bg-accent-blue-bold)"
reference.color.bg.button.primary.default = "var(--zinnia-color-bg-button-primary-default)"
```

The vars themselves are declared in `@roserocket/design.tokens/dist/stylesheet.css` (on `:root`). Representative entries (verbatim):

```css
/* node_modules/@roserocket/design.tokens/dist/stylesheet.css */
--zinnia-color-bg-brand: #225ed2;
--zinnia-color-bg-default: #f6f9fb;
--zinnia-color-bg-bold: #eef2f6;
--zinnia-color-bg-bolder: #dbe1e9;

/* Buttons */
--zinnia-color-bg-button-primary-default: #225ed2;
--zinnia-color-bg-button-primary-hover:   #11419b;
--zinnia-color-bg-button-primary-pressed: #0c337e;
--zinnia-color-bg-button-secondary-default: #f6fafe;
--zinnia-color-bg-button-secondary-hover:   #ecf3fe;
--zinnia-color-bg-button-secondary-pressed: #d2e2ff;
--zinnia-color-bg-button-tertiary-default: #ffffff;
--zinnia-color-bg-button-tertiary-hover:   #f6f9fb;
--zinnia-color-bg-button-tertiary-pressed: #eef2f6;
--zinnia-color-bg-button-critical-default: #c71830;
--zinnia-color-bg-button-critical-hover:   #900c1f;

/* Inputs / cells / checkbox */
--zinnia-color-bg-input-field-default: #ffffff;
--zinnia-color-bg-input-cell-hover:    #5665890d;
--zinnia-color-bg-checkbox-selected:   #225ed2;

/* Content (text) */
--zinnia-color-content-default: #222222;
```

Distinct var families found in the tokens stylesheet: `--zinnia-color-bg-*`, `--zinnia-color-border-*`, `--zinnia-color-content-*`, `--zinnia-opacity-interactive-*`, `--zinnia-opacity-shortcut-*`. (Spacing/radius/shadow are consumed from the JS `global` object rather than CSS vars in this stylesheet.)

### 2.3 Theme provider?

There is **no runtime JS theme-provider/context** for tokens — components import `tokens` directly (styled-components) and/or reference the global `--zinnia-*` CSS vars. This is favorable for Templara: it means tokens are ambient (CSS vars in scope + an importable JS object), not locked behind a React context the 3rd-party editor couldn't access.

---

## 3. FONT setup

- **Family:** `Noto Sans, sans-serif` (`tokens.global.fontFamily`, and hard-set in the tokens stylesheet `body { font-family: 'Noto Sans', sans-serif; }`).
- **Root sizing:** `html { font-size: 62.5%; }` → `1rem = 10px` (chosen so rem math is "×10 px" and still respects user browser zoom). Verbatim:

```css
/* node_modules/@roserocket/design.tokens/dist/stylesheet.css */
html {
    /* 62.5% of 16px = 10px. We use percent to still allow the user to change their browser base font size. */
    font-size: 62.5%;
    -webkit-text-size-adjust: 100%;
}
body {
    margin: 0;
    padding: 0;
    font-size: 1.4rem; /* 14px */
    font-weight: 400;
    color: var(--zinnia-color-content-default, #222222);
    font-family: 'Noto Sans', sans-serif;
    background-color: #fff;
    line-height: 1.42857143;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
```

- **Weights:** declared as strings — `regular:400`, `semibold:600`, `bold:700` (`tokens.global.fontWeight`). The actual Noto Sans font files are loaded by the app shell (font-face/`<link>` at the host level); the token stylesheet only sets the family. Monospace fallback for `code/pre` is `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`.

### 3.1 Typography scale (component contract)

`@roserocket/design.typography` exposes named variants (used across the host, e.g. in `DocumentBuilder.tsx`):

```ts
// node_modules/@roserocket/design.typography/dist/typography.constants.d.ts
export declare enum TypographyVariant {
    h1, h2, h3, h4,
    bodyTitle, bodyParagraph,
    captionTitle, captionParagraph,
    smallCaption,
    linkMedium, linkSmall
}
export declare const TYPOGRAPHY_VARIANT_ELEMENTS: {
    h1:"h1"; h2:"h2"; h3:"h3"; h4:"h4";
    bodyTitle:"p"; bodyParagraph:"p"; captionTitle:"p"; captionParagraph:"p";
    smallCaption:"span"; linkMedium:"span"; linkSmall:"span";
};
export declare const TYPOGRAPHY_VARIANT_FONT_SIZES: { … per variant … };
export declare const TYPOGRAPHY_VARIANT_LINE_HEIGHTS: { … per variant … };
```

The `Typography` component props (`dist/typography.d.ts`) include `variant`, `isBold`, `isSemiBold`, `isItalic`, `color`, `align`, `as` — these compose the `type.*` composites above.

---

## 4. Core primitives and how they consume tokens

Each primitive is its own Bit package (versions from `ui/package.json`): `@roserocket/design.button` `^2.2.33`, `@roserocket/design.text-input` `^1.7.22`, `@roserocket/design.select-input` `^1.16.93`, `@roserocket/design.popover` `^1.4.25`, `@roserocket/design.input-container` `^1.7.43`, `@roserocket/design.typography` `^1.5.40`, `@roserocket/design.pill` `^2.1.72`, `@roserocket/design.toggle` `^1.6.74`, plus the field picker `@roserocket/design.object-field-select-input` `^2.5.95` (this is the exact component that renders the merge-field picker — see P1).

They consume the semantic CSS vars. From the button token block:

- **Button** (primary/secondary/tertiary/critical/warning + ghost variants) → `--zinnia-color-bg-button-<variant>-<state>` for default/hover/pressed. e.g. primary uses `#225ed2 / #11419b / #0c337e`. Used in the host as `import { Button, ButtonVariant, ButtonSize } from '@roserocket/design.button'` (`DocumentBuilder.tsx`).
- **Input / cell / checkbox** → `--zinnia-color-bg-input-field-default`, `--zinnia-color-bg-input-cell-*`, `--zinnia-color-bg-checkbox-selected`.
- **Panel / card / surfaces** → `--zinnia-color-bg-default|bold|bolder`, `--zinnia-color-bg-card-*`, with elevation from `tokens.global.shadow.{sm,md,lg,xl}`.
- **Content/text** → `--zinnia-color-content-default` (`#222222`).

Because these are plain CSS custom properties on `:root`, any DOM subtree rendered inside the app inherits them automatically — including an embedded editor's chrome.

Example of the host importing primitives (from `DocumentBuilder.tsx`), showing the surface Templara must visually match:

```6:14:ui/src/scripts/platform/core/DocumentBuilderAdmin/components/DocumentBuilder.tsx
import { ActionMenu, ActionMenuSize } from '@roserocket/design.action-menu';
import { Button, ButtonSize, ButtonVariant, IconButton } from '@roserocket/design.button';
import { StatusPill, StatusPillVariants } from '@roserocket/design.pill';
import { Popover } from '@roserocket/design.popover';
import { ChevronRightIcon, MoreIcon } from '@roserocket/design.svg-icons';
import { Toggle } from '@roserocket/design.toggle';
import { Typography, TypographyVariant } from '@roserocket/design.typography';
```

---

## 5. RECOMMENDATION — the minimal token contract for Templara

**Delivery model:** Prefer **CSS-variable inheritance** as the primary channel (mount Templara in the host DOM so the `--zinnia-*` vars cascade in with zero prop plumbing), and pass a **typed `HostDesignTokens` object** as a secondary channel for values Templara needs in JS (canvas inline styles, iframe/shadow-DOM cases where cascade is broken, or to theme a document canvas that must render standalone).

Grounded in the real Zinnia token names, the minimal contract:

```ts
/**
 * Minimal design-token contract an embedded 3rd-party editor ("Templara") accepts
 * to visually match the Rose Rocket ("Zinnia") host.
 *
 * Values mirror @roserocket-sdk/zinnia-particles `tokens.global`. Every field is a
 * plain CSS value string so it can be dropped into inline styles or styled-components
 * without importing the host's packages. Where the host uses CSS vars, the editor may
 * instead read them off `:root` when embedded in-DOM.
 */
export interface HostDesignTokens {
  /** Root rem base note: host sets html font-size to 62.5% (1rem = 10px). */
  fontFamily: string;                       // "Noto Sans, sans-serif"
  fontSize: {                               // rem strings
    xs: string; sm: string; md: string; lg: string; xl: string; xxl: string; xxxl: string;
  };                                        // maps to zinnia fontSize 50..700
  fontWeight: { regular: string; semibold: string; bold: string }; // "400" | "600" | "700"
  lineHeight: {
    xs: string; sm: string; md: string; lg: string; xl: string; xxl: string;
  };                                        // zinnia lineHeight 100..600

  spacing: {                                // zinnia spacing scale (rem)
    none: string; xxxs: string; xxs: string; xs: string; sm: string;
    md: string; lg: string; xl: string; xxl: string;
  };
  radii: { none: string; sm: string; md: string; round: string };  // zinnia borderRadius
  borderWidth: { sm: string; md: string };
  shadow: { sm: string; md: string; lg: string; xl: string; focus: string };

  color: {
    /** Surfaces */
    bg: {
      default: string;      // --zinnia-color-bg-default   (#f6f9fb)
      bold: string;         // --zinnia-color-bg-bold      (#eef2f6)
      bolder: string;       // --zinnia-color-bg-bolder    (#dbe1e9)
      inputField: string;   // --zinnia-color-bg-input-field-default (#ffffff)
      brand: string;        // --zinnia-color-bg-brand     (#225ed2)
    };
    /** Text */
    content: {
      default: string;      // --zinnia-color-content-default (#222222)
      subtle?: string;
      brand?: string;
    };
    border: {
      default: string;      // --zinnia-color-border-*
      strong?: string;
    };
    /** Interactive (button) states, primary + a critical/destructive channel */
    button: {
      primary:   { default: string; hover: string; pressed: string }; // #225ed2 / #11419b / #0c337e
      secondary: { default: string; hover: string; pressed: string };
      tertiary:  { default: string; hover: string; pressed: string };
      critical:  { default: string; hover: string; pressed: string }; // #c71830 / #900c1f / …
    };
    /** Full brand ramp, in case the editor themes accents/pills */
    brandRamp?: Record<50|100|200|300|400|500|600|700|800|900, string>;
  };

  /** Optional: ready-made font shorthands (zinnia `type.*`) for canvas typography. */
  typography?: {
    bodyRegular: string;    // "400 1.4rem/1.43 'Noto Sans', sans-serif"
    bodySemibold: string;
    heading1: string;       // "700 1.8rem/1.33 'Noto Sans', sans-serif"
  };
}
```

**How Templara should consume it:**
1. When embedded in the host DOM, do nothing special — inherit `--zinnia-*` from `:root` for chrome, and read the current font (Noto Sans, 62.5% base) automatically.
2. Accept `HostDesignTokens` as a prop and use it for (a) the **document canvas** (which often needs print-accurate absolute values, not the 62.5% rem base), and (b) any **iframe/shadow-DOM** editing surface where the cascade doesn't reach.
3. Keep the contract **versioned** — the current editor already suffers from a package-vs-host type drift (`fieldCode`, see P1 §3.3); a stable `HostDesignTokens` interface avoids repeating that.

---

## 6. File index (P6)

| Concern | Path |
|---|---|
| Token SDK (values) | `node_modules/@roserocket-sdk/zinnia-particles/lib/autogen/web/index.js` / `index.d.ts` |
| Platform re-export | `node_modules/@roserocket/design.tokens/dist/index.d.ts` |
| CSS custom props + resets + font | `node_modules/@roserocket/design.tokens/dist/stylesheet.css` |
| Typography scale/variants | `node_modules/@roserocket/design.typography/dist/typography.constants.d.ts` |
| Package versions | `ui/package.json` (`@roserocket/design.*`, `@roserocket/colors*`) |
| Primitive usage sample | `ui/src/scripts/platform/core/DocumentBuilderAdmin/components/DocumentBuilder.tsx` |
