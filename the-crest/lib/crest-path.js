/**
 * SVG path d for the crest polygon (280 viewBox).
 * @param {number[]} scores length 12
 */
export function crestPathD(scores) {
  const cx = 140;
  const cy = 140;
  const rMin = 26;
  const rMax = 118;
  const pts = scores.map((s, i) => {
    const ang = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r = rMin + ((s - 1) / 6) * (rMax - rMin);
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  });
  return (
    pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
    " Z"
  );
}
