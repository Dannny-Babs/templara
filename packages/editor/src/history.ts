/**
 * Small, pure helpers for coalescing editor history entries.
 *
 * A "transaction" groups rapid, related mutations (slider drags, typing in a
 * field, repeated nudges of the same node) into a single undo entry. A new
 * entry is started when the transaction key changes or when the previous
 * transaction has been idle longer than the coalescing window.
 */

export interface HistoryTransaction {
  key: string;
  time: number;
}

export const DEFAULT_HISTORY_COALESCE_MS = 700;

/**
 * Returns true when the incoming commit should push a fresh undo snapshot,
 * false when it should coalesce into the currently open transaction.
 *
 * Commits without a transaction key always start a new entry, so one-shot
 * actions (delete, duplicate, insert) never merge with neighbours.
 */
export function shouldStartNewHistoryEntry(
  active: HistoryTransaction | null,
  key: string | undefined,
  now: number,
  windowMs: number = DEFAULT_HISTORY_COALESCE_MS,
): boolean {
  if (key == null) {
    return true;
  }

  if (!active) {
    return true;
  }

  if (active.key !== key) {
    return true;
  }

  return now - active.time >= windowMs;
}

/**
 * Computes the transaction marker to store after a commit. Keyless commits
 * close any open transaction so the next commit cannot merge into them.
 */
export function advanceHistoryTransaction(
  key: string | undefined,
  now: number,
): HistoryTransaction | null {
  return key == null ? null : { key, time: now };
}
