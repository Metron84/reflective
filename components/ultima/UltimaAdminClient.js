"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_LABELS,
  ULTIMA_MIN_POOL_PER_LEAGUE,
  ULTIMA_MIN_POOL_TOTAL,
  ULTIMA_TIMER_OPTIONS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

export default function UltimaAdminClient({
  seasonLabel,
  timerSeconds = 60,
  managers = [],
  gameweeks = [],
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [clock, setClock] = useState(timerSeconds);
  const [undoPick, setUndoPick] = useState("");
  const [undoReason, setUndoReason] = useState("");
  const [overrideManager, setOverrideManager] = useState("");
  const [overrideGw, setOverrideGw] = useState("");
  const [overridePoints, setOverridePoints] = useState("");
  const [overrideBolt, setOverrideBolt] = useState("0");
  const [overrideReason, setOverrideReason] = useState("");
  const [gwNumber, setGwNumber] = useState("");
  const [gwStart, setGwStart] = useState("");
  const [gwEnd, setGwEnd] = useState("");
  const [syncReport, setSyncReport] = useState(null);
  const [busy, setBusy] = useState("");

  async function act(action, extra = {}) {
    setMessage("");
    setError("");
    setBusy(action);
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Action failed.");
      else {
        if (data.sync) setSyncReport(data.sync);
        if (data.timer_seconds) {
          setClock(data.timer_seconds);
          setMessage(`Clock set to ${formatUltimaTimer(data.timer_seconds)}.`);
        } else {
          setMessage(data.code ? `Invite: ${data.code}` : "Done.");
        }
        if (data.code) setInviteCode(data.code);
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.adminPage}>
      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Draft control</h2>
        <div className={styles.adminActions}>
          <button type="button" className={styles.primaryBtn} onClick={() => act("start_draft")}>
            Start draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("pause_draft")}>
            Pause draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("resume_draft")}>
            Resume draft
          </button>
        </div>
        <p className={styles.adminHint}>
          Clock is {formatUltimaTimer(clock)}. Changing it resets the current turn if the draft is live.
        </p>
        <div className={styles.adminActions}>
          {ULTIMA_TIMER_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={clock === seconds ? styles.primaryBtn : styles.secondaryBtn}
              onClick={() => act("set_timer", { timer_seconds: seconds })}
            >
              {formatUltimaTimer(seconds)}
            </button>
          ))}
        </div>
        <div className={styles.adminActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              const when = prompt("Draft start time (ISO, e.g. 2026-08-20T18:00:00+04:00):");
              if (when) act("schedule_draft", { scheduled_at: when });
            }}
          >
            Schedule draft
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Invites</h2>
        <button type="button" className={styles.secondaryBtn} onClick={() => act("issue_invite")}>
          Issue invite code
        </button>
        {inviteCode ? <p className={styles.messageOk}>Code: {inviteCode}</p> : null}
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Undo pick</h2>
        <p className={styles.adminHint}>
          Emergency only. You cannot undo your own pick. Type a reason for the public log.
        </p>
        <div className={styles.adminForm}>
          <label className={styles.adminField}>
            Pick number
            <input
              type="number"
              min="1"
              max="300"
              value={undoPick}
              onChange={(e) => setUndoPick(e.target.value)}
            />
          </label>
          <label className={styles.adminField}>
            Reason
            <input
              type="text"
              value={undoReason}
              onChange={(e) => setUndoReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              act("undo_pick", {
                pick_number: Number(undoPick),
                reason: undoReason,
              })
            }
          >
            Undo pick
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Score override</h2>
        <p className={styles.adminHint}>Writes a public log row. Use a typed reason.</p>
        <div className={styles.adminForm}>
          <label className={styles.adminField}>
            Manager
            <select value={overrideManager} onChange={(e) => setOverrideManager(e.target.value)}>
              <option value="">Choose</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.team_name}
                  {m.is_bot ? " · BOT" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.adminField}>
            Gameweek
            <select value={overrideGw} onChange={(e) => setOverrideGw(e.target.value)}>
              <option value="">Choose</option>
              {gameweeks.map((gw) => (
                <option key={gw.id} value={gw.id}>
                  GW{gw.number} · {gw.state}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.adminField}>
            Points
            <input
              type="number"
              value={overridePoints}
              onChange={(e) => setOverridePoints(e.target.value)}
            />
          </label>
          <label className={styles.adminField}>
            Bolt
            <input
              type="number"
              value={overrideBolt}
              onChange={(e) => setOverrideBolt(e.target.value)}
            />
          </label>
          <label className={styles.adminField}>
            Reason
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              act("score_override", {
                manager_id: overrideManager,
                gameweek_id: overrideGw,
                points: Number(overridePoints),
                bolt_points: Number(overrideBolt),
                reason: overrideReason,
              })
            }
          >
            Override score
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Create gameweek</h2>
        <p className={styles.adminHint}>
          Friday 00:00 to Thursday 23:59 GST. Sync fixtures after you create it.
        </p>
        <div className={styles.adminForm}>
          <label className={styles.adminField}>
            Number
            <input
              type="number"
              min="1"
              value={gwNumber}
              onChange={(e) => setGwNumber(e.target.value)}
            />
          </label>
          <label className={styles.adminField}>
            Window start
            <input type="datetime-local" value={gwStart} onChange={(e) => setGwStart(e.target.value)} />
          </label>
          <label className={styles.adminField}>
            Window end
            <input type="datetime-local" value={gwEnd} onChange={(e) => setGwEnd(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              act("create_gameweek", {
                number: Number(gwNumber),
                window_start: gwStart ? `${gwStart}:00+04:00` : null,
                window_end: gwEnd ? `${gwEnd}:00+04:00` : null,
                league_open_at: {},
              })
            }
          >
            Create gameweek
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Bootstrap and sync</h2>
        <div className={styles.adminActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy === "bootstrap"}
            onClick={() => act("bootstrap")}
          >
            {busy === "bootstrap" ? "Syncing five leagues…" : "Sync players"}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("sync_gameweek")}>
            Sync active gameweek
          </button>
        </div>
        {syncReport ? <SyncReport report={syncReport} /> : null}
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Cancel draft</h2>
        <button
          type="button"
          className={styles.destructiveBtn}
          onClick={() => {
            const reason = prompt("Reason for cancellation:");
            const confirm = prompt(`Type season label to confirm: ${seasonLabel}`);
            if (reason && confirm) act("cancel_draft", { reason, confirm });
          }}
        >
          Cancel draft
        </button>
      </section>

      {message ? <p className={styles.messageOk}>{message}</p> : null}
      {error ? <p className={styles.messageError}>{error}</p> : null}

      <Link href="/ultima" className={styles.quietLink}>
        Back to hub
      </Link>
    </div>
  );
}

function SyncReport({ report }) {
  const byLeague = report.byLeague ?? {};
  const reasons = report.reasons ?? {};
  const total = ULTIMA_LEAGUES.reduce((sum, l) => sum + (byLeague[l] ?? 0), 0);
  const ready =
    total >= ULTIMA_MIN_POOL_TOTAL &&
    ULTIMA_LEAGUES.every((l) => (byLeague[l] ?? 0) >= ULTIMA_MIN_POOL_PER_LEAGUE);

  return (
    <div className={styles.syncReport}>
      <p className={styles.adminHint}>
        Provider: {report.provider === "sportmonks" ? "Sportmonks" : "Mock seed"}. {total} players
        in the pool.
      </p>
      <ul className={styles.syncList}>
        {ULTIMA_LEAGUES.map((league) => {
          const count = byLeague[league] ?? 0;
          return (
            <li key={league} className={styles.syncRow}>
              <span>{ULTIMA_LEAGUE_LABELS[league]}</span>
              <span
                className={count >= ULTIMA_MIN_POOL_PER_LEAGUE ? styles.syncOk : styles.syncBad}
              >
                {count}
              </span>
              {reasons[league] ? (
                <span className={styles.syncReason}>{reasons[league]}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className={ready ? styles.messageOk : styles.messageError}>
        {ready
          ? "Pool is big enough for a full draft."
          : `Not enough to draft. A full draft needs ${ULTIMA_MIN_POOL_TOTAL} players and at least ${ULTIMA_MIN_POOL_PER_LEAGUE} in every league.`}
      </p>
    </div>
  );
}
