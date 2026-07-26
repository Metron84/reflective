#!/usr/bin/env node
/**
 * Build normalized clubs + nations for The Stand from data/players_seed.json.
 * Run: node scripts/build-stand-entities.mjs
 *
 * Does not invent clubs or nations. Alias merges are explicit below.
 * Championship lane stays empty until Melo seeds championship rows.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SEED_PATH = path.join(ROOT, "data/players_seed.json");
const OUT_DIR = path.join(ROOT, "data/stand");

/** Raw seed club string → canonical club_id */
const CLUB_ALIASES = {
  // Serie A
  "ACF Fiorentina": "acf-fiorentina",
  Fiorentina: "acf-fiorentina",
  "AC Milan": "ac-milan",
  Milan: "ac-milan",
  Napoli: "napoli",
  "SSC Napoli": "napoli",
  "Associazione Sportiva Roma": "roma",
  Roma: "roma",
  "Società Sportiva Lazio S.p.A.": "lazio",
  Lazio: "lazio",
  "UC Sampdoria": "sampdoria",
  Sampdoria: "sampdoria",
  "Bologna Football Club 1909": "bologna",
  Bologna: "bologna",
  "Cagliari Calcio": "cagliari",
  Cagliari: "cagliari",
  "Udinese Calcio": "udinese",
  Udinese: "udinese",
  "Parma Calcio 1913": "parma",
  Parma: "parma",
  "Genoa CFC": "genoa",
  Genoa: "genoa",
  "Inter Milan": "inter-milan",
  Juventus: "juventus",
  "Atalanta BC": "atalanta",
  Torino: "torino",
  "US Sassuolo": "sassuolo",
  Empoli: "empoli",
  Palermo: "palermo",
  "Hellas Verona": "hellas-verona",
  Monza: "monza",
  "Benevento Calcio": "benevento",
  Brescia: "brescia",
  "Chievo Verona": "chievo",
  Crotone: "crotone",
  SPAL: "spal",
  Catania: "catania",
  Cesena: "cesena",
  "Como 1907": "como",
  "Pisa Sporting Club": "pisa",
  "US Lecce": "lecce",
  "US Salernitana 1919": "salernitana",
  "Delfino Pescara 1936": "pescara",

  // Premier League
  Arsenal: "arsenal",
  "Manchester United": "manchester-united",
  "Manchester City": "manchester-city",
  Liverpool: "liverpool",
  "Tottenham Hotspur": "tottenham",
  Chelsea: "chelsea",
  "West Ham United": "west-ham",
  Everton: "everton",
  "Aston Villa": "aston-villa",
  Southampton: "southampton",
  "Leicester City": "leicester",
  "Crystal Palace": "crystal-palace",
  "Newcastle United": "newcastle",
  Burnley: "burnley",
  Watford: "watford",
  Fulham: "fulham",
  "West Bromwich Albion": "west-brom",
  "AFC Bournemouth": "bournemouth",
  "Brighton & Hove Albion": "brighton",
  "Leeds United": "leeds",
  "Swansea City": "swansea",
  "Hull City": "hull",
  "Nottingham Forest": "nottingham-forest",
  Brentford: "brentford",
  "Luton Town": "luton",
  "Wolverhampton Wanderers": "wolves",
  "Blackburn Rovers": "blackburn",
  "Bolton Wanderers": "bolton",
  "Cardiff City": "cardiff",
  "Coventry City": "coventry",
  Middlesbrough: "middlesbrough",
  "Norwich City": "norwich",
  Portsmouth: "portsmouth",
  "Queens Park Rangers": "qpr",
  "Stoke City": "stoke",
  Sunderland: "sunderland",
  "Sunderland AFC": "sunderland",
  "Wigan Athletic": "wigan",

  // La Liga
  "Real Madrid": "real-madrid",
  Barcelona: "barcelona",
  "Atletico Madrid": "atletico-madrid",
  Valencia: "valencia",
  "RCD Espanyol Barcelona": "espanyol",
  "Real Sociedad": "real-sociedad",
  Sevilla: "sevilla",
  Villarreal: "villarreal",
  "Athletic Bilbao": "athletic-bilbao",
  Getafe: "getafe",
  "Celta de Vigo": "celta-vigo",
  "Celta Vigo": "celta-vigo",
  "CA Osasuna": "osasuna",
  "Real Betis Balompié": "real-betis",
  "Real Betis": "real-betis",
  "Deportivo Alavés": "alaves",
  "Rayo Vallecano": "rayo-vallecano",
  "SD Eibar": "eibar",
  Girona: "girona",
  "Levante UD": "levante",
  "CD Leganés": "leganes",
  Granada: "granada",
  "RCD Mallorca": "mallorca",
  Mallorca: "mallorca",
  "UD Almería": "almeria",
  "UD Las Palmas": "las-palmas",
  Cádiz: "cadiz",
  "Deportivo La Coruna": "deportivo",
  "Deportivo de La Coruña": "deportivo",
  Elche: "elche",
  Malaga: "malaga",
  Málaga: "malaga",
  "Real Valladolid": "valladolid",
  "SD Huesca": "huesca",
  "Sporting Gijón": "sporting-gijon",

  // Bundesliga
  "Bayern Munich": "bayern-munich",
  "Borussia Dortmund": "borussia-dortmund",
  "Bayer Leverkusen": "bayer-leverkusen",
  "Borussia Monchengladbach": "borussia-monchengladbach",
  "RB Leipzig": "rb-leipzig",
  "TSG 1899 Hoffenheim": "hoffenheim",
  "Eintracht Frankfurt": "eintracht-frankfurt",
  "SC Freiburg": "sc-freiburg",
  Augsburg: "augsburg",
  "Hertha BSC": "hertha",
  "SV Werder Bremen": "werder-bremen",
  "Werder Bremen": "werder-bremen",
  "VfL Wolfsburg": "wolfsburg",
  Wolfsburg: "wolfsburg",
  "1.FC Köln": "fc-koln",
  Cologne: "fc-koln",
  "1.FC Union Berlin": "union-berlin",
  "Schalke 04": "schalke",
  "1.FSV Mainz 05": "mainz",
  "Hamburger SV": "hamburger-sv",
  "VfB Stuttgart": "vfb-stuttgart",
  Stuttgart: "vfb-stuttgart",
  "Hannover 96": "hannover",
  "1.FC Nuremberg": "nuremberg",
  Kaiserslautern: "kaiserslautern",
  "Arminia Bielefeld": "arminia-bielefeld",
  "Eintracht Braunschweig": "braunschweig",
  "Ingolstadt 04": "ingolstadt",
  "Karlsruher SC": "karlsruhe",
  "VfL Bochum": "bochum",

  // Ligue 1 (parked for Stand v1 stories; still normalize)
  "Paris Saint-Germain": "psg",
  Paris: "psg",
  Monaco: "monaco",
  Marseille: "marseille",
  "Montpellier HSC": "montpellier",
  Nantes: "nantes",
  "Stade Rennais": "rennes",
  Rennes: "rennes",
  "Saint-Étienne": "saint-etienne",
  "Saint-Etienne": "saint-etienne",
  Lyon: "lyon",
  "Olympique Lyon": "lyon",
  "LOSC Lille": "lille",
  Lille: "lille",
  "OGC Nice": "nice",
  Nice: "nice",
  Toulouse: "toulouse",
  "Angers SCO": "angers",
  Angers: "angers",
  "Girondins Bordeaux": "bordeaux",
  Bordeaux: "bordeaux",
  "EA Guingamp": "guingamp",
  Guingamp: "guingamp",
  "RC Lens": "lens",
  Metz: "metz",
  "RC Strasbourg Alsace": "strasbourg",
  Strasbourg: "strasbourg",
  Ajaccio: "ajaccio",
  "GFC Ajaccio": "ajaccio",
  Lorient: "lorient",
  "SC Bastia": "bastia",
  Bastia: "bastia",
  "Stade Brestois 29": "brest",
  "Dijon FCO": "dijon",
  "Nîmes Olympique": "nimes",
  "SM Caen": "caen",
  "Stade Reims": "reims",
  "Thonon Évian Grand Genève": "evian",
  "Clermont Foot 63": "clermont",
  "Le Havre AC": "le-havre",
  "Le Mans": "le-mans",
  "Nancy-Lorraine": "nancy",
  "Sochaux-Montbéliard": "sochaux",
};

const DISPLAY_NAMES = {
  "acf-fiorentina": "Fiorentina",
  "ac-milan": "AC Milan",
  napoli: "Napoli",
  roma: "Roma",
  lazio: "Lazio",
  sampdoria: "Sampdoria",
  bologna: "Bologna",
  cagliari: "Cagliari",
  udinese: "Udinese",
  parma: "Parma",
  genoa: "Genoa",
  "inter-milan": "Inter Milan",
  juventus: "Juventus",
  atalanta: "Atalanta",
  torino: "Torino",
  sassuolo: "Sassuolo",
  arsenal: "Arsenal",
  "manchester-united": "Manchester United",
  "manchester-city": "Manchester City",
  liverpool: "Liverpool",
  tottenham: "Tottenham Hotspur",
  chelsea: "Chelsea",
  "west-ham": "West Ham United",
  everton: "Everton",
  "aston-villa": "Aston Villa",
  "real-madrid": "Real Madrid",
  barcelona: "Barcelona",
  "atletico-madrid": "Atlético Madrid",
  "celta-vigo": "Celta Vigo",
  "real-betis": "Real Betis",
  deportivo: "Deportivo La Coruña",
  malaga: "Málaga",
  mallorca: "Mallorca",
  "bayern-munich": "Bayern Munich",
  "borussia-dortmund": "Borussia Dortmund",
  "bayer-leverkusen": "Bayer Leverkusen",
  "borussia-monchengladbach": "Borussia Mönchengladbach",
  "werder-bremen": "Werder Bremen",
  wolfsburg: "Wolfsburg",
  "fc-koln": "1. FC Köln",
  "vfb-stuttgart": "VfB Stuttgart",
  sunderland: "Sunderland",
  psg: "Paris Saint-Germain",
  "saint-etienne": "Saint-Étienne",
  lyon: "Lyon",
  lille: "Lille",
  nice: "Nice",
  angers: "Angers",
  bordeaux: "Bordeaux",
  guingamp: "Guingamp",
  strasbourg: "Strasbourg",
  ajaccio: "Ajaccio",
  bastia: "Bastia",
};

const SHORT_NAMES = {
  "acf-fiorentina": "Fiorentina",
  "ac-milan": "Milan",
  "inter-milan": "Inter",
  "manchester-united": "Man United",
  "manchester-city": "Man City",
  tottenham: "Spurs",
  "west-ham": "West Ham",
  "aston-villa": "Villa",
  "nottingham-forest": "Forest",
  "real-madrid": "Real",
  "atletico-madrid": "Atlético",
  "bayern-munich": "Bayern",
  "borussia-dortmund": "Dortmund",
  "bayer-leverkusen": "Leverkusen",
  "borussia-monchengladbach": "Gladbach",
  psg: "PSG",
};

const LEAGUE_LANES = {
  premier_league: "premier_league",
  serie_a: "serie_a",
  la_liga: "la_liga",
  bundesliga: "bundesliga",
  ligue_1: "ligue_1",
  championship: "championship",
};

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nationId(nationality) {
  return `nation-${slugify(nationality)}`;
}

function resolveClubId(raw) {
  if (CLUB_ALIASES[raw]) return CLUB_ALIASES[raw];
  return slugify(raw);
}

function main() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const players = seed.players;
  const clubs = new Map();
  const nations = new Map();
  const unresolvedClubStrings = new Set();

  for (const row of players) {
    const nat = row.nationality;
    if (nat) {
      const nid = nationId(nat);
      if (!nations.has(nid)) {
        nations.set(nid, {
          id: nid,
          display_name: nat,
          person_ids: new Set(),
          row_count: 0,
        });
      }
      const n = nations.get(nid);
      n.person_ids.add(row.person_id);
      n.row_count += 1;
    }

    for (const raw of row.clubs || []) {
      const id = resolveClubId(raw);
      if (!CLUB_ALIASES[raw] && !DISPLAY_NAMES[id]) {
        unresolvedClubStrings.add(raw);
      }
      if (!clubs.has(id)) {
        clubs.set(id, {
          id,
          display_name: DISPLAY_NAMES[id] || raw,
          short_name: SHORT_NAMES[id] || DISPLAY_NAMES[id] || raw,
          aliases: new Set(),
          leagues: new Set(),
          person_ids: new Set(),
          row_ids: new Set(),
        });
      }
      const c = clubs.get(id);
      c.aliases.add(raw);
      if (row.league && LEAGUE_LANES[row.league]) {
        c.leagues.add(row.league);
      }
      c.person_ids.add(row.person_id);
      c.row_ids.add(row.id);
    }
  }

  const clubsOut = [...clubs.values()]
    .map((c) => {
      const personCount = c.person_ids.size;
      let tier = "D";
      if (personCount >= 12) tier = "A";
      else if (personCount >= 6) tier = "B";
      else if (personCount >= 3) tier = "C";
      return {
        id: c.id,
        display_name: c.display_name,
        short_name: c.short_name,
        aliases: [...c.aliases].sort(),
        leagues: [...c.leagues].sort(),
        person_ids: [...c.person_ids].sort(),
        person_count: personCount,
        row_count: c.row_ids.size,
        stand_tier: tier,
        championship_ready: false,
      };
    })
    .sort((a, b) => b.person_count - a.person_count || a.id.localeCompare(b.id));

  const nationsOut = [...nations.values()]
    .map((n) => {
      const personCount = n.person_ids.size;
      let tier = "D";
      if (personCount >= 30) tier = "A";
      else if (personCount >= 10) tier = "B";
      else if (personCount >= 5) tier = "C";
      return {
        id: n.id,
        display_name: n.display_name,
        person_ids: [...n.person_ids].sort(),
        person_count: personCount,
        row_count: n.row_count,
        stand_tier: tier,
      };
    })
    .sort((a, b) => b.person_count - a.person_count || a.id.localeCompare(b.id));

  const byLeague = {};
  for (const lane of Object.values(LEAGUE_LANES)) {
    byLeague[lane] = clubsOut
      .filter((c) => c.leagues.includes(lane))
      .map((c) => ({
        id: c.id,
        display_name: c.display_name,
        person_count: c.person_count,
        stand_tier: c.stand_tier,
      }));
  }

  const chaptersDir = path.join(OUT_DIR, "chapters");
  const chapterIds = fs.existsSync(chaptersDir)
    ? fs
        .readdirSync(chaptersDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort()
    : [];

  const manifest = {
    generated: new Date().toISOString().slice(0, 10),
    source: "data/players_seed.json",
    note: "SAMPLE entity index for The Stand. Championship empty until seeded. Unresolved raw club strings listed for Melo review.",
    counts: {
      clubs: clubsOut.length,
      nations: nationsOut.length,
      tier_a_clubs: clubsOut.filter((c) => c.stand_tier === "A").length,
      tier_b_clubs: clubsOut.filter((c) => c.stand_tier === "B").length,
      unresolved_raw_club_strings: unresolvedClubStrings.size,
      chapters: chapterIds.length,
    },
    composers: {
      premier_league: "zadie-smith",
      championship: "geoffrey-chaucer",
      serie_a: "dante-alighieri",
      la_liga: "cervantes",
      bundesliga: "goethe",
      ligue_1: "albert-camus",
      nations: "homer",
    },
    product_rules: {
      questions_per_day: 5,
      questions_per_chapter: 15,
      days_per_chapter: 3,
      signup_to_save_progress: true,
      badges: ["club", "nation", "player"],
    },
    chapters: chapterIds,
    pilot_chapter: chapterIds.includes("sa.fiorentina.ch01")
      ? "sa.fiorentina.ch01"
      : null,
    clubs_by_league: byLeague,
    unresolved_raw_club_strings: [...unresolvedClubStrings].sort(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "clubs.json"), JSON.stringify(clubsOut, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "nations.json"), JSON.stringify(nationsOut, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Wrote ${clubsOut.length} clubs, ${nationsOut.length} nations → data/stand/`);
  console.log(
    `Tier A clubs: ${manifest.counts.tier_a_clubs}, Tier B: ${manifest.counts.tier_b_clubs}`,
  );
  console.log(`Unresolved raw club strings: ${unresolvedClubStrings.size}`);
  const fio = clubsOut.find((c) => c.id === "acf-fiorentina");
  if (fio) {
    console.log(
      `Fiorentina: ${fio.person_count} persons, tier ${fio.stand_tier}, aliases=${fio.aliases.join(" | ")}`,
    );
  }
}

main();
