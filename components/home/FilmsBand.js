import Link from "next/link";
import FilmCard from "@/components/home/FilmCard";
import { getLatestFilms } from "@/lib/films";

export default function FilmsBand() {
  const films = getLatestFilms(3);

  return (
    <section className="border-b border-navy/10 px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.35em] text-navy/45">
          Latest Films
        </p>
        <h2 className="mt-3 font-display text-3xl text-navy sm:text-4xl">
          Stories from the stands
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-4">
          {films.map((film) => (
            <FilmCard key={film.slug} film={film} />
          ))}
        </div>
        <Link
          href="/films"
          className="mt-8 inline-block text-sm font-medium text-navy/70 transition-colors hover:text-navy"
        >
          Browse all films
        </Link>
      </div>
    </section>
  );
}
