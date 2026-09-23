"use client";

export default function UltimaLocalTime({ value, className, format = "full" }) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const text =
    format === "weekdayTime"
      ? d.toLocaleString("en-GB", {
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : d.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
  return (
    <time className={className} dateTime={d.toISOString()}>
      {text}
    </time>
  );
}
