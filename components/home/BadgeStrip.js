/** Slow marquee of monochrome badges. Rendered only when BADGES_ENABLED. */
export default function BadgeStrip({ badges }) {
  if (!badges?.length) return null;
  const loop = [...badges, ...badges];

  return (
    <section
      aria-label="Supporters clubs we have filmed"
      className="overflow-hidden border-b border-navy/10 bg-paper py-6"
    >
      <ul className="badge-marquee flex w-max items-center gap-12 px-6">
        {loop.map((src, index) => (
          <li key={`${src}-${index}`} aria-hidden={index >= badges.length}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              className="h-10 w-auto opacity-60 brightness-0 grayscale"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
