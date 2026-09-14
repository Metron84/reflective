import { CLUSTER_PRIMARY } from "./club-color.js";
import { hashSlug } from "./color-utils.js";

/** @type {Record<string, { primary: string; secondary: string; stadiumName: string; skylineVariant: number }>} */
export const CLUB_GROUND_BY_SLUG = {
  "real-madrid": {
    primary: "#FEBE10",
    secondary: "#1a2744",
    stadiumName: "Santiago Bernabéu",
    skylineVariant: 1,
  },
  barcelona: {
    primary: "#A50044",
    secondary: "#0d3d7a",
    stadiumName: "Spotify Camp Nou",
    skylineVariant: 2,
  },
  "atletico-madrid": {
    primary: "#CB3524",
    secondary: "#142238",
    stadiumName: "Riyadh Air Metropolitano",
    skylineVariant: 1,
  },
  "athletic-bilbao": {
    primary: "#EE2523",
    secondary: "#1b2a4a",
    stadiumName: "San Mamés",
    skylineVariant: 3,
  },
  everton: {
    primary: "#003399",
    secondary: "#1a2f5c",
    stadiumName: "Hill Dickinson Stadium",
    skylineVariant: 4,
  },
  liverpool: {
    primary: "#C8102E",
    secondary: "#0f1c33",
    stadiumName: "Anfield",
    skylineVariant: 4,
  },
  arsenal: {
    primary: "#EF0107",
    secondary: "#152642",
    stadiumName: "Emirates Stadium",
    skylineVariant: 1,
  },
  "tottenham-hotspur": {
    primary: "#132257",
    secondary: "#2a3550",
    stadiumName: "Tottenham Hotspur Stadium",
    skylineVariant: 2,
  },
  "manchester-city": {
    primary: "#6CABDD",
    secondary: "#0a1628",
    stadiumName: "Etihad Stadium",
    skylineVariant: 5,
  },
  "manchester-united": {
    primary: "#DA291C",
    secondary: "#101828",
    stadiumName: "Old Trafford",
    skylineVariant: 5,
  },
  "newcastle-united": {
    primary: "#241F20",
    secondary: "#2d4a7a",
    stadiumName: "St James' Park",
    skylineVariant: 6,
  },
  celtic: {
    primary: "#00843D",
    secondary: "#0c1f14",
    stadiumName: "Celtic Park",
    skylineVariant: 6,
  },
  juventus: {
    primary: "#000000",
    secondary: "#2a0508",
    stadiumName: "Allianz Stadium",
    skylineVariant: 3,
  },
  napoli: {
    primary: "#12A0D7",
    secondary: "#0a1a30",
    stadiumName: "Diego Armando Maradona",
    skylineVariant: 2,
  },
  roma: {
    primary: "#8B0304",
    secondary: "#1a1210",
    stadiumName: "Stadio Olimpico",
    skylineVariant: 2,
  },
  "borussia-dortmund": {
    primary: "#FDE100",
    secondary: "#1a1200",
    stadiumName: "Signal Iduna Park",
    skylineVariant: 5,
  },
  "bayern-munich": {
    primary: "#DC052D",
    secondary: "#0a1528",
    stadiumName: "Allianz Arena",
    skylineVariant: 3,
  },
  "st-pauli": {
    primary: "#604531",
    secondary: "#1a0f0a",
    stadiumName: "Millerntor-Stadion",
    skylineVariant: 4,
  },
  ajax: {
    primary: "#DA020E",
    secondary: "#0f1a33",
    stadiumName: "Johan Cruijff ArenA",
    skylineVariant: 1,
  },
  marseille: {
    primary: "#2FAEE0",
    secondary: "#0a2848",
    stadiumName: "Orange Vélodrome",
    skylineVariant: 2,
  },
  "al-ahly": {
    primary: "#C8102E",
    secondary: "#1a0508",
    stadiumName: "Cairo International Stadium",
    skylineVariant: 6,
  },
  "wydad-casablanca": {
    primary: "#E30613",
    secondary: "#1a0508",
    stadiumName: "Stade Mohammed V",
    skylineVariant: 6,
  },
  "al-hilal": {
    primary: "#0047BB",
    secondary: "#0a1020",
    stadiumName: "Kingdom Arena",
    skylineVariant: 1,
  },
  "al-ain": {
    primary: "#6C2C91",
    secondary: "#1a0a28",
    stadiumName: "Hazza bin Zayed Stadium",
    skylineVariant: 5,
  },
};

const DEFAULT_SECONDARY = "#1a2438";

/**
 * @param {{ slug?: string; city?: string|null; name?: string; cluster?: string|null; primary?: string|null; secondary?: string|null; stadiumName?: string|null; skylineVariant?: number|null }} club
 */
export function resolveClubGround(club) {
  const slug = club?.slug || "";
  const preset = CLUB_GROUND_BY_SLUG[slug];
  const primary =
    club?.primary?.trim() ||
    preset?.primary ||
    (club?.cluster && CLUSTER_PRIMARY[club.cluster]) ||
    "#0A111F";
  const secondary =
    club?.secondary?.trim() || preset?.secondary || DEFAULT_SECONDARY;
  const city = club?.city?.trim() || "your city";
  const stadiumName =
    club?.stadiumName?.trim() || preset?.stadiumName || "Home ground";
  let skylineVariant =
    club?.skylineVariant ?? preset?.skylineVariant ?? (hashSlug(slug) % 6) + 1;
  skylineVariant = Math.min(6, Math.max(1, Math.round(Number(skylineVariant))));

  return {
    primary,
    secondary,
    city,
    stadiumName,
    skylineVariant,
  };
}
