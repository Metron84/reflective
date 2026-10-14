/** Colour helpers for the league reveal. WCAG 2.x contrast, no dependencies. */

export const CREAM = "#F2EDE4";
export const NAVY = "#0A111F";
export const AA_TEXT = 4.5;
export const AA_GRAPHIC = 3;

function parse(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function luminance(hex) {
  const rgb = parse(hex) || parse(NAVY);
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `a` toward `b` by t (0 to 1). */
export function mix(a, b, t) {
  const x = parse(a) || parse(NAVY);
  const y = parse(b) || parse(NAVY);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

function bestText(bg) {
  return contrast(bg, CREAM) >= contrast(bg, NAVY) ? CREAM : NAVY;
}

/**
 * Club colour in, AA-safe palette out. The background keeps the club's hue and is
 * nudged lighter or darker only as far as needed for 4.5:1 text. The accent is a
 * tint of the text colour over the background that holds 3:1 against it.
 *
 * @param {string|null|undefined} clubColour
 * @returns {{primary: string, secondary: string, text: string}}
 */
export function leaguePalette(clubColour) {
  let primary = parse(clubColour) ? toHex(parse(clubColour)) : NAVY;
  let text = bestText(primary);
  for (let i = 0; i < 40 && contrast(primary, text) < AA_TEXT; i += 1) {
    primary = mix(primary, text === CREAM ? "#000000" : "#FFFFFF", 0.05);
    text = bestText(primary);
  }
  let secondary = text;
  for (let t = 0.35; t <= 1.001; t += 0.05) {
    secondary = mix(primary, text, t);
    if (contrast(secondary, primary) >= AA_GRAPHIC) break;
  }
  return { primary, secondary, text };
}
