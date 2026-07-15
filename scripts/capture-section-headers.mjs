import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/deliverables");
const baseUrl = process.env.TRF_BASE_URL ?? "http://localhost:4343";

const PAGES = [
  { slug: "films", path: "/films" },
  { slug: "games", path: "/games" },
  { slug: "reflections", path: "/reflections" },
];

async function captureComposite(viewport, filename) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const images = [];

  for (const entry of PAGES) {
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}${entry.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const header = page.locator("[data-section-header]");
    await header.waitFor({ state: "visible" });
    const png = await header.screenshot();
    images.push({ slug: entry.slug, b64: png.toString("base64") });
    await page.close();
  }

  const composite = await context.newPage();
  const width = viewport.width;
  const isMobile = width <= 480;
  await composite.setViewportSize({
    width,
    height: isMobile ? 2400 : 520,
  });
  await composite.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 16px;
            background: #e8e3da;
            font-family: sans-serif;
          }
          .row {
            display: flex;
            gap: 16px;
            align-items: flex-start;
            justify-content: center;
            flex-wrap: ${isMobile ? "wrap" : "nowrap"};
          }
          figure {
            margin: 0;
            flex: ${isMobile ? "1 1 100%" : "1 1 0"};
            min-width: 0;
          }
          figcaption {
            display: none;
          }
          img {
            display: block;
            width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <div class="row">
          ${images
            .map(
              ({ slug, b64 }) => `
            <figure>
              <img src="data:image/png;base64,${b64}" alt="${slug} header" />
            </figure>`
            )
            .join("")}
        </div>
      </body>
    </html>
  `);
  await composite.waitForTimeout(200);
  await composite.locator(".row").screenshot({
    path: path.join(outDir, filename),
  });

  await browser.close();
  console.log(`Saved ${filename}`);
}

await captureComposite({ width: 1280, height: 900 }, "section-headers-desktop.png");
await captureComposite({ width: 380, height: 844 }, "section-headers-mobile-380.png");
