"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_MIN_POOL_PER_LEAGUE,
  ULTIMA_MIN_POOL_TOTAL,
  ULTIMA_TIERED_TIMER_TEXT,
  ULTIMA_TIMER_OPTIONS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import { formatGstDateTime, formatGstTime, fromGstInput, toGstInputValue } from "@/lib/ultima/gst";
import UltimaBroadcastPanel from "./UltimaBroadcastPanel";
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
  managerCount = 0,
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
  const [rescoreGw, setRescoreGw] = useState("");
  const [gwNumber, setGwNumber] = useState("");
  const [gwStart, setGwStart] = useState("");
  const [gwEnd, setGwEnd] = useState("");
  const [savedAt, setSavedAt] = useState(desk.scheduledAt ?? null);
  const [scheduleAt, setScheduleAt] = useState(toGstInputValue(desk.scheduledAt));
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [syncReport, setSyncReport] = useState(null);
  const [poolReports, setPoolReports] = useState({});
  const [poolRun, setPoolRun] = useState({ mode: "", league: "" });
  const [clubSync, setClubSync] = useState(null);
  const router = useRouter();
  const [clubBusy, setClubBusy] = useState("");
  const [clubProgress, setClubProgress] = useState(null); // { startedAt, seconds, saved }
  const pollRef = useRef(null);
  useEffect(() => () => clearInterval(pollRef.current), []);
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);
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
        if (action === "sync_stats") {
          setMessage(
            `Stats written ${data.written ?? 0}, failed ${data.failed ?? 0}. ${data.managers ?? 0} managers rescored. ${data.state ?? ""}.`,
          );
        }
        if (action === "schedule_draft" && data.scheduledAt) {
          setSavedAt(data.scheduledAt);
          setScheduleAt(toGstInputValue(data.scheduledAt));
          setMessage(`Draft set for ${formatGstDateTime(data.scheduledAt)} GST.`);
        }
        setConfirm(null);
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setBusy("");
    }
  }

  async function syncClubs(apply) {
    setMessage("");
    setError("");
    setClubBusy(apply ? "apply" : "preview");
    const startedAt = new Date();
    if (apply) {
      // The run takes minutes. Show the clock and how many players are saved so far.
      setClubProgress({ startedAt: startedAt.toISOString(), seconds: 0, saved: 0 });
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const seconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
        let saved = null;
        try {
          const res = await fetch(`/api/ultima/admin?since=${encodeURIComponent(startedAt.toISOString())}`, {
            cache: "no-store",
          });
          if (res.ok) saved = (await res.json()).saved;
        } catch {}
        setClubProgress((p) => (p ? { ...p, seconds, saved: saved ?? p.saved } : p));
      }, 5000);
    }
    const controller = new AbortController();
    const timeout = apply ? setTimeout(() => controller.abort(), 330_000) : null;
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_clubs",
          dry_run: !apply,
          apply: Boolean(apply),
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.sync?.ok) {
        setError(data.message ?? data.sync?.error ?? "Club sync failed.");
        return;
      }
      setClubSync(data.sync);
      setMessage(
        apply
          ? "Clubs applied."
          : "Club preview ready. Review, then Apply.",
      );
      if (apply) router.refresh();
    } catch {
      setError(
        apply
          ? "The answer did not come back. Check the saved count, then Preview to confirm."
          : "Connection lost.",
      );
      if (apply) router.refresh();
    } finally {
      if (timeout) clearTimeout(timeout);
      clearInterval(pollRef.current);
      setClubBusy("");
      setClubProgress(null);
    }
  }

  // One league per request keeps each call short. Stops at the first failure.
  async function syncPool(dryRun) {
    setMessage("");
    setError("");
    setPoolReports({});
    try {
      for (const league of ULTIMA_LEAGUES) {
        setPoolRun({ mode: dryRun ? "preview" : "apply", league });
        const res = await fetch("/api/ultima/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_pool", league, dry_run: dryRun }),
        });
        const data = await res.json();
        if (!res.ok || !data.sync?.ok) {
          setError(
            `${ULTIMA_LEAGUE_SHORT[league]}: ${data.message ?? data.sync?.error ?? "did not sync"}. Run it again.`,
          );
          return;
        }
        setPoolReports((current) => ({ ...current, [league]: data.sync }));
      }
      setMessage(dryRun ? "Preview done. Nothing was saved." : "Players synced.");
    } catch {
      setError("Connection lost.");
    } finally {
      setPoolRun({ mode: "", league: "" });
    }
  }

  const poolBusy = Boolean(poolRun.mode);

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
            disabled={Boolean(clubBusy) || poolBusy}
            onClick={() => syncClubs(false)}
          >
            {clubBusy === "preview" ? "Checking clubs…" : "Preview club changes"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={!clubSync || Boolean(clubBusy) || poolBusy}
            onClick={() => syncClubs(true)}
          >
            {clubBusy === "apply" ? "Applying…" : "Apply club changes"}
          </button>
        </div>
        {clubProgress ? (
          <p className={styles.utNote} role="status">
            Applying club changes. {Math.floor(clubProgress.seconds / 60)}m {clubProgress.seconds % 60}s so far.
            {clubProgress.saved ? ` ${clubProgress.saved} players saved.` : " Fetching squads, this takes a few minutes."}
          </p>
        ) : null}
        <button
          type="button"
          className={styles.utNote}
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
          onClick={() => setShowAdvancedSync((v) => !v)}
        >
          {showAdvancedSync ? "Hide advanced" : "Advanced"}
        </button>
        {showAdvancedSync ? (
          <div className={styles.utActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy === "sync_gameweek"}
              onClick={() => act("sync_gameweek")}
            >
              {busy === "sync_gameweek" ? "Syncing…" : "Run sync"}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={poolBusy || Boolean(clubBusy)}
              onClick={() => syncPool(false)}
            >
              {poolRun.mode === "apply"
                ? `Syncing ${ULTIMA_LEAGUE_SHORT[poolRun.league]}…`
                : "Sync players"}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={poolBusy || Boolean(clubBusy)}
              onClick={() => syncPool(true)}
            >
              {poolRun.mode === "preview"
                ? `Checking ${ULTIMA_LEAGUE_SHORT[poolRun.league]}…`
                : "Preview changes"}
            </button>
          </div>
        ) : null}
        {clubSync ? <ClubSyncReport report={clubSync} /> : null}
        {showAdvancedSync && syncReport ? <SyncReport report={syncReport} /> : null}
        {showAdvancedSync && Object.keys(poolReports).length ? (
          <PoolReport reports={poolReports} />
        ) : null}
      </UltimaPanel>

      <UltimaPanel title="Draft controls">
        <div className={styles.utActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy === "start_draft"}
            onClick={() => setConfirm("start")}
          >
            Start draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("pause_draft")}>
            Pause
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("resume_draft")}>
            Resume
          </button>
        </div>
        <UltimaRow
          primary="Draft time"
          meta={savedAt ? `Scheduled ${formatGstTime(savedAt)} GST` : "Not scheduled"}
          number={savedAt ? `${formatGstDateTime(savedAt)} GST` : "-"}
        />
        {desk.timerTiered ? (
          <UltimaRow primary="Clock" meta={ULTIMA_TIERED_TIMER_TEXT} />
        ) : (
          <>
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
          </>
        )}
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("schedule")}>
            Schedule draft
          </button>
        </div>
      </UltimaPanel>

      <UltimaBroadcastPanel managerCount={managerCount} />

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

      <UltimaPanel title="Resync stats and rescore">
        <p className={styles.utNote}>Pulls Sportmonks stats for one gameweek, then writes the stored scores again.</p>
        <div className={styles.utPad}>
          <label className={styles.field}>
            Gameweek
            <select value={rescoreGw} onChange={(e) => setRescoreGw(e.target.value)}>
              <option value="">Choose</option>
              {weeks.map((gw) => (
                <option key={gw.id} value={gw.id}>
                  GW{gw.number} · {gw.state}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.utActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm("rescore")}>
            Resync and rescore
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

      {confirm === "start" ? (
        <ConfirmSheet
          title="Start the draft now?"
          body="The order is locked. Pick 1 begins."
          confirmLabel="Start draft"
          cancelLabel="Cancel"
          cancelFirst
          onClose={() => setConfirm(null)}
          onConfirm={() => act("start_draft")}
          busy={busy === "start_draft"}
        />
      ) : null}

      {confirm === "schedule" ? (
        <ConfirmSheet
          title="Schedule draft"
          body="Set the live draft time. Times are GST (UTC+4)."
          onClose={() => setConfirm(null)}
          onConfirm={() => act("schedule_draft", { scheduled_at: fromGstInput(scheduleAt) })}
          busy={busy === "schedule_draft"}
        >
          <label className={styles.field}>
            Start time (GST)
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

      {confirm === "rescore" ? (
        <ConfirmSheet
          title="Resync this gameweek?"
          body="This pulls match stats and rewrites every manager score for the gameweek you chose."
          onClose={() => setConfirm(null)}
          onConfirm={() => act("sync_stats", { gameweek_id: rescoreGw })}
          busy={busy === "sync_stats"}
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

function ConfirmSheet({
  title,
  body,
  onClose,
  onConfirm,
  busy,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Back",
  cancelFirst = false,
}) {
  const confirmBtn = (
    <button key="confirm" type="button" className={styles.primaryBtn} disabled={busy} onClick={onConfirm}>
      {busy ? "Working…" : confirmLabel}
    </button>
  );
  const cancelBtn = (
    <button key="cancel" type="button" className={styles.secondaryBtn} disabled={busy} onClick={onClose}>
      {cancelLabel}
    </button>
  );
  return (
    <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.dSheetPanel}>
        <p className={styles.dSheetName}>{title}</p>
        <p className={styles.dSheetMeta}>{body}</p>
        {children}
        <div className={styles.dSheetActions}>
          {cancelFirst ? [cancelBtn, confirmBtn] : [confirmBtn, cancelBtn]}
        </div>
      </div>
    </div>
  );
}

function ClubSyncReport({ report }) {
  const c = report.counts ?? {};
  const dry = Boolean(report.dryRun);
  const ownedPrefix = (m) => (m.owned ? `Owned (${m.owner ?? "squad"}): ` : "");

  function Section({ title, count, children }) {
    return (
      <>
        <UltimaRow primary={title} number={count ?? 0} />
        {children}
      </>
    );
  }

  return (
    <>
      <UltimaRow
        primary={dry ? "Club preview" : "Clubs applied"}
        meta={`${c.clubMoves ?? 0} club moves · ${c.leaguePending ?? 0} league · ${c.loans ?? 0} loans · ${c.departures ?? 0} left · ${c.added ?? 0} new`}
        number={report.fresh ?? 0}
      />
      {report.applyLeagueNow ? (
        <p className={styles.utNote}>
          League changes apply now
          {report.gameweekLive ? " (Friday unlock during a live gameweek)." : " (no live gameweek)."}
        </p>
      ) : (
        <p className={styles.utNote}>
          A gameweek is live. League changes wait for Friday 00:00 Dubai. Club and loan update now.
        </p>
      )}

      <Section title="Club moves" count={c.clubMoves}>
        {(report.clubMoves ?? []).map((m) => (
          <p key={`club-${m.name}-${m.fromClub}-${m.toClub}`} className={styles.utNote}>
            {ownedPrefix(m)}
            {m.name}: {m.fromClub} → {m.toClub}
            {m.rescuedFromGap ? " · squad gap filled" : ""}
          </p>
        ))}
      </Section>

      <Section title="League changes pending Friday" count={c.leaguePending}>
        {(report.leaguePending ?? []).map((m) => (
          <p key={`lg-${m.name}-${m.fromLeague}-${m.toLeague}`} className={styles.utNote}>
            {ownedPrefix(m)}
            {m.name}: {m.fromLeague} → {m.toLeague}
            {m.appliedNow ? " · applying now" : ""}
            {m.fromClub !== m.toClub ? ` · ${m.fromClub} → ${m.toClub}` : ""}
          </p>
        ))}
      </Section>

      <Section title="Loans" count={c.loans}>
        {(report.loans ?? []).map((m) => (
          <p key={`loan-${m.name}-${m.club}`} className={styles.utNote}>
            {ownedPrefix(m)}
            {m.name}:{" "}
            {m.on_loan
              ? `on loan at ${m.club} from ${m.parent_club}`
              : `loan ended at ${m.club}`}
          </p>
        ))}
      </Section>

      <Section title="Departures" count={c.departures}>
        {(report.departures ?? []).map((m) => (
          <p key={`gone-${m.name}-${m.club}`} className={styles.utNote}>
            {ownedPrefix(m)}
            {m.name} left {m.club}
            {m.destinationClub ? ` → ${m.destinationClub}` : ""}
          </p>
        ))}
      </Section>

      <Section title="New free agents" count={c.added}>
        {(report.added ?? []).map((m) => (
          <p key={`new-${m.name}-${m.club}-${m.league}`} className={styles.utNote}>
            {m.name} ({m.club} · {m.league})
          </p>
        ))}
      </Section>
    </>
  );
}

function PoolReport({ reports }) {
  const done = ULTIMA_LEAGUES.filter((l) => reports[l]);
  const total = (key) => done.reduce((n, l) => n + (reports[l].diff?.[key] ?? 0), 0);
  const count = done.reduce((n, l) => n + (reports[l].count ?? 0), 0);
  const dry = done.some((l) => reports[l].dryRun);

  return (
    <>
      <UltimaRow
        primary={dry ? "Preview, nothing saved" : "Synced"}
        meta={`${total("added")} new · ${total("changedClub")} changed club · ${total("wentInactive")} inactive`}
        number={count}
      />
      {done.map((league) => {
        const r = reports[league];
        const d = r.diff ?? {};
        return (
          <UltimaRow
            key={league}
            primary={ULTIMA_LEAGUE_SHORT[league]}
            meta={`${d.added ?? 0} new · ${d.changedClub ?? 0} changed club · ${d.wentInactive ?? 0} inactive`}
            number={r.count}
          >
            {d.deactivateSkipped ? <p className={styles.utNote}>{d.deactivateSkipped}</p> : null}
            {(d.samples?.changedClub ?? []).map((line) => (
              <p key={line} className={styles.utNote}>{line}</p>
            ))}
          </UltimaRow>
        );
      })}
    </>
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
