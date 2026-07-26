import ViewsTickerBand from "@/components/ViewsTickerBand";
import SectionContinue from "@/components/SectionContinue";
import FilmsHero from "@/components/films/FilmsHero";
import FilmsHeroPicks from "@/components/films/FilmsHeroPicks";
import FilmsWatchWays from "@/components/films/FilmsWatchWays";
import { getFilmsTabFilms, getShortsFilms } from "@/lib/films";
import { SAMPLE_STORY, youtubeWatchUrl } from "@/lib/films/schema";
import { getViewCounterPayload } from "@/lib/stats/views";
import { SITE_URL } from "@/lib/config";

export const metadata = {
  title: "Films",
  description:
    "We connect the football fan community. Fan-first football films from Dubai.",
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
  // Keep ItemList JSON-LD even though the visible archive grid is parked.
  const structuredData = filmsStructuredData(
    [...filmsTabFilms, ...shortsFilms].filter((f) => f.youtube_id).slice(0, 100)
  );

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <FilmsHero
        youtubeViews={tickerPayload.youtubeViews}
        watchHours={tickerPayload.watchHours}
      />
      <ViewsTickerBand payload={tickerPayload} />
      <FilmsHeroPicks />
      {/* FilmsArchive parked: code kept under components/films/FilmsArchive* */}
      <FilmsWatchWays />

      <SectionContinue
        nextHref="/reflections"
        nextEyebrow="Awards. For the Fans."
        nextTitle="The Reflectives"
      />
    </div>
  );
}
