import ViewCounter from "@/components/home/ViewCounter";
import { formatNumber } from "@/lib/stats/format";

/** Rolling view counter band — permanent home on /films, under the hero. */
export default function ViewsTickerBand({ payload }) {
  const {
    combinedViews,
    watchHours,
    impressions,
    anchorAt,
    viewsPerMinute,
  } = payload;

  return (
    <section
      aria-label="Viewership since May 1st"
      className="w-full border-y border-navy/10 bg-navy px-6 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-paper/55">
          Since May 1st
        </p>
        <p className="mt-3 font-display text-3xl leading-snug text-paper sm:text-5xl md:text-6xl">
          <ViewCounter
            combinedViews={combinedViews}
            anchorAt={anchorAt}
            viewsPerMinute={viewsPerMinute}
          />
        </p>
        <p className="mt-2 text-sm text-paper/65 sm:text-base">
          views across YouTube and Instagram
        </p>

        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-paper/60 sm:flex-row sm:justify-center sm:gap-8">
          <p>
            <span className="font-medium text-paper">
              {formatNumber(watchHours)}
            </span>{" "}
            hours of full episodes watched
          </p>
          {impressions != null ? (
            <p>
              <span className="font-medium text-paper">
                {formatNumber(impressions)}
              </span>{" "}
              YouTube impressions
            </p>
          ) : null}
        </div>

        <p className="mt-5 text-xs tracking-wide text-paper/45">
          AED 0 spent on promotion
        </p>
      </div>
    </section>
  );
}
