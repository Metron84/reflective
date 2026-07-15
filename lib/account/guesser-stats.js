import { GUESSER_MODES, gstDay } from "@/lib/guesser/config";

function dayBefore(dateStr) {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function parsePlayRow(play) {
  const guesses = play.guesses ?? {};
  const revealed = Array.isArray(guesses.revealedClues)
    ? guesses.revealedClues
    : [];
  return {
    puzzleDate: play.puzzle_date,
    mode: play.mode,
    solved: Boolean(play.solved),
    attempts: Number(play.attempts) || 0,
    cluesUsed: revealed.length,
  };
}

function computeWinStreaks(plays) {
  const sorted = [...plays].sort((a, b) =>
    a.puzzleDate.localeCompare(b.puzzleDate)
  );
  const byDate = new Map(sorted.map((p) => [p.puzzleDate, p]));

  let best = 0;
  let run = 0;
  let prevDate = null;

  for (const play of sorted) {
    if (!play.solved) {
      run = 0;
      prevDate = null;
      continue;
    }
    if (prevDate && dayBefore(play.puzzleDate) === prevDate) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prevDate = play.puzzleDate;
  }

  let current = 0;
  let cursor = gstDay();
  if (!byDate.get(cursor)?.solved) {
    cursor = dayBefore(cursor);
  }
  while (byDate.get(cursor)?.solved) {
    current += 1;
    cursor = dayBefore(cursor);
  }

  return { current, best };
}

function guessDistribution(plays) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const play of plays) {
    if (!play.solved) continue;
    const key = Math.min(6, Math.max(1, play.attempts));
    dist[key] += 1;
  }
  return dist;
}

export function buildModeStats(allPlays) {
  const parsed = allPlays.map(parsePlayRow);

  return GUESSER_MODES.map((modeConfig) => {
    const modePlays = parsed.filter((p) => p.mode === modeConfig.slug);
    const played = modePlays.length;
    const won = modePlays.filter((p) => p.solved).length;
    const streaks = computeWinStreaks(modePlays);
    const distribution = guessDistribution(modePlays);
    const solvedPlays = modePlays.filter((p) => p.solved);
    const avgClues =
      solvedPlays.length > 0
        ? solvedPlays.reduce((sum, p) => sum + p.cluesUsed, 0) / solvedPlays.length
        : null;

    return {
      slug: modeConfig.slug,
      name: modeConfig.name,
      free: modeConfig.free,
      played,
      won,
      currentStreak: streaks.current,
      bestStreak: streaks.best,
      distribution,
      avgClues,
      hasPlayed: played > 0,
    };
  });
}

export function buildShareStatsLine(modeStats) {
  const played = modeStats.filter((m) => m.hasPlayed);
  if (!played.length) {
    return "My Reflective Football Programme\nNo Guesser boards yet.\nthereflectivefootball.com/account";
  }
  const lines = played.map((m) => {
    const streak = m.currentStreak > 0 ? ` 🔥${m.currentStreak}` : "";
    const clues =
      m.avgClues != null ? ` · ${m.avgClues.toFixed(1)} clues avg` : "";
    return `${m.name}${streak} · ${m.won}/${m.played} won${clues}`;
  });
  return [
    "My Reflective Football Programme",
    ...lines,
    "thereflectivefootball.com/account",
  ].join("\n");
}
