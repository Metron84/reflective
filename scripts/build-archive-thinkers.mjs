#!/usr/bin/env node
/**
 * Beautiful Archive thinker lens. For every archive entry, picks up to three thinkers
 * from different domains whose interests overlap the entry's themes, plus the maker
 * when the maker is in the database. Deterministic, no AI calls.
 *
 * Reads .thinkers/thinkers.json (from scripts/pull-thinkers.mjs) and
 * content/archive/entries.json. Writes content/archive/thinkers.generated.json
 * (gitignored) with only the fields the page shows.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const OUT = join(root, "content/archive/thinkers.generated.json");
const src = join(root, ".thinkers/thinkers.json");
const thinkers = existsSync(src) ? JSON.parse(readFileSync(src, "utf8")) : [];
const entries = JSON.parse(readFileSync(join(root, "content/archive/entries.json"), "utf8"));

if (!thinkers.length) {
  writeFileSync(OUT, "[]\n");
  console.warn("[archive-thinkers] no thinkers loaded; lens stays hidden.");
  process.exit(0);
}

const DOMAIN = {
  Business: "Business",
  Tech: "Technology",
  Psychology: "Psychology",
  Writer: "Writer",
  Philosophy: "Philosophy",
  PoliSci: "Politics",
  FilmVisual: "Film & visual",
};

const STOP = new Set(
  (
    "a an the and or of in on to for with by as at from into is are was were be been being it its this that these those " +
    "not no but if then than so such their his her him he she they them we us our you your i me my who whom what which " +
    "how why when where all any each more most other some own same can will just about over under between through " +
    "against during before after above below up down out off again further once there here also only very one two " +
    "new world life work works way ways makes make made like itself without within becomes become every much many " +
    "should would could must may might even ever still yet both either neither upon toward towards across thus while " +
    "build need take get got find know feel thing things people true bad good great best story human time help want try " +
    "football film films player players team teams fan fans match game season club clubs book books"
  ).split(" "),
);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ness")) return w.slice(0, -4);
  if (w.length > 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
const tokens = (s) =>
  s ? norm(String(s)).split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem) : [];

const bags = thinkers.map((t) => {
  const bag = new Map();
  const add = (s, w) => {
    for (const tok of new Set(tokens(s))) bag.set(tok, Math.max(bag.get(tok) || 0, w));
  };
  add(t.philosophyCanon, 1);
  add(t.coreSynthesis, 1);
  add(t.reasoningProfile?.problemFraming, 1);
  add(t.domain, 2);
  add((t.subDomains || []).join(" "), 3);
  add((t.generalInterests || []).join(" "), 3);
  return bag;
});
const df = new Map();
for (const bag of bags) for (const tok of bag.keys()) df.set(tok, (df.get(tok) || 0) + 1);
const idf = (tok) => Math.log(thinkers.length / (df.get(tok) || thinkers.length));

const byName = new Map(thinkers.map((t) => [norm(t.name).replace(/[^a-z]/g, ""), t]));

function score(query) {
  const q = new Map();
  for (const { text, weight } of query) for (const tok of tokens(text)) q.set(tok, Math.max(q.get(tok) || 0, weight));
  const out = [];
  thinkers.forEach((t, i) => {
    let s = 0;
    for (const [tok, qw] of q) {
      const w = bags[i].get(tok);
      if (w) s += qw * w * idf(tok);
    }
    if (s >= 7) out.push({ t, s });
  });
  return out.sort((a, b) => b.s - a.s);
}

function pick(scored, limit, exclude) {
  const picked = [];
  const people = new Set(exclude);
  const domains = new Set();
  for (const x of scored) {
    if (picked.length >= limit) break;
    if (people.has(x.t.id) || domains.has(x.t.domainCategory)) continue;
    picked.push(x.t);
    people.add(x.t.id);
    domains.add(x.t.domainCategory);
  }
  return picked;
}

const slim = (t) => ({
  id: t.id,
  name: t.name,
  domain: DOMAIN[t.domainCategory] || t.domainCategory,
  era: t.era,
  question: t.reasoningProfile?.problemFraming || "",
  reads: t.reasoningProfile?.reasoningMoves || "",
  breaks: t.reasoningProfile?.blindSpots || "",
  insight: t.representativeInsight || "",
});

const result = [];
for (const e of entries) {
  if (e.status && e.status !== "published") continue;
  const maker = e.creator ? byName.get(norm(e.creator).replace(/[^a-z]/g, "")) || null : null;
  const scored = score([
    { text: `${e.subject || ""} ${e.subjectName || ""}`, weight: 3 },
    { text: e.tone, weight: 1 },
    { text: e.logline, weight: 0.5 },
    { text: e.whyItMatters, weight: 0.5 },
  ]);
  const lenses = pick(scored, 3, maker ? [maker.id] : []);
  if (!maker && !lenses.length) continue;
  result.push({ entryId: e.id, maker: maker ? slim(maker) : null, thinkers: lenses.map(slim) });
}
writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(`[archive-thinkers] ${result.length} of ${entries.length} entries have a thinker lens`);
