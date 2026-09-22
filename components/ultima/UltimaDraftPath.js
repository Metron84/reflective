import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_MAX_SEATS,
} from "@/lib/ultima/constants";
import { playerSurname } from "@/lib/ultima/draft/last-picks";
import { leagueDeficits, countByLeague } from "@/lib/ultima/draft/floor";
import styles from "./ultima.module.css";

function pickNumberFor(round, slot, seats) {
  const position = round % 2 === 1 ? slot : seats - slot + 1;
  return (round - 1) * seats + position;
}

export default function UltimaDraftPath({
  managers = [],
  picks = [],
  currentPick = 0,
  youId = null,
  fullHistory = false,
  onOpenHistory,
}) {
  const seats = managers.length || ULTIMA_MAX_SEATS;
  const ordered = [...managers].sort((a, b) => (a.draft_slot ?? 0) - (b.draft_slot ?? 0));
  const byNumber = new Map(picks.map((p) => [p.pick_number, p]));
  const round = Math.min(
    ULTIMA_DRAFT_ROUNDS,
    Math.max(1, Math.ceil((currentPick || 1) / seats)),
  );
  const direction = round % 2 === 1 ? "left to right" : "right to left";
  const start = (round - 1) * seats + 1;
  const roundPicks = Array.from({ length: seats }, (_, i) => start + i);
  const you = ordered.find((m) => m.id === youId);
  const yourLine = [];
  if (you) {
    for (let r = 1; r <= ULTIMA_DRAFT_ROUNDS; r += 1) {
      const n = pickNumberFor(r, you.draft_slot ?? 1, seats);
      const pick = byNumber.get(n);
      if (pick?.player) yourLine.push({ round: r, pick });
    }
  }

  const needs = ordered.map((m) => {
    const roster = picks
      .filter((p) => p.manager_id === m.id)
      .map((p) => p.player)
      .filter(Boolean);
    const deficits = leagueDeficits(countByLeague(roster));
    const short = Object.entries(deficits)
      .filter(([, n]) => n > 0)
      .map(([league, n]) => `${ULTIMA_LEAGUE_SHORT[league] ?? league} NEED ${n}`);
    return {
      id: m.id,
      name: m.id === youId ? "You" : m.team_name,
      line: short.length ? short.join(" · ") : "floors met",
    };
  });

  return (
    <div className={styles.deskPath}>
      <p className={styles.deskPathEyebrow}>
        Round {round} · {start}–{start + seats - 1} · {direction}
      </p>
      <ol className={styles.deskPathRound}>
        {roundPicks.map((n) => {
          const pick = byNumber.get(n);
          const manager = ordered.find((m) => {
            const slot = m.draft_slot ?? 1;
            return pickNumberFor(round, slot, seats) === n;
          });
          const isCurrent = n === currentPick;
          const label = pick?.player
            ? `${playerSurname(pick.player.name)} · ${ULTIMA_LEAGUE_SHORT[pick.player.league] ?? ""}`
            : isCurrent
              ? "Current pick"
              : "Waiting";
          return (
            <li
              key={n}
              className={isCurrent ? styles.deskPathCurrent : styles.deskPathItem}
            >
              <span className={styles.deskPathNum}>{n}</span>
              <span className={styles.deskPathWho}>
                {manager?.id === youId ? "You" : manager?.team_name ?? "Seat"}
              </span>
              <span className={styles.deskPathWhat}>{label}</span>
            </li>
          );
        })}
      </ol>

      <p className={styles.deskPathEyebrow}>My draft line</p>
      {yourLine.length ? (
        <ul className={styles.deskPathMine}>
          {yourLine.map((row) => (
            <li key={row.round}>
              R{row.round} {row.pick.player?.name} ·{" "}
              {ULTIMA_LEAGUE_SHORT[row.pick.player?.league] ?? ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.deskMuted}>No picks yet.</p>
      )}

      <p className={styles.deskPathEyebrow}>Manager needs</p>
      <ul className={styles.deskPathNeeds}>
        {needs.map((row) => (
          <li key={row.id}>
            {row.name} · {row.line}
          </li>
        ))}
      </ul>

      {fullHistory || !onOpenHistory ? null : (
        <button type="button" className={styles.boardJumpBtn} onClick={onOpenHistory}>
          Full history
        </button>
      )}
    </div>
  );
}
