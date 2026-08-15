"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaNewsBoard({ initialItems = [] }) {
  const items = initialItems;

  if (!items.length) {
    return (
      <section className={styles.newsBoard} id="ultima-news" aria-label="League news">
        <h2 className={styles.sectionTitle}>League news</h2>
        <p className={styles.hubNote}>
          Picks, seats, XI locks, market moves and trades land here as they happen.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.newsBoard} id="ultima-news" aria-label="League news">
      <h2 className={styles.sectionTitle}>League news</h2>
      <ul className={styles.newsList}>
        {items.map((item) => (
          <li key={item.id} className={styles.newsItem}>
            <time className={styles.newsTime} dateTime={item.at}>
              {formatStamp(item.at)}
            </time>
            <span>{item.line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UltimaTradeDesk({ initialCards = [], managerId }) {
  const [cards, setCards] = useState(initialCards);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  async function act(tradeId, body) {
    setBusyId(tradeId);
    setError("");
    try {
      const res = await fetch("/api/ultima/trades/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_id: tradeId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "That did not land.");
        return;
      }
      if (body.veto && !data.vetoed) {
        setCards((current) =>
          current.map((card) =>
            card.id === tradeId
              ? {
                  ...card,
                  already_vetoed: true,
                  veto_count: card.veto_count + 1,
                }
              : card,
          ),
        );
        return;
      }
      if (body.accept) {
        setCards((current) =>
          current.map((card) =>
            card.id === tradeId
              ? {
                  ...card,
                  state: "review",
                  can_accept: false,
                  can_veto: false,
                }
              : card,
          ),
        );
        return;
      }
      setCards((current) => current.filter((card) => card.id !== tradeId));
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setBusyId("");
    }
  }

  if (!cards.length) return null;

  return (
    <section className={styles.tradeDesk} id="ultima-decisions" aria-label="Open trades">
      <h2 className={styles.sectionTitle}>Needs a decision</h2>
      <ul className={styles.tradeDeskList}>
        {cards.map((card) => (
          <li key={card.id} className={styles.tradeDeskCard}>
            <p className={styles.tradeDeskMeta}>
              {card.state === "proposed" ? "Proposal" : "League review"}
              {card.review_expires_at && card.state === "review"
                ? ` · ${hoursLeft(card.review_expires_at)}`
                : ""}
            </p>
            <p className={styles.tradeDeskTitle}>
              {card.proposer_name} to {card.receiver_name}
            </p>
            <p className={styles.hubNote}>
              {card.giving.join(", ") || "Players"}
              {" for "}
              {card.getting.join(", ") || "players"}
              {card.verdict ? `. ${card.verdict}` : ""}
            </p>
            {card.state === "review" ? (
              <p className={styles.hubNote}>
                {card.veto_count} veto{card.veto_count === 1 ? "" : "es"} so far.
              </p>
            ) : null}
            {card.can_accept ? (
              <div className={styles.tradeDeskActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busyId === card.id}
                  onClick={() => act(card.id, { accept: true })}
                >
                  {busyId === card.id ? "…" : "Accept"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busyId === card.id}
                  onClick={() => act(card.id, { accept: false })}
                >
                  Decline
                </button>
              </div>
            ) : null}
            {card.can_veto ? (
              <div className={styles.tradeDeskActions}>
                {card.already_vetoed ? (
                  <p className={styles.hubNote}>You vetoed this.</p>
                ) : (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busyId === card.id}
                    onClick={() => act(card.id, { veto: true })}
                  >
                    {busyId === card.id ? "…" : "Veto"}
                  </button>
                )}
              </div>
            ) : null}
            {card.state === "review" &&
            (card.proposer_id === managerId || card.receiver_id === managerId) ? (
              <p className={styles.hubNote}>You are in this trade. The league reviews it.</p>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className={styles.messageError}>{error}</p> : null}
      <Link href="/ultima/trades" className={styles.quietLink}>
        Open the trade board
      </Link>
    </section>
  );
}

export function UltimaChat({ managerId }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ultima/chat");
        const data = await res.json();
        if (!cancelled && res.ok) setMessages(data.messages ?? []);
      } catch {
        /* keep last */
      }
    }
    load();
    const tick = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  async function send(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Message did not send.");
      } else {
        setMessages(data.messages ?? []);
        setBody("");
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.chatBoard} aria-label="Manager chat">
      <h2 className={styles.sectionTitle}>Room</h2>
      <p className={styles.hubNote}>Ten seats. Keep it about the league.</p>
      <ul className={styles.chatList}>
        {messages.length === 0 ? (
          <li className={styles.chatRow}>No messages yet.</li>
        ) : (
          messages.map((msg) => (
            <li
              key={msg.id}
              className={msg.manager_id === managerId ? styles.chatMine : styles.chatRow}
            >
              <span className={styles.chatName}>{msg.team_name}</span>
              <span>{msg.body}</span>
            </li>
          ))
        )}
      </ul>
      <form className={styles.chatForm} onSubmit={send}>
        <label className="sr-only" htmlFor="ultima-chat">
          Message
        </label>
        <input
          id="ultima-chat"
          value={body}
          maxLength={280}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write to the room"
        />
        <button type="submit" className={styles.secondaryBtn} disabled={busy || !body.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {error ? <p className={styles.messageError}>{error}</p> : null}
    </section>
  );
}

function formatStamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Window closing";
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  return `${hours}h left`;
}
