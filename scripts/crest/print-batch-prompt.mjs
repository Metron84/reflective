#!/usr/bin/env node
/**
 * Prints the full Step 2 scoring prompt with batch clubs substituted.
 *
 * Usage: node scripts/crest/print-batch-prompt.mjs 001
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const batchArg = process.argv[2];
if (!batchArg) {
  console.error("Usage: node scripts/crest/print-batch-prompt.mjs <batch-number, e.g. 001>");
  process.exit(1);
}

const num = batchArg.padStart(3, "0");
const batchFile = path.join(ROOT, "data/tier-b/batches", `${num}.json`);
const anchorsFile = path.join(ROOT, "data/tier-b/codebook-and-anchors.md");

if (!fs.existsSync(batchFile)) {
  console.error(`Batch file not found: ${batchFile}. Run prepare-tier-b-batches.mjs first.`);
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
const clubList = batch
  .map(
    (c) =>
      `- ${c.common_name} (slug: ${c.slug}, ${c.city || "city TBD"}, ${c.country || "country TBD"}, founded ${c.founded || "unknown"}) [${c.competition}]`,
  )
  .join("\n");

const anchors = fs.existsSync(anchorsFile)
  ? fs.readFileSync(anchorsFile, "utf8")
  : "[[ WARNING: data/tier-b/codebook-and-anchors.md not found — paste Part 1 from docs/crest-club-database-brief.md manually. ]]";

const prompt = `${anchors}

You are scoring football clubs on a locked twelve dimension codebook. These are
lower-profile clubs, so the evidence base is thinner than for major clubs. Score
them honestly rather than confidently.

RULES
1. Score enduring cultural identity. Ignore the current season, manager, owner and
   league position entirely.
2. Treat 4 as the default. Move off 4 only where there is a documented reason.
   A club with no distinctive identity on a dimension should score 4, and most of
   these clubs will score 4 on most dimensions.
3. Confidence is capped at 2 for every score in this tier. Use 1 wherever the
   evidence is a single passing mention or an inference from the club's situation.
4. Do not invent supporter culture. If you cannot find evidence that a club has a
   distinctive ritual, rivalry or political character, that absence is data.
5. Divisional status is not an identity. Being in a second division does not make
   a club a suffering underdog, an outsider or a local institution. Score the club,
   not the league it is currently in.
6. Exclusion clubs: list the club's genuine derby rivals as slugs, lowercase and
   hyphenated. Use the working slugs from the batch list where rivals appear there.
   If there is no notable rivalry, return an empty array.

OUTPUT
Valid JSON only. One object per club. Copy slug, name, common_name, city, country,
founded, and competition from the batch list into each object:

{
  "slug": "",
  "name": "",
  "common_name": "",
  "city": "",
  "country": "",
  "founded": 0,
  "competition": "",
  "cluster": "",
  "vector": [0,0,0,0,0,0,0,0,0,0,0,0],
  "confidence": [0,0,0,0,0,0,0,0,0,0,0,0],
  "identity_summary": "",
  "exclusion_clubs": [],
  "vector_version": "1.1",
  "research_status": "draft",
  "source_quality_notes": ""
}

vector order is fixed: H1 H2 H3 H4 M1 M2 M3 M4 S1 S2 S3 S4.
identity_summary is one sentence, maximum 25 words, written for someone who has
never heard of this club.
cluster groups clubs that should not all appear in one result together. Use the
form country-region, for example italy-north, england-midlands, france-south.

CLUBS IN THIS BATCH (batch ${num}, ${batch.length} clubs)
${clubList}
`;

console.log(prompt);
