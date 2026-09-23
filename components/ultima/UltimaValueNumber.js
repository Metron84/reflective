import styles from "./ultima.module.css";

export function percentileInList(value, values = []) {
  const n = Number(value);
  const nums = (values ?? [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);
  if (!Number.isFinite(n) || !nums.length) return null;
  const rank = nums.filter((item) => item <= n).length;
  return rank / nums.length;
}

export function valueScaleTone(value, percentile) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "empty";
  if (percentile == null || Number.isNaN(Number(percentile))) return "mid";
  const p = Number(percentile);
  if (p >= 2 / 3) return "high";
  if (p <= 1 / 3) return "low";
  return "mid";
}

export default function UltimaValueNumber({ value, percentile, digits = 1 }) {
  const tone = valueScaleTone(value, percentile);
  const className =
    tone === "high"
      ? styles.opValueHigh
      : tone === "low"
        ? styles.opValueLow
        : tone === "empty"
          ? styles.opValueEmpty
          : styles.opValueMid;

  if (tone === "empty") {
    return <span className={className}>-</span>;
  }

  const n = Number(value);
  const text = Number.isInteger(digits)
    ? n.toFixed(digits)
    : String(n);

  return <span className={className}>{text}</span>;
}
