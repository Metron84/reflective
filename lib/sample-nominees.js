import {
  REFLECTIONS_CATEGORIES,
  getOpenCategorySlugs,
} from "./config";

// SAMPLE placeholders for open categories only when DB and seed file are empty.
export const SAMPLE_NOMINEES = getOpenCategorySlugs().flatMap((slug) =>
  [1, 2, 3, 4].map((n) => ({
    id: `sample-${slug}-${n}`,
    category: slug,
    title: `SAMPLE Nominee ${n}`,
    youtube_id: null,
    clip_url: null,
    context_line: "SAMPLE context line. Real nominee data replaces this.",
    sort: n,
  }))
);
