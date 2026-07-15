import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/deliverables");
const baseUrl = process.env.TRF_BASE_URL ?? "http://localhost:4343";

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: "light" });

  for (const [name, width] of [
    ["auth-signin-desktop", 1280],
    ["auth-signin-mobile-380", 380],
  ]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width === 380 ? 844 : 900 });
    await page.goto(`${baseUrl}/signin`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(outDir, `${name}.png`),
      fullPage: false,
    });
    await page.close();
  }

  const welcomeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;background:#f2ede4;color:#0a111f;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
    .card{max-width:32rem;border:1px solid rgba(10,17,31,.1);background:#f2ede4;padding:2rem;text-align:center;box-shadow:0 12px 40px rgba(10,17,31,.08)}
    h1{font-size:2rem;line-height:1.15;margin:0}
    p{margin:1rem 0 0;font-family:system-ui,sans-serif;color:rgba(10,17,31,.8)}
    .btn{display:inline-block;margin-top:2rem;background:#d8232a;color:#f2ede4;padding:.75rem 2rem;border-radius:9999px;text-decoration:none;font-family:system-ui,sans-serif;font-size:.875rem;letter-spacing:.08em;text-transform:uppercase}
  </style></head><body><div class="card"><h1>Welcome to The Reflective Football, Melo.</h1><p>You're Member #0042.</p><a class="btn" href="#">Continue</a></div></body></html>`;

  for (const [name, width] of [
    ["auth-welcome-complete-desktop", 1280],
    ["auth-welcome-complete-mobile-380", 380],
  ]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width === 380 ? 844 : 900 });
    await page.setContent(welcomeHtml);
    await page.screenshot({
      path: path.join(outDir, `${name}.png`),
      fullPage: false,
    });
    await page.close();
  }

  await browser.close();
  console.log("Auth flow deliverables saved.");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
