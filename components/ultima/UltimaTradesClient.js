"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import styles from "./ultima.module.css";

export default function UltimaTradesClient({
  trades,
  managers,
  myId,
  roster,
  rostersByManager = {},
  tradesOpen,
  gameweekNumber,
}) {
  const [mode, setMode] = useState("list");
  const [receiverId, setReceiverId] = useState("");
  const [giveIds, setGiveIds] = useState([]);
  const [getIds, setGetIds] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const opponents = managers.filter((m) => m.id !== myId && !m.is_bot);
  const theirRoster = receiverId ? (rostersByManager[receiverId] ?? []) : [];

  function toggleGet(id) {
    const next = getIds.includes(id) ? getIds.filter((x) => x !== id) : [...getIds, id];
    setGetIds(next);
    if (receiverId) previewVerdict(giveIds, next, receiverId);
  }

  async function previewVerdict(give, get, receiver) {
    const res = await fetch("/api/ultima/trades/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preview: true,
        receiver_id: receiver,
        give_player_ids: give,
        get_player_ids: get,
      }),
    });
    const data = await res.json();
    if (res.ok) setVerdict(data.verdict);
    else setVerdict({ message: data.message });
  }

  function toggleGive(id) {
    const next = giveIds.includes(id) ? giveIds.filter((x) => x !== id) : [...giveIds, id];
    setGiveIds(next);
    if (receiverId) previewVerdict(next, getIds, receiverId);
  }

  async function sendTrade() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/trades/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_id: receiverId,
          give_player_ids: giveIds,
          get_player_ids: getIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Could not send.");
      else window.location.reload();
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  async function respond(tradeId, accept) {
    await fetch("/api/ultima/trades/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_id: tradeId, accept }),
    });
    window.location.reload();
  }

  async function veto(tradeId) {
    await fetch("/api/ultima/trades/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_id: tradeId, veto: true }),
    });
    window.location.reload();
  }

  if (!tradesOpen) {
    return (
      <EmptyState
        heading="Trades closed"
        body={`Not enough data yet. Trades open at gameweek 4. Current gameweek ${gameweekNumber ?? "—"}.`}
        actionLabel="Open the hub"
        actionHref="/ultima"
      />
    );
  }

  if (mode === "build") {
    return (
      <div className={styles.tradeBuilder}>
        <label className={styles.field}>
          Opponent
          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className={styles.fieldSelect}
          >
            <option value="">Choose…</option>
            {opponents.map((m) => (
              <option key={m.id} value={m.id}>
                {m.team_name}
              </option>
            ))}
          </select>
        </label>

        <section>
          <h2 className={styles.sectionTitle}>You give</h2>
          {roster.map((p) => (
            <label key={p.id} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={giveIds.includes(p.id)}
                onChange={() => toggleGive(p.id)}
              />
              {p.name}
            </label>
          ))}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>You get</h2>
          {!receiverId ? (
            <p className={styles.emptyState}>Choose an opponent first.</p>
          ) : (
            theirRoster.map((p) => (
              <label key={p.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={getIds.includes(p.id)}
                  onChange={() => toggleGet(p.id)}
                />
                {p.name}
              </label>
            ))
          )}
        </section>

        <div className={styles.tradeFooter}>
          <p>{verdict?.message ?? "Pick players to see the verdict."}</p>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={
              loading ||
              !receiverId ||
              giveIds.length !== getIds.length ||
              giveIds.length === 0
            }
            onClick={sendTrade}
          >
            Send proposal
          </button>
          {giveIds.length !== getIds.length ? (
            <p className={styles.disabledReason}>
              {giveIds.length > getIds.length
                ? "Two for two. Add one more on their side."
                : "Counts must match."}
            </p>
          ) : null}
        </div>

        {error ? <p className={styles.messageError}>{error}</p> : null}
        <button type="button" className={styles.quietLink} onClick={() => setMode("list")}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.primaryBtn} onClick={() => setMode("build")}>
        New proposal
      </button>

      <ul className={styles.tradeList}>
        {trades.map((t) => (
          <li key={t.id} className={styles.tradeRow}>
            <p>
              {t.state} · {t.verdict_json?.message ?? ""}
            </p>
            {t.receiver_id === myId && t.state === "proposed" ? (
              <div className={styles.tradeActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => respond(t.id, true)}>
                  Accept
                </button>
                <button type="button" className={styles.quietLink} onClick={() => respond(t.id, false)}>
                  Decline
                </button>
              </div>
            ) : null}
            {t.state === "review" && t.proposer_id !== myId && t.receiver_id !== myId ? (
              <button type="button" className={styles.secondaryBtn} onClick={() => veto(t.id)}>
                Veto
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {trades.length === 0 ? <p className={styles.emptyState}>No trades yet.</p> : null}
    </div>
  );
}
