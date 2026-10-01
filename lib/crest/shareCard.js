/**
 * The Crest share card. Draws a 1080x1920 story image of the result on a
 * canvas and hands it to the native share sheet, or downloads it.
 * Browser only. No React.
 */

import { SITE_URL } from "@/lib/config";

const W = 1080;
const H = 1920;
const NAVY = "#0a111f";
const CREAM = "#f2ede4";
const MUTED = "rgba(242, 237, 228, 0.62)";
const RED = "#d8232a";

/**
 * Font family strings from the next/font CSS variables, with safe fallbacks.
 */
function fonts() {
  const host = document.querySelector("[data-crest-play]") || document.documentElement;
  const css = getComputedStyle(host);
  const head = css.getPropertyValue("--font-crest-head").trim() || "Montserrat, Arial, sans-serif";
  const body = css.getPropertyValue("--font-archivo").trim() || "Archivo, Arial, sans-serif";
  return { head, body };
}

/** Dark text on light club colours, cream text on dark ones. */
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return CREAM;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? NAVY : CREAM;
}

/** Wrap text to a width, shrinking the size until it fits in maxLines. */
function fitLines(ctx, text, font, size, minSize, maxWidth, maxLines) {
  let s = size;
  for (; s >= minSize; s -= 4) {
    ctx.font = font(s);
    const lines = wrap(ctx, text, maxWidth);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (lines.length <= maxLines && fits) return { lines, size: s };
  }
  ctx.font = font(minSize);
  return { lines: wrap(ctx, text, maxWidth).slice(0, maxLines), size: minSize };
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Arrival kicker for the card and the reveal.
 *
 * @param {number} roomPct
 * @param {boolean} confident
 */
export function shareKicker(roomPct, confident) {
  return roomPct < 80 ? "Closest match" : confident ? "Your club" : "You sit between two";
}

/**
 * @param {{
 *   clubName: string,
 *   clubColor?: string|null,
 *   place?: string,
 *   roomPct: number,
 *   kicker: string,
 *   traits: string[],
 *   rub?: {you: string, them: string}|null,
 * }} data
 * @returns {Promise<Blob>}
 */
export async function renderShareCard(data) {
  if (document.fonts?.ready) await document.fonts.ready;
  const { head, body } = fonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pad = 96;
  const club = data.clubColor || RED;
  const ink = inkOn(club);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#142038");
  sky.addColorStop(0.55, NAVY);
  sky.addColorStop(1, "#060b14");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = MUTED;
  ctx.font = `700 34px ${head}`;
  ctx.fillText("The Crest", pad, pad + 30);
  ctx.textAlign = "right";
  ctx.font = `500 30px ${body}`;
  ctx.fillText("Eighteen swipes. One club.", W - pad, pad + 30);
  ctx.textAlign = "left";

  ctx.fillStyle = CREAM;
  ctx.font = `700 44px ${head}`;
  ctx.fillText(data.kicker, pad, 560);

  const bandTop = 610;
  const name = fitLines(ctx, data.clubName, (s) => `700 ${s}px ${head}`, 150, 64, W - pad * 2, 3);
  const lineH = name.size * 1.02;
  const bandH = 60 + name.lines.length * lineH + 150;
  ctx.fillStyle = club;
  roundRect(ctx, pad - 32, bandTop, W - (pad - 32) * 2, bandH, 36);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = `700 ${name.size}px ${head}`;
  name.lines.forEach((l, i) => ctx.fillText(l, pad, bandTop + 40 + name.size * 0.9 + i * lineH));
  ctx.font = `500 38px ${body}`;
  ctx.globalAlpha = 0.85;
  if (data.place) ctx.fillText(data.place, pad, bandTop + 40 + name.lines.length * lineH + 60);
  ctx.globalAlpha = 1;
  ctx.font = `700 46px ${head}`;
  ctx.fillText(`${data.roomPct}% of the last room`, pad, bandTop + bandH - 44);

  let y = bandTop + bandH + 140;
  ctx.fillStyle = MUTED;
  ctx.font = `700 32px ${head}`;
  ctx.fillText("Where we meet", pad, y);
  y += 30;
  for (const t of data.traits.slice(0, 2)) {
    const block = fitLines(ctx, `You're ${t}.`, (s) => `600 ${s}px ${body}`, 58, 42, W - pad * 2, 2);
    ctx.fillStyle = CREAM;
    ctx.font = `600 ${block.size}px ${body}`;
    for (const l of block.lines) {
      y += block.size * 1.2;
      ctx.fillText(l, pad, y);
    }
    y += 26;
  }

  if (data.rub) {
    y += 90;
    ctx.fillStyle = MUTED;
    ctx.font = `700 32px ${head}`;
    ctx.fillText("The rub", pad, y);
    y += 10;
    const rub = fitLines(
      ctx,
      `Me: ${data.rub.you}. Them: ${data.rub.them}.`,
      (s) => `500 ${s}px ${body}`,
      44,
      34,
      W - pad * 2,
      3,
    );
    ctx.fillStyle = CREAM;
    ctx.font = `500 ${rub.size}px ${body}`;
    for (const l of rub.lines) {
      y += rub.size * 1.25;
      ctx.fillText(l, pad, y);
    }
  }

  ctx.fillStyle = "rgba(242, 237, 228, 0.14)";
  ctx.fillRect(pad, H - 250, W - pad * 2, 2);
  ctx.fillStyle = CREAM;
  ctx.font = `700 46px ${head}`;
  ctx.fillText("Find yours", pad, H - 170);
  ctx.fillStyle = MUTED;
  ctx.font = `500 36px ${body}`;
  ctx.fillText(`${SITE_URL.replace(/^https?:\/\//, "")}/crest`, pad, H - 118);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the card."))), "image/png"),
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Share the card as an image where the device allows it, else download it
 * and copy the link.
 *
 * @param {Blob} blob
 * @param {string} clubName
 * @returns {Promise<"shared"|"saved"|"cancelled">}
 */
export async function shareCard(blob, clubName) {
  const slug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = new File([blob], `my-crest-${slug}.png`, { type: "image/png" });
  const url = `${SITE_URL}/crest`;
  const text = `My Crest is ${clubName}. Find yours:`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `My Crest: ${clubName}`, text: `${text} ${url}` });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 4000);
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* ignore */
  }
  return "saved";
}

/**
 * Card data from an arrivalSummary result.
 *
 * @param {ReturnType<typeof import("./engine.js").arrivalSummary>} summary
 * @param {number} roomPct
 * @param {string} kicker
 */
export function cardDataFrom(summary, roomPct, kicker) {
  const { club, greenFlags, rub } = summary;
  return {
    clubName: club.name,
    clubColor: club.color,
    place: [club.city, club.country].filter(Boolean).join(", "),
    roomPct,
    kicker,
    traits: greenFlags.map((f) => f.userPhrase).filter((p) => p && p !== "both"),
    rub: rub ? { you: bothText(rub.userPhrase), them: bothText(rub.clubPhrase) } : null,
  };
}

/** "both" reads badly in a sentence. */
export function bothText(phrase) {
  return phrase === "both" ? "a bit of both" : phrase;
}
