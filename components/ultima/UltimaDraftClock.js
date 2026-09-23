"use client";

import { useMemo } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { wouldBreakFloor } from "@/lib/ultima/draft/floor";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaRow from "./UltimaRow";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function neededLine(floor) {
  const parts = ULTIMA_LEAGUES.filter((id) => (floor?.deficits?.[id] ?? 0) > 0).map(
    (id) => `${ULTIMA_LEAGUE_SHORT[id]} ${floor.deficits[id]}`,
  );
  if (!parts.length) return "All country floors are met.";
  return `Still needed: ${parts.join(", ")}`;
}

export default function UltimaDraftClock({
  round,
  pickNumber,
  pool = [],
  queue = [],
  byId,
  floor,
  pickBusy = false,
  onDraft,
  onSeeAll,
  onAutoPick,
}) {
  const options = useMemo(() => {
    const counts = floor?.counts ?? {};
    const slotsLeft = floor?.slotsLeft ?? 0;
    const eligible = (player) => !wouldBreakFloor(counts, player.league, slotsLeft);

    const queued = (queue ?? [])
      .map((entry) => byId.get(entry.player_id))
      .filter((player) => player && eligible(player));
    const firstQueued = queued[0] ?? null;

    const ranked = [...pool]
      .filter((player) => eligible(player) && player.id !== firstQueued?.id)
      .sort((a, b) => expectedUltimaPoints(b) - expectedUltimaPoints(a));

    const list = [];
    if (firstQueued) list.push({ player: firstQueued, queued: true });
    for (const player of ranked) {
      if (list.length >= 5) break;
      list.push({ player, queued: false });
    }
    return list;
  }, [byId, floor, pool, queue]);

  const points = options.map((row) => expectedUltimaPoints(row.player));

  return (
    <div className={styles.dClock} role="dialog" aria-modal="true" aria-label="You're on the clock">
      <div className={styles.dClockPanel}>
        <p className={styles.dClockHeadline}>You're on the clock</p>
        <p className={styles.dClockPick}>
          Round {round} · Pick {pickNumber}
        </p>
        <p className={styles.dClockNeed}>{neededLine(floor)}</p>

        {options.map((row) => {
          const pts = expectedUltimaPoints(row.player);
          return (
            <div key={row.player.id} className={styles.dClockOption}>
              <UltimaRow
                primary={row.player.name}
                meta={row.queued ? `${row.player.club || "-"} · Queued` : row.player.club || "-"}
                number={
                  <span className={styles.dClockVals}>
                    <UltimaCountryTag league={row.player.league} />
                    <UltimaValueNumber
                      value={Number.isFinite(pts) ? pts : null}
                      percentile={percentileInList(pts, points)}
                      digits={1}
                    />
                  </span>
                }
              />
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={pickBusy}
                onClick={() => onDraft?.(row.player.id)}
              >
                Draft
              </button>
            </div>
          );
        })}

        <div className={styles.dClockSecondary}>
          <button type="button" className={styles.secondaryBtn} onClick={onSeeAll}>
            See all players
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={pickBusy || !options.length}
            onClick={() => onAutoPick?.(options[0]?.player.id)}
          >
            Auto pick
          </button>
        </div>
      </div>
    </div>
  );
}
