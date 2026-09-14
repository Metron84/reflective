/**
 * Recut club vectors from supporter say/do evidence.
 * Does not import integrity rankings. Anchors stay locked.
 *
 *   node scripts/crest/apply-say-do-recalibration.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {Record<string, { vector: number[]; identity: string; notes: string; confidence?: number[] }>} */
const PATCH = {
  "tottenham-hotspur": {
    vector: [3, 4, 3, 3, 4, 4, 5, 4, 4, 3, 3, 4],
    identity:
      "North London ambition. They want to win now, not to be known for almost winning.",
    notes:
      "Recut from heartbreak myth. To Dare Is To Do is glory, not suffering. Levy control and the new ground are enacted modernity. Super League then retreat is establishment appetite.",
  },
  liverpool: {
    vector: [4, 6, 2, 6, 5, 5, 4, 5, 6, 7, 5, 6],
    identity:
      "A city's emotional language, sung before kickoff, and a crowd that will walk out on its own club.",
    notes:
      "H4 moved for documented walkouts and spending pressure. H1 stays 4: they expect to compete, and they also pay a cost. Not an integrity rank.",
  },
  "manchester-united": {
    vector: [4, 5, 1, 5, 4, 4, 5, 4, 3, 6, 4, 5],
    identity:
      "A global club whose match-going people have spent years fighting the owners, not only the table.",
    notes:
      "H1 off 2. The people have been in the wilderness. H4 and S3 move for a long protest record across owners. Still mass belonging. Not a virtue score.",
  },
  "manchester-city": {
    vector: [1, 3, 3, 2, 5, 4, 3, 4, 3, 2, 2, 3],
    identity:
      "A modern project built to win. The crowd chose that project, then argued about tickets.",
    notes:
      "M4 was Pep-era ideology. Codebook ignores current manager. Softened. Ownership exceptionalism is the people, not a reason to hide the club.",
  },
  "newcastle-united": {
    vector: [6, 6, 4, 6, 3, 4, 4, 3, 7, 6, 3, 6],
    identity:
      "One city, one club. The crowd stayed through the dark, then chose the power that ended it.",
    notes:
      "S3 to 3. The takeover surveys are enacted choice, not a sin mark. Local 7 and hardship stay.",
  },
  barcelona: {
    vector: [3, 5, 2, 3, 7, 6, 5, 6, 3, 5, 3, 5],
    identity:
      "A way of playing treated as belief, and a member club that often behaves like a global company.",
    notes:
      "M3 off 7: academy is say, the market is do. S3 off 5: Super League and asset votes are establishment when useful. M1 7 stays as the football idea.",
  },
  "atletico-madrid": {
    vector: [5, 6, 4, 5, 2, 2, 5, 6, 5, 6, 4, 6],
    identity:
      "Built on resistance and effort. The outsider story sits next to a club that now wants scale.",
    notes:
      "S3 off 5. Anti-establishment self-image; enacted commercial growth. Identity stays struggle, not a moral rank.",
  },
  "hull-city": {
    vector: [4, 4, 5, 6, 4, 4, 4, 4, 6, 5, 5, 6],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Hull's people fought the name, the concessions, and the board. The town is not a decoration.",
    notes:
      "Was a blank civic. Trust action, ombudsman ruling, cancelled season ticket. Journey, local, meaning. Not a league rank.",
  },
  "coventry-city": {
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 5, 5, 6],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Coventry's sky-blue people. Years of marches and boycotts to keep the club in the city.",
    notes:
      "S3 and S4 move. Ground exile plus sustained owner protest. Style left at 4.",
  },
  "crystal-palace": {
    vector: [4, 5, 5, 5, 4, 4, 4, 4, 6, 5, 6, 6],
    confidence: [1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "South London noise that will turn on another club's owner and on its own commercial deal.",
    notes:
      "S3 to 6. Holmesdale challenged Newcastle's takeover and Palace's own Socios deal. Not Millwall. Style left at 4.",
  },
  fulham: {
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 6, 5, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "West London by the Thames. The Cottage is heritage, and the crowd will march over prices.",
    notes:
      "S3 to 5. Trust marches after the first protest failed. Still not a cult.",
  },
  "nottingham-forest": {
    vector: [4, 4, 4, 5, 4, 4, 4, 4, 6, 6, 5, 5],
    confidence: [1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "A civic Midlands club. European nights are heritage, and the trust still fights the prices.",
    notes:
      "S3 to 5. Documented survey-to-concession. Clough not scored as ideology.",
  },
  chelsea: {
    vector: [3, 5, 2, 4, 4, 4, 2, 2, 2, 3, 2, 4],
    confidence: [2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1],
    identity:
      "West London people who stay through resets. The institution buys and starts again.",
    notes:
      "H2 and H4 moved for the crowd. Institution stays acquisition and global. Abramovich nostalgia is the split, not a hide-the-club mark. Still flattened vs United and City.",
  },
  valencia: {
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 6, 6, 6],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Mestalla people who stood outside their own ground for years rather than accept the owner.",
    notes:
      "Was civic heritage. Lim-era boycotts, delayed entry, shareholder action. Journey, defiance, meaning. Not a virtue rank.",
  },
  alaves: {
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 4, 6, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 2, 2],
    identity:
      "A Basque civic club that emptied its stands rather than accept Monday football.",
    notes:
      "S3 to 6. Empty-stand scheduling protest is enacted local defiance. Playing idea left at 4.",
  },
  "rc-strasbourg": {
    vector: [4, 4, 5, 6, 4, 4, 4, 4, 7, 6, 6, 6],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Alsace first. They kept the silence and the banners after the new owners started winning.",
    notes:
      "S3 to 6. BlueCo protest through better results. Local 7 already right. Not a ranking.",
  },
  "sc-freiburg": {
    vector: [4, 4, 5, 5, 4, 4, 6, 5, 6, 4, 5, 6],
    confidence: [1, 1, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2],
    identity:
      "A member development club that stood with the league-wide fight against outside investors.",
    notes:
      "S3 to 5. Academy scores stay. Collective anti-investor action, not a unique cult.",
  },
  "mainz-05": {
    vector: [4, 4, 5, 4, 4, 4, 4, 4, 6, 4, 5, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 2],
    identity:
      "Mainz's carnival-city club. Civic, and present in the fight to keep member football.",
    notes:
      "S3 to 5 for documented investor-campaign participation. Still not Union or St Pauli.",
  },
  bologna: {
    vector: [4, 4, 4, 5, 4, 4, 4, 4, 6, 5, 5, 5],
    confidence: [1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Bologna's civic rossoblu. The city comes first, and the curve shows up for the national fights.",
    notes:
      "S3 to 5. Collective away-restriction and affordability action, not a locked idea.",
  },
  fiorentina: {
    vector: [5, 4, 5, 6, 5, 4, 4, 4, 6, 6, 5, 6],
    confidence: [2, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2],
    identity:
      "Florence's purple club. Civic and stubborn, including when the club sells what the city loved.",
    notes:
      "S3 to 5. Challenge over sales is enacted. Personal abuse is not a vector. Style left light.",
  },
};

function words(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function assertPatch(slug, p) {
  if (p.vector.length !== 12) throw new Error(`${slug}: vector length`);
  const extremes = p.vector.filter((v) => v > 6 || v < 2).length;
  if (extremes > 5) throw new Error(`${slug}: ${extremes} extremes`);
  if (words(p.identity) > 25) {
    throw new Error(`${slug}: identity is ${words(p.identity)} words`);
  }
}

for (const [slug, p] of Object.entries(PATCH)) assertPatch(slug, p);

const files = [
  join(ROOT, "data/tier-a/clubs.json"),
  ...readdirSync(join(ROOT, "data/tier-b/scored"))
    .filter((f) => /^\d{3}\.json$/.test(f))
    .map((f) => join(ROOT, "data/tier-b/scored", f)),
];

const seen = new Set();
for (const file of files) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const arr = Array.isArray(raw) ? raw : raw.clubs;
  if (!Array.isArray(arr)) continue;
  let changed = 0;
  for (const club of arr) {
    const p = PATCH[club.slug];
    if (!p) continue;
    seen.add(club.slug);
    club.vector = p.vector;
    club.identity_summary = p.identity;
    club.source_quality_notes = p.notes;
    if (p.confidence) club.confidence = p.confidence;
    changed += 1;
  }
  if (!changed) continue;
  const out = Array.isArray(raw) ? arr : { ...raw, clubs: arr };
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`patched ${changed} in ${file}`);
}

const missing = Object.keys(PATCH).filter((s) => !seen.has(s));
if (missing.length) throw new Error(`missing slugs: ${missing.join(", ")}`);
console.log(`recalibrated ${seen.size} clubs`);
