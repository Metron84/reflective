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

  // Current streak (Wordle-like): a loss today zeros the streak.
  // No play today still allows a run ending yesterday.
  const today = gstDay();
  const todayPlay = byDate.get(today);
  if (todayPlay && !todayPlay.solved) {
    return { current: 0, best };
  }

  let current = 0;
  let cursor = today;
  if (!todayPlay?.solved) {
    cursor = dayBefore(cursor);
  }
  while (byDate.get(cursor)?.solved) {
    current += 1;
    cursor = dayBefore(cursor);
  }

  return { current, best };
}

/** GST today: not_played | won | lost */
function todayStatusForPlays(modePlays) {
  const today = gstDay();
  const todayPlay = modePlays.find((p) => p.puzzleDate === today);
  if (!todayPlay) return "not_played";
  return todayPlay.solved ? "won" : "lost";
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
      todayStatus: todayStatusForPlays(modePlays),
    };
  });
}

/**
 * One-line Programme summary: boards/votes today + next unfinished action.
 */
export function buildProgrammeTodayLine(modeStats, ballot) {
  const boardTotal = modeStats.length;
  const boardsDone = modeStats.filter(
    (m) => m.todayStatus === "won" || m.todayStatus === "lost"
  ).length;
  const voteTotal = ballot?.total ?? 0;
  const votesIn = ballot?.votedCount ?? 0;

  const nextBoard = modeStats.find((m) => m.todayStatus === "not_played");
  const nextVote = (ballot?.categories ?? []).find((c) => c.open && !c.pick);

  let summary;
  if (boardsDone === 0 && votesIn === 0) {
    summary =
      voteTotal > 0
        ? "Today: no boards yet · ballot open"
        : "Today: no boards yet";
  } else {
    const votePart =
      voteTotal > 0 ? ` · ${votesIn} of ${voteTotal} votes in` : "";
    summary = `Today: ${boardsDone} of ${boardTotal} boards${votePart}`;
  }

  const nextBits = [];
  if (nextBoard) nextBits.push(`play ${nextBoard.name}`);
  if (nextVote) nextBits.push(`cast ${nextVote.name}`);
  if (!nextBits.length) {
    return summary;
  }
  return `${summary}\nNext: ${nextBits.join(" · ")}`;
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
