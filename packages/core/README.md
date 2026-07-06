# @templara/core

Core schema, validation, migration, logic, and shared document types.

Use this package anywhere templates are stored, loaded, imported, or sent across package boundaries.

## Validate And Migrate

```ts
import { migrateTemplate, validateTemplate } from "@templara/core";
import type { DocumentTemplate } from "@templara/core";

export function loadTemplate(input: DocumentTemplate): DocumentTemplate {
  const migration = migrateTemplate(input);

  if (migration.warnings.length > 0) {
    console.warn(migration.warnings);
  }

  const validation = validateTemplate(migration.template);

  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.message).join("\n"));
  }

  return migration.template;
}
```

## Includes

- `DocumentTemplate` and node schema types.
- Page presets.
- Binding, formula, and expression types.
- Template validation.
- Template migration scaffolding.
- Logic description/evaluation helpers.
