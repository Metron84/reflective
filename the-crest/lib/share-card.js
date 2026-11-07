import {
  CREST_CX,
  CREST_CY,
  CREST_R_MAX,
  CREST_R_MIN,
  crestSpokeTips,
} from "./crest-path.js";

const W = 1080;
const H = 1920;
const CREAM = "#F2EDE4";
const NAVY = "#0A111F";
const RED = "#D8232A";
const MARGIN_X = 80;
const MARGIN_TOP = 120;
const MARGIN_BOTTOM = 100;

async function loadFont(family, url, weight = "400") {
  if (typeof document === "undefined") return;
  try {
    const face = new FontFace(family, `url(${url})`, { weight });
    await face.load();
    document.fonts.add(face);
  } catch {
    /* fallback families used in draw */
  }
}

/**
 * Panel share card: crest, archetype, reading, club, reason, domain.
 * No percentage, neighbours, admire, or icons.
 *
 * @param {{
 *   scores: number[];
 *   archetypeName: string;
 *   reading: string;
 *   primaryClubName: string;
 *   reason: string;
 * }} data
 */
export async function renderShareCardPng(data) {
  const {
    scores,
    archetypeName,
    reading,
    primaryClubName,
    reason,
  } = data;

  await Promise.all([
    loadFont("Archivo", "/crest/fonts/archivo-latin-400-normal.woff2", "400"),
    loadFont("Archivo", "/crest/fonts/archivo-latin-500-normal.woff2", "500"),
    loadFont("Archivo", "/crest/fonts/archivo-latin-600-normal.woff2", "600"),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  const crestSize = 640;
  const crestX = (W - crestSize) / 2;
  const crestY = MARGIN_TOP;
  ctx.save();
  ctx.translate(crestX, crestY);
  ctx.scale(crestSize / 280, crestSize / 280);
  drawSpokeCrest(ctx, scores);
  ctx.restore();

  let y = crestY + crestSize + 48;
  const textWidth = W - MARGIN_X * 2;
  ctx.textAlign = "center";
  ctx.fillStyle = NAVY;

  ctx.font = '600 72px "Bodoni Moda", Georgia, "Times New Roman", serif';
  y = wrapText(ctx, archetypeName, W / 2, y, textWidth, 78, 2) + 28;

  ctx.font = '400 28px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = NAVY;
  y = wrapText(ctx, reading, W / 2, y, textWidth, 40, 6) + 36;

  ctx.font = '500 36px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = NAVY;
  y = wrapText(ctx, primaryClubName, W / 2, y, textWidth, 44, 2) + 18;

  if (reason) {
    ctx.font = '400 24px "Archivo", system-ui, sans-serif';
    ctx.fillStyle = "rgba(10, 17, 31, 0.8)";
    wrapText(ctx, reason, W / 2, y, textWidth, 34, 3);
  }

  ctx.font = '400 20px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = "rgba(10, 17, 31, 0.5)";
  ctx.fillText("thereflectivefootball.com", W / 2, H - MARGIN_BOTTOM);

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

/** @param {CanvasRenderingContext2D} ctx */
function drawSpokeCrest(ctx, scores) {
  const tips = crestSpokeTips(scores);

  ctx.strokeStyle = "rgba(10, 17, 31, 0.4)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(CREST_CX, CREST_CY, CREST_R_MAX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CREST_CX, CREST_CY, CREST_R_MIN, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(CREST_CX, CREST_CY, CREST_R_MIN, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 0.75;
  ctx.lineCap = "round";
  for (const [x, y] of tips) {
    ctx.beginPath();
    ctx.moveTo(CREST_CX, CREST_CY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @param {number} [maxLines=8]
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let yy = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
      lines += 1;
      if (lines >= maxLines) return yy;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, yy);
    yy += lineHeight;
  }
  return yy;
}

/**
 * @param {Blob} blob
 * @param {string} archetypeName
 */
export async function shareCrestCard(blob, archetypeName) {
  const file = new File([blob], "the-crest.png", { type: "image/png" });
  const text = `${archetypeName}. My football crest from The Reflective Football.`;

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: "The Crest",
        text,
        files: [file],
      });
      return "shared";
    } catch {
      /* fall through */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "the-crest.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
