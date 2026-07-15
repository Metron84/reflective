import ViewCounter from "@/components/home/ViewCounter";
import { formatNumber } from "@/lib/stats/format";

/** Rolling view counter band — permanent home on /films. */
export default function ViewsTickerBand({ payload }) {
  const { combinedViews, watchHours, anchorAt, viewsPerMinute } = payload;

  return (
    <section
      aria-label="Viewership since May 1st"
      className="w-full border-y border-navy/10 bg-navy px-6 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-display text-2xl leading-snug text-paper sm:text-4xl md:text-5xl">
          Since May 1st,{" "}
          <ViewCounter
            combinedViews={combinedViews}
            anchorAt={anchorAt}
            viewsPerMinute={viewsPerMinute}
          />{" "}
          views of The Reflective Football.
        </p>
        <p className="mt-8 text-base text-paper/70 sm:text-lg">
          Total watch hours on YouTube:{" "}
          <span className="font-medium text-paper">{formatNumber(watchHours)}</span>
          .
        </p>
      </div>
    </section>
  );
}
