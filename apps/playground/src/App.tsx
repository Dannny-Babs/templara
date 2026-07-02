import { useMemo, useState } from "react";
import { DocumentPreview } from "@templara/react-renderer";
import { renderDocument } from "@templara/renderer";
import { shipmentBolSampleData, shipmentBolTemplate } from "@templara/templates";

const fontOptions = shipmentBolTemplate.fonts ?? [];

export function App() {
  const [selectedFontFamily, setSelectedFontFamily] = useState(fontOptions[0]?.family ?? "Geist");
  const rendered = useMemo(
    () =>
      renderDocument({
        template: shipmentBolTemplate,
        data: shipmentBolSampleData,
        mode: "preview",
        fonts: fontOptions,
        fontFamily: selectedFontFamily
      }),
    [selectedFontFamily]
  );
  const generatedCodeCount = rendered.pages.reduce(
    (count, page) => count + page.children.filter((node) => node.type === "barcode" || node.type === "qr").length,
    0
  );

  return (
    <div className="playground">
      <header className="topbar">
        <div className="brand">
          <strong>Templara</strong>
          <span>Shipment BOL renderer</span>
        </div>
        <label className="font-picker">
          <span>Font</span>
          <select value={selectedFontFamily} onChange={(event) => setSelectedFontFamily(event.target.value)}>
            {fontOptions.map((font) => (
              <option key={font.id} value={font.family}>
                {font.family}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className="workspace">
        <section className="preview-shell">
          <DocumentPreview document={rendered} showDebug />
        </section>
        <aside className="debug-panel">
          <h2>Render Debug</h2>
          <dl>
            <div>
              <dt>Pages</dt>
              <dd>{rendered.pages.length}</dd>
            </div>
            <div>
              <dt>Warnings</dt>
              <dd>{rendered.warnings.length}</dd>
            </div>
            <div>
              <dt>Font</dt>
              <dd>{rendered.selectedFontFamily}</dd>
            </div>
            <div>
              <dt>Codes</dt>
              <dd>{generatedCodeCount}</dd>
            </div>
          </dl>
          <h3>Repeat Fit</h3>
          <ul>
            {rendered.repeatAnalyses.map((analysis) => (
              <li key={analysis.id}>
                <strong>{analysis.bindingPath}</strong>
                <span>
                  {analysis.rowsFitOnStartPage} of {analysis.itemCount} fit in the first available space.
                </span>
                <span>
                  Available: {Math.round(analysis.spaceLeftOnStartPage)}px. Used:{" "}
                  {Math.round(analysis.usedSpaceOnStartPage)}px. Remaining:{" "}
                  {Math.max(0, Math.round(analysis.remainingSpaceOnStartPage))}px.
                </span>
                <span>
                  Fill: {Math.round(analysis.startPageUtilization * 100)}%. Avg row:{" "}
                  {Math.round(analysis.averageRowHeight)}px. Estimated pages: {analysis.estimatedTotalPages}.
                </span>
                <span>
                  Row height: {analysis.fixedRowHeight.toFixed(1)}px {"->"} {analysis.plannedRowHeight.toFixed(1)}px.
                  {analysis.compacted
                    ? ` Gained ${analysis.additionalRowsFitOnStartPage} first-page row.`
                    : analysis.filledStartPage
                      ? " Filled the first-page space."
                      : " No compaction applied."}
                </span>
                <span>
                  Overflow items: {analysis.overflowItemCount}. Continuation capacity:{" "}
                  {analysis.continuationPageCapacity} rows/page.
                </span>
              </li>
            ))}
          </ul>
          <h3>Warnings</h3>
          <ul>
            {rendered.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <strong>{warning.code}</strong>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
