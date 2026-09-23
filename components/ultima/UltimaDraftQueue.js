"use client";

import { useState } from "react";
import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { wouldBreakFloor } from "@/lib/ultima/draft/floor";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function floorImpact(player, floor) {
  if (!player || !floor) return null;
  const need = floor.deficits?.[player.league] ?? 0;
  if (need > 0) return `Fills ${ULTIMA_LEAGUE_SHORT[player.league] ?? player.league}`;
  return null;
}

function Handle() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M8 6.5h8v1.6H8V6.5Zm0 4.7h8v1.6H8v-1.6Zm0 4.7h8V17.5H8v-1.6Z"
      />
    </svg>
  );
}

export default function UltimaDraftQueue({
  queue = [],
  byId,
  draftedIds,
  floor,
  onMove,
  onRemove,
  onDraft,
  isYourTurn,
  pickBusy,
}) {
  const [dragFrom, setDragFrom] = useState(null);
  const slotsLeft = floor?.slotsLeft ?? 0;
  const counts = floor?.counts ?? {};

  if (!queue.length) {
    return (
      <UltimaStaffMessage
        subject="Your queue is empty"
        body="Your queue is empty. Add players from the list."
      />
    );
  }

  return (
    <ol className={styles.dQueueList}>
      {queue.map((entry, index) => {
        const player = byId.get(entry.player_id);
        const taken = draftedIds.has(entry.player_id);
        const ineligible = Boolean(
          isYourTurn &&
            player &&
            !taken &&
            wouldBreakFloor(counts, player.league, slotsLeft),
        );
        const impact = !taken && !ineligible ? floorImpact(player, floor) : null;
        const meta = [
          taken ? "Taken" : ineligible ? "Not eligible on this pick" : player?.club || "-",
          impact,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li
            key={entry.player_id}
            className={styles.dQueueItem}
            draggable
            onDragStart={() => setDragFrom(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragFrom == null || dragFrom === index) return;
              const dir = index - dragFrom;
              onMove?.(dragFrom, dir);
              setDragFrom(null);
            }}
          >
            <button
              type="button"
              className={styles.dQueueHandle}
              aria-label={`Reorder ${player?.name ?? "player"}`}
              onClick={() => undefined}
            >
              <Handle />
            </button>
            <UltimaRow
              className={styles.dQueueRow}
              primary={player?.name ?? "Player left the pool"}
              meta={meta}
              number={player ? <UltimaCountryTag league={player.league} /> : null}
            />
            <div className={styles.dQueueActions}>
              {isYourTurn && player && !taken && !ineligible ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={pickBusy}
                  onClick={() => onDraft?.(player.id)}
                >
                  Draft
                </button>
              ) : null}
              <button
                type="button"
                className={styles.dQueueRemove}
                onClick={() => onRemove?.(entry.player_id)}
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
