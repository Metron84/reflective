import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/deliverables");
const baseUrl = process.env.TRF_BASE_URL ?? "http://localhost:4343";

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: "dark" });

  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1280, height: 900 });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1200);
  await desktop.screenshot({
    path: path.join(outDir, "doors-hub-desktop.png"),
  });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 380, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({
    path: path.join(outDir, "doors-hub-mobile-380.png"),
  });

  await browser.close();
  console.log("Doors hub deliverables saved.");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
