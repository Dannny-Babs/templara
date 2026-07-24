/**
 * Money formatting suffix leaves present in `fixtures/invoice-context.json`
 * and asserted by G1 contract tests.
 *
 * This is the fixture-present subset only — not the full closed P3
 * `MoneyFormatType` set (`withCurrencyCode` exists in Doc Builder 1 but is
 * absent from this invoice fixture). See docs/discovery/P3-context-builder.md
 * §2d for the complete enum. Eval assertions only — not the Stream C adapter.
 */
export const MONEY_SUFFIX_LEAVES = [
  "withDecimalsAndCurrencyCode",
  "unroundedWithoutCurrencyCode",
] as const;

export type MoneySuffixLeaf = (typeof MONEY_SUFFIX_LEAVES)[number];
