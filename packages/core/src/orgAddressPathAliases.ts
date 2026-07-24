/**
 * Org address postal key aliases for host value adapters.
 *
 * Discovery evidence ([P3](../../docs/discovery/P3-context-builder.md) §0 / §5.4,
 * [P4](../../docs/discovery/P4-real-templates-invoice-chain.md)):
 * - `getOrgAddress` emits `{ …, postal, … }` on `org.orgAddress` / `org.remitToAddress`.
 * - DB1 Handlebars invoice/payStub templates read `{{org.orgAddress.postalCode}}`.
 * - Record addresses (`invoiceToAddress`, etc.) genuinely use `postalCode` and are fine.
 *
 * This module is a **host-adapter helper only**. It does not change Rose Rocket
 * `platform-model` / `getOrgAddress`. Hosts that hydrate `{ org, record, document }`
 * for Templara should call {@link aliasOrgAddressPaths} (or apply the same mapping)
 * so templates that bind `postalCode` on org addresses do not render blank.
 */

/**
 * Binding-path map: template-facing path ↔ host-emitted path.
 * Bidirectional for documentation; {@link aliasOrgAddressPaths} mirrors leaf values.
 */
export const ORG_ADDRESS_PATH_ALIASES = {
  "org.orgAddress.postalCode": "org.orgAddress.postal",
  "org.orgAddress.postal": "org.orgAddress.postalCode",
  "org.remitToAddress.postalCode": "org.remitToAddress.postal",
  "org.remitToAddress.postal": "org.remitToAddress.postalCode",
} as const;

export type OrgAddressPathAlias = keyof typeof ORG_ADDRESS_PATH_ALIASES;

/** Object keys under `org` that use the `postal` (not `postalCode`) contract. */
export const ORG_ADDRESS_OBJECT_KEYS = ["orgAddress", "remitToAddress"] as const;

export type OrgAddressObjectKey = (typeof ORG_ADDRESS_OBJECT_KEYS)[number];

const POSTAL = "postal";
const POSTAL_CODE = "postalCode";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Mirror `postal` ↔ `postalCode` on a single org-address-shaped object.
 * Prefer an existing string on either key; if both are already set, leave both as-is
 * (do not invent a winner — host data wins).
 */
export function mirrorOrgAddressPostalKeys(
  address: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...address };
  const postal = next[POSTAL];
  const postalCode = next[POSTAL_CODE];
  const hasPostal = nonEmptyString(postal);
  const hasPostalCode = nonEmptyString(postalCode);

  if (hasPostal && !hasPostalCode) {
    next[POSTAL_CODE] = postal;
  } else if (hasPostalCode && !hasPostal) {
    next[POSTAL] = postalCode;
  }

  return next;
}

/**
 * Shallow-copy `{ org, … }` context and mirror postal keys on known org address
 * objects. Leaves `record.*` addresses untouched.
 *
 * Returns the input unchanged when `context` is not a plain object or has no `org`.
 */
export function aliasOrgAddressPaths<T>(context: T): T {
  if (!isPlainObject(context)) {
    return context;
  }

  const org = context.org;
  if (!isPlainObject(org)) {
    return context;
  }

  let orgChanged = false;
  const nextOrg: Record<string, unknown> = { ...org };

  for (const key of ORG_ADDRESS_OBJECT_KEYS) {
    const address = nextOrg[key];
    if (!isPlainObject(address)) {
      continue;
    }
    const mirrored = mirrorOrgAddressPostalKeys(address);
    if (
      mirrored.postal !== address.postal ||
      mirrored.postalCode !== address.postalCode
    ) {
      nextOrg[key] = mirrored;
      orgChanged = true;
    }
  }

  if (!orgChanged) {
    return context;
  }

  return { ...context, org: nextOrg } as T;
}
