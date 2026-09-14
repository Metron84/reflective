import { groundSceneSvgForClub } from "./ground-scene-svg.js";
import { resolveClubGround } from "./club-ground-meta.js";
import { describeMatchClub } from "./tier.js";

const W = 1080;
const H = 1920;
const CREAM = "#F2EDE4";
const NAVY = "#0A111F";
const INK = "#2A3547";
const TAGLINE = "Football is nothing without the fans.";
const SITE = "thereflectivefootball.com";

async function loadFont(family, url) {
  if (typeof document === "undefined") return;
  try {
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    document.fonts.add(face);
  } catch {
    /* system fallback */
  }
}

/**
 * @param {string} svgString
 * @returns {Promise<HTMLImageElement>}
 */
function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise scene"));
    };
    img.src = url;
  });
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement | null>}
 */
function loadImageOptional(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** @param {CanvasRenderingContext2D} ctx */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

/**
 * @param {object | null} club
 * @returns {Promise<Blob>}
 */
export async function renderArrivalSharePng(club) {
  await Promise.all([
    loadFont("Bodoni Moda", "/crest/fonts/bodoni-latin-400-normal.woff2"),
    loadFont("Bodoni Moda", "/crest/fonts/bodoni-latin-600-italic.woff2"),
    loadFont("Archivo", "/crest/fonts/archivo-latin-500-normal.woff2"),
    loadFont("Archivo", "/crest/fonts/archivo-latin-400-normal.woff2"),
  ]);
  await document.fonts.ready;

  const ground = resolveClubGround(club || {});
  const displayName = club ? describeMatchClub(club) : "Your club";
  const svgString = groundSceneSvgForClub(club);

  const [sceneImg, badgeImg] = await Promise.all([
    svgToImage(svgString),
    loadImageOptional(club?.badge_url || null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  const scale = Math.max(W / 390, H / 844);
  const drawW = 390 * scale;
  const drawH = 844 * scale;
  const dx = (W - drawW) / 2;
  const dy = 0;
  ctx.drawImage(sceneImg, dx, dy, drawW, drawH);

  const textTop = H * 0.58;
  const grad = ctx.createLinearGradient(0, textTop - 80, 0, H);
  grad.addColorStop(0, "rgba(10, 17, 31, 0)");
  grad.addColorStop(0.35, "rgba(10, 17, 31, 0.82)");
  grad.addColorStop(1, "rgba(10, 17, 31, 0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, textTop - 100, W, H - textTop + 100);

  if (badgeImg) {
    const badgeSize = 140;
    ctx.drawImage(badgeImg, (W - badgeSize) / 2, textTop - 20, badgeSize, badgeSize);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = CREAM;

  let y = badgeImg ? textTop + 150 : textTop + 40;
  ctx.font = '600 72px "Bodoni Moda", Georgia, serif';
  y = wrapText(ctx, displayName, W / 2, y, W - 100, 78) + 36;

  ctx.font = '400 40px "Bodoni Moda", Georgia, serif';
  ctx.fillText(`Welcome to ${ground.city}`, W / 2, y);
  y += 52;

  ctx.font = '500 28px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = "rgb(242 237 228 / 0.85)";
  ctx.fillText(ground.stadiumName, W / 2, y);
  y += 72;

  ctx.font = '400 34px "Bodoni Moda", Georgia, serif';
  ctx.fillStyle = CREAM;
  y = wrapText(ctx, TAGLINE, W / 2, y, W - 120, 42) + 48;

  ctx.font = '500 30px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = CREAM;
  ctx.fillText(SITE, W / 2, H - 88);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create share image"));
      },
      "image/png",
      1,
    );
  });
}

/**
 * @param {Blob} blob
 * @param {string} clubName
 * @returns {Promise<"shared" | "downloaded">}
 */
export async function shareArrivalCard(blob, clubName) {
  const safeName = clubName.replace(/[^\w\s-]/g, "").trim() || "club";
  const file = new File([blob], `the-crest-${safeName}.png`, {
    type: "image/png",
  });

  if (typeof navigator !== "undefined" && navigator.share) {
    const payload = {
      title: "The Crest",
      text: `${clubName}. ${TAGLINE}`,
      files: [file],
    };
    try {
      const can =
        typeof navigator.canShare === "function"
          ? navigator.canShare(payload)
          : true;
      if (can) {
        await navigator.share(payload);
        return "shared";
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        throw err;
      }
    }
  }

  downloadBlob(blob, file.name);
  return "downloaded";
}

/** @param {Blob} blob @param {string} filename */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Share with download fallback on any failure (incl. iOS share quirks).
 * @param {object | null} club
 */
export async function shareArrivalFromClub(club) {
  const displayName = club ? describeMatchClub(club) : "Your club";
  const blob = await renderArrivalSharePng(club);
  try {
    return await shareArrivalCard(blob, displayName);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    downloadBlob(blob, `the-crest-arrival.png`);
    return "downloaded";
  }
}
