import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { wouldBreakFloor } from "@/lib/ultima/draft/floor";
import styles from "./ultima.module.css";

export default function UltimaDraftQueue({
  queue = [],
  byId,
  draftedIds,
  floor,
  autoDraft,
  autoBusy,
  onToggleAuto,
  onMove,
  onRemove,
  onDraft,
  isYourTurn,
  pickBusy,
}) {
  const slotsLeft = floor?.slotsLeft ?? 0;
  const counts = floor?.counts ?? {};

  return (
    <section className={styles.deskQueue} aria-label="Queue">
      <div className={styles.deskQueueAuto}>
        <p className={styles.deskQueueAutoCopy}>
          Queue first. Ranking after queue.
        </p>
        <button
          type="button"
          className={styles.deskQueueAutoBtn}
          onClick={onToggleAuto}
          disabled={autoBusy}
        >
          {autoBusy ? "…" : autoDraft ? "Auto on" : "Auto off"}
        </button>
      </div>
      {!queue.length ? (
        <p className={styles.deskMuted}>Queue is empty. Add names with +.</p>
      ) : (
        <ol className={styles.deskQueueList}>
          {queue.map((entry, index) => {
            const player = byId.get(entry.player_id);
            const taken = draftedIds.has(entry.player_id);
            const ineligible = Boolean(
              isYourTurn &&
                player &&
                !taken &&
                wouldBreakFloor(counts, player.league, slotsLeft),
            );
            return (
              <li key={entry.player_id} className={styles.deskQueueRow}>
                <span className={styles.deskQueueIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.deskQueueInfo}>
                  <p className={styles.deskQueueName}>
                    {player?.name ?? "Player left the pool"}
                  </p>
                  <p className={styles.deskQueueMeta}>
                    {taken
                      ? "Taken"
                      : ineligible
                        ? "Not eligible on this pick"
                        : player
                          ? `${player.club} · ${ULTIMA_LEAGUE_SHORT[player.league] ?? player.league}`
                          : "Gone"}
                  </p>
                </div>
                <div className={styles.deskQueueActions}>
                  {isYourTurn && player && !taken && !ineligible ? (
                    <button
                      type="button"
                      className={styles.pickerPickBtn}
                      disabled={pickBusy}
                      onClick={() => onDraft(player.id)}
                    >
                      Draft
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deskQueueMove}
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                    aria-label="Move up"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={styles.deskQueueMove}
                    disabled={index === queue.length - 1}
                    onClick={() => onMove(index, 1)}
                    aria-label="Move down"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className={styles.deskQueueRemove}
                    onClick={() => onRemove(entry.player_id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
