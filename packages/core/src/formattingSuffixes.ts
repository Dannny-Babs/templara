/**
 * Closed formatting-suffix allowlist from Doc Builder 1
 * (`documentContext.helpers` / P3 §2d, §5).
 *
 * Host `buildRecordContext` materializes money, date, range, and file URL
 * leaves as **pre-formatted strings** (or `{ [suffix]: string }` nests)
 * keyed by these path suffixes. Templara integrations should treat matching
 * leaves as display strings and must not re-run client money/date formatters
 * by default (see value-adapter helpers).
 *
 * Source: docs/discovery/P3-context-builder.md
 */

/** P3 `MoneyFormatType` — terminal money leaf keys. */
export const MONEY_FORMAT_SUFFIXES = [
  "withCurrencyCode",
  "withDecimalsAndCurrencyCode",
  "unroundedWithoutCurrencyCode",
] as const;

export type MoneyFormatSuffix = (typeof MONEY_FORMAT_SUFFIXES)[number];

/** P3 `DateTimeValueFormatType` — format keys under dateTimeInLocation*. */
export const DATE_FORMAT_SUFFIXES = [
  "standardDate",
  "standardDateTime",
  "shortDate",
  "shortDateTime",
  "longDate",
  "longDateTime",
] as const;

export type DateFormatSuffix = (typeof DATE_FORMAT_SUFFIXES)[number];

/** P3 `DateTimeValueProperties` — nesting keys for DateTimeValue. */
export const DATE_TIME_PROPERTY_SUFFIXES = [
  "dateTimeInLocation",
  "dateTimeInLocationEnd",
] as const;

export type DateTimePropertySuffix = (typeof DATE_TIME_PROPERTY_SUFFIXES)[number];

/** P3 `DateTimeValueFormatRangeType` — range leaves on the field itself. */
export const DATE_RANGE_SUFFIXES = [
  "standardDateRange",
  "standardDateTimeRange",
  "shortDateRange",
  "shortDateTimeRange",
  "shortDateTimeRangeCompact",
  "longDateRange",
  "longDateTimeRange",
] as const;

export type DateRangeSuffix = (typeof DATE_RANGE_SUFFIXES)[number];

/** Other strip/format leaves (file connection `.url`, etc.). */
export const OTHER_FORMATTING_SUFFIXES = ["url"] as const;

export type OtherFormattingSuffix = (typeof OTHER_FORMATTING_SUFFIXES)[number];

/**
 * Composite trailing suffixes for DateTimeValue nesting, e.g.
 * `dateTimeInLocation.shortDate` (P3 §5.3).
 */
export const COMPOSITE_DATE_PATH_SUFFIXES: readonly string[] = DATE_TIME_PROPERTY_SUFFIXES.flatMap(
  (property) => DATE_FORMAT_SUFFIXES.map((format) => `${property}.${format}`),
);

/**
 * All terminal path segments that identify a pre-formatted leaf.
 * Includes money, date formats, range formats, datetime property keys, and `url`.
 * Does **not** include composite `property.format` strings — use
 * {@link COMPOSITE_DATE_PATH_SUFFIXES} / {@link bindingPathHasFormattingSuffix} for those.
 */
export const FORMATTING_PATH_SUFFIXES = [
  ...MONEY_FORMAT_SUFFIXES,
  ...DATE_FORMAT_SUFFIXES,
  ...DATE_TIME_PROPERTY_SUFFIXES,
  ...DATE_RANGE_SUFFIXES,
  ...OTHER_FORMATTING_SUFFIXES,
] as const;

export type FormattingPathSuffix = (typeof FORMATTING_PATH_SUFFIXES)[number];

const FORMATTING_PATH_SUFFIX_SET = new Set<string>(FORMATTING_PATH_SUFFIXES);

/**
 * True when `segment` is a known terminal formatting suffix (money, date,
 * range, datetime property key, or `url`).
 */
export function isFormattingPathSuffix(segment: string): boolean {
  return FORMATTING_PATH_SUFFIX_SET.has(segment);
}

/**
 * True when `path` ends with a known formatting suffix or a composite
 * `dateTimeInLocation*.<format>` trailing segment pair (dot-separated path).
 */
export function bindingPathHasFormattingSuffix(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) {
    return false;
  }

  for (const composite of COMPOSITE_DATE_PATH_SUFFIXES) {
    if (trimmed === composite || trimmed.endsWith(`.${composite}`)) {
      return true;
    }
  }

  const lastDot = trimmed.lastIndexOf(".");
  const terminal = lastDot === -1 ? trimmed : trimmed.slice(lastDot + 1);
  return isFormattingPathSuffix(terminal);
}

/**
 * Pass-through for host pre-formatted leaves: return the string as-is.
 * Returns `undefined` for missing / non-string values (never reformats).
 */
export function asPreformattedDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}
