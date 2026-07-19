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
  const [nameHint, setNameHint] = useState("");
  const [emailHint, setEmailHint] = useState("");

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

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailLooksValid = trimmedEmail && isValidEmail(trimmedEmail);

  const canSubmit = useMemo(() => {
    if (submitting || sent) return false;
    if (!timingToken) return false;
    if (!message.trim()) return false;
    if (!trimmedName) return false;
    if (!emailLooksValid) return false;
    return true;
  }, [
    submitting,
    sent,
    timingToken,
    message,
    trimmedName,
    emailLooksValid,
  ]);

  async function onSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Please write a short message.");
      return;
    }
    if (!trimmedName) {
      setNameHint("I need a name so Melo knows who to reply to.");
      setError("");
      return;
    }
    if (!trimmedEmail) {
      setEmailHint("I need an email to reply to you.");
      setError("");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setEmailHint("That email does not look right.");
      setError("");
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    setNameHint("");
    setEmailHint("");

    try {
      const res = await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          name: trimmedName,
          email: trimmedEmail,
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
        } else if (data.reason === "name-required") {
          setNameHint("I need a name so Melo knows who to reply to.");
        } else if (data.reason === "email-required") {
          setEmailHint("I need an email to reply to you.");
        } else if (data.reason === "invalid-email") {
          setEmailHint("That email does not look right.");
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
          ? "Tell Melo what you were looking for. Leave your name and email so he can reply."
          : "This one needs a human. Leave your name and email, and Melo will take it from here."}
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
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              onBlur={() => {
                setNameHint(
                  name.trim()
                    ? ""
                    : "I need a name so Melo knows who to reply to."
                );
              }}
              autoComplete="name"
              required
              maxLength={100}
              disabled={submitting}
            />
            {nameHint ? <span className={styles.fieldHint}>{nameHint}</span> : null}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              onBlur={() => {
                const v = email.trim();
                if (!v) setEmailHint("I need an email to reply to you.");
                else if (!isValidEmail(v))
                  setEmailHint("That email does not look right.");
                else setEmailHint("");
              }}
              autoComplete="email"
              required
              maxLength={200}
              disabled={submitting}
            />
            {emailHint ? (
              <span className={styles.fieldHint}>{emailHint}</span>
            ) : null}
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
