/**
 * Pure form helpers. All numbers come from already-synced fixture and stat rows.
 * Nothing is written by hand.
 */

export function clubKey(nameOrId) {
  if (nameOrId == null) return "";
  return String(nameOrId).trim().toLowerCase();
}

export function resultForClub(fixture, club) {
  const homeId = fixture.home_club_id;
  const awayId = fixture.away_club_id;
  const homeName = clubKey(fixture.home_club);
  const awayName = clubKey(fixture.away_club);
  const match = clubKey(club.name) || club.club_id;

  const isHome =
    (club.club_id != null && homeId != null && Number(club.club_id) === Number(homeId)) ||
    (homeName && homeName === clubKey(club.name));
  const isAway =
    (club.club_id != null && awayId != null && Number(club.club_id) === Number(awayId)) ||
    (awayName && awayName === clubKey(club.name));

  if (!isHome && !isAway) return null;
  if (fixture.home_score == null || fixture.away_score == null) return null;

  const gf = isHome ? Number(fixture.home_score) : Number(fixture.away_score);
  const ga = isHome ? Number(fixture.away_score) : Number(fixture.home_score);
  let result = "D";
  if (gf > ga) result = "W";
  if (gf < ga) result = "L";

  return {
    fixtureId: fixture.id,
    kickoff: fixture.kickoff_at ?? fixture.kickoff,
    isHome,
    gf,
    ga,
    result,
    cleanSheet: ga === 0,
    over25: gf + ga > 2.5,
    btts: gf > 0 && ga > 0,
  };
}

export function resultsForClub(fixtures, club) {
  return (fixtures ?? [])
    .map((fix) => resultForClub(fix, club))
    .filter(Boolean)
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
}

function countRun(results, pred) {
  let n = 0;
  for (const row of results) {
    if (!pred(row)) break;
    n += 1;
  }
  return n;
}

export function winStreak(results) {
  return countRun(results, (row) => row.result === "W");
}

export function unbeatenRun(results) {
  return countRun(results, (row) => row.result !== "L");
}

export function cleanSheetStreak(results) {
  return countRun(results, (row) => row.cleanSheet);
}

export function winlessRun(results) {
  return countRun(results, (row) => row.result !== "W");
}

export function goalsOver(results, n) {
  const slice = results.slice(0, n);
  return {
    for: slice.reduce((sum, row) => sum + row.gf, 0),
    against: slice.reduce((sum, row) => sum + row.ga, 0),
  };
}

function pct(rows, pred) {
  if (!rows.length) return null;
  return Math.round((rows.filter(pred).length / rows.length) * 100);
}

export function last10Rates(results) {
  const slice = results.slice(0, 10);
  if (slice.length < 3) return null;
  return {
    over25: pct(slice, (row) => row.over25),
    btts: pct(slice, (row) => row.btts),
    cleanSheet: pct(slice, (row) => row.cleanSheet),
  };
}

export function homeAwaySplit(results) {
  const home = results.filter((row) => row.isHome);
  const away = results.filter((row) => !row.isHome);
  return {
    home: home.slice(0, 5).map((row) => row.result),
    away: away.slice(0, 5).map((row) => row.result),
  };
}

export function heatScore(results) {
  const last5 = results.slice(0, 5);
  return last5.reduce((sum, row) => {
    if (row.result === "W") return sum + 3;
    if (row.result === "D") return sum + 1;
    return sum - 1;
  }, 0);
}

export function buildTeamForm(fixtures, clubs) {
  const rows = [];
  for (const club of clubs ?? []) {
    const results = resultsForClub(fixtures, club);
    if (results.length < 3) continue;
    const last5 = results.slice(0, 5);
    rows.push({
      clubId: club.club_id,
      club: club.club_name ?? club.name,
      league: club.league,
      leagueCode: club.league_code,
      last5: last5.map((row) => row.result),
      winStreak: winStreak(results),
      unbeaten: unbeatenRun(results),
      cleanSheets: cleanSheetStreak(results),
      winless: winlessRun(results),
      goals: goalsOver(results, 5),
      rates: last10Rates(results),
      split: homeAwaySplit(results),
      heat: heatScore(results),
    });
  }
  return rows;
}

export function pickHotCold(teamRows, league = "all") {
  const pool =
    league === "all" ? teamRows : teamRows.filter((row) => row.league === league);
  const hot = [...pool].sort((a, b) => b.heat - a.heat).slice(0, 5);
  const cold = [...pool].sort((a, b) => a.heat - b.heat).slice(0, 5);
  return { hot, cold };
}

export function appearancesForPlayer(stats) {
  return [...(stats ?? [])]
    .filter((row) => row.minutes == null || Number(row.minutes) > 0 || row.rating != null)
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
}

export function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

export function avg(rows, field) {
  const values = rows.map((row) => Number(row[field])).filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildPlayerForm(statRows) {
  const byPlayer = new Map();
  for (const row of statRows ?? []) {
    if (!row.player_id) continue;
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }

  const out = [];
  for (const [playerId, rows] of byPlayer) {
    const apps = appearancesForPlayer(rows);
    if (apps.length < 3) continue;
    const last3 = apps.slice(0, 3);
    const last5 = apps.slice(0, 5);
    const last3Rating = avg(last3, "rating");
    const seasonRating = avg(apps, "rating");
    const minutes = last3.map((row) => Number(row.minutes)).filter((n) => Number.isFinite(n));
    const minutesFalling =
      minutes.length === 3 && minutes[0] < 60 && minutes[0] < minutes[2];

    out.push({
      playerId,
      league: apps[0].league,
      last3: {
        goals: sumField(last3, "goals"),
        assists: sumField(last3, "assists"),
        rating: last3Rating,
      },
      last5: {
        goals: sumField(last5, "goals"),
        assists: sumField(last5, "assists"),
      },
      recent: last5.map((row) => ({
        goals: Number(row.goals ?? 0),
        assists: Number(row.assists ?? 0),
        rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
      })),
      seasonRating,
      ratingDelta:
        last3Rating != null && seasonRating != null ? last3Rating - seasonRating : null,
      minutesTrend: minutes,
      minutesFlag: minutesFalling,
    });
  }
  return out;
}
