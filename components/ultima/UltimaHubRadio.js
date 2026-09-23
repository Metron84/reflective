"use client";

import { useState } from "react";
import UltimaInboxItem from "./UltimaInboxItem";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function stamp(iso) {
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

export default function UltimaHubRadio({ initialMessages = [], managerId }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    <UltimaPanel title="Staff radio" className={styles.hubRadioPanel}>
      <div className={styles.hubRadioList}>
        {!messages.length ? (
          <UltimaStaffMessage
            subject="The radio is quiet"
            body="Ten seats. Keep it about the league."
          />
        ) : (
          messages.map((msg) => (
            <UltimaInboxItem
              key={msg.id}
              type="staff"
              unread={false}
              subject={msg.body}
              sender={msg.team_name}
              time={stamp(msg.at)}
            />
          ))
        )}
      </div>
      <form className={styles.hubRadioForm} onSubmit={send}>
        <label className="sr-only" htmlFor="ultima-radio">
          Message
        </label>
        <input
          id="ultima-radio"
          value={body}
          maxLength={280}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write to the room"
        />
        <button
          type="submit"
          className={styles.secondaryBtn}
          disabled={busy || !body.trim()}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {error ? (
        <UltimaStaffMessage subject="The radio could not send that" body={error} />
      ) : null}
    </UltimaPanel>
  );
}
