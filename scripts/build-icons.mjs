/**
 * Compose each subdomain icon from artwork already on the site, then export the PNGs.
 * Run: npm run icons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const NAVY = "#0A111F";
const CHARCOAL = "#12151C";
const CREAM = "#F2EDE4";

function readPublic(rel) {
  return fs.readFileSync(path.join(pub, rel), "utf8");
}

function svgInner(markup) {
  return markup.replace(/^[\s\S]*?<svg\b[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
}

function frame({ bg, viewBox, body }) {
  const box = 308;
  const origin = (512 - box) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <svg x="${origin}" y="${origin}" width="${box}" height="${box}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
    ${body}
  </svg>
</svg>
`;
}

function lineIcon(paths) {
  return frame({
    bg: NAVY,
    viewBox: "0 0 28 28",
    body: `<g fill="none" stroke="${CREAM}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
  });
}

const play = svgInner(readPublic("games/are-you-really-a-fan.svg"));
const playWheel = play.slice(play.indexOf('<circle cx="800" cy="470" r="344"'));

const ultima = svgInner(readPublic("games/ultima.svg"));
const crest = svgInner(readPublic("games/the-crest.svg"));

const guesser = readPublic("games/the-guesser.svg");
const guesserStart = guesser.indexOf('<g transform="translate(84');
const guesserEnd = guesser.indexOf('<path fill="#F2EDE4" d="M122.32');
const guesserMark = guesser.slice(guesserStart, guesserEnd);

const code = svgInner(readPublic("codemaster/codemaster-card.svg")).replace(
  /<text\b[^>]*>[\s\S]*?<\/text>/g,
  "",
);

const library = svgInner(readPublic("observatory/library.svg"));
const watch = svgInner(readPublic("games/watch-with.svg"));

/** @type {Record<string, { bg: string, svg: string, source: string }>} */
const ICONS = {
  play: {
    source: "public/games/are-you-really-a-fan.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "430 50 740 800", body: playWheel }),
  },
  ultima: {
    source: "public/games/ultima.svg",
    bg: CHARCOAL,
    svg: frame({ bg: CHARCOAL, viewBox: "660 150 280 640", body: ultima }),
  },
  codemaster: {
    source: "public/codemaster/codemaster-card.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "55 85 300 270", body: code }),
  },
  guesser: {
    source: "public/games/the-guesser.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "350 60 500 520", body: guesserMark }),
  },
  crest: {
    source: "public/games/the-crest.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "590 220 420 580", body: crest }),
  },
  concierge: {
    source: "components/home/DoorIcons.js (IconConcierge)",
    bg: NAVY,
    svg: lineIcon(`
      <circle cx="14" cy="14" r="9"/>
      <circle cx="14" cy="14" r="1.4" fill="${CREAM}" stroke="none"/>
      <path d="M14 5.5v3.2"/>
      <path d="M14 19.3v3.2"/>
      <path d="M5.5 14h3.2"/>
      <path d="M19.3 14h3.2"/>
      <path d="M14 14l5.2-3.4"/>
    `),
  },
  compete: {
    source: "components/home/DoorIcons.js (IconAwards)",
    bg: NAVY,
    svg: lineIcon(`
      <path d="M14 4c-3.2 0-5.5 2.4-5.5 5.2 0 2.2 1.2 4 3 5.1L10 22h8l-1.5-7.7c1.8-1.1 3-2.9 3-5.1C19.5 6.4 17.2 4 14 4z"/>
      <path d="M10 22h8"/>
      <path d="M11.5 24.5h5"/>
    `),
  },
  observatory: {
    source: "public/observatory/library.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "800 310 360 380", body: library }),
  },
  watchwith: {
    source: "public/games/watch-with.svg",
    bg: NAVY,
    svg: frame({ bg: NAVY, viewBox: "530 150 600 700", body: watch }),
  },
};

async function raster(svg, size, { bg, scale = 1, opaque = false }) {
  const inner = Math.round(size * scale);
  const drawn = await sharp(Buffer.from(svg)).resize(inner, inner).png().toBuffer();
  let image = sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  }).composite([{ input: drawn, gravity: "centre" }]);
  if (opaque) image = image.flatten({ background: bg }).removeAlpha();
  return image.png().toBuffer();
}

for (const [key, icon] of Object.entries(ICONS)) {
  const dir = path.join(pub, "icons", key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "icon.svg"), icon.svg);
  fs.writeFileSync(path.join(dir, "icon-192.png"), await raster(icon.svg, 192, { bg: icon.bg }));
  fs.writeFileSync(path.join(dir, "icon-512.png"), await raster(icon.svg, 512, { bg: icon.bg }));
  fs.writeFileSync(
    path.join(dir, "maskable-512.png"),
    await raster(icon.svg, 512, { bg: icon.bg, scale: 0.8 }),
  );
  fs.writeFileSync(
    path.join(dir, "apple-touch-icon.png"),
    await raster(icon.svg, 180, { bg: icon.bg, opaque: true }),
  );
  console.log(`${key} <- ${icon.source}`);
}
