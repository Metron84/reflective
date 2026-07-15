// Nationality to confederation, covering every nationality in the
// seed. Historical entities map to their confederation of the era.
const UEFA = [
  "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia",
  "Czech Republic", "Denmark", "England", "France", "Georgia",
  "Germany", "Ireland", "Italy", "Netherlands", "Norway", "Poland",
  "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia",
  "Spain", "Sweden", "Switzerland", "Ukraine", "Wales",
  "West Germany", "Yugoslavia",
];
const CONMEBOL = ["Argentina", "Brazil", "Chile", "Colombia", "Peru", "Uruguay"];
const CAF = [
  "Algeria", "Cameroon", "Egypt", "Gabon", "Guinea", "Ivory Coast",
  "Morocco", "Nigeria", "Senegal",
];
const CONCACAF = ["Canada"];
const AFC = ["South Korea"];

const MAP = new Map();
for (const [confed, list] of [
  ["UEFA", UEFA],
  ["CONMEBOL", CONMEBOL],
  ["CAF", CAF],
  ["CONCACAF", CONCACAF],
  ["AFC", AFC],
]) {
  for (const nation of list) MAP.set(nation, confed);
}

export function confederationOf(nationality) {
  return MAP.get(nationality) ?? null;
}
