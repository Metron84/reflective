/**
 * One-shot: add kit_family to scored 001–004, Tier A, PL extras;
 * write scored 005–010. Home shirt only. One of twelve families.
 *
 *   node scripts/crest/apply-kit-and-score-rest.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const KIT = new Set([
  "red",
  "blue",
  "white",
  "black",
  "purple",
  "yellow",
  "green",
  "orange",
  "pink",
  "brown",
  "grey",
  "claret",
]);

const CIVIC_V = [4, 4, 4, 4, 4, 4, 4, 4, 6, 4, 4, 4];
const CIVIC_C = [1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1];

/** Home-shirt family. Split shirts use the colour people mean. */
const KIT_BY_SLUG = {
  atalanta: "blue",
  bologna: "red",
  cagliari: "red",
  como: "blue",
  fiorentina: "purple",
  frosinone: "yellow",
  genoa: "red",
  "inter-milan": "blue",
  lazio: "blue",
  lecce: "yellow",
  "ac-milan": "red",
  monza: "red",
  parma: "yellow",
  sassuolo: "green",
  torino: "claret",
  udinese: "black",
  venezia: "black",
  alaves: "blue",
  "athletic-bilbao": "red",
  "celta-vigo": "blue",
  "deportivo-la-coruna": "blue",
  elche: "green",
  espanyol: "blue",
  getafe: "blue",
  levante: "red",
  malaga: "blue",
  osasuna: "red",
  "racing-santander": "green",
  "rayo-vallecano": "white",
  "real-betis": "green",
  "real-sociedad": "blue",
  sevilla: "white",
  valencia: "white",
  villarreal: "yellow",
  "rb-leipzig": "red",
  "vfb-stuttgart": "red",
  "tsg-hoffenheim": "blue",
  "bayer-leverkusen": "red",
  "sc-freiburg": "red",
  "eintracht-frankfurt": "red",
  "fc-augsburg": "red",
  "mainz-05": "red",
  "union-berlin": "red",
  "borussia-monchengladbach": "green",
  "hamburger-sv": "white",
  "1-fc-koln": "red",
  "werder-bremen": "green",
  "schalke-04": "blue",
  "sv-elversberg": "white",
  "sc-paderborn": "blue",
  angers: "white",
  "aj-auxerre": "blue",
  "stade-brestois": "red",
  "le-havre": "blue",
  "le-mans": "red",
  "rc-lens": "red",
  "losc-lille": "red",
  "fc-lorient": "orange",
  "olympique-lyon": "white",
  "as-monaco": "red",
  "ogc-nice": "red",
  "paris-fc": "blue",
  "paris-saint-germain": "blue",
  "stade-rennais": "red",
  "rc-strasbourg": "blue",
  "toulouse-fc": "purple",
  "estac-troyes": "blue",
  palermo: "pink",
  mantova: "white",
  sudtirol: "white",
  ascoli: "black",
  avellino: "green",
  modena: "yellow",
  pisa: "black",
  empoli: "blue",
  cesena: "white",
  "hellas-verona": "yellow",
  "calcio-padova": "white",
  "lr-vicenza": "white",
  cremonese: "grey",
  "real-madrid": "white",
  barcelona: "blue",
  "atletico-madrid": "red",
  everton: "blue",
  liverpool: "red",
  arsenal: "red",
  "tottenham-hotspur": "white",
  "manchester-city": "blue",
  "manchester-united": "red",
  "newcastle-united": "black",
  celtic: "green",
  juventus: "black",
  napoli: "blue",
  roma: "red",
  "borussia-dortmund": "yellow",
  "bayern-munich": "red",
  "st-pauli": "brown",
  ajax: "red",
  marseille: "white",
  "al-ahly": "red",
  "wydad-casablanca": "red",
  "al-hilal": "blue",
  "al-ain": "purple",
  "aston-villa": "claret",
  bournemouth: "red",
  brentford: "red",
  brighton: "blue",
  chelsea: "blue",
  "coventry-city": "blue",
  "crystal-palace": "red",
  fulham: "white",
  "hull-city": "yellow",
  "ipswich-town": "blue",
  "leeds-united": "white",
  "nottingham-forest": "red",
  sunderland: "red",
};

function words(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function row(c) {
  if (!KIT.has(c.kit_family)) {
    throw new Error(`${c.slug}: bad kit_family ${c.kit_family}`);
  }
  if (!c.identity_summary) throw new Error(`${c.slug}: missing identity`);
  if (words(c.identity_summary) > 25) {
    throw new Error(
      `${c.slug}: identity is ${words(c.identity_summary)} words: ${c.identity_summary}`,
    );
  }
  return {
    slug: c.slug,
    name: c.name,
    common_name: c.common_name ?? c.name,
    city: c.city,
    country: c.country,
    founded: c.founded,
    competition: c.competition,
    cluster: c.cluster,
    vector: c.vector,
    confidence: c.confidence,
    identity_summary: c.identity_summary,
    kit_family: c.kit_family,
    exclusion_clubs: c.exclusion_clubs ?? [],
    vector_version: "1.1",
    research_status: "draft",
    source_quality_notes: c.notes,
  };
}

function civic(partial) {
  return row({
    vector: CIVIC_V,
    confidence: CIVIC_C,
    ...partial,
    notes:
      partial.notes ??
      `Founded ${partial.founded}. Civic ${partial.city} club. Stay near 4 except local scale. Division is not identity.`,
  });
}

const BATCH_005 = [
  civic({
    slug: "ss-arezzo",
    name: "SS Arezzo",
    city: "Arezzo",
    country: "Italy",
    founded: 1923,
    competition: "Serie B",
    cluster: "italy-tuscany",
    kit_family: "claret",
    identity_summary:
      "Arezzo's civic club in Tuscany, known for the amaranto shirt more than a locked idea.",
  }),
  civic({
    slug: "virtus-entella",
    name: "Virtus Entella",
    city: "Chiavari",
    country: "Italy",
    founded: 1914,
    competition: "Serie B",
    cluster: "italy-liguria",
    kit_family: "white",
    identity_summary:
      "Chiavari's civic club on the Ligurian coast. The town is the identity.",
  }),
  civic({
    slug: "benevento",
    name: "Benevento",
    city: "Benevento",
    country: "Italy",
    founded: 1929,
    competition: "Serie B",
    cluster: "italy-south",
    kit_family: "yellow",
    identity_summary:
      "Benevento's civic club. The yellow shirt is clearer than any locked football idea.",
  }),
  civic({
    slug: "carrarese",
    name: "Carrarese",
    city: "Carrara",
    country: "Italy",
    founded: 1908,
    competition: "Serie B",
    cluster: "italy-tuscany",
    kit_family: "blue",
    identity_summary:
      "Carrara's civic club. A marble-town side, local in scale, not a cult idea.",
  }),
  row({
    slug: "sampdoria",
    name: "Sampdoria",
    city: "Genoa",
    country: "Italy",
    founded: 1946,
    competition: "Serie B",
    cluster: "italy-liguria",
    kit_family: "blue",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Genoa's blucerchiati club, born in 1946, always the other half of the city.",
    exclusion_clubs: ["genoa"],
    notes:
      "Founded 1946 from a merger. Derby with Genoa is documented. Shirt bands are identity. Playing ideology left at 4.",
  }),
  civic({
    slug: "juve-stabia",
    name: "Juve Stabia",
    city: "Castellammare di Stabia",
    country: "Italy",
    founded: 1907,
    competition: "Serie B",
    cluster: "italy-south",
    kit_family: "yellow",
    identity_summary:
      "Castellammare's civic club on the Bay of Naples. Town first, idea second.",
  }),
  civic({
    slug: "catanzaro",
    name: "Catanzaro",
    city: "Catanzaro",
    country: "Italy",
    founded: 1929,
    competition: "Serie B",
    cluster: "italy-south",
    kit_family: "red",
    identity_summary:
      "Catanzaro's civic club in Calabria. The city is the identity, not a locked idea.",
  }),
  row({
    slug: "ad-ceuta-fc",
    name: "AD Ceuta FC",
    city: "Ceuta",
    country: "Spain",
    founded: 1956,
    competition: "LaLiga 2",
    cluster: "spain-north-africa",
    kit_family: "blue",
    vector: [4, 4, 6, 4, 4, 4, 4, 4, 7, 4, 4, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1],
    identity_summary:
      "Ceuta's club represents a Spanish city in North Africa. Geography is the identity.",
    notes:
      "Current club lineage is commonly dated 1956. Distinction is the enclave, not table position. Playing idea left at 4.",
  }),
  civic({
    slug: "albacete-bp",
    name: "Albacete BP",
    city: "Albacete",
    country: "Spain",
    founded: 1940,
    competition: "LaLiga 2",
    cluster: "spain-castilla",
    kit_family: "white",
    identity_summary:
      "Albacete's civic club in Castilla-La Mancha. The city is the identity.",
  }),
  civic({
    slug: "burgos-cf",
    name: "Burgos CF",
    city: "Burgos",
    country: "Spain",
    founded: 1994,
    competition: "LaLiga 2",
    cluster: "spain-castilla",
    kit_family: "white",
    identity_summary:
      "Burgos's civic club. A city side rebuilt in 1994, not a locked football idea.",
    notes:
      "Current Burgos CF was founded in 1994 after the earlier club folded. Civic only.",
  }),
  row({
    slug: "cadiz-cf",
    name: "Cadiz CF",
    city: "Cadiz",
    country: "Spain",
    founded: 1910,
    competition: "LaLiga 2",
    cluster: "spain-andalucia",
    kit_family: "yellow",
    vector: [4, 5, 5, 5, 4, 4, 4, 4, 6, 5, 5, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1],
    identity_summary:
      "Cadiz is a port club in yellow. The city and the sea are the identity.",
    notes:
      "Founded 1910. Yellow home shirt and island-port civic story are documented. Style left at 4.",
  }),
  civic({
    slug: "cd-castellon",
    name: "CD Castellon",
    city: "Castellon",
    country: "Spain",
    founded: 1922,
    competition: "LaLiga 2",
    cluster: "spain-valencia",
    kit_family: "black",
    identity_summary:
      "Castellon's civic club. Albinegro in colour, local in scale, not a cult idea.",
  }),
  civic({
    slug: "cd-eldense",
    name: "CD Eldense",
    city: "Elda",
    country: "Spain",
    founded: 1921,
    competition: "LaLiga 2",
    cluster: "spain-valencia",
    kit_family: "blue",
    identity_summary:
      "Elda's civic club. A small-town side without a locked football idea.",
  }),
  civic({
    slug: "cd-leganes",
    name: "CD Leganes",
    city: "Leganes",
    country: "Spain",
    founded: 1928,
    competition: "LaLiga 2",
    cluster: "spain-madrid",
    kit_family: "white",
    identity_summary:
      "Leganes is a south-Madrid civic club. The suburb is the identity, not a style.",
  }),
  row({
    slug: "cd-tenerife",
    name: "CD Tenerife",
    city: "Santa Cruz de Tenerife",
    country: "Spain",
    founded: 1912,
    competition: "LaLiga 2",
    cluster: "spain-canaries",
    kit_family: "blue",
    vector: [4, 4, 5, 4, 4, 4, 4, 4, 7, 5, 4, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Tenerife's island club. The island is the identity, not a mainland idea.",
    notes:
      "Founded 1912. Island geography is documented identity. Playing ideology left at 4.",
  }),
  civic({
    slug: "ce-sabadell",
    name: "CE Sabadell",
    city: "Sabadell",
    country: "Spain",
    founded: 1903,
    competition: "LaLiga 2",
    cluster: "spain-catalonia",
    kit_family: "blue",
    identity_summary:
      "Sabadell's civic club in Catalonia. An industrial-city side, not a locked idea.",
  }),
  civic({
    slug: "cordoba-cf",
    name: "Cordoba CF",
    city: "Cordoba",
    country: "Spain",
    founded: 1954,
    competition: "LaLiga 2",
    cluster: "spain-andalucia",
    kit_family: "green",
    identity_summary:
      "Cordoba's civic club in Andalusia. The city is the identity, not a locked idea.",
  }),
  row({
    slug: "fc-andorra",
    name: "FC Andorra",
    city: "Andorra la Vella",
    country: "Andorra",
    founded: 1942,
    competition: "LaLiga 2",
    cluster: "spain-andorra",
    kit_family: "blue",
    vector: [4, 4, 6, 4, 4, 4, 4, 4, 6, 3, 4, 4],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1],
    identity_summary:
      "Andorra's club plays in Spain. The identity is the country, not a Spanish city.",
    notes:
      "Founded 1942. Plays in the Spanish system. Current ownership ignored. S2 at 3 is a light modern-project read, confidence 1.",
  }),
  row({
    slug: "girona-fc",
    name: "Girona FC",
    city: "Girona",
    country: "Spain",
    founded: 1930,
    competition: "LaLiga 2",
    cluster: "spain-catalonia",
    kit_family: "red",
    vector: [4, 4, 5, 4, 4, 4, 3, 4, 5, 3, 4, 4],
    confidence: [1, 1, 1, 1, 1, 1, 2, 1, 2, 2, 1, 1],
    identity_summary:
      "Girona rose fast with City Football Group money. The project is modern, not old ritual.",
    notes:
      "Founded 1930. City Football Group ownership is documented. M3/S2 move for the modern project, not for one league season.",
  }),
];

const BATCH_006 = [
  civic({
    slug: "granada-cf",
    name: "Granada CF",
    city: "Granada",
    country: "Spain",
    founded: 1931,
    competition: "LaLiga 2",
    cluster: "spain-andalucia",
    kit_family: "red",
    identity_summary:
      "Granada's civic club under the Alhambra. The city is the identity, not a locked idea.",
  }),
  row({
    slug: "rcd-mallorca",
    name: "RCD Mallorca",
    city: "Palma",
    country: "Spain",
    founded: 1916,
    competition: "LaLiga 2",
    cluster: "spain-islands",
    kit_family: "red",
    vector: [4, 4, 5, 4, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Mallorca's island club in Palma. The island is the identity more than a style.",
    notes: "Founded 1916. Island civic identity is documented. Ideology left at 4.",
  }),
  row({
    slug: "real-oviedo",
    name: "Real Oviedo",
    city: "Oviedo",
    country: "Spain",
    founded: 1926,
    competition: "LaLiga 2",
    cluster: "spain-asturias",
    kit_family: "blue",
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 6, 4, 5],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Oviedo's civic club in Asturias, defined by years of waiting more than by trophies.",
    exclusion_clubs: ["real-sporting-gijon"],
    notes:
      "Founded 1926. Long absence from the top flight is documented. H4 moves for the wait, not current form.",
  }),
  row({
    slug: "real-sporting-gijon",
    name: "Real Sporting Gijon",
    city: "Gijon",
    country: "Spain",
    founded: 1905,
    competition: "LaLiga 2",
    cluster: "spain-asturias",
    kit_family: "red",
    vector: [4, 4, 4, 5, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Gijon's civic club in Asturias. The city derby with Oviedo is the local story.",
    exclusion_clubs: ["real-oviedo"],
    notes: "Founded 1905. Asturias derby is documented. Playing idea left at 4.",
  }),
  civic({
    slug: "real-valladolid",
    name: "Real Valladolid",
    city: "Valladolid",
    country: "Spain",
    founded: 1928,
    competition: "LaLiga 2",
    cluster: "spain-castilla",
    kit_family: "purple",
    identity_summary:
      "Valladolid's civic club, known as Pucela. The city and the purple shirt are the identity.",
  }),
  row({
    slug: "sd-eibar",
    name: "SD Eibar",
    city: "Eibar",
    country: "Spain",
    founded: 1940,
    competition: "LaLiga 2",
    cluster: "spain-basque",
    kit_family: "blue",
    vector: [4, 4, 7, 5, 4, 4, 5, 4, 7, 5, 5, 6],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity_summary:
      "Eibar is a tiny Basque town club that reached the top flight without becoming a city brand.",
    notes:
      "Founded 1940. Ipurua and the town's scale are documented. H3/S1 move for the small-town identity. Style left at 4.",
  }),
  civic({
    slug: "ud-almeria",
    name: "UD Almeria",
    city: "Almeria",
    country: "Spain",
    founded: 1989,
    competition: "LaLiga 2",
    cluster: "spain-andalucia",
    kit_family: "red",
    identity_summary:
      "Almeria's civic club. A relatively young city side without a locked idea.",
    notes: "Founded 1989. Current ownership ignored. Civic only.",
  }),
  row({
    slug: "ud-las-palmas",
    name: "UD Las Palmas",
    city: "Las Palmas",
    country: "Spain",
    founded: 1949,
    competition: "LaLiga 2",
    cluster: "spain-canaries",
    kit_family: "yellow",
    vector: [4, 4, 5, 4, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Las Palmas is Gran Canaria's yellow club. The island is the identity.",
    notes: "Founded 1949. Island civic identity is documented. Style left at 4.",
  }),
  civic({
    slug: "hertha-bsc",
    name: "Hertha BSC",
    city: "Berlin",
    country: "Germany",
    founded: 1892,
    competition: "2. Bundesliga",
    cluster: "germany-east",
    kit_family: "blue",
    identity_summary:
      "Berlin's old civic club in blue and white. The city is larger than any locked idea.",
    notes:
      "Founded 1892. Big-city civic club. Current league place ignored. Stay near 4 except local Berlin.",
  }),
  civic({
    slug: "arminia-bielefeld",
    name: "Arminia Bielefeld",
    city: "Bielefeld",
    country: "Germany",
    founded: 1905,
    competition: "2. Bundesliga",
    cluster: "germany-west",
    kit_family: "blue",
    identity_summary:
      "Bielefeld's civic club. The town is the identity, not a locked football idea.",
  }),
  row({
    slug: "vfl-bochum",
    name: "VfL Bochum",
    city: "Bochum",
    country: "Germany",
    founded: 1848,
    competition: "2. Bundesliga",
    cluster: "germany-west",
    kit_family: "blue",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 5, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1],
    identity_summary:
      "Bochum's Ruhr club. A working-city side, local and stubborn, not a style brand.",
    notes:
      "Sports club dated 1848. Ruhr civic identity is documented. Playing idea left at 4.",
  }),
  civic({
    slug: "eintracht-braunschweig",
    name: "Eintracht Braunschweig",
    city: "Braunschweig",
    country: "Germany",
    founded: 1895,
    competition: "2. Bundesliga",
    cluster: "germany-north",
    kit_family: "yellow",
    identity_summary:
      "Braunschweig's civic club. The city and the yellow shirt are the identity.",
  }),
  civic({
    slug: "energie-cottbus",
    name: "Energie Cottbus",
    city: "Cottbus",
    country: "Germany",
    founded: 1966,
    competition: "2. Bundesliga",
    cluster: "germany-east",
    kit_family: "red",
    identity_summary:
      "Cottbus's civic club in Lusatia. An East German town side, not a locked idea.",
  }),
  civic({
    slug: "darmstadt-98",
    name: "Darmstadt 98",
    city: "Darmstadt",
    country: "Germany",
    founded: 1898,
    competition: "2. Bundesliga",
    cluster: "germany-south",
    kit_family: "blue",
    identity_summary:
      "Darmstadt's civic club, known as the Lilies. The city is the identity.",
  }),
  row({
    slug: "dynamo-dresden",
    name: "Dynamo Dresden",
    city: "Dresden",
    country: "Germany",
    founded: 1953,
    competition: "2. Bundesliga",
    cluster: "germany-east",
    kit_family: "yellow",
    vector: [5, 5, 6, 6, 4, 4, 4, 4, 6, 5, 6, 6],
    confidence: [2, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity_summary:
      "Dresden's East German club. The city and a loud, loyal support are the identity.",
    notes:
      "Founded 1953. East German civic identity and support culture are documented. Style left at 4. Do not invent chants.",
  }),
  civic({
    slug: "greuther-furth",
    name: "Greuther Furth",
    city: "Furth",
    country: "Germany",
    founded: 1903,
    competition: "2. Bundesliga",
    cluster: "germany-south",
    kit_family: "green",
    identity_summary:
      "Furth's civic club in green and white. A town side next to Nuremberg, not a locked idea.",
    exclusion_clubs: ["1-fc-nurnberg"],
  }),
  civic({
    slug: "hannover-96",
    name: "Hannover 96",
    city: "Hannover",
    country: "Germany",
    founded: 1896,
    competition: "2. Bundesliga",
    cluster: "germany-north",
    kit_family: "red",
    identity_summary:
      "Hannover's civic club in red. The city is the identity, not a locked idea.",
  }),
  row({
    slug: "1-fc-heidenheim",
    name: "1. FC Heidenheim",
    city: "Heidenheim",
    country: "Germany",
    founded: 1846,
    competition: "2. Bundesliga",
    cluster: "germany-south",
    kit_family: "red",
    vector: [4, 4, 6, 5, 4, 4, 5, 4, 7, 4, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1],
    identity_summary:
      "Heidenheim is a small-town club that climbed by staying itself.",
    notes:
      "Club dates itself to 1846. Small-town identity is documented. Recent league climb is not the culture score.",
  }),
  row({
    slug: "1-fc-kaiserslautern",
    name: "1. FC Kaiserslautern",
    city: "Kaiserslautern",
    country: "Germany",
    founded: 1900,
    competition: "2. Bundesliga",
    cluster: "germany-west",
    kit_family: "red",
    vector: [5, 4, 5, 6, 4, 4, 4, 4, 6, 6, 4, 6],
    confidence: [2, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Kaiserslautern is the Betze. The town and the red shirt are the identity.",
    notes:
      "Founded 1900. Betzenberg and the red civic story are documented. Current division ignored.",
  }),
];

const BATCH_007 = [
  civic({
    slug: "karlsruher-sc",
    name: "Karlsruher SC",
    city: "Karlsruhe",
    country: "Germany",
    founded: 1894,
    competition: "2. Bundesliga",
    cluster: "germany-south",
    kit_family: "blue",
    identity_summary:
      "Karlsruhe's civic club. The city is the identity, not a locked football idea.",
  }),
  civic({
    slug: "holstein-kiel",
    name: "Holstein Kiel",
    city: "Kiel",
    country: "Germany",
    founded: 1900,
    competition: "2. Bundesliga",
    cluster: "germany-north",
    kit_family: "blue",
    identity_summary:
      "Kiel's civic club on the Baltic. A port-city side without a locked idea.",
  }),
  row({
    slug: "1-fc-magdeburg",
    name: "1. FC Magdeburg",
    city: "Magdeburg",
    country: "Germany",
    founded: 1965,
    competition: "2. Bundesliga",
    cluster: "germany-east",
    kit_family: "blue",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 5, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1],
    identity_summary:
      "Magdeburg's East German club, still carrying a 1974 European night as civic memory.",
    notes:
      "Founded 1965. 1974 Cup Winners' Cup is documented. Do not invent present-day ideology.",
  }),
  row({
    slug: "1-fc-nurnberg",
    name: "1. FC Nurnberg",
    city: "Nuremberg",
    country: "Germany",
    founded: 1900,
    competition: "2. Bundesliga",
    cluster: "germany-south",
    kit_family: "red",
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 6, 4, 5],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Nuremberg's old club, still called Der Club, living more on history than on present titles.",
    exclusion_clubs: ["greuther-furth"],
    notes:
      "Founded 1900. Historic title count is documented. H1/H4 move for the gap between past glory and now.",
  }),
  civic({
    slug: "vfl-osnabruck",
    name: "VfL Osnabruck",
    city: "Osnabruck",
    country: "Germany",
    founded: 1899,
    competition: "2. Bundesliga",
    cluster: "germany-west",
    kit_family: "purple",
    identity_summary:
      "Osnabruck's civic club in purple. The town is the identity, not a locked idea.",
  }),
  row({
    slug: "vfl-wolfsburg",
    name: "VfL Wolfsburg",
    city: "Wolfsburg",
    country: "Germany",
    founded: 1945,
    competition: "2. Bundesliga",
    cluster: "germany-north",
    kit_family: "green",
    vector: [4, 4, 3, 4, 4, 4, 3, 4, 5, 3, 2, 4],
    confidence: [1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 2, 1],
    identity_summary:
      "Wolfsburg is the Volkswagen works club. A company town side, not a folk rebellion.",
    notes:
      "Founded 1945. VW link is documented. S3 moves toward establishment. Current table ignored.",
  }),
  row({
    slug: "as-saint-etienne",
    name: "AS Saint-Etienne",
    city: "Saint-Etienne",
    country: "France",
    founded: 1919,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "green",
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 6, 4, 6],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Saint-Etienne is Les Verts. A working-city club that still lives on older glory.",
    notes:
      "Founded 1919. Historic French titles and the green shirt are documented. Current division ignored.",
  }),
  civic({
    slug: "fc-annecy",
    name: "FC Annecy",
    city: "Annecy",
    country: "France",
    founded: 1927,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "red",
    identity_summary:
      "Annecy's civic club by the lake. The town is the identity, not a locked idea.",
  }),
  row({
    slug: "stade-de-reims",
    name: "Stade de Reims",
    city: "Reims",
    country: "France",
    founded: 1931,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "red",
    vector: [5, 4, 4, 6, 4, 4, 4, 4, 6, 6, 4, 5],
    confidence: [2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Reims is an old French champion living on memory more than on present titles.",
    notes:
      "Founded 1931. 1950s European nights are documented. H4/S2 move for heritage, not current form.",
  }),
  civic({
    slug: "fc-metz",
    name: "FC Metz",
    city: "Metz",
    country: "France",
    founded: 1932,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "claret",
    identity_summary:
      "Metz's civic club in Lorraine, known for the grenat shirt more than a locked idea.",
  }),
  civic({
    slug: "montpellier-hsc",
    name: "Montpellier HSC",
    city: "Montpellier",
    country: "France",
    founded: 1974,
    competition: "Ligue 2",
    cluster: "france-south",
    kit_family: "orange",
    identity_summary:
      "Montpellier's civic club. One title does not lock a playing idea. The city is the identity.",
    notes: "Founded 1974. 2012 title ignored as a one-off. Civic only.",
  }),
  row({
    slug: "red-star-fc",
    name: "Red Star FC",
    city: "Saint-Ouen",
    country: "France",
    founded: 1897,
    competition: "Ligue 2",
    cluster: "france-capital",
    kit_family: "green",
    vector: [4, 4, 6, 6, 4, 4, 4, 4, 6, 5, 7, 6],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity_summary:
      "Red Star is Saint-Ouen's historic club, known for a left-wing, working-class stance.",
    notes:
      "Founded 1897 by Jules Rimet. Green home shirt. Political and suburb identity is widely documented. Style left at 4.",
  }),
  civic({
    slug: "as-nancy-lorraine",
    name: "AS Nancy-Lorraine",
    city: "Nancy",
    country: "France",
    founded: 1967,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "red",
    identity_summary:
      "Nancy's civic club in Lorraine. The city is the identity, not a locked idea.",
  }),
  civic({
    slug: "rodez-aveyron",
    name: "Rodez Aveyron",
    city: "Rodez",
    country: "France",
    founded: 1929,
    competition: "Ligue 2",
    cluster: "france-south",
    kit_family: "red",
    identity_summary:
      "Rodez's civic club in Aveyron. A small-town side without a locked idea.",
  }),
  row({
    slug: "fc-sochaux-montbeliard",
    name: "FC Sochaux-Montbeliard",
    city: "Montbeliard",
    country: "France",
    founded: 1928,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "yellow",
    vector: [4, 4, 5, 5, 4, 4, 5, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 1],
    identity_summary:
      "Sochaux is the old Peugeot works club. A factory-town side, not a capital brand.",
    notes:
      "Founded 1928 by Peugeot. Works-club origin is documented. Current ownership ignored.",
  }),
  civic({
    slug: "usl-dunkerque",
    name: "USL Dunkerque",
    city: "Dunkirk",
    country: "France",
    founded: 1909,
    competition: "Ligue 2",
    cluster: "france-north",
    kit_family: "blue",
    identity_summary:
      "Dunkirk's civic port club. The town is the identity, not a locked idea.",
  }),
  row({
    slug: "en-avant-guingamp",
    name: "En Avant Guingamp",
    city: "Guingamp",
    country: "France",
    founded: 1912,
    competition: "Ligue 2",
    cluster: "france-west",
    kit_family: "red",
    vector: [4, 4, 6, 5, 4, 4, 4, 4, 7, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Guingamp is a small Breton town club that reached cups without becoming a city brand.",
    notes:
      "Founded 1912. Small-town cup story is documented. Style left at 4.",
  }),
  civic({
    slug: "pau-fc",
    name: "Pau FC",
    city: "Pau",
    country: "France",
    founded: 1920,
    competition: "Ligue 2",
    cluster: "france-south",
    kit_family: "yellow",
    identity_summary:
      "Pau's civic club in the Pyrenees. The town is the identity, not a locked idea.",
  }),
  civic({
    slug: "us-boulogne-cote-d-opale",
    name: "US Boulogne Cote d'Opale",
    city: "Boulogne-sur-Mer",
    country: "France",
    founded: 1898,
    competition: "Ligue 2",
    cluster: "france-north",
    kit_family: "red",
    identity_summary:
      "Boulogne's civic club on the Channel. A port-town side without a locked idea.",
  }),
  civic({
    slug: "clermont-foot-63",
    name: "Clermont Foot 63",
    city: "Clermont-Ferrand",
    country: "France",
    founded: 1911,
    competition: "Ligue 2",
    cluster: "france-centre",
    kit_family: "blue",
    identity_summary:
      "Clermont-Ferrand's civic club. The city is the identity, not a locked idea.",
  }),
];

const BATCH_008 = [
  row({
    slug: "fc-nantes",
    name: "FC Nantes",
    city: "Nantes",
    country: "France",
    founded: 1943,
    competition: "Ligue 2",
    cluster: "france-west",
    kit_family: "yellow",
    vector: [4, 4, 4, 5, 5, 4, 5, 5, 6, 5, 4, 5],
    confidence: [1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 1, 1],
    identity_summary:
      "Nantes is the yellow club of the west, still tied to an old academy idea more than to buying stars.",
    notes:
      "Founded 1943. Canaries shirt and former academy reputation are documented. M1/M4 at 5 are light reads, confidence 1.",
  }),
  civic({
    slug: "grenoble-foot-38",
    name: "Grenoble Foot 38",
    city: "Grenoble",
    country: "France",
    founded: 1911,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "blue",
    identity_summary:
      "Grenoble's civic club in the Alps. The city is the identity, not a locked idea.",
  }),
  civic({
    slug: "stade-lavallois",
    name: "Stade Lavallois",
    city: "Laval",
    country: "France",
    founded: 1902,
    competition: "Ligue 2",
    cluster: "france-west",
    kit_family: "orange",
    identity_summary:
      "Laval's civic club. An orange-shirt town side without a locked football idea.",
  }),
  civic({
    slug: "dijon-fco",
    name: "Dijon FCO",
    city: "Dijon",
    country: "France",
    founded: 1998,
    competition: "Ligue 2",
    cluster: "france-east",
    kit_family: "red",
    identity_summary:
      "Dijon's civic club. A young city side without a locked football idea.",
    notes: "Current club founded 1998. Civic only.",
  }),
  civic({
    slug: "birmingham-city",
    name: "Birmingham City",
    city: "Birmingham",
    country: "England",
    founded: 1875,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "blue",
    identity_summary:
      "Birmingham's civic club in blue. The city is the identity, not a locked idea.",
    exclusion_clubs: ["aston-villa"],
  }),
  civic({
    slug: "blackburn-rovers",
    name: "Blackburn Rovers",
    city: "Blackburn",
    country: "England",
    founded: 1875,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "blue",
    identity_summary:
      "Blackburn's civic club. One old title does not lock a present idea.",
    notes: "Founded 1875. 1995 title treated as history, not current identity.",
  }),
  civic({
    slug: "bolton-wanderers",
    name: "Bolton Wanderers",
    city: "Bolton",
    country: "England",
    founded: 1874,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "white",
    identity_summary:
      "Bolton's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "bristol-city",
    name: "Bristol City",
    city: "Bristol",
    country: "England",
    founded: 1894,
    competition: "EFL Championship",
    cluster: "england-west",
    kit_family: "red",
    identity_summary:
      "Bristol's civic club in red. The city is the identity, not a locked idea.",
  }),
  row({
    slug: "burnley",
    name: "Burnley",
    city: "Burnley",
    country: "England",
    founded: 1882,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "claret",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 7, 6, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Burnley is a small-town claret club. Turf Moor and the town are the identity.",
    notes:
      "Founded 1882. Small-town and claret identity are documented. Current ownership ignored.",
  }),
  civic({
    slug: "cardiff-city",
    name: "Cardiff City",
    city: "Cardiff",
    country: "Wales",
    founded: 1899,
    competition: "EFL Championship",
    cluster: "england-west",
    kit_family: "blue",
    identity_summary:
      "Cardiff's civic club. The city is the identity. The home shirt here is blue.",
    notes:
      "Founded 1899. Kit family is the current blue home, not the red era.",
  }),
  civic({
    slug: "charlton-athletic",
    name: "Charlton Athletic",
    city: "London",
    country: "England",
    founded: 1905,
    competition: "EFL Championship",
    cluster: "england-london",
    kit_family: "red",
    identity_summary:
      "Charlton's civic club in south-east London. The area is the identity, not a locked idea.",
  }),
  civic({
    slug: "derby-county",
    name: "Derby County",
    city: "Derby",
    country: "England",
    founded: 1884,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "white",
    identity_summary:
      "Derby's civic club. An old league name, local in feeling, not a locked idea.",
  }),
  civic({
    slug: "lincoln-city",
    name: "Lincoln City",
    city: "Lincoln",
    country: "England",
    founded: 1884,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "red",
    identity_summary:
      "Lincoln's civic club. The city is the identity, not a locked football idea.",
  }),
  civic({
    slug: "middlesbrough",
    name: "Middlesbrough",
    city: "Middlesbrough",
    country: "England",
    founded: 1876,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "red",
    identity_summary:
      "Middlesbrough's civic club on the Tees. The town is the identity, not a locked idea.",
  }),
  row({
    slug: "millwall",
    name: "Millwall",
    city: "London",
    country: "England",
    founded: 1885,
    competition: "EFL Championship",
    cluster: "england-london",
    kit_family: "blue",
    vector: [5, 6, 6, 6, 4, 4, 4, 4, 6, 5, 7, 6],
    confidence: [2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2],
    identity_summary:
      "Millwall's identity is defiant and local, a south London club that does not seek approval.",
    notes:
      "Founded 1885. Outsider reputation is widely documented. Do not invent chants. Style left at 4.",
  }),
  civic({
    slug: "norwich-city",
    name: "Norwich City",
    city: "Norwich",
    country: "England",
    founded: 1902,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Norwich's civic club, the Canaries. The city and the yellow shirt are the identity.",
  }),
  row({
    slug: "portsmouth",
    name: "Portsmouth",
    city: "Portsmouth",
    country: "England",
    founded: 1898,
    competition: "EFL Championship",
    cluster: "england-south",
    kit_family: "blue",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Portsmouth is a naval-city club. The city and the blue shirt are the identity.",
    notes: "Founded 1898. Port-city civic identity is documented. Style left at 4.",
  }),
  row({
    slug: "preston-north-end",
    name: "Preston North End",
    city: "Preston",
    country: "England",
    founded: 1880,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "white",
    vector: [4, 4, 4, 5, 4, 4, 4, 4, 6, 7, 4, 5],
    confidence: [1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Preston North End is one of the league's founding clubs. The history is the point.",
    notes:
      "Founded 1880. First Football League champions. S2 moves for that documented origin story.",
  }),
  civic({
    slug: "queens-park-rangers",
    name: "Queens Park Rangers",
    city: "London",
    country: "England",
    founded: 1882,
    competition: "EFL Championship",
    cluster: "england-london",
    kit_family: "blue",
    identity_summary:
      "QPR is a west London civic club. The hoops are colour, not a locked idea.",
  }),
  civic({
    slug: "sheffield-united",
    name: "Sheffield United",
    city: "Sheffield",
    country: "England",
    founded: 1889,
    competition: "EFL Championship",
    cluster: "england-north",
    kit_family: "red",
    identity_summary:
      "Sheffield's Blades. A civic steel-city club, not a locked playing idea.",
    exclusion_clubs: ["sheffield-wednesday"],
  }),
];

const BATCH_009 = [
  civic({
    slug: "southampton",
    name: "Southampton",
    city: "Southampton",
    country: "England",
    founded: 1885,
    competition: "EFL Championship",
    cluster: "england-south",
    kit_family: "red",
    identity_summary:
      "Southampton's civic club. The city and the academy name are clearer than a locked idea.",
    notes:
      "Founded 1885. Academy reputation is known; M3 left at 4 because it is not unique enough here.",
  }),
  civic({
    slug: "stoke-city",
    name: "Stoke City",
    city: "Stoke-on-Trent",
    country: "England",
    founded: 1863,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "red",
    identity_summary:
      "Stoke's civic club. An old name, local in feeling, not a locked football idea.",
  }),
  civic({
    slug: "swansea-city",
    name: "Swansea City",
    city: "Swansea",
    country: "Wales",
    founded: 1912,
    competition: "EFL Championship",
    cluster: "england-west",
    kit_family: "white",
    identity_summary:
      "Swansea's civic club. The city is the identity, not a locked football idea.",
  }),
  civic({
    slug: "watford",
    name: "Watford",
    city: "Watford",
    country: "England",
    founded: 1881,
    competition: "EFL Championship",
    cluster: "england-london",
    kit_family: "yellow",
    identity_summary:
      "Watford's civic club in yellow. The town is the identity, not a locked idea.",
  }),
  civic({
    slug: "west-bromwich-albion",
    name: "West Bromwich Albion",
    city: "West Bromwich",
    country: "England",
    founded: 1878,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "blue",
    identity_summary:
      "West Brom's civic club. The town is the identity. The home shirt here is navy.",
    notes: "Founded 1878. Navy and white stripes map to blue.",
  }),
  row({
    slug: "west-ham-united",
    name: "West Ham United",
    city: "London",
    country: "England",
    founded: 1895,
    competition: "EFL Championship",
    cluster: "england-london",
    kit_family: "claret",
    vector: [4, 4, 4, 5, 4, 4, 4, 4, 5, 5, 4, 5],
    confidence: [1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "West Ham is an East London claret club. The shirt and the old docks story still sit on the identity.",
    notes:
      "Founded 1895. Claret home shirt. Stadium move is not scored as a new culture. Stay close to 4.",
  }),
  civic({
    slug: "wolverhampton-wanderers",
    name: "Wolverhampton Wanderers",
    city: "Wolverhampton",
    country: "England",
    founded: 1877,
    competition: "EFL Championship",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Wolves are a civic Midlands club. Old gold maps to yellow. The city is the identity.",
    notes: "Founded 1877. Gold ⊂ yellow. Current ownership ignored.",
  }),
  row({
    slug: "wrexham",
    name: "Wrexham",
    city: "Wrexham",
    country: "Wales",
    founded: 1864,
    competition: "EFL Championship",
    cluster: "england-west",
    kit_family: "red",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Wrexham is a historic Welsh club. Recent fame is ownership, not the older identity.",
    notes:
      "Founded 1864. Racecourse Ground age is documented. Hollywood ownership ignored for culture scores.",
  }),
  row({
    slug: "afc-wimbledon",
    name: "AFC Wimbledon",
    city: "London",
    country: "England",
    founded: 2002,
    competition: "EFL League One",
    cluster: "england-london",
    kit_family: "blue",
    vector: [5, 4, 7, 7, 4, 4, 4, 4, 6, 4, 7, 7],
    confidence: [2, 1, 2, 2, 1, 1, 1, 1, 2, 1, 2, 2],
    identity_summary:
      "AFC Wimbledon was founded by supporters after the club was moved. The phoenix is the identity.",
    exclusion_clubs: ["milton-keynes-dons"],
    notes:
      "Founded 2002 by Wimbledon supporters. Phoenix-club story is documented. Do not invent present-day style.",
  }),
  civic({
    slug: "barnsley",
    name: "Barnsley",
    city: "Barnsley",
    country: "England",
    founded: 1887,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "red",
    identity_summary:
      "Barnsley's civic club. A South Yorkshire town side without a locked idea.",
  }),
  civic({
    slug: "blackpool",
    name: "Blackpool",
    city: "Blackpool",
    country: "England",
    founded: 1887,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "orange",
    identity_summary:
      "Blackpool's civic club in tangerine. The town and the shirt are the identity.",
  }),
  civic({
    slug: "bradford-city",
    name: "Bradford City",
    city: "Bradford",
    country: "England",
    founded: 1903,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "claret",
    identity_summary:
      "Bradford's civic club in claret and amber. The city is the identity, not a locked idea.",
  }),
  civic({
    slug: "bromley",
    name: "Bromley",
    city: "London",
    country: "England",
    founded: 1892,
    competition: "EFL League One",
    cluster: "england-london",
    kit_family: "white",
    identity_summary:
      "Bromley's civic club in south-east London. A town side without a locked idea.",
  }),
  civic({
    slug: "burton-albion",
    name: "Burton Albion",
    city: "Burton upon Trent",
    country: "England",
    founded: 1950,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Burton's civic club. A small-town side without a locked football idea.",
  }),
  civic({
    slug: "cambridge-united",
    name: "Cambridge United",
    city: "Cambridge",
    country: "England",
    founded: 1912,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Cambridge's civic club in amber. The city is the identity, not a locked idea.",
  }),
  civic({
    slug: "doncaster-rovers",
    name: "Doncaster Rovers",
    city: "Doncaster",
    country: "England",
    founded: 1879,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "red",
    identity_summary:
      "Doncaster's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "huddersfield-town",
    name: "Huddersfield Town",
    city: "Huddersfield",
    country: "England",
    founded: 1908,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "blue",
    identity_summary:
      "Huddersfield's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "leicester-city",
    name: "Leicester City",
    city: "Leicester",
    country: "England",
    founded: 1884,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "blue",
    identity_summary:
      "Leicester's civic club. One title season is not treated as a locked culture.",
    notes: "Founded 1884. 2016 title left out of the vector. Civic only.",
  }),
  civic({
    slug: "leyton-orient",
    name: "Leyton Orient",
    city: "London",
    country: "England",
    founded: 1881,
    competition: "EFL League One",
    cluster: "england-london",
    kit_family: "red",
    identity_summary:
      "Leyton Orient is an East London civic club. The area is the identity, not a locked idea.",
  }),
  row({
    slug: "luton-town",
    name: "Luton Town",
    city: "Luton",
    country: "England",
    founded: 1885,
    competition: "EFL League One",
    cluster: "england-london",
    kit_family: "orange",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 5, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Luton's civic club at Kenilworth Road. A tight, local ground is the identity more than a style.",
    notes:
      "Founded 1885. Kenilworth Road civic story is documented. Style left at 4.",
  }),
];

const BATCH_010 = [
  civic({
    slug: "mansfield-town",
    name: "Mansfield Town",
    city: "Mansfield",
    country: "England",
    founded: 1897,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Mansfield's civic club in amber. The town is the identity, not a locked idea.",
  }),
  row({
    slug: "milton-keynes-dons",
    name: "Milton Keynes Dons",
    city: "Milton Keynes",
    country: "England",
    founded: 2004,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "white",
    vector: [4, 4, 3, 4, 4, 4, 4, 4, 4, 2, 3, 4],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 2, 1],
    identity_summary:
      "MK Dons exist because a club was moved to a new town. The identity is modern and contested.",
    exclusion_clubs: ["afc-wimbledon"],
    notes:
      "Founded 2004 after the Wimbledon relocation. S2/S3 move for that documented origin. Do not invent present culture.",
  }),
  row({
    slug: "notts-county",
    name: "Notts County",
    city: "Nottingham",
    country: "England",
    founded: 1862,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "black",
    vector: [4, 4, 5, 5, 4, 4, 4, 4, 6, 7, 4, 5],
    confidence: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 2],
    identity_summary:
      "Notts County is the world's oldest professional club still playing.",
    exclusion_clubs: ["nottingham-forest"],
    notes:
      "Founded 1862. Oldest Football League club is documented. S2 at 7 for that fact alone.",
  }),
  civic({
    slug: "oxford-united",
    name: "Oxford United",
    city: "Oxford",
    country: "England",
    founded: 1893,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "yellow",
    identity_summary:
      "Oxford's civic club in yellow. The city is the identity, not a locked idea.",
  }),
  civic({
    slug: "peterborough-united",
    name: "Peterborough United",
    city: "Peterborough",
    country: "England",
    founded: 1934,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "blue",
    identity_summary:
      "Peterborough's civic club. The town is the identity, not a locked football idea.",
  }),
  row({
    slug: "plymouth-argyle",
    name: "Plymouth Argyle",
    city: "Plymouth",
    country: "England",
    founded: 1886,
    competition: "EFL League One",
    cluster: "england-south",
    kit_family: "green",
    vector: [4, 4, 5, 4, 4, 4, 4, 4, 7, 5, 4, 5],
    confidence: [1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1],
    identity_summary:
      "Plymouth's civic club at the far south-west. Distance and the green shirt are the identity.",
    notes:
      "Founded 1886. Geographic isolation is documented civic identity. Style left at 4.",
  }),
  civic({
    slug: "reading",
    name: "Reading",
    city: "Reading",
    country: "England",
    founded: 1871,
    competition: "EFL League One",
    cluster: "england-south",
    kit_family: "blue",
    identity_summary:
      "Reading's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "sheffield-wednesday",
    name: "Sheffield Wednesday",
    city: "Sheffield",
    country: "England",
    founded: 1867,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "blue",
    identity_summary:
      "Sheffield's Owls. A civic steel-city club, not a locked playing idea.",
    exclusion_clubs: ["sheffield-united"],
  }),
  civic({
    slug: "stevenage",
    name: "Stevenage",
    city: "Stevenage",
    country: "England",
    founded: 1976,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "red",
    identity_summary:
      "Stevenage's civic club. A new-town side without a locked football idea.",
  }),
  civic({
    slug: "stockport-county",
    name: "Stockport County",
    city: "Stockport",
    country: "England",
    founded: 1883,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "blue",
    identity_summary:
      "Stockport's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "wigan-athletic",
    name: "Wigan Athletic",
    city: "Wigan",
    country: "England",
    founded: 1932,
    competition: "EFL League One",
    cluster: "england-north",
    kit_family: "blue",
    identity_summary:
      "Wigan's civic club. The town is the identity, not a locked football idea.",
  }),
  civic({
    slug: "wycombe-wanderers",
    name: "Wycombe Wanderers",
    city: "High Wycombe",
    country: "England",
    founded: 1887,
    competition: "EFL League One",
    cluster: "midlands",
    kit_family: "blue",
    identity_summary:
      "Wycombe's civic club. A town side without a locked football idea.",
  }),
];

function patchArrayFile(relPath, extraFields = (row) => row) {
  const path = join(ROOT, relPath);
  const rows = JSON.parse(readFileSync(path, "utf8"));
  const next = rows.map((c) => {
    const kit = KIT_BY_SLUG[c.slug];
    if (!kit) {
      throw new Error(`No kit_family mapped for ${c.slug} in ${relPath}`);
    }
    return extraFields({ ...c, kit_family: kit });
  });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next.length;
}

const n001 = patchArrayFile("data/tier-b/scored/001.json");
const n002 = patchArrayFile("data/tier-b/scored/002.json");
const n003 = patchArrayFile("data/tier-b/scored/003.json");
const n004 = patchArrayFile("data/tier-b/scored/004.json");
const nA = patchArrayFile("data/tier-a/clubs.json");
const nPl = patchArrayFile("data/tier-b/premier-league-2026-27.json");

writeFileSync(
  join(ROOT, "data/tier-b/scored/005.json"),
  `${JSON.stringify(BATCH_005, null, 2)}\n`,
);
writeFileSync(
  join(ROOT, "data/tier-b/scored/006.json"),
  `${JSON.stringify(BATCH_006, null, 2)}\n`,
);
writeFileSync(
  join(ROOT, "data/tier-b/scored/007.json"),
  `${JSON.stringify(BATCH_007, null, 2)}\n`,
);
writeFileSync(
  join(ROOT, "data/tier-b/scored/008.json"),
  `${JSON.stringify(BATCH_008, null, 2)}\n`,
);
writeFileSync(
  join(ROOT, "data/tier-b/scored/009.json"),
  `${JSON.stringify(BATCH_009, null, 2)}\n`,
);
writeFileSync(
  join(ROOT, "data/tier-b/scored/010.json"),
  `${JSON.stringify(BATCH_010, null, 2)}\n`,
);

console.log(
  `kit_family tagged: 001=${n001} 002=${n002} 003=${n003} 004=${n004} tier-a=${nA} pl-extras=${nPl}`,
);
console.log(
  `scored: 005=${BATCH_005.length} 006=${BATCH_006.length} 007=${BATCH_007.length} 008=${BATCH_008.length} 009=${BATCH_009.length} 010=${BATCH_010.length}`,
);
