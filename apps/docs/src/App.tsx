import type { ReactNode } from "react";

function Code({ children }: { children: string }): ReactNode {
  return (
    <pre className="docs-code">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactNode {
  return (
    <section id={id} className="docs-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function App() {
  return (
    <main className="docs">
      <header className="docs-header">
        <h1>Templara</h1>
        <p className="docs-lede">
          A browser-native document runtime and visual authoring platform. Design once, bind to
          structured data, and render deterministic business documents.
        </p>
      </header>

      <nav className="docs-toc">
        <a href="#packages">Packages</a>
        <a href="#install">Install</a>
        <a href="#editor">Embed the editor</a>
        <a href="#render">Render-only service</a>
        <a href="#api">Public API</a>
        <a href="#template">Template JSON</a>
        <a href="#validation">Validation &amp; migration</a>
      </nav>

      <Section id="packages" title="Packages">
        <p>Templara is a small set of composable packages with strict boundaries.</p>
        <ul>
          <li>
            <code>@templara/core</code> — the document language: schema, node types, bindings,
            variables, structured expressions, validation, and migrations.
          </li>
          <li>
            <code>@templara/renderer</code> — deterministic, side-effect-free planning: resolves
            data, evaluates logic, expands repeats, and paginates into a render tree.
          </li>
          <li>
            <code>@templara/react-renderer</code> — renders the render tree in the browser
            (<code>DocumentPreview</code>). This is the export source.
          </li>
          <li>
            <code>@templara/editor</code> — the Figma-like authoring surface
            (<code>DocumentEditor</code>).
          </li>
          <li>
            <code>@templara/pdf</code> — browser-first PDF export and pre-flight diagnostics.
          </li>
          <li>
            <code>@templara/templates</code> — ready-made invoice, BOL, receipt, pay stub, and
            shipping-label templates with sample data.
          </li>
        </ul>
      </Section>

      <Section id="install" title="Install">
        <Code>{`pnpm add @templara/core @templara/renderer @templara/react-renderer
# add the editor only if you embed authoring
pnpm add @templara/editor`}</Code>
      </Section>

      <Section id="editor" title="Embed the editor">
        <p>
          <code>DocumentEditor</code> is a controlled React component. Pass a template as{" "}
          <code>value</code> and sample <code>data</code>, and listen for changes.
        </p>
        <Code>{`import { DocumentEditor } from "@templara/editor";
import { invoiceTemplate, invoiceSampleData } from "@templara/templates";
import type { DocumentTemplate } from "@templara/core";

export function Studio() {
  const [template, setTemplate] = useState<DocumentTemplate>(invoiceTemplate);
  const [data, setData] = useState(invoiceSampleData);

  return (
    <DocumentEditor
      value={template}
      data={data}
      onChange={setTemplate}
      onDataChange={setData}
    />
  );
}`}</Code>
        <p className="docs-note">
          The editor renders the authored structure (nodes, handlebars, and a single repeat row) —
          it never expands repeats or resolves data. That is the renderer&apos;s job.
        </p>
      </Section>

      <Section id="render" title="Render-only service">
        <p>
          No editor required to produce documents. Render a template with data anywhere React runs
          — including a server-rendered export service.
        </p>
        <Code>{`import { renderDocument } from "@templara/renderer";
import { DocumentPreview } from "@templara/react-renderer";
import { invoiceTemplate, invoiceSampleData } from "@templara/templates";

const result = renderDocument({
  template: invoiceTemplate,
  data: invoiceSampleData,
});

// result.pages       -> paginated render tree
// result.warnings     -> actionable layout / data diagnostics
// result.repeatAnalyses -> per-repeat pagination metrics

export function Preview() {
  return <DocumentPreview document={result} />;
}`}</Code>
      </Section>

      <Section id="api" title="Public API">
        <Code>{`renderDocument({ template, data, mode?, fontFamily? }): RenderDocumentResult
validateTemplate(template): ValidationResult
migrateTemplate(template): MigrationResult

<DocumentEditor value data onChange onDataChange />
<DocumentPreview document />`}</Code>
        <p>
          <code>renderDocument</code> is deterministic: the same template and data always produce
          the same render tree. It never mutates its inputs and performs no I/O.
        </p>
      </Section>

      <Section id="template" title="Template JSON">
        <p>
          A template is plain JSON and is the single source of truth. Pages hold layers; layers hold
          nodes; nodes carry a <code>frame</code> plus type-specific content.
        </p>
        <Code>{`{
  "id": "invoice",
  "version": "0.0.1",
  "unit": "px",
  "pages": [
    {
      "id": "page-1",
      "size": { "width": 816, "height": 1056 },
      "layers": [
        {
          "id": "flow",
          "kind": "flow",
          "nodes": [
            {
              "id": "items",
              "type": "repeat",
              "binding": { "path": "invoice.items" },
              "itemAlias": "item",
              "frame": { "x": 0, "y": 0, "width": 688, "height": 30 },
              "layout": { "direction": "vertical", "gap": 0, "repeatHeaderOnPageBreak": true },
              "header": [ /* static header row, repeated on continuation pages */ ],
              "children": [ /* one row template, bound to item.* */ ]
            }
          ]
        }
      ]
    }
  ]
}`}</Code>
        <p className="docs-note">
          Runtime logic uses structured expressions and formulas only. Templates never contain
          executable JavaScript, and data is always treated as data — never HTML.
        </p>
      </Section>

      <Section id="validation" title="Validation & migration">
        <p>
          Validate a template before persisting or rendering, and migrate older templates up to the
          current schema version.
        </p>
        <Code>{`import { validateTemplate, migrateTemplate, CURRENT_TEMPLATE_VERSION } from "@templara/core";

const migrated = migrateTemplate(loadedTemplate).template;
const report = validateTemplate(migrated);

if (!report.valid) {
  console.warn("Template issues", report.issues);
}`}</Code>
      </Section>
    </main>
  );
}
