"use client";

import { useEffect, useState } from "react";
import styles from "./WriteToUs.module.css";

const RETRY = "Could not send. Please try again.";
const WAIT = "You can write to us again in 24 hours.";

export default function WriteToUs({ initiallySent = false }) {
  const [club, setClub] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [timingToken, setTimingToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(initiallySent);
  const [cooling, setCooling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sent || cooling) return undefined;

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
        /* Submit stays quiet if the timing token never arrives. */
      });

    return () => {
      cancelled = true;
    };
  }, [sent, cooling]);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting || sent || cooling) return;

    const supportersClub = club.trim();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!supportersClub || !trimmedName || !trimmedMessage) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "your-say",
          supportersClub,
          publishConsent,
          name: trimmedName,
          message: trimmedMessage,
          website,
          timingToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.reason === "cooldown") {
          setCooling(true);
        } else {
          setError(RETRY);
        }
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError(RETRY);
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.card} role="status">
        <p className={styles.thanks}>Thank you. Melo reads every message.</p>
      </div>
    );
  }

  if (cooling) {
    return (
      <div className={styles.card} role="status">
        <p className={styles.thanks}>{WAIT}</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Write to us</h2>
      <p className={styles.sub}>Praise or criticism, it goes on this page.</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Supporters club
          <input
            className={styles.input}
            name="supporters-club"
            value={club}
            onChange={(event) => setClub(event.target.value)}
            autoComplete="organization"
            required
            maxLength={120}
            disabled={submitting}
          />
        </label>
        <label className={styles.label}>
          Your name (never shown)
          <input
            className={styles.input}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            maxLength={100}
            disabled={submitting}
          />
        </label>
        <label className={styles.label}>
          Your message
          <textarea
            className={styles.textarea}
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            required
            maxLength={8000}
            disabled={submitting}
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="publish-consent"
            checked={publishConsent}
            onChange={(event) => setPublishConsent(event.target.checked)}
            disabled={submitting}
          />
          <span>TRF can publish my words on this page under my supporters club&apos;s name.</span>
        </label>
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="your-say-website">Website</label>
          <input
            id="your-say-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button className={styles.submit} type="submit" disabled={submitting || !timingToken}>
          SEND
        </button>
      </form>
    </div>
  );
}
