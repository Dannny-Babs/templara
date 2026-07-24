/**
 * Capture remaining User Guide screenshots from a running Studio (`pnpm studio`).
 * Usage: node scripts/capture-user-guide.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.argv[2] ?? "http://localhost:5173/";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "apps/docs/public/user-guide");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20_000);

async function shot(name, clip) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, clip, animations: "disabled" });
  console.log("wrote", name);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Open Invoice project if on dashboard
  const invoiceCard = page.getByText(/Invoice/i).first();
  if (await invoiceCard.isVisible().catch(() => false)) {
    await invoiceCard.click();
    await page.waitForTimeout(1200);
  }

  // Data panel
  const dataHeader = page.getByText(/^Data$/).first();
  if (await dataHeader.isVisible().catch(() => false)) {
    const box = await dataHeader.boundingBox();
    if (box) {
      await shot("data-panel.png", {
        x: Math.max(0, box.x - 16),
        y: Math.max(0, box.y - 8),
        width: 340,
        height: Math.min(520, 900 - box.y),
      });
    }
  }

  // Layers panel
  const layersHeader = page.getByText(/^Layers$/).first();
  if (await layersHeader.isVisible().catch(() => false)) {
    const layerRow = page.locator("aside").first().locator("div[role='button'], button").nth(2);
    await layerRow.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const box = await layersHeader.boundingBox();
    if (box) {
      await shot("layers-panel.png", {
        x: Math.max(0, box.x - 16),
        y: Math.max(0, box.y - 8),
        width: 340,
        height: Math.min(420, 900 - box.y),
      });
    }
  }

  // Inspector (right panel) after selection
  const inspector = page.locator("aside").last();
  const inspectorBox = await inspector.boundingBox();
  if (inspectorBox) {
    await shot("inspector-text.png", {
      x: inspectorBox.x,
      y: inspectorBox.y,
      width: inspectorBox.width,
      height: Math.min(560, inspectorBox.height),
    });
  }

  // Zoom dock
  const zoom = page.getByText(/%/).first();
  if (await zoom.isVisible().catch(() => false)) {
    await zoom.click().catch(() => undefined);
    await page.waitForTimeout(300);
    const box = await zoom.boundingBox();
    if (box) {
      await shot("zoom-dock.png", {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 160),
        width: 220,
        height: 220,
      });
    }
  }

  // Diagnostics
  const diagnosticsBtn = page.getByRole("button", { name: /diagnostic/i }).first();
  if (await diagnosticsBtn.isVisible().catch(() => false)) {
    await diagnosticsBtn.click();
    await page.waitForTimeout(500);
    await shot("diagnostics-dock.png", {
      x: 40,
      y: 520,
      width: 720,
      height: 340,
    });
  }

  // Text tool
  const textTool = page.getByTitle(/Text/i).first();
  if (await textTool.isVisible().catch(() => false)) {
    await textTool.click();
    await page.waitForTimeout(200);
    await shot("text-tool.png", {
      x: 0,
      y: 48,
      width: 80,
      height: 420,
    });
  }

  // Binding: click a data field if present
  const bindCandidate = page.getByText(/invoice\.|business\.|total/i).first();
  if (await bindCandidate.isVisible().catch(() => false)) {
    const box = await bindCandidate.boundingBox();
    if (box) {
      await shot("binding-field.png", {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 80),
        width: 360,
        height: 280,
      });
    }
  }

  // Editor overview refresh (full shell)
  await shot("editor-overview-wave7.png", undefined);

  // Preview open for side-by-side later
  const preview = page.getByRole("button", { name: /Preview/i }).first();
  if (await preview.isVisible().catch(() => false)) {
    await preview.click();
    await page.waitForTimeout(200);
    const sample = page.getByText(/sample data/i).first();
    if (await sample.isVisible().catch(() => false)) {
      await sample.click();
      await page.waitForTimeout(800);
      await shot("preview-overlay.png", undefined);
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
