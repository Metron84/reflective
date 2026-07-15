import Link from "next/link";
import { youtubeThumbnailUrl } from "@/lib/films/youtube";

export default function FilmCard({ film }) {
  const thumb = youtubeThumbnailUrl(film.youtube_id);
  const href = film.slug ? `/films/${film.slug}` : "/films";

  return (
    <Link
      href={href}
      className="film-card group relative block overflow-hidden bg-navy-deep shadow-[0_12px_40px_rgba(10,17,31,0.18)] transition-transform duration-300 active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <div className="relative aspect-video overflow-hidden bg-navy">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] group-hover:brightness-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:brightness-100"
          />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-br from-navy to-navy-deep transition duration-500 group-hover:brightness-110 motion-reduce:transition-none"
            aria-hidden
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy via-navy/55 to-navy/10"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3 className="font-display text-lg leading-snug text-paper sm:text-xl">
            {film.title}
          </h3>
          {film.club ? (
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-paper/45">
              {film.club}
            </p>
          ) : null}
          {film.context ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-paper/55">
              {film.context}
            </p>
          ) : null}
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.28em] text-signal">
            Watch
          </p>
        </div>
      </div>
    </Link>
  );
}
