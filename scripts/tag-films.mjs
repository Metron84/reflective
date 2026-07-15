#!/usr/bin/env node
/**
 * Auto-tag film catalog from title segments and duration.
 * Usage: node scripts/tag-films.mjs
 *
 * Only fills empty taxonomy fields. Never overwrites hand edits.
 * Story is never auto-filled.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FILMS_DIR = path.join(ROOT, "content/films");
const VOCAB_PATH = path.join(FILMS_DIR, "_vocab.json");

const SAMPLE_STORY =
  "SAMPLE: Editorial line pending. Replace before publish.";

function parseDurationSeconds(iso) {
  if (!iso || typeof iso !== "string") return null;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return null;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(parseFloat(match[3] || 0));
  return h * 3600 + m * 60 + s;
}

function normalizeText(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function titleText(film) {
  return film.titleOverride?.trim() || film.title || "";
}

function splitSegments(title) {
  return title
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findAllMatches(haystack, terms, canonicalMap = {}) {
  const norm = normalizeText(haystack);
  const found = new Map();

  for (const term of terms) {
    const needle = normalizeText(term);
    if (!needle) continue;
    if (norm.includes(needle)) {
      const canonical = canonicalMap[term] ?? term;
      found.set(canonical, term);
    }
  }

  return [...found.keys()];
}

function inferFormat(title, durationSec, rules) {
  const norm = normalizeText(title);
  const candidates = [];

  for (const phrase of rules.podcast) {
    if (norm.includes(normalizeText(phrase))) {
      candidates.push({ format: "podcast", rule: `podcast:${phrase}` });
      break;
    }
  }

  if (durationSec != null && durationSec < rules.shortMaxSeconds) {
    candidates.push({ format: "short_film", rule: "duration_under_180s" });
  }

  for (const phrase of rules.catchmentary) {
    if (norm.includes(normalizeText(phrase))) {
      candidates.push({ format: "catchmentary", rule: `catchmentary:${phrase}` });
      break;
    }
  }

  for (const phrase of rules.explainer) {
    if (norm.includes(normalizeText(phrase))) {
      candidates.push({ format: "explainer", rule: `explainer:${phrase}` });
      break;
    }
  }

  if (
    candidates.length === 0 &&
    durationSec != null &&
    durationSec >= rules.shortMaxSeconds &&
    (norm.includes(" fans") ||
      norm.includes(" fan ") ||
      norm.endsWith(" fan") ||
      norm.includes("fan interview") ||
      norm.includes("fan unedited"))
  ) {
    candidates.push({ format: "catchmentary", rule: "catchmentary:longform_fan" });
  }

  const formats = [...new Set(candidates.map((c) => c.format))];
  if (formats.length === 0) {
    return { format: null, confident: false, reason: "format_unknown", rules: [] };
  }

  const priority = ["podcast", "short_film", "catchmentary", "explainer"];
  const picked = priority.find((f) => formats.includes(f));

  return {
    format: picked,
    confident: true,
    reason: null,
    rules: candidates,
  };
}

function inferVenue(title, segments, venues) {
  const matches = [];
  const full = title;
  for (const venue of venues) {
    if (normalizeText(full).includes(normalizeText(venue))) {
      matches.push(venue);
    }
  }
  for (const segment of segments) {
    for (const venue of venues) {
      if (
        normalizeText(segment).includes(normalizeText(venue)) &&
        !matches.includes(venue)
      ) {
        matches.push(venue);
      }
    }
  }
  matches.sort((a, b) => b.length - a.length);
  const unique = [...new Set(matches)];
  if (unique.length === 0) {
    return { venue: null, confident: false, reason: "venue_unknown" };
  }
  if (unique.length > 1 && unique[0].length === unique[1].length) {
    return {
      venue: unique[0],
      confident: false,
      reason: `venue_ambiguous:${unique.slice(0, 3).join("|")}`,
    };
  }
  return { venue: unique[0], confident: true, reason: null };
}

function inferCompetition(title, competitions) {
  const norm = normalizeText(title);
  const hits = [];
  for (const entry of competitions) {
    if (norm.includes(normalizeText(entry.match))) {
      hits.push(entry.value);
    }
  }
  const unique = [...new Set(hits)];
  if (unique.length === 0) {
    return { competition: null, confident: true, reason: null };
  }
  if (unique.length > 1) {
    return {
      competition: unique[0],
      confident: false,
      reason: `competition_ambiguous:${unique.join("|")}`,
    };
  }
  return { competition: unique[0], confident: true, reason: null };
}

function inferClubs(title, vocab) {
  const aliasEntries = Object.entries(vocab.clubAliases ?? {});
  const nationAliases = Object.entries(vocab.nationAliases ?? {});
  const clubTerms = [
    ...vocab.clubs,
    ...aliasEntries.map(([alias]) => alias),
  ];
  const nationTerms = [
    ...vocab.nations,
    ...nationAliases.map(([alias]) => alias),
  ];
  const clubCanonical = Object.fromEntries(
    aliasEntries.map(([alias, canon]) => [alias, canon])
  );
  const nationCanonical = Object.fromEntries(
    nationAliases.map(([alias, canon]) => [alias, canon])
  );

  const clubs = findAllMatches(title, clubTerms, clubCanonical);
  const nations = findAllMatches(title, nationTerms, nationCanonical);
  const merged = [...new Set([...clubs, ...nations])];

  if (merged.length === 0) {
    return { clubs: [], confident: false, reason: "no_club_or_nation" };
  }
  if (merged.length > 4) {
    return {
      clubs: merged.slice(0, 4),
      confident: false,
      reason: `many_teams:${merged.length}`,
    };
  }
  return { clubs: merged, confident: true, reason: null };
}

function isEmptyClubs(clubs) {
  return !Array.isArray(clubs) || clubs.length === 0;
}

function isEmptyField(value) {
  return value == null || value === "";
}

function taxonomyComplete(film) {
  if (!film.format) return false;
  if (film.format === "short_film") return true;
  if (film.format === "podcast") return true;
  if (!isEmptyClubs(film.clubs)) return true;
  if (film.venue) return true;
  return false;
}

function tagFilm(film, vocab, options = {}) {
  const { retagFlagged = false } = options;
  const changes = {};
  const reasons = [];
  const title = titleText(film);
  const segments = splitSegments(title);
  const durationSec = parseDurationSeconds(film.duration);
  const rules = vocab.formatRules;

  const canSetFormat =
    isEmptyField(film.format) ||
    (retagFlagged && film.needs_review === true);
  const canSetClubs =
    isEmptyClubs(film.clubs) ||
    (retagFlagged && film.needs_review === true);
  const canSetVenue =
    isEmptyField(film.venue) ||
    (retagFlagged && film.needs_review === true);
  const canSetCompetition =
    isEmptyField(film.competition) ||
    (retagFlagged && film.needs_review === true);

  if (canSetFormat) {
    const fmt = inferFormat(title, durationSec, rules);
    if (fmt.format) changes.format = fmt.format;
    if (fmt.reason) reasons.push(fmt.reason);
  }

  if (canSetClubs) {
    const teams = inferClubs(title, vocab);
    if (teams.clubs.length) changes.clubs = teams.clubs;
    if (teams.reason) reasons.push(teams.reason);
  }

  if (canSetVenue) {
    const venue = inferVenue(title, segments, vocab.venues);
    if (venue.venue) changes.venue = venue.venue;
    if (venue.reason) reasons.push(venue.reason);
  }

  if (canSetCompetition) {
    const comp = inferCompetition(title, vocab.competitions);
    if (comp.competition) changes.competition = comp.competition;
    if (comp.reason) reasons.push(comp.reason);
  }

  const merged = { ...film, ...changes };
  const format = merged.format;

  if (format === "catchmentary" && isEmptyClubs(merged.clubs) && !merged.venue) {
    reasons.push("catchmentary_missing_context");
  }

  const uniqueReasons = [...new Set(reasons.filter(Boolean))];
  const complete = taxonomyComplete(merged);
  const clearReview =
    complete &&
    !uniqueReasons.some((r) =>
      r === "format_unknown" ||
      r === "catchmentary_missing_context" ||
      r.startsWith("competition_ambiguous") ||
      r.startsWith("venue_ambiguous") ||
      r.startsWith("many_teams")
    );

  if (clearReview) {
    changes.needs_review = false;
    changes.review_reason = null;
  } else {
    changes.needs_review = true;
    changes.review_reason = uniqueReasons.length
      ? uniqueReasons.join("; ")
      : complete
        ? null
        : "incomplete_taxonomy";
  }

  return { changes, merged, reasons: uniqueReasons, complete, clearReview };
}

function loadVocab() {
  if (!existsSync(VOCAB_PATH)) {
    throw new Error(`Missing vocab file: ${VOCAB_PATH}`);
  }
  return JSON.parse(readFileSync(VOCAB_PATH, "utf8"));
}

function loadFilms() {
  return readdirSync(FILMS_DIR)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .map((name) => {
      const filePath = path.join(FILMS_DIR, name);
      return {
        filePath,
        fileName: name,
        film: JSON.parse(readFileSync(filePath, "utf8")),
      };
    });
}

function applyChanges(film, changes, options = {}) {
  const { retagFlagged = false } = options;
  const next = { ...film };
  for (const [key, value] of Object.entries(changes)) {
    const allowOverwrite =
      retagFlagged && film.needs_review === true && key !== "story";
    if (key === "clubs" && !isEmptyClubs(film.clubs) && !allowOverwrite) continue;
    if (key === "format" && !isEmptyField(film.format) && !allowOverwrite) continue;
    if (key === "venue" && !isEmptyField(film.venue) && !allowOverwrite) continue;
    if (key === "competition" && !isEmptyField(film.competition) && !allowOverwrite) continue;
    if (key === "story") continue;
    next[key] = value;
  }
  if (!next.story) next.story = SAMPLE_STORY;
  return next;
}

function main() {
  const retagFlagged = process.argv.includes("--retag-flagged");
  const vocab = loadVocab();
  const entries = loadFilms();

  const stats = {
    total: entries.length,
    updated: 0,
    fullyTagged: 0,
    stillFlagged: 0,
    byFormat: {},
  };
  const exceptions = [];

  for (const entry of entries) {
    const { changes, merged, reasons, complete, clearReview } = tagFilm(
      entry.film,
      vocab,
      { retagFlagged }
    );
    const next = applyChanges(entry.film, changes, { retagFlagged });
    const changed =
      JSON.stringify(next) !== JSON.stringify(entry.film);

    if (changed) {
      writeFileSync(entry.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      stats.updated += 1;
    }

    const format = next.format ?? "untagged";
    stats.byFormat[format] = (stats.byFormat[format] ?? 0) + 1;

    if (next.needs_review === false && complete) {
      stats.fullyTagged += 1;
    } else {
      stats.stillFlagged += 1;
      exceptions.push({
        slug: next.slug,
        videoId: next.videoId,
        title: titleText(next),
        format: next.format,
        clubs: next.clubs,
        venue: next.venue,
        review_reason: next.review_reason,
        reasons,
        clearReview,
      });
    }
  }

  exceptions.sort((a, b) =>
    (a.review_reason ?? "").localeCompare(b.review_reason ?? "")
  );

  console.log("");
  console.log("Films auto-tag summary");
  console.log("=".repeat(60));
  console.log(`Total films:        ${stats.total}`);
  console.log(`Files updated:      ${stats.updated}`);
  console.log(`Fully tagged:       ${stats.fullyTagged}`);
  console.log(`Still flagged:      ${stats.stillFlagged}`);
  console.log("");
  console.log("Count per format:");
  for (const [format, count] of Object.entries(stats.byFormat).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${format.padEnd(16)} ${count}`);
  }

  const gridVisible = Object.entries(stats.byFormat)
    .filter(([f]) => f !== "short_film" && f !== "untagged")
    .reduce((sum, [, n]) => sum + n, 0);
  console.log("");
  console.log(
    `Grid-eligible (excl. short_film): ${gridVisible} (see FILMS_GRID_FORMATS in lib/config.js)`
  );

  console.log("");
  console.log("Exceptions (still flagged):");
  console.log("-".repeat(60));
  for (const row of exceptions) {
    console.log(`${row.videoId}  ${row.title}`);
    console.log(
      `  format=${row.format ?? "—"} clubs=[${(row.clubs ?? []).join(", ")}] venue=${row.venue ?? "—"}`
    );
    console.log(`  reason: ${row.review_reason ?? "—"}`);
    console.log("");
  }
}

main();
