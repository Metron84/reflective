"use client";

import { useMemo, useState } from "react";
import styles from "./WriteToMeloCard.module.css";

const TOPICS = [
  "Partnership",
  "Supporters Club",
  "Content idea",
  "Other",
];

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function WriteToMeloCard({
  prefillMessage = "",
  sourceConversation = [],
}) {
  const [message, setMessage] = useState(prefillMessage);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    if (submitting || sent) return false;
    if (!message.trim()) return false;
    if (email.trim() && !isValidEmail(email.trim())) return false;
    return true;
  }, [submitting, sent, message, email]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Please write a short message.");
      return;
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      setError("That email does not look right.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          topic,
          source_conversation: sourceConversation,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.reason === "rate-limited") {
          setError("Too many messages. Try again shortly.");
        } else if (data.reason === "invalid-email") {
          setError("That email does not look right.");
        } else {
          setError("Could not send. Try again, or email melo@thereflectivefootball.com.");
        }
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send. Try again, or email melo@thereflectivefootball.com.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.card} role="status">
        <p className={styles.eyebrow}>Write to Melo</p>
        <p className={styles.confirm}>
          Sent. Melo reads everything. Usually replies within a couple of days.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Write to Melo</p>
      <p className={styles.lead}>
        This one needs a human. Send it through and Melo will take it from here.
      </p>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Message</span>
          <textarea
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            disabled={submitting}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Topic</span>
          <select
            className={styles.select}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={submitting}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Name (optional)</span>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={submitting}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email (optional)</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
          </label>
        </div>
        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          type="submit"
          className={styles.submit}
          disabled={!canSubmit}
        >
          {submitting ? "Sending..." : "Send to Melo"}
        </button>
      </form>
    </div>
  );
}
