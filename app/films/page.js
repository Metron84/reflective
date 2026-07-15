import { Suspense } from "react";
import SectionHeader from "@/components/SectionHeader";
import ViewsTickerBand from "@/components/ViewsTickerBand";
import SectionContinue from "@/components/SectionContinue";
import FilmsArchive from "@/components/films/FilmsArchive";
import { getGridFilms } from "@/lib/films";
import { getFilterOptions } from "@/lib/films/filters";
import { getViewCounterPayload } from "@/lib/stats/views";

export const metadata = {
  title: "Films",
  description:
    "Fan-first football films from Dubai. Watch the archive on YouTube.",
};

export const dynamic = "force-dynamic";

export default async function FilmsPage() {
  const films = getGridFilms();
  const filterOptions = getFilterOptions(films);
  const tickerPayload = await getViewCounterPayload();

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10">
        <SectionHeader
          eyebrow="Films. From the Fans."
          title="Films"
        />
      </div>

      <ViewsTickerBand payload={tickerPayload} />

      <Suspense fallback={<FilmsArchiveFallback count={films.length} />}>
        <FilmsArchive films={films} filterOptions={filterOptions} />
      </Suspense>

      <SectionContinue
        nextHref="/reflections"
        nextEyebrow="Awards. For the Fans."
        nextTitle="The Reflections"
      />
    </div>
  );
}

function FilmsArchiveFallback({ count }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-navy/50">
      Loading {count} films…
    </div>
  );
}
