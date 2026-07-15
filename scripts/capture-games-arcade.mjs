import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/deliverables");
const baseUrl = process.env.TRF_BASE_URL ?? "http://localhost:4343";

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: "light" });

  // Games page desktop
  const gamesDesktop = await context.newPage();
  await gamesDesktop.setViewportSize({ width: 1280, height: 900 });
  await gamesDesktop.goto(`${baseUrl}/games`, { waitUntil: "networkidle" });
  await gamesDesktop.waitForTimeout(800);
  await gamesDesktop.screenshot({
    path: path.join(outDir, "games-arcade-desktop.png"),
  });

  // Games page mobile
  const gamesMobile = await context.newPage();
  await gamesMobile.setViewportSize({ width: 380, height: 844 });
  await gamesMobile.goto(`${baseUrl}/games`, { waitUntil: "networkidle" });
  await gamesMobile.waitForTimeout(800);
  await gamesMobile.screenshot({
    path: path.join(outDir, "games-arcade-mobile-380.png"),
  });

  // Nav desktop (home with header)
  const navDesktop = await context.newPage();
  await navDesktop.setViewportSize({ width: 1280, height: 200 });
  await navDesktop.goto(baseUrl, { waitUntil: "networkidle" });
  await navDesktop.waitForTimeout(500);
  await navDesktop.locator("header").screenshot({
    path: path.join(outDir, "nav-desktop-games.png"),
  });

  // Nav mobile menu open
  const navMobile = await context.newPage();
  await navMobile.setViewportSize({ width: 380, height: 844 });
  await navMobile.goto(baseUrl, { waitUntil: "networkidle" });
  await navMobile.getByRole("button", { name: "Open menu" }).click();
  await navMobile.waitForTimeout(400);
  await navMobile.screenshot({
    path: path.join(outDir, "nav-mobile-games-380.png"),
  });

  await browser.close();
  console.log("Games deliverables saved.");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
