/** Short labels for club chips on narrow tiles (max ~10 chars). */
const ABBREVIATIONS = {
  "Atletico Madrid": "Atlético",
  "Atlético Madrid": "Atlético",
  "Manchester United": "Man Utd",
  "Manchester City": "Man City",
  "Tottenham Hotspur": "Spurs",
  "Newcastle United": "Newcastle",
  "Nottingham Forest": "Nott'm",
  "Wolverhampton Wanderers": "Wolves",
  "Internazionale": "Inter",
  "Bayern Munich": "Bayern",
  "Borussia Dortmund": "Dortmund",
  "Borussia Mönchengladbach": "Gladbach",
  "Paris Saint-Germain": "PSG",
  "Real Madrid": "Real Madrid",
  "Barcelona": "Barcelona",
};

export function abbreviateClub(name) {
  if (!name) return "";
  if (ABBREVIATIONS[name]) return ABBREVIATIONS[name];
  if (name.length <= 10) return name;
  const words = name.split(/\s+/);
  if (words.length > 1 && words[0].length <= 10) return words[0];
  return `${name.slice(0, 9)}…`;
}
