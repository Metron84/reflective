"use client";

import { useEffect, useMemo, useState } from "react";
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
  variant = "full",
  defaultTopic = "Partnership",
}) {
  const [expanded, setExpanded] = useState(variant !== "light");
  const [message, setMessage] = useState(prefillMessage);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(
    TOPICS.includes(defaultTopic) ? defaultTopic : "Other"
  );
  const [website, setWebsite] = useState("");
  const [timingToken, setTimingToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const formVisible = !sent && (variant !== "light" || expanded);

  // Fresh timing token whenever the form is shown (mount or light expand).
  useEffect(() => {
    if (!formVisible) return undefined;

    let cancelled = false;
    setTimingToken("");

    fetch("/api/concierge/handoff/token")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data?.token === "string") {
          setTimingToken(data.token);
        }
      })
      .catch(() => {
        /* submit will silent-fail timing if token missing */
      });

    return () => {
      cancelled = true;
    };
  }, [formVisible]);

  const canSubmit = useMemo(() => {
    if (submitting || sent) return false;
    if (!timingToken) return false;
    if (!message.trim()) return false;
    if (email.trim() && !isValidEmail(email.trim())) return false;
    return true;
  }, [submitting, sent, timingToken, message, email]);

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
          timingToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.reason === "rate-limited") {
          setError("Too many messages just now. Please try again later.");
        } else if (data.reason === "invalid-email") {
          setError("That email does not look right.");
        } else {
          setError(
            "Could not send. Try again, or email melo@thereflectivefootball.com."
          );
        }
        setSubmitting(false);
        return;
      }
      setSent(true);
      setExpanded(true);
    } catch {
      setError(
        "Could not send. Try again, or email melo@thereflectivefootball.com."
      );
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

  if (variant === "light" && !expanded) {
    return (
      <p className={styles.lightLine}>
        <button
          type="button"
          className={styles.lightButton}
          onClick={() => setExpanded(true)}
        >
          Can&apos;t find what you need? Ask Melo directly
        </button>
      </p>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Write to Melo</p>
      <p className={styles.lead}>
        {variant === "light"
          ? "Tell Melo what you were looking for. He reads every message."
          : "This one needs a human. Send it through and Melo will take it from here."}
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
          <label htmlFor="concierge-website">Website</label>
          <input
            id="concierge-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.submit} disabled={!canSubmit}>
          {submitting ? "Sending..." : "Send to Melo"}
        </button>
      </form>
    </div>
  );
}
