"use client";

import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function metric(player, key) {
  const n = Number(player?.seed_metrics?.[key]);
  return Number.isFinite(n) ? n : null;
}

function formatRate(value) {
  if (value == null) return "-";
  return Number(value).toFixed(2);
}

export default function UltimaPlayerSheet({
  player,
  points = [],
  onClose,
  actions = [],
  note,
  embedded = false,
}) {
  if (!player) return null;

  const pts = player.expectedPoints ?? expectedUltimaPoints(player);
  const goals = metric(player, "goals_rate");
  const assists = metric(player, "assists_rate");
  const rating = metric(player, "rating_avg");
  const minutes = metric(player, "minutes");

  const body = (
    <>
        <p className={styles.dSheetName}>{player.name}</p>
        <p className={styles.dSheetMeta}>
          {player.club || "-"}
          {" · "}
          {player.position || "-"}
          {" "}
          <UltimaCountryTag league={player.league} />
          {player.bolt_eligible ? <span className={styles.sqBolt}>Bolt</span> : null}
        </p>
        <dl className={styles.dSheetStats}>
          <div>
            <dt>Expected points</dt>
            <dd>
              <UltimaValueNumber
                value={Number.isFinite(Number(pts)) ? pts : null}
                percentile={percentileInList(pts, points)}
                digits={1}
              />
            </dd>
          </div>
          <div>
            <dt>Goals</dt>
            <dd>{formatRate(goals)}</dd>
          </div>
          <div>
            <dt>Assists</dt>
            <dd>{formatRate(assists)}</dd>
          </div>
          <div>
            <dt>Average rating</dt>
            <dd>{formatRate(rating)}</dd>
          </div>
          <div>
            <dt>Minutes</dt>
            <dd>{formatRate(minutes)}</dd>
          </div>
        </dl>
        {note ? <p className={styles.dSheetMeta}>{note}</p> : null}
        {actions.length ? (
          <div className={styles.dSheetActions}>
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.primary ? styles.primaryBtn : styles.secondaryBtn}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
    </>
  );

  if (embedded) return <div className={styles.mkSheetPad}>{body}</div>;

  return (
    <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label={player.name}>
      <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.dSheetPanel}>{body}</div>
    </div>
  );
}
