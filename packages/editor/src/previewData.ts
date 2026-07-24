import { aliasOrgAddressPaths } from "@templara/core";

export interface PreparePreviewDataOptions {
  /**
   * Mirror org address `postal` ↔ `postalCode` so templates that bind either
   * key resolve against host-hydrated `{ org, record, … }` context.
   * Defaults to `true`.
   */
  aliasOrgAddresses?: boolean;
}

/**
 * Host-facing helper for feeding a **real** record context into
 * `DocumentEditor` via the controlled `data` / `onDataChange` props.
 *
 * This does **not** fetch platform records or synthesize sample placeholders.
 * Hosts resolve the record graph themselves, then call this before setting
 * `data` so org-address postal aliases match Templara binding paths.
 *
 * @example
 * ```tsx
 * const preview = preparePreviewData(hostResolvedContext);
 * <DocumentEditor value={template} data={preview} onDataChange={setPreview} />
 * ```
 */
export function preparePreviewData(
  data: Record<string, unknown>,
  options: PreparePreviewDataOptions = {},
): Record<string, unknown> {
  const aliasOrgAddresses = options.aliasOrgAddresses !== false;
  return aliasOrgAddresses ? aliasOrgAddressPaths(data) : data;
}
