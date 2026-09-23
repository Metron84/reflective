"use client";

import { useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_MIN_POOL_PER_LEAGUE,
  ULTIMA_MIN_POOL_TOTAL,
  ULTIMA_TIMER_OPTIONS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

export default function UltimaAdminClient({
  office = null,
  seasonLabel,
  timerSeconds = 60,
  managers = [],
  gameweeks = [],
}) {
  const desk = office ?? {
    seasonLabel,
    timerSeconds,
    stage: "Draft lobby",
    gameweek: "No gameweek",
    window: "Market closed · Trades closed",
    seats: [],
    lastSyncAt: null,
    managers,
    gameweeks,
  };
  const clubs = desk.managers ?? managers;
  const weeks = desk.gameweeks ?? gameweeks;

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [clock, setClock] = useState(desk.timerSeconds ?? timerSeconds);
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
  const [scheduleAt, setScheduleAt] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [syncReport, setSyncReport] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

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
        setConfirm(null);
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.utPage}>
      <UltimaPanel title="League state">
        <UltimaRow primary="Stage" number={desk.stage} />
        <UltimaRow primary="Gameweek" number={desk.gameweek} />
        <UltimaRow primary="Window" meta={desk.window} />
      </UltimaPanel>

      <UltimaPanel title="Seats">
        {(desk.seats ?? []).map((seat) => (
          <UltimaRow
            key={seat.slot}
            primary={seat.club}
            meta={`${seat.manager} · ${seat.status}`}
            number={seat.slot}
          />
        ))}
      </UltimaPanel>

      <UltimaPanel title="Sync">
        <UltimaRow
          primary="Last Sportmonks sync"
          meta={
            desk.lastSyncAt ? (
              <UltimaLocalTime value={desk.lastSyncAt} />
            ) : (
              "Not synced yet"
            )
          }
        />
        <div className={styles.utActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy === "sync_gameweek"}
            onClick={() => act("sync_gameweek")}
          >
            {busy === "sync_gameweek" ? "Syncing…" : "Run sync"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy === "bootstrap"}
            onClick={() => act("bootstrap")}
          >
            {busy === "bootstrap" ? "Syncing players…" : "Sync players"}
          </button>
        </div>
        {syncReport ? <SyncReport report={syncReport} /> : null}
      </UltimaPanel>

      <UltimaPanel title="Draft controls">
        <div className={styles.utActions}>
          <button type="button" className={styles.primaryBtn} onClick={() => act("start_draft")}>
            Start draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("pause_draft")}>
            Pause
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("resume_draft")}>
            Resume
          </button>
        </div>
        <UltimaRow primary="Clock" number={formatUltimaTimer(clock)} />
        <div className={styles.utActions}>
          {ULTIMA_TIMER_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={clock === seconds ? styles.deskTabOn : styles.deskTab}
              onClick={() => act("set_timer", { timer_seconds: seconds })}
            >
              {formatUltimaTimer(seconds)}
            </button>
          ))}
        </div>
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("schedule")}>
            Schedule draft
          </button>
        </div>
      </UltimaPanel>

      <UltimaPanel title="Invites">
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("issue_invite")}>
            Issue invite code
          </button>
        </div>
        {inviteCode ? <UltimaRow primary="Code" number={inviteCode} /> : null}
      </UltimaPanel>

      <UltimaPanel title="Undo pick">
        <p className={styles.utNote}>Emergency only. You cannot undo your own pick.</p>
        <div className={styles.utPad}>
          <label className={styles.field}>
            Pick number
            <input
              type="number"
              min="1"
              max="300"
              value={undoPick}
              onChange={(e) => setUndoPick(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Reason
            <input type="text" value={undoReason} onChange={(e) => setUndoReason(e.target.value)} />
          </label>
        </div>
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("undo")}>
            Undo pick
          </button>
        </div>
      </UltimaPanel>

      <UltimaPanel title="Score override">
        <p className={styles.utNote}>Writes a public log row. Use a typed reason.</p>
        <div className={styles.utPad}>
          <label className={styles.field}>
            Manager
            <select value={overrideManager} onChange={(e) => setOverrideManager(e.target.value)}>
              <option value="">Choose</option>
              {clubs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.team_name}
                  {m.is_bot ? " · BOT" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Gameweek
            <select value={overrideGw} onChange={(e) => setOverrideGw(e.target.value)}>
              <option value="">Choose</option>
              {weeks.map((gw) => (
                <option key={gw.id} value={gw.id}>
                  GW{gw.number} · {gw.state}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Points
            <input type="number" value={overridePoints} onChange={(e) => setOverridePoints(e.target.value)} />
          </label>
          <label className={styles.field}>
            Bolt
            <input type="number" value={overrideBolt} onChange={(e) => setOverrideBolt(e.target.value)} />
          </label>
          <label className={styles.field}>
            Reason
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </label>
        </div>
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("override")}>
            Override score
          </button>
        </div>
      </UltimaPanel>

      <UltimaPanel title="Create gameweek">
        <p className={styles.utNote}>Friday 00:00 to Thursday 23:59 GST.</p>
        <div className={styles.utPad}>
          <label className={styles.field}>
            Number
            <input type="number" min="1" value={gwNumber} onChange={(e) => setGwNumber(e.target.value)} />
          </label>
          <label className={styles.field}>
            Window start
            <input type="datetime-local" value={gwStart} onChange={(e) => setGwStart(e.target.value)} />
          </label>
          <label className={styles.field}>
            Window end
            <input type="datetime-local" value={gwEnd} onChange={(e) => setGwEnd(e.target.value)} />
          </label>
        </div>
        <div className={styles.utActions}>
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
      </UltimaPanel>

      <UltimaPanel title="Cancel draft">
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("cancel")}>
            Cancel draft
          </button>
        </div>
      </UltimaPanel>

      {message ? <p className={styles.utNote}>{message}</p> : null}
      {error ? (
        <UltimaStaffMessage subject="The commission desk could not do that" body={error} />
      ) : null}

      {confirm === "schedule" ? (
        <ConfirmSheet
          title="Schedule draft"
          body="Set the live draft time."
          onClose={() => setConfirm(null)}
          onConfirm={() => act("schedule_draft", { scheduled_at: scheduleAt })}
          busy={busy === "schedule_draft"}
        >
          <label className={styles.field}>
            Start time
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </label>
        </ConfirmSheet>
      ) : null}

      {confirm === "undo" ? (
        <ConfirmSheet
          title="Undo pick"
          body={`Undo pick ${undoPick || "?"}? This writes a public log row.`}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            act("undo_pick", {
              pick_number: Number(undoPick),
              reason: undoReason,
            })
          }
          busy={busy === "undo_pick"}
        />
      ) : null}

      {confirm === "override" ? (
        <ConfirmSheet
          title="Override score"
          body="This writes a public log row. The reason is visible to the league."
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            act("score_override", {
              manager_id: overrideManager,
              gameweek_id: overrideGw,
              points: Number(overridePoints),
              bolt_points: Number(overrideBolt),
              reason: overrideReason,
            })
          }
          busy={busy === "score_override"}
        />
      ) : null}

      {confirm === "cancel" ? (
        <ConfirmSheet
          title="Cancel draft"
          body={`Type ${desk.seasonLabel} to confirm.`}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            act("cancel_draft", { reason: cancelReason, confirm: cancelConfirm })
          }
          busy={busy === "cancel_draft"}
        >
          <label className={styles.field}>
            Reason
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Season label
            <input
              type="text"
              value={cancelConfirm}
              onChange={(e) => setCancelConfirm(e.target.value)}
            />
          </label>
        </ConfirmSheet>
      ) : null}
    </div>
  );
}

function ConfirmSheet({ title, body, onClose, onConfirm, busy, children }) {
  return (
    <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.dSheetPanel}>
        <p className={styles.dSheetName}>{title}</p>
        <p className={styles.dSheetMeta}>{body}</p>
        {children}
        <div className={styles.dSheetActions}>
          <button type="button" className={styles.primaryBtn} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : "Confirm"}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncReport({ report }) {
  const byLeague = report.byLeague ?? {};
  const reasons = report.reasons ?? {};
  const coverage = report.coverage ?? {};
  const total = ULTIMA_LEAGUES.reduce((sum, l) => sum + (byLeague[l] ?? 0), 0);
  const statsSeason = ULTIMA_LEAGUES.map((l) => coverage[l]?.season).find(Boolean);
  const ready =
    total >= ULTIMA_MIN_POOL_TOTAL &&
    ULTIMA_LEAGUES.every((l) => (byLeague[l] ?? 0) >= ULTIMA_MIN_POOL_PER_LEAGUE);

  return (
    <>
      <UltimaRow
        primary={report.provider === "sportmonks" ? "Sportmonks" : "Mock seed"}
        meta={statsSeason ? `Ratings from the ${statsSeason} season.` : `${total} players in the pool.`}
        number={total}
      />
      {ULTIMA_LEAGUES.map((league) => {
        const count = byLeague[league] ?? 0;
        const rated = coverage[league]?.rated;
        return (
          <UltimaRow
            key={league}
            primary={ULTIMA_LEAGUE_SHORT[league]}
            meta={
              reasons[league]
                ? reasons[league]
                : typeof rated === "number"
                  ? `${rated} rated`
                  : null
            }
            number={count}
          />
        );
      })}
      {ready ? (
        <p className={styles.utNote}>Pool is big enough for a full draft.</p>
      ) : (
        <UltimaStaffMessage
          subject="The pool is short"
          body={`A full draft needs ${ULTIMA_MIN_POOL_TOTAL} players and at least ${ULTIMA_MIN_POOL_PER_LEAGUE} in every league.`}
        />
      )}
    </>
  );
}
