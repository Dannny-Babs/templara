/**
 * Money formatting suffix leaves used by G1 fixture assertions.
 *
 * The full closed set lives in docs/discovery/P3-context-builder.md §2d
 * (`MoneyFormatType`). This module is for eval assertions only — not the
 * Stream C value adapter.
 */
export const MONEY_SUFFIX_LEAVES = [
  "withCurrencyCode",
  "withDecimalsAndCurrencyCode",
  "unroundedWithoutCurrencyCode",
] as const;

export type MoneySuffixLeaf = (typeof MONEY_SUFFIX_LEAVES)[number];
