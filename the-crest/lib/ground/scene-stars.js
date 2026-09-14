import { hashSlug } from "../color-utils.js";

/**
 * @param {string} slug
 * @returns {{ cx: number; cy: number; r: number; o: number }[]}
 */
export function starsForClub(slug) {
  let seed = hashSlug(slug || "stars");
  const stars = [];
  const horizon = 280;
  for (let i = 0; i < 30; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const cx = (seed % 39000) / 100;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const cy = (seed % Math.floor(horizon * 100)) / 100;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const r = 0.6 + (seed % 120) / 100;
    const fade = 1 - cy / horizon;
    const o = 0.15 + fade * 0.55;
    stars.push({ cx, cy, r, o });
  }
  return stars;
}

/**
 * @param {string} slug
 * @returns {{ d: string; fill: string }[]}
 */
export function crowdShapesForClub(slug, primary) {
  let seed = hashSlug(`${slug}-crowd`);
  const baseY = 633;
  const shapes = [];
  for (let i = 0; i < 90; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = (i / 89) * 410 - 10 + ((seed % 200) - 100) / 40;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const h = 14 + (seed % 220) / 10;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const w = 10 + (seed % 80) / 10;
    const tinted = seed % 100 < 15;
    const shoulderY = baseY + (844 - baseY) * 0.52;
    const headY = shoulderY - h * 0.55;
    const headR = w * 0.38;
    const body = `M ${x - w / 2} ${844} L ${x - w / 2} ${shoulderY} Q ${x} ${shoulderY - h * 0.35} ${x + w / 2} ${shoulderY} L ${x + w / 2} ${844} Z`;
    const head = `M ${x - headR} ${headY} a ${headR} ${headR} 0 1 0 ${headR * 2} 0 a ${headR} ${headR} 0 1 0 ${-headR * 2} 0`;
    shapes.push({ d: `${body} ${head}`, fill: tinted ? primary : "#0a0c10" });
  }
  return shapes;
}
