import type { InlineContent } from "@templara/core";

const FIELD_TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Serializes inline content into the editable `{{path}}` string form used by the
 * inspector content input. Text runs are emitted verbatim; field runs become
 * `{{binding.path}}` tokens.
 */
export function serializeInlineContent(content: InlineContent[]): string {
  return content
    .map((part) => (part.kind === "text" ? part.text : `{{${part.binding.path}}}`))
    .join("");
}

/**
 * Parses the editable string form back into inline content, preserving mixed
 * text and field runs (e.g. `Hello {{customer.name}}!` becomes three runs).
 * Returns an empty array for empty input.
 */
export function parseInlineContent(value: string): InlineContent[] {
  if (!value) {
    return [];
  }

  const runs: InlineContent[] = [];
  let lastIndex = 0;
  FIELD_TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FIELD_TOKEN.exec(value)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ kind: "text", text: value.slice(lastIndex, match.index) });
    }

    const path = match[1];
    runs.push({ kind: "field", label: path, binding: { path } });
    lastIndex = FIELD_TOKEN.lastIndex;
  }

  if (lastIndex < value.length) {
    runs.push({ kind: "text", text: value.slice(lastIndex) });
  }

  return runs;
}

export interface CaretInsertion {
  value: string;
  caret: number;
}

/**
 * Inserts a `{{path}}` field token into the string at the given caret offset,
 * padding with single spaces only when needed so the token doesn't fuse into
 * adjacent words. Returns the new string and the caret offset positioned after
 * the inserted token.
 */
export function insertBindingToken(
  value: string,
  path: string,
  caret: number,
): CaretInsertion {
  const safeCaret = clamp(caret, 0, value.length);
  const before = value.slice(0, safeCaret);
  const after = value.slice(safeCaret);

  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);

  const lead = needsLeadingSpace ? " " : "";
  const trail = needsTrailingSpace ? " " : "";
  const token = `${lead}{{${path}}}${trail}`;

  return {
    value: `${before}${token}${after}`,
    caret: safeCaret + lead.length + path.length + 4,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return max;
  }

  return Math.max(min, Math.min(max, value));
}
