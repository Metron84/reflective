"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_LABELS,
  ULTIMA_LEAGUE_SHORT,
  ultimaColourHex,
} from "@/lib/ultima/constants";
import { formatClubLine } from "@/lib/ultima/player-club";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import { BLOCK_CHIPS, filterSellers, sortSellers } from "@/lib/ultima/trades/block-view";
import { LOOKING_FOR_MAX, UNTOUCHABLE_MAX } from "@/lib/ultima/trades/rules";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaLookingFor from "./UltimaLookingFor";
import UltimaUntouchableChip from "./UltimaUntouchableChip";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaValueNumber from "./UltimaValueNumber";
import styles from "./ultima.module.css";

const STANCE_LABEL = { listed: "Listed", open: "Open" };

async function post(body) {
  const res = await fetch("/api/ultima/trades/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function PlayerLine({ player, note, chip, untouchable = false, children }) {
  const value = expectedUltimaPoints(player);
  return (
    <div className={styles.blkRow}>
      <div className={styles.blkRowTop}>
        <span className={styles.blkRowCopy}>
          <span className={styles.dPickName}>
            {player.name || "-"}
            {untouchable ? <UltimaUntouchableChip /> : null}
          </span>
          <span className={styles.dPickMeta}>
            {formatClubLine(player)}
            {" · "}
            {player.position || "-"} <UltimaCountryTag league={player.league} />
          </span>
        </span>
        {chip ? (
          <span className={chip === "listed" ? styles.blkChipListed : styles.blkChipOpen}>
            {STANCE_LABEL[chip]}
          </span>
        ) : null}
        <span className={styles.blkPts}>
          <UltimaValueNumber value={Number.isFinite(value) ? value : null} digits={1} />
        </span>
      </div>
      {note ? <p className={styles.blkNote}>{note}</p> : null}
      {children}
    </div>
  );
}

function Board({ office, asked, onAsk, onOffer, busyKey }) {
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("newest");
  const untouchable = office.untouchable ?? {};
  const all = office.board.sellers;
  const sellers = useMemo(() => sortSellers(filterSellers(all, chip), sort), [all, chip, sort]);

  const filters = (
    <div className={styles.blkFilters} role="group" aria-label="Filter by country">
      {BLOCK_CHIPS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={chip === item.id ? styles.deskTabOn : styles.deskTab}
          aria-pressed={chip === item.id}
          onClick={() => setChip(item.id)}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        className={`${sort === "newest" ? styles.deskTabOn : styles.deskTab} ${styles.blkFilterSort}`}
        aria-pressed={sort === "newest"}
        onClick={() => setSort((current) => (current === "newest" ? "rank" : "newest"))}
      >
        Newest
      </button>
    </div>
  );

  if (all.length && !sellers.length) {
    return (
      <>
        {filters}
        <UltimaStaffMessage
          subject="Nobody has listed a player from that country yet."
          actionLabel="Show all"
          onAction={() => setChip("all")}
        />
      </>
    );
  }
  if (!sellers.length) {
    return (
      <UltimaStaffMessage
        subject="Nobody has listed a player yet. Be the first."
        body="List or open a player from My block and the league sees it."
      />
    );
  }
  return (
    <>
      {filters}
      {sellers.map((seller) => {
    const sellerAsked = asked.has(`${seller.id}:all`);
    return (
      <UltimaPanel
        key={seller.id}
        raised
        title={seller.team_name}
        action={<span className={styles.blkMgr}>{seller.manager_name || "-"}</span>}
      >
        <div className={styles.blkSeller} style={{ "--team": ultimaColourHex(seller.colour) }}>
          {seller.looking_for.length || seller.note ? (
            <UltimaLookingFor leagues={seller.looking_for} note={seller.note} />
          ) : null}
          {seller.players.map((player) => {
            const key = `${seller.id}:${player.id}`;
            const done = asked.has(key);
            return (
              <PlayerLine
                key={player.id}
                player={player}
                note={player.note}
                chip={player.stance}
                untouchable={Boolean(untouchable[player.id])}
              >
                <div className={styles.blkActions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={done || busyKey === key}
                    onClick={() => onAsk({ to: seller.id, player: player.id, key })}
                  >
                    {done ? "Asked" : player.stance === "listed" ? "I'm interested" : "Ask about him"}
                  </button>
                  {office.windowOpen && !untouchable[player.id] ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => onOffer({ receiverId: seller.id, getId: player.id })}
                    >
                      Make offer
                    </button>
                  ) : null}
                </div>
              </PlayerLine>
            );
          })}
          <div className={styles.blkActions}>
            <button
              type="button"
              className={styles.blkLink}
              disabled={sellerAsked || busyKey === `${seller.id}:all`}
              onClick={() => onAsk({ to: seller.id, player: null, key: `${seller.id}:all` })}
            >
              {sellerAsked ? "Asked about their block" : "Ask what else they would move"}
            </button>
          </div>
        </div>
      </UltimaPanel>
    );
      })}
    </>
  );
}

function MyBlock({ office, mine, prefs, onStance, onPrefs, onProtect, protectedIds, busyKey, saved }) {
  const [draft, setDraft] = useState(prefs);
  const [notes, setNotes] = useState({});
  const roster = office.myRoster ?? [];

  return (
    <>
      <UltimaPanel raised title="Looking for">
        <div className={styles.blkPrefs}>
          <p className={styles.dPicksNote}>
            Tell the league what you want back. Shown on your squad and your block.
          </p>
          <div className={styles.blkLeagueChips}>
            {ULTIMA_LEAGUES.map((league) => {
              const on = draft.looking_for.includes(league);
              return (
                <button
                  key={league}
                  type="button"
                  className={on ? styles.deskTabOn : styles.deskTab}
                  aria-pressed={on}
                  aria-label={ULTIMA_LEAGUE_LABELS[league]}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      looking_for: on
                        ? d.looking_for.filter((l) => l !== league)
                        : [...d.looking_for, league],
                    }))
                  }
                >
                  {ULTIMA_LEAGUE_SHORT[league]}
                </button>
              );
            })}
          </div>
          <label className={styles.blkField}>
            <span className={styles.blkLookingLabel}>
              Line · {draft.note.length}/{LOOKING_FOR_MAX}
            </span>
            <input
              className={styles.blkInput}
              maxLength={LOOKING_FOR_MAX}
              value={draft.note}
              placeholder="A striker who plays every week"
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
          </label>
          <div className={styles.blkActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busyKey === "prefs"}
              onClick={() => onPrefs(draft)}
            >
              {saved === "prefs" ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </UltimaPanel>

      {ULTIMA_LEAGUES.map((league) => {
        const players = roster.filter((p) => p.league === league);
        if (!players.length) return null;
        return (
          <UltimaPanel
            key={league}
            raised
            title={ULTIMA_LEAGUE_LABELS[league]}
            action={
              <span className={styles.blkMgr}>
                {players.filter((p) => mine[p.id]).length} on the block
              </span>
            }
          >
            {players.map((player) => {
              const entry = mine[player.id];
              const isProtected = protectedIds.includes(player.id);
              const stance = entry?.stance ?? null;
              const noteValue = notes[player.id] ?? entry?.note ?? "";
              return (
                <PlayerLine key={player.id} player={player} note={null} untouchable={isProtected}>
                  <div className={styles.blkSeg} role="group" aria-label={`Trade status for ${player.name}`}>
                    {[
                      [null, "Off"],
                      ["open", "Open to offers"],
                      ["listed", "Trade list"],
                    ].map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        className={stance === value ? styles.deskTabOn : styles.deskTab}
                        aria-pressed={stance === value}
                        disabled={busyKey === player.id || isProtected}
                        onClick={() => onStance({ player, stance: value, note: noteValue })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.blkProtect}>
                    <button
                      type="button"
                      className={isProtected ? styles.deskTabOn : styles.deskTab}
                      aria-pressed={isProtected}
                      disabled={
                        busyKey === `protect:${player.id}` ||
                        (!isProtected && protectedIds.length >= UNTOUCHABLE_MAX)
                      }
                      onClick={() => onProtect({ player, on: !isProtected })}
                    >
                      Untouchable
                    </button>
                    <span>
                      {protectedIds.length}/{UNTOUCHABLE_MAX} used
                    </span>
                  </div>
                  {stance ? (
                    <div className={styles.blkNoteEdit}>
                      <input
                        className={styles.blkInput}
                        maxLength={80}
                        value={noteValue}
                        placeholder={stance === "listed" ? "What would you like back?" : "Add a note (optional)"}
                        aria-label={`Note for ${player.name}`}
                        onChange={(e) => setNotes((n) => ({ ...n, [player.id]: e.target.value }))}
                        onBlur={() => {
                          if (noteValue !== (entry?.note ?? "")) {
                            onStance({ player, stance, note: noteValue });
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </PlayerLine>
              );
            })}
          </UltimaPanel>
        );
      })}
    </>
  );
}

function Interest({ office, inbox, onResolve, onOffer, busyKey }) {
  if (!inbox.length) {
    return (
      <UltimaStaffMessage
        subject="No interest yet."
        body={
          Object.keys(office.board.mine).length
            ? "Your block is live. Managers will ask here."
            : "List or open a player and managers can ask about him."
        }
      />
    );
  }
  return (
    <UltimaPanel raised title="Interest">
      {inbox.map((item) => (
        <div
          key={item.id}
          className={styles.blkSeller}
          style={{ "--team": ultimaColourHex(item.from.colour) }}
        >
          <div className={styles.blkRow}>
            <div className={styles.blkRowTop}>
              <span className={styles.blkRowCopy}>
                <span className={styles.dPickName}>
                  {item.state === "new" ? <span className={styles.opInboxDot} aria-hidden /> : null}
                  {item.from.team_name}
                </span>
                <span className={styles.dPickMeta}>
                  {item.from.manager_name || "-"}
                  {" · "}
                  {item.player ? `asked about ${item.player.name}` : "asked about your block"}
                </span>
              </span>
            </div>
            {item.message ? <p className={styles.blkNote}>{item.message}</p> : null}
            <div className={styles.blkActions}>
              {office.windowOpen ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busyKey === item.id}
                  onClick={() => onOffer({ receiverId: item.from.id, giveId: item.player?.id ?? null, interestId: item.id })}
                >
                  Start an offer
                </button>
              ) : null}
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busyKey === item.id}
                onClick={() => onResolve(item.id, "dismissed")}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ))}
      {!office.windowOpen ? (
        <p className={styles.dPicksNote}>Trades are closed right now. Your block stays live.</p>
      ) : null}
    </UltimaPanel>
  );
}

export default function UltimaTradeBlock({ office, onStartOffer, preview = false, initialView = "board" }) {
  const [view, setView] = useState(initialView);
  const [mine, setMine] = useState(office.board.mine);
  const [prefs, setPrefs] = useState(office.board.prefs);
  const [asked, setAsked] = useState(
    () => new Set(office.board.asked.map((a) => `${a.to}:${a.player ?? "all"}`)),
  );
  const [inbox, setInbox] = useState(office.board.inbox);
  const [protectedIds, setProtectedIds] = useState(office.myUntouchable ?? []);
  const [busyKey, setBusyKey] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function run(key, body, onOk) {
    setBusyKey(key);
    setError("");
    try {
      if (preview) {
        onOk?.({});
      } else {
        const { ok, data } = await post(body);
        if (!ok) setError(data.message ?? "The trade desk could not update.");
        else onOk?.(data);
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setBusyKey("");
    }
  }

  function onStance({ player, stance, note }) {
    run(player.id, { action: "stance", player_id: player.id, stance, note }, () =>
      setMine((current) => {
        const next = { ...current };
        if (stance) next[player.id] = { stance, note: note ?? "" };
        else delete next[player.id];
        return next;
      }),
    );
  }

  function onProtect({ player, on }) {
    run(`protect:${player.id}`, { action: "untouchable", player_id: player.id, on }, () => {
      setProtectedIds((current) =>
        on ? [...new Set([...current, player.id])] : current.filter((id) => id !== player.id),
      );
      if (on) {
        setMine((current) => {
          const next = { ...current };
          delete next[player.id];
          return next;
        });
      }
    });
  }

  function onPrefs(next) {
    run("prefs", { action: "prefs", looking_for: next.looking_for, note: next.note }, () => {
      setPrefs(next);
      setSaved("prefs");
      setTimeout(() => setSaved(""), 1800);
    });
  }

  function onAsk({ to, player, key }) {
    run(key, { action: "ask", to_manager_id: to, player_id: player }, () =>
      setAsked((current) => new Set(current).add(key)),
    );
  }

  function onResolve(id, state) {
    run(id, { action: "resolve", interest_id: id, state }, () =>
      setInbox((current) => current.filter((item) => item.id !== id)),
    );
  }

  function onOffer(args) {
    if (args.interestId && !preview) {
      post({ action: "resolve", interest_id: args.interestId, state: "offered" });
    }
    onStartOffer(args);
  }

  const mineCount = Object.keys(mine).length;
  const newInterest = inbox.filter((i) => i.state === "new").length;

  if (!office.hasSquad) {
    return (
      <UltimaStaffMessage
        subject="Your block opens after the draft."
        body="Finish the draft and your squad appears here, ready to list."
        actionLabel="Go to the draft"
        href="/ultima/draft"
      />
    );
  }

  return (
    <div className={styles.blkPage}>
      <div className={styles.blkViews} role="tablist" aria-label="Trade block">
        {[
          ["board", "League block"],
          ["mine", `My block${mineCount ? ` · ${mineCount}` : ""}`],
          ["interest", `Interest${newInterest ? ` · ${newInterest}` : ""}`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? styles.deskTabOn : styles.deskTab}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <UltimaStaffMessage subject={error} /> : null}

      {view === "board" ? (
        <Board
          office={{ ...office, board: { ...office.board, mine } }}
          asked={asked}
          onAsk={onAsk}
          onOffer={onOffer}
          busyKey={busyKey}
        />
      ) : null}
      {view === "mine" ? (
        <MyBlock
          office={office}
          mine={mine}
          prefs={prefs}
          onStance={onStance}
          onPrefs={onPrefs}
          onProtect={onProtect}
          protectedIds={protectedIds}
          busyKey={busyKey}
          saved={saved}
        />
      ) : null}
      {view === "interest" ? (
        <Interest
          office={office}
          inbox={inbox}
          onResolve={onResolve}
          onOffer={onOffer}
          busyKey={busyKey}
        />
      ) : null}

      {view !== "mine" && !mineCount ? (
        <UltimaStaffMessage
          subject="Have a player to move?"
          actionLabel="Open My block"
          onAction={() => setView("mine")}
        />
      ) : null}
    </div>
  );
}
