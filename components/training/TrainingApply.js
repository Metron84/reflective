"use client";

import { useState } from "react";
import { TRAINING_TERMS } from "@/lib/training/terms";
import styles from "./TrainingApply.module.css";

const DESCRIBES = [
  "Student",
  "Recent graduate",
  "Changing career",
  "Already creating content",
  "Other",
];

const FILMED_BEFORE = ["No", "A little", "Yes"];

const MESSAGES = {
  "full_name-required": "Add your full name.",
  "full_name-too-long": "That name is too long. Shorten it.",
  "email-required": "Add your email.",
  "email-invalid": "Check the email address.",
  "email-too-long": "That email is too long.",
  "whatsapp-required": "Add a WhatsApp number.",
  "whatsapp-too-long": "That WhatsApp number is too long.",
  "describes-required": "Choose which option describes you.",
  "describes-invalid": "Choose an option from the list.",
  "why-required": "Tell us why you want a seat.",
  "why-too-long": "Keep that answer under 500 characters.",
  "filmed-required": "Say whether you have filmed or edited before.",
  "filmed-invalid": "Choose an option from the list.",
  "accepted_terms-required": "Accept the terms to continue.",
  "accepted_fee-required": "Confirm you understand the fee.",
  "requested_payment-required": "Confirm you want payment details.",
  "rate-limited": "Too many tries just now. Wait an hour and try again.",
  unavailable: "Applications are paused right now. Try again soon.",
  "server-error": "Could not send. Try again in a moment.",
  "invalid-request": "Could not send. Try again in a moment.",
};

export default function TrainingApply() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [describes, setDescribes] = useState("");
  const [why, setWhy] = useState("");
  const [filmedBefore, setFilmedBefore] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedFee, setAcceptedFee] = useState(false);
  const [requestedPayment, setRequestedPayment] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const fieldsComplete =
    Boolean(fullName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(whatsapp.trim()) &&
    Boolean(describes) &&
    Boolean(why.trim()) &&
    Boolean(filmedBefore);

  const acceptancesComplete =
    acceptedTerms && acceptedFee && requestedPayment;

  const canSubmit = fieldsComplete && acceptancesComplete && !submitting;

  function messageFor(reason) {
    return MESSAGES[reason] ?? MESSAGES["server-error"];
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    if (!fullName.trim()) {
      setError(messageFor("full_name-required"));
      return;
    }
    if (!email.trim()) {
      setError(messageFor("email-required"));
      return;
    }
    if (!whatsapp.trim()) {
      setError(messageFor("whatsapp-required"));
      return;
    }
    if (!describes) {
      setError(messageFor("describes-required"));
      return;
    }
    if (!why.trim()) {
      setError(messageFor("why-required"));
      return;
    }
    if (why.trim().length > 500) {
      setError(messageFor("why-too-long"));
      return;
    }
    if (!filmedBefore) {
      setError(messageFor("filmed-required"));
      return;
    }
    if (!acceptedTerms) {
      setError(messageFor("accepted_terms-required"));
      return;
    }
    if (!acceptedFee) {
      setError(messageFor("accepted_fee-required"));
      return;
    }
    if (!requestedPayment) {
      setError(messageFor("requested_payment-required"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          describes_you: describes,
          why_seat: why.trim(),
          filmed_before: filmedBefore,
          accepted_terms: acceptedTerms,
          accepted_fee: acceptedFee,
          requested_payment_details: requestedPayment,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(messageFor(data.reason));
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError(messageFor("server-error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="apply"
      className={styles.section}
      aria-labelledby="training-apply-title"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Apply</p>
        <h2 id="training-apply-title" className={styles.heading}>
          Apply and confirm your place
        </h2>

        {sent ? (
          <p className={styles.success} role="status">
            Request received. If a seat is available we will send payment
            details within 3 days.
          </p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor="training-website">Website</label>
              <input
                id="training-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="training-full-name" className={styles.label}>
                Full name
              </label>
              <input
                id="training-full-name"
                className={styles.input}
                type="text"
                name="full_name"
                autoComplete="name"
                required
                disabled={submitting}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="training-email" className={styles.label}>
                Email
              </label>
              <input
                id="training-email"
                className={styles.input}
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={submitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="training-whatsapp" className={styles.label}>
                WhatsApp number
              </label>
              <input
                id="training-whatsapp"
                className={styles.input}
                type="tel"
                name="whatsapp"
                autoComplete="tel"
                required
                disabled={submitting}
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="training-describes" className={styles.label}>
                Which best describes you
              </label>
              <select
                id="training-describes"
                className={styles.select}
                name="describes_you"
                required
                disabled={submitting}
                value={describes}
                onChange={(event) => setDescribes(event.target.value)}
              >
                <option value="">Select one</option>
                {DESCRIBES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="training-why" className={styles.label}>
                Why you want a seat
              </label>
              <textarea
                id="training-why"
                className={styles.textarea}
                name="why_seat"
                required
                maxLength={500}
                placeholder="A few lines is enough."
                disabled={submitting}
                value={why}
                onChange={(event) => setWhy(event.target.value)}
              />
              <p className={styles.charCount}>{why.length}/500</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="training-filmed" className={styles.label}>
                Have you filmed or edited anything before
              </label>
              <select
                id="training-filmed"
                className={styles.select}
                name="filmed_before"
                required
                disabled={submitting}
                value={filmedBefore}
                onChange={(event) => setFilmedBefore(event.target.value)}
              >
                <option value="">Select one</option>
                {FILMED_BEFORE.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.terms}>
              <h3 className={styles.termsHeading}>The terms</h3>
              <ul className={styles.termsList}>
                {TRAINING_TERMS.map((line) => (
                  <li key={line} className={styles.termsItem}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.checks}>
              <label htmlFor="training-accepted-terms" className={styles.check}>
                <input
                  id="training-accepted-terms"
                  type="checkbox"
                  name="accepted_terms"
                  required
                  checked={acceptedTerms}
                  disabled={submitting}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>I have read and accept the terms above.</span>
              </label>

              <label htmlFor="training-accepted-fee" className={styles.check}>
                <input
                  id="training-accepted-fee"
                  type="checkbox"
                  name="accepted_fee"
                  required
                  checked={acceptedFee}
                  disabled={submitting}
                  onChange={(event) => setAcceptedFee(event.target.checked)}
                />
                <span>
                  I understand the fee is AED 2,500 and must be paid in full
                  before the course begins.
                </span>
              </label>

              <label
                htmlFor="training-requested-payment"
                className={styles.check}
              >
                <input
                  id="training-requested-payment"
                  type="checkbox"
                  name="requested_payment_details"
                  required
                  checked={requestedPayment}
                  disabled={submitting}
                  onChange={(event) =>
                    setRequestedPayment(event.target.checked)
                  }
                />
                <span>
                  I request payment details and am happy for The Reflective
                  Football to contact me.
                </span>
              </label>
            </div>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className={styles.submit}
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
            >
              {submitting
                ? "Sending…"
                : "Confirm and request payment details"}
            </button>

            <p className={styles.footnote}>
              We reply within 3 days. If a seat is available we send payment
              details and agree your start date.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
