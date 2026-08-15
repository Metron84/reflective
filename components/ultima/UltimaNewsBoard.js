"use client";

import { useEffect, useState } from "react";
import styles from "./ultima.module.css";

export default function UltimaNewsBoard({ initialItems = [] }) {
  const items = initialItems;

  if (!items.length) {
    return (
      <section className={styles.newsBoard} aria-label="League news">
        <h2 className={styles.sectionTitle}>League news</h2>
        <p className={styles.hubNote}>Picks, XI locks, market moves and trades land here.</p>
      </section>
    );
  }

  return (
    <section className={styles.newsBoard} aria-label="League news">
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
      <h2 className={styles.sectionTitle}>Managers</h2>
      <p className={styles.hubNote}>Ten seats. Keep it about the league.</p>
      <ul className={styles.chatList}>
        {messages.map((msg) => (
          <li
            key={msg.id}
            className={msg.manager_id === managerId ? styles.chatMine : styles.chatRow}
          >
            <span className={styles.chatName}>{msg.team_name}</span>
            <span>{msg.body}</span>
          </li>
        ))}
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
