import { Suspense } from "react";
import SectionHeader from "@/components/SectionHeader";
import ViewsTickerBand from "@/components/ViewsTickerBand";
import SectionContinue from "@/components/SectionContinue";
import FilmsArchive from "@/components/films/FilmsArchive";
import { getFilmsTabFilms, getShortsFilms } from "@/lib/films";
import { SAMPLE_STORY, youtubeWatchUrl } from "@/lib/films/schema";
import { getViewCounterPayload } from "@/lib/stats/views";
import { SITE_URL } from "@/lib/config";

export const metadata = {
  title: "Films",
  description:
    "Fan-first football films from Dubai. Watch the archive on YouTube.",
};

export const dynamic = "force-dynamic";

function filmsStructuredData(films) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "The Reflective Football films",
    url: `${SITE_URL}/films`,
    itemListElement: films.map((film, index) => {
      const video = {
        "@type": "VideoObject",
        name: film.title,
        url: youtubeWatchUrl(film.youtube_id),
        embedUrl: `https://www.youtube.com/embed/${film.youtube_id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${film.youtube_id}/hqdefault.jpg`,
      };
      if (film.published_at) video.uploadDate = film.published_at;
      if (film.duration) video.duration = film.duration;
      if (film.story && film.story !== SAMPLE_STORY) {
        video.description = film.story;
      }
      return { "@type": "ListItem", position: index + 1, item: video };
    }),
  };
}

export default async function FilmsPage() {
  const filmsTabFilms = getFilmsTabFilms();
  const shortsFilms = getShortsFilms();
  const tickerPayload = await getViewCounterPayload();
  const structuredData = filmsStructuredData(
    [...filmsTabFilms, ...shortsFilms].filter((f) => f.youtube_id).slice(0, 100)
  );

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10">
        <SectionHeader
          eyebrow="Films. From the Fans."
          title="Films"
        />
      </div>

      <ViewsTickerBand payload={tickerPayload} />

      <Suspense
        fallback={
          <FilmsArchiveFallback
            filmsCount={filmsTabFilms.length}
            shortsCount={shortsFilms.length}
          />
        }
      >
        <FilmsArchive
          filmsTabFilms={filmsTabFilms}
          shortsFilms={shortsFilms}
        />
      </Suspense>

      <SectionContinue
        nextHref="/reflections"
        nextEyebrow="Awards. For the Fans."
        nextTitle="The Reflections"
      />
    </div>
  );
}

function FilmsArchiveFallback({ filmsCount, shortsCount }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-navy/50">
      Loading archive ({filmsCount} films, {shortsCount} shorts)…
    </div>
  );
}
