/**
 * Filters layer-tree rows by label / type / id (case-insensitive).
 * Empty or whitespace-only query returns all rows unchanged.
 */
export function filterLayerTreeRows<
  T extends { label: string; type?: string; nodeId?: string },
>(rows: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }

  return rows.filter((row) => {
    const haystack = `${row.label} ${row.type ?? ""} ${row.nodeId ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
