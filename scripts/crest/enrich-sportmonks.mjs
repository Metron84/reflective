/**
 * One-off Crest club enrichment from Sportmonks (read-only provider config).
 *
 *   node scripts/crest/enrich-sportmonks.mjs              # dry-run (default)
 *   node scripts/crest/enrich-sportmonks.mjs --commit       # write to Supabase
 *   node scripts/crest/enrich-sportmonks.mjs --slug=everton --limit=5
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPORTMONKS_API_KEY.
 *
 * Token and base URL mirror lib/ultima/provider/sportmonks-config.js via sportmonks-env.mjs
 * (Node cannot load that file directly because of @/ imports; Ultima provider code is unchanged).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { SPORTMONKS_BASE, sportmonksApiKey } from "./sportmonks-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const REPORT_DIR = join(__dirname, "reports");

let requestCount = 0;

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const args = { dryRun: true, slug: null, limit: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") args.dryRun = false;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--slug=")) args.slug = arg.slice("--slug=".length);
    else if (arg.startsWith("--limit=")) {
      args.limit = Number(arg.slice("--limit=".length));
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(club, team) {
  const names = [
    club.name,
    club.common_name,
    club.slug?.replace(/-/g, " "),
  ].filter(Boolean);

  const teamName = normalizeName(team.name);
  let best = 0;

  for (const raw of names) {
    const n = normalizeName(raw);
    if (!n) continue;
    if (n === teamName) best = Math.max(best, 100);
    else if (teamName.includes(n) || n.includes(teamName)) best = Math.max(best, 65);
    else {
      const tokens = n.split(" ").filter(Boolean);
      const hits = tokens.filter((t) => teamName.includes(t)).length;
      if (tokens.length && hits === tokens.length) best = Math.max(best, 55);
    }
  }

  const founded = team.founded ?? team.foundation_year ?? team.founded_year;
  if (club.founded && founded && Number(club.founded) === Number(founded)) {
    best += 25;
  }

  const teamCountry =
    team.country?.name ??
    team.country?.iso2 ??
    team.country ??
    team.nationality ??
    null;
  if (club.country && teamCountry) {
    if (
      normalizeName(club.country) === normalizeName(teamCountry) ||
      normalizeName(club.country).includes(normalizeName(teamCountry)) ||
      normalizeName(teamCountry).includes(normalizeName(club.country))
    ) {
      best += 15;
    }
  }

  return best;
}

function pickUnambiguous(candidates) {
  if (!candidates.length) return { team: null, reason: "no candidates" };
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  if (top.score < 70) {
    return {
      team: null,
      reason: `best score ${top.score} below threshold 70`,
      considered: sorted.slice(0, 5),
    };
  }
  if (second && top.score - second.score < 15) {
    return {
      team: null,
      reason: `tie risk: ${top.name} (${top.score}) vs ${second.name} (${second.score})`,
      considered: sorted.slice(0, 5),
    };
  }
  return { team: top, reason: "unambiguous", considered: sorted.slice(0, 5) };
}

async function smFetch(path, params = {}) {
  const key = sportmonksApiKey();
  if (!key) throw new Error("SPORTMONKS_API_KEY not configured");

  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  url.searchParams.set("api_token", key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  requestCount += 1;
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (res.status === 403 || res.status === 402) {
    const err = new Error(`subscription_gap:${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Sportmonks ${path} returned ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

async function searchTeams(query) {
  const encoded = encodeURIComponent(query);
  const res = await smFetch(`/teams/search/${encoded}`);
  return res.data ?? [];
}

async function fetchTeamDetails(teamId) {
  return smFetch(`/teams/${teamId}`, {
    include: "venue;socials;rivals.team;country",
  });
}

function extractStadium(teamPayload) {
  const team = teamPayload.data ?? teamPayload;
  const venue = team.venue ?? team.venue?.data ?? null;
  if (!venue) return {};
  return {
    name: venue.name ?? null,
    capacity: venue.capacity ?? null,
    city: venue.city_name ?? venue.city ?? null,
  };
}

function extractSocials(teamPayload) {
  const team = teamPayload.data ?? teamPayload;
  const socials = team.socials ?? team.socials?.data ?? [];
  if (!Array.isArray(socials)) return socials && typeof socials === "object" ? socials : {};
  const out = {};
  for (const row of socials) {
    const key = row.type ?? row.name ?? row.platform;
    const val = row.url ?? row.value ?? row.link;
    if (key && val) out[String(key).toLowerCase()] = val;
  }
  return out;
}

function extractRivalTeams(teamPayload) {
  const team = teamPayload.data ?? teamPayload;
  const rivals = team.rivals ?? team.rivals?.data ?? [];
  if (!Array.isArray(rivals)) return [];
  return rivals
    .map((r) => {
      const t = r.team ?? r.rival ?? r;
      return {
        id: t?.id ?? r.team_id ?? r.rival_id,
        name: t?.name ?? r.name,
      };
    })
    .filter((r) => r.id);
}

function badgeUrlFromTeam(team) {
  const path = team.image_path ?? team.logo_path ?? team.logo;
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return `https://cdn.sportmonks.com${path.startsWith("/") ? "" : "/"}${path}`;
}

function mergeExclusions(existing, additions) {
  const set = new Set(existing ?? []);
  for (const slug of additions) {
    if (slug) set.add(slug);
  }
  return [...set];
}

function todayReportPath() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return join(REPORT_DIR, `enrich-${y}-${m}-${day}.md`);
}

function renderReport(state) {
  const lines = [
    "# Crest Sportmonks enrichment report",
    "",
    `Mode: ${state.dryRun ? "dry-run" : "commit"}`,
    `Total API requests: ${state.requestCount}`,
    "",
    "## Matched",
    "",
  ];

  if (!state.matched.length) lines.push("_None_");
  for (const row of state.matched) {
    lines.push(
      `- **${row.slug}** → Sportmonks ${row.sportmonks_id} (${row.matchedName}) — ${row.reason}`,
    );
  }

  lines.push("", "## Unmatched (needs manual ID)", "");
  if (!state.unmatched.length) lines.push("_None_");
  for (const row of state.unmatched) {
    lines.push(`- **${row.slug}** (${row.name}): ${row.reason}`);
    if (row.considered?.length) {
      for (const c of row.considered) {
        lines.push(`  - candidate ${c.id} ${c.name} (score ${c.score})`);
      }
    }
  }

  lines.push("", "## Outside subscription", "");
  if (!state.subscriptionGaps.length) lines.push("_None_");
  for (const row of state.subscriptionGaps) {
    lines.push(`- **${row.slug}**: ${row.detail}`);
  }

  lines.push("", "## Rivals not in crest_clubs", "");
  if (!state.rivalsMissing.length) lines.push("_None_");
  for (const row of state.rivalsMissing) {
    lines.push(
      `- From **${row.slug}**: rival ${row.rivalId} ${row.rivalName ?? ""} (no crest slug)`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!sportmonksApiKey()) {
    console.error("Set SPORTMONKS_API_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("crest_clubs")
    .select(
      "slug, name, common_name, city, country, founded, exclusion_clubs, sportmonks_id",
    )
    .order("slug");

  if (args.slug) query = query.eq("slug", args.slug);
  if (args.limit) query = query.limit(args.limit);

  const { data: clubs, error } = await query;
  if (error) {
    console.error("Supabase read failed:", error.message);
    process.exit(1);
  }

  const { data: allRows } = await supabase
    .from("crest_clubs")
    .select("slug, sportmonks_id, name");

  const slugBySportmonksId = new Map();
  for (const row of allRows ?? []) {
    if (row.sportmonks_id) slugBySportmonksId.set(row.sportmonks_id, row.slug);
  }

  const state = {
    dryRun: args.dryRun,
    requestCount: 0,
    matched: [],
    unmatched: [],
    subscriptionGaps: [],
    rivalsMissing: [],
  };

  for (const club of clubs ?? []) {
    const searchName = club.common_name || club.name;
    let searchResults = [];

    try {
      searchResults = await searchTeams(searchName);
      await sleep(120);
    } catch (err) {
      if (String(err.message).startsWith("subscription_gap:")) {
        state.subscriptionGaps.push({
          slug: club.slug,
          detail: `search blocked (${err.status})`,
        });
        continue;
      }
      state.unmatched.push({
        slug: club.slug,
        name: searchName,
        reason: `search error: ${err.message}`,
      });
      continue;
    }

    const scored = searchResults.map((team) => ({
      ...team,
      score: scoreCandidate(club, team),
    }));

    const { team, reason, considered } = pickUnambiguous(scored);
    if (!team) {
      state.unmatched.push({
        slug: club.slug,
        name: searchName,
        reason,
        considered: considered?.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.score,
        })),
      });
      continue;
    }

    let details;
    try {
      details = await fetchTeamDetails(team.id);
      await sleep(120);
    } catch (err) {
      if (String(err.message).startsWith("subscription_gap:")) {
        state.subscriptionGaps.push({
          slug: club.slug,
          detail: `team ${team.id} blocked (${err.status})`,
        });
        continue;
      }
      state.unmatched.push({
        slug: club.slug,
        name: searchName,
        reason: `detail fetch failed: ${err.message}`,
      });
      continue;
    }

    const teamData = details.data ?? details;
    const stadium = extractStadium(details);
    const socials = extractSocials(details);
    const badge = badgeUrlFromTeam(teamData);
    const founded =
      club.founded ?? teamData.founded ?? teamData.foundation_year ?? null;

    const rivalTeams = extractRivalTeams(details);
    const newExclusionSlugs = [];
    for (const rival of rivalTeams) {
      const rivalSlug = slugBySportmonksId.get(rival.id);
      if (rivalSlug && rivalSlug !== club.slug) {
        newExclusionSlugs.push(rivalSlug);
      } else if (!rivalSlug) {
        state.rivalsMissing.push({
          slug: club.slug,
          rivalId: rival.id,
          rivalName: rival.name,
        });
      }
    }

    const exclusion_clubs = mergeExclusions(
      club.exclusion_clubs,
      newExclusionSlugs,
    );

    state.matched.push({
      slug: club.slug,
      sportmonks_id: team.id,
      matchedName: team.name,
      reason,
    });

    if (args.dryRun) continue;

    const patch = {
      sportmonks_id: team.id,
      badge_url: badge,
      stadium,
      socials,
      exclusion_clubs,
      updated_at: new Date().toISOString(),
    };
    if (founded != null && club.founded == null) patch.founded = founded;

    const { error: updateError } = await supabase
      .from("crest_clubs")
      .update(patch)
      .eq("slug", club.slug);

    if (updateError) {
      console.error(`Update failed for ${club.slug}:`, updateError.message);
    }
  }

  state.requestCount = requestCount;
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = todayReportPath();
  writeFileSync(reportPath, renderReport(state), "utf8");

  console.log(`Report: ${reportPath}`);
  console.log(
    `Matched: ${state.matched.length}, unmatched: ${state.unmatched.length}, subscription gaps: ${state.subscriptionGaps.length}`,
  );
  console.log(`API requests: ${requestCount}`);
  if (args.dryRun) {
    console.log("Dry-run only. Re-run with --commit after Melo approves the report.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
