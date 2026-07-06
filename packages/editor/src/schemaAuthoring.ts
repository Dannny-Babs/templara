import type { DataField, DataSchema } from "@templara/core";

export function inferDataSchemaFromSample(
  data: Record<string, unknown>,
): DataSchema {
  return {
    fields: Object.entries(data).map(([key, value]) =>
      inferDataField(key, value, key),
    ),
  };
}

function inferDataField(label: string, value: unknown, path: string): DataField {
  if (Array.isArray(value)) {
    const sample = value.find((entry) => entry != null);
    return {
      path,
      label: titleCase(label),
      kind: "array",
      children:
        sample && typeof sample === "object" && !Array.isArray(sample)
          ? Object.entries(sample as Record<string, unknown>).map(([key, child]) =>
              inferDataField(key, child, `${path}.${key}`),
            )
          : undefined,
    };
  }

  if (value && typeof value === "object") {
    return {
      path,
      label: titleCase(label),
      kind: "object",
      children: Object.entries(value as Record<string, unknown>).map(
        ([key, child]) => inferDataField(key, child, `${path}.${key}`),
      ),
    };
  }

  return {
    path,
    label: titleCase(label),
    kind: inferDataKind(value),
  };
}

function inferDataKind(value: unknown): DataField["kind"] {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value !== "string") return "unknown";
  if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(value)) return "image";
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value)) return "date";
  return "string";
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
