import { crestPathD } from "./crest-path.js";

const W = 1080;
const H = 1920;
const CREAM = "#F2EDE4";
const NAVY = "#0A111F";
const RED = "#D8232A";

async function loadFont(family, url) {
  if (typeof document === "undefined") return;
  try {
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    document.fonts.add(face);
  } catch {
    /* fallback families used in draw */
  }
}

/**
 * @param {number[]} scores
 * @param {string} archetypeName
 * @param {string} primaryClubName
 */
export async function renderShareCardPng(scores, archetypeName, primaryClubName) {
  await Promise.all([
    loadFont("Bodoni Moda", "/crest/fonts/bodoni-latin-400-normal.woff2"),
    loadFont("Archivo", "/crest/fonts/archivo-latin-500-normal.woff2"),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  const crestSize = 520;
  const crestX = (W - crestSize) / 2;
  const crestY = 200;
  ctx.save();
  ctx.translate(crestX, crestY);
  ctx.scale(crestSize / 280, crestSize / 280);
  drawCrest(ctx, scores);
  ctx.restore();

  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";

  ctx.font = '600 56px "Bodoni Moda", Georgia, serif';
  wrapText(ctx, archetypeName, W / 2, 820, W - 120, 64);

  ctx.font = '500 40px "Archivo", system-ui, sans-serif';
  ctx.fillText(primaryClubName, W / 2, 980);

  ctx.font = '500 28px "Archivo", system-ui, sans-serif';
  ctx.fillStyle = "#2A3547";
  ctx.fillText("thereflectivefootball.com", W / 2, H - 120);

  ctx.font = '500 24px "Archivo", system-ui, sans-serif';
  ctx.fillText("The Crest", W / 2, H - 80);

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
function drawCrest(ctx, scores) {
  const cx = 140;
  const cy = 140;
  const rMin = 26;
  const rMax = 118;
  const path = new Path2D(crestPathD(scores));

  ctx.strokeStyle = "#DED3C2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, rMax, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, (rMax + rMin) / 2, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const ang = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r = rMin + ((scores[i] - 1) / 6) * (rMax - rMin);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    ctx.strokeStyle = "rgba(10, 17, 31, 0.18)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(10, 17, 31, 0.9)";
  ctx.fill(path);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
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
