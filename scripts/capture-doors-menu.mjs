import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public/deliverables");
const framesDir = path.join(outDir, "_hover-frames");
const baseUrl = process.env.TRF_BASE_URL ?? "http://localhost:4343";

async function capture() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: "dark" });

  // Desktop
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1280, height: 900 });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1200);
  await desktop.screenshot({
    path: path.join(outDir, "doors-menu-desktop.png"),
    fullPage: false,
  });

  // Mobile 380px
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 380, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({
    path: path.join(outDir, "doors-menu-mobile-380.png"),
    fullPage: false,
  });

  // Hover GIF on Awards row
  const hover = await context.newPage();
  await hover.setViewportSize({ width: 1280, height: 900 });
  await hover.goto(baseUrl, { waitUntil: "networkidle" });
  await hover.waitForTimeout(800);

  const awards = hover.locator("#tree-door-awards");
  const box = await awards.boundingBox();
  if (!box) throw new Error("Awards row not found");

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  for (let i = 0; i < 12; i += 1) {
    if (i === 4) {
      await hover.mouse.move(cx, cy);
    }
    await hover.waitForTimeout(i === 4 ? 250 : 80);
    await hover.screenshot({
      path: path.join(framesDir, `frame-${String(i).padStart(3, "0")}.png`),
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 60),
        width: Math.min(1280, box.width + 80),
        height: box.height + 120,
      },
    });
  }

  await browser.close();

  try {
    execSync(
      `ffmpeg -y -framerate 10 -i "${framesDir}/frame-%03d.png" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${path.join(outDir, "doors-menu-hover-awards.gif")}"`,
      { stdio: "pipe" }
    );
    await rm(framesDir, { recursive: true, force: true });
  } catch {
    console.warn("ffmpeg not available; hover frames kept in _hover-frames");
  }

  console.log("Saved deliverables to public/deliverables/");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
