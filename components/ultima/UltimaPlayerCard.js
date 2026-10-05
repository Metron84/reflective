"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ultima.module.css";
import { useUltimaAction } from "./useUltimaAction";

const CardContext = createContext({ openPlayer: () => {} });

/** Open the one player card from any screen: `const { openPlayer } = useUltimaPlayerCard()`. */
export function useUltimaPlayerCard() {
  return useContext(CardContext);
}

const NOTE_MAX = 80;

/** The verb in progress on a card button while its write runs. */
const WORKING = {
  sign: "Signing…",
  drop_sign: "Releasing…",
  captain_on: "Naming captain…",
  captain_off: "Updating…",
  xv_in: "Moving…",
  xv_out: "Moving…",
  shortlist_on: "Saving…",
  shortlist_off: "Saving…",
  untouchable_on: "Saving…",
  untouchable_off: "Saving…",
  list: "Listing…",
  unlist: "Updating…",
};

function dubaiTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} Dubai`;
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function UltimaPlayerCardProvider({ children }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);
  const write = useUltimaAction();
  const busy = loading || write.busy;
  const [swap, setSwap] = useState(null); // { actionId, list }
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const loadSeq = useRef(0);

  const load = useCallback(async (id) => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`/api/ultima/player/${id}`, { cache: "no-store" });
      const body = await readJson(res);
      if (seq !== loadSeq.current) return;
      if (!res.ok) {
        setError(body.message ?? "Could not load this player.");
        return;
      }
      setCard(body);
      setError(null);
    } catch {
      if (seq === loadSeq.current) setError("Could not load this player.");
    }
  }, []);

  const openPlayer = useCallback((id) => {
    if (!id) return;
    setCard(null);
    setError(null);
    setSwap(null);
    setNoting(false);
    setNote("");
    setPlayerId(id);
    load(id);
  }, [load]);

  const close = useCallback(() => {
    setPlayerId(null);
    setCard(null);
    setSwap(null);
  }, []);

  useEffect(() => {
    if (!playerId) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerId, close]);

  const { run } = write;
  const post = useCallback(
    async (payload) => {
      setPending(payload.action);
      setError(null);
      const result = await run("/api/ultima/player/action", payload);
      setPending(null);
      if (!result.ok) {
        setError(result.message ?? "That did not go through.");
        return false;
      }
      window.dispatchEvent(new Event("ultima:changed"));
      router.refresh();
      return true;
    },
    [router, run],
  );

  const openSwap = useCallback(
    async (actionId) => {
      const mode = actionId === "sign" ? "add" : "drop";
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ultima/player/${playerId}/swap?mode=${mode}`, { cache: "no-store" });
        const body = await readJson(res);
        if (!res.ok) {
          setError(body.message ?? "Could not load the list.");
          return;
        }
        setSwap({ actionId, list: body });
      } catch {
        setError("Could not load the list.");
      } finally {
        setLoading(false);
      }
    },
    [playerId],
  );

  const onAction = useCallback(
    async (action) => {
      if (!card || action.disabled || busy) return;
      const id = action.id;
      if (id === "offer") {
        close();
        router.push(`/ultima/trades?offer=${card.owner.id}&get=${card.player.id}`);
        return;
      }
      if (id === "offer_mine") {
        close();
        router.push(`/ultima/trades?give=${card.player.id}`);
        return;
      }
      if (id === "sign" || id === "drop_sign") {
        await openSwap(id);
        return;
      }
      if (id === "list") {
        setNoting(true);
        return;
      }
      if (await post({ player_id: card.player.id, action: id })) await load(card.player.id);
    },
    [card, busy, close, router, openSwap, post, load],
  );

  const confirmList = useCallback(async () => {
    if (await post({ player_id: card.player.id, action: "list", note: note.slice(0, NOTE_MAX) })) {
      setNoting(false);
      setNote("");
      await load(card.player.id);
    }
  }, [card, note, post, load]);

  const pickSwap = useCallback(
    async (row) => {
      if (!row.can || !swap) return;
      const ok = await post({
        player_id: card.player.id,
        action: swap.actionId,
        other_player_id: row.id,
      });
      if (ok) {
        setSwap(null);
        await load(card.player.id);
      } else if (swap.actionId === "sign" || swap.actionId === "drop_sign") {
        // A lost race changes who is available; show the fresh list.
        await openSwap(swap.actionId);
      }
    },
    [card, swap, post, load, openSwap],
  );

  const value = useMemo(() => ({ openPlayer }), [openPlayer]);

  return (
    <CardContext.Provider value={value}>
      {children}
      {playerId ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label={card?.player?.name ?? "Player"}>
          <button type="button" className={styles.dSheetBackdrop} aria-label="Close" onClick={close} />
          <div className={styles.dSheetPanel}>
            {card?.owner?.colour ? (
              <span className={styles.pcStripe} style={{ background: card.owner.colour }} aria-hidden />
            ) : null}
            {!card && !error ? <p className={styles.dSheetMeta}>Loading.</p> : null}
            {card && !swap ? (
              <CardBody
                card={card}
                busy={busy}
                pending={pending}
                noting={noting}
                note={note}
                setNote={setNote}
                onAction={onAction}
                confirmList={confirmList}
                cancelNote={() => setNoting(false)}
                close={close}
              />
            ) : null}
            {card && swap ? <SwapPicker swap={swap} card={card} busy={busy} working={busy && pending ? (WORKING[pending] ?? "Working…") : null} onPick={pickSwap} onBack={() => setSwap(null)} /> : null}
            {error ? (
              <p className={styles.pcError} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </CardContext.Provider>
  );
}

function CardBody({ card, busy, pending, noting, note, setNote, onAction, confirmList, cancelNote, close }) {
  const { player, owner, stats } = card;
  const lock = dubaiTime(card.lockAt);
  const owned = owner ? (owner.you ? "Your squad" : owner.team) : "Free agent";
  return (
    <>
      <p className={styles.dSheetName}>{player.name}</p>
      <p className={styles.dSheetMeta}>
        <span>{player.club}</span>
        {player.on_loan && player.parent_club ? <span>on loan from {player.parent_club}</span> : null}
        <span className={styles.opTag}>{player.tag}</span>
      </p>
      <p className={styles.dSheetMeta}>{owned}</p>
      {card.chips.length ? (
        <ul className={styles.pcChips}>
          {card.chips.map((chip) => (
            <li key={chip.id} className={styles.pcChip}>
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}
      {card.note ? <p className={styles.dSheetMeta}>{card.note}</p> : null}
      <dl className={styles.dSheetStats}>
        <div>
          <dt>This gameweek</dt>
          <dd>{stats.gwPoints ?? "-"}</dd>
        </div>
        <div>
          <dt>Season points</dt>
          <dd>{stats.seasonPoints}</dd>
        </div>
        <div>
          <dt>Goals and assists</dt>
          <dd>
            {stats.goals} and {stats.assists}
          </dd>
        </div>
        <div>
          <dt>Average rating</dt>
          <dd>{stats.avgRating ?? "-"}</dd>
        </div>
        <div>
          <dt>Last 5</dt>
          <dd>{stats.form.length ? stats.form.join(" ") : "-"}</dd>
        </div>
        <div>
          <dt>{player.tag} locks</dt>
          <dd>{lock ?? "-"}</dd>
        </div>
      </dl>

      {noting ? (
        <div className={styles.pcNote}>
          <label htmlFor="pc-note">Note for the market (optional)</label>
          <input
            id="pc-note"
            type="text"
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why he is available"
          />
          <div className={styles.dSheetActions}>
            <button type="button" className={styles.primaryBtn} disabled={busy} onClick={confirmList}>
              {busy && pending === "list" ? (
                <>
                  <span className={styles.actionSpinner} aria-hidden />
                  Listing…
                </>
              ) : (
                "Transfer list"
              )}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={cancelNote}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul className={styles.pcActions}>
          {card.actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                className={action.primary ? styles.primaryBtn : styles.secondaryBtn}
                disabled={action.disabled || busy}
                onClick={() => onAction(action)}
              >
                {busy && pending === action.id ? (
                  <>
                    <span className={styles.actionSpinner} aria-hidden />
                    {WORKING[action.id] ?? "Working…"}
                  </>
                ) : (
                  action.label
                )}
              </button>
              {action.disabled && action.reason ? <span className={styles.pcReason}>{action.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.quietLink} onClick={close}>
        Close
      </button>
    </>
  );
}

function SwapPicker({ swap, card, busy, working, onPick, onBack }) {
  const adding = swap.actionId === "sign";
  const rows = swap.list.rows;
  return (
    <>
      <p className={styles.dSheetName}>{adding ? "Pick who goes" : "Pick who you sign"}</p>
      <p className={styles.dSheetMeta}>
        {adding ? `${card.player.name} joins your squad.` : `${card.player.name} leaves your squad.`}
      </p>
      {working ? (
        <p className={styles.dSheetMeta} role="status">
          <span className={styles.actionSpinner} aria-hidden />
          {working}
        </p>
      ) : null}
      <ul className={styles.pcSwap}>
        {rows.map((row, index) => {
          const firstOther = !row.sameCountry && (index === 0 || rows[index - 1].sameCountry);
          return (
            <li key={row.id}>
              {firstOther ? <p className={styles.pcSwapHead}>Another country</p> : null}
              {index === 0 && row.sameCountry ? <p className={styles.pcSwapHead}>Same country</p> : null}
              <button
                type="button"
                className={styles.pcSwapRow}
                disabled={!row.can || busy}
                onClick={() => onPick(row)}
              >
                <span>
                  {row.name} <span className={styles.opTag}>{row.tag}</span>
                  {row.shortlisted ? <span className={styles.pcChip}>Shortlist</span> : null}
                </span>
                <span className={styles.pcReason}>
                  {row.can
                    ? row.on_loan && row.parent_club
                      ? `${row.club}, on loan from ${row.parent_club}`
                      : row.club
                    : `Can't. ${row.reason}`}
                  {row.can && row.voids?.length ? ` This voids your live offer with ${row.voids.join(" and ")}.` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className={styles.quietLink} onClick={onBack}>
        Back
      </button>
    </>
  );
}
