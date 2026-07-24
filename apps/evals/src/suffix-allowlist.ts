/**
 * @deprecated Import money suffixes from `@templara/core` (`MONEY_FORMAT_SUFFIXES`).
 * Re-export kept only so local eval helpers stay one line; fixture-present subset
 * is the first two money leaves that appear in invoice-context.json.
 */
export {
  MONEY_FORMAT_SUFFIXES,
  type MoneyFormatSuffix,
} from "@templara/core";

/** Fixture-present money leaves asserted by G1 (subset of P3 MoneyFormatType). */
export const FIXTURE_MONEY_SUFFIX_LEAVES = [
  "withDecimalsAndCurrencyCode",
  "unroundedWithoutCurrencyCode",
] as const;

export type FixtureMoneySuffixLeaf = (typeof FIXTURE_MONEY_SUFFIX_LEAVES)[number];
