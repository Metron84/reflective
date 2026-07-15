import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/deliverables");

const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/players_seed.json"), "utf8")
);
const villa = seed.players.find((p) => p.person_id === "6127985dc429" && p.category === "la_liga");
const yamal = seed.players.find((p) => p.person_id === "0540dd5857b4");

function clubChips(guessedClubs, answerClubs) {
  return guessedClubs.map((club) => ({
    name: club,
    status: answerClubs.includes(club) ? "correct" : "wrong",
  }));
}

function abbreviateClub(name) {
  if (name === "Atletico Madrid") return "Atlético";
  if (name.length <= 10) return name;
  return name.split(/\s+/)[0];
}

const chips = clubChips(villa.clubs, yamal.clubs);

const CHIP_STYLE = {
  correct: "background:#059669;color:#fff;border:1px solid transparent",
  wrong: "background:#060b14;color:rgba(242,237,228,.6);border:1px solid rgba(242,237,228,.1)",
};

function chipHtml(chip) {
  return `<button type="button" style="font-size:9px;font-weight:600;padding:2px 3px;border-radius:2px;${CHIP_STYLE[chip.status]}">${abbreviateClub(chip.name)}</button>`;
}

function boardHtml() {
  const clubCell = `<div style="min-width:0"><div style="aspect-ratio:4/5;min-height:48px;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:2px;background:#060b14;border:1px solid rgba(242,237,228,.1);border-radius:2px;padding:2px">${chips.map(chipHtml).join("")}</div></div>`;
  const other = [
    ["Spain", "#059669", "#fff"],
    ["La Liga", "#059669", "#fff"],
    clubCell,
    ["FW", "#059669", "#fff"],
    ["1981", "#060b14", "rgba(242,237,228,.6)"],
    ["7", "#060b14", "rgba(242,237,228,.6)"],
  ];

  const cells = other
    .map((item) => {
      if (typeof item === "string") return item;
      const [value, bg, color] = item;
      return `<div style="min-width:0"><div style="aspect-ratio:4/5;min-height:48px;display:flex;align-items:center;justify-content:center;background:${bg};color:${color};border:1px solid rgba(242,237,228,.1);border-radius:2px;font-size:9px;font-weight:600;padding:2px">${value}</div></div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;background:#0a111f;color:#f2ede4;font-family:system-ui,sans-serif}
    .wrap{max-width:720px;margin:0 auto;padding:24px 12px}
    .board{background:#0a111f;border:1px solid rgba(242,237,228,.15);padding:16px}
    .headers,.row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:2px}
    .headers p{font-size:8px;text-transform:uppercase;color:rgba(242,237,228,.5);text-align:center;margin:0 0 4px}
    .name{font-size:12px;font-weight:600;margin:0 0 6px}
  </style></head><body><div class="wrap"><div class="board">
    <div class="headers">${["Nat", "Lge", "Club", "Pos", "Born", "Shirt"].map((h) => `<p>${h}</p>`).join("")}</div>
    <p class="name">David Villa</p>
    <div class="row">${cells}</div>
  </div></div></body></html>`;
}

async function capture() {
  const browser = await chromium.launch();
  const html = boardHtml();

  for (const [name, width, height] of [
    ["guesser-club-chips-desktop", 1280, 400],
    ["guesser-club-chips-mobile-380", 380, 360],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(html, { waitUntil: "load" });
    await page.locator(".board").screenshot({
      path: path.join(outDir, `${name}.png`),
    });
    await page.close();
  }

  await browser.close();
  console.log("Club chip deliverables saved.");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
