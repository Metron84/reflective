"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ATTENDANCE_OPTIONS,
  CLOCKEND_SHARE_TEXT,
  GROUP_SIZE_OPTIONS,
  TRF_INSTAGRAM_URL,
  WATCH_STYLE_OPTIONS,
} from "@/lib/clockend/options";
import { normalizeInstagram, normalizeWhatsapp } from "@/lib/clockend/normalize";
import styles from "./ClockEndSignup.module.css";

const SERVER_ERRORS = {
  "name-required": { field: "name", text: "Add your first and last name" },
  "name-too-long": { field: "name", text: "That name is too long. Shorten it" },
  "whatsapp-required": {
    field: "whatsapp",
    text: "Add your WhatsApp number so we can reach you",
  },
  "whatsapp-invalid": {
    field: "whatsapp",
    text: "That number does not look right. Check it and try again",
  },
  "instagram-invalid": {
    field: "instagram",
    text: "Use letters, numbers, dots or underscores only",
  },
  "consent-required": {
    field: "consent",
    text: "Tick the box so we can message you on WhatsApp",
  },
  "rate-limited": {
    field: "form",
    text: "Too many tries just now. Wait an hour and try again",
  },
  unavailable: { field: "form", text: "Sign-ups are paused right now. Try again soon" },
};
const GENERIC_ERROR = { field: "form", text: "Could not send. Try again in a moment" };

const FIELD_ORDER = ["name", "whatsapp", "instagram", "consent"];
const FIELD_IDS = {
  name: "ce-name",
  whatsapp: "ce-whatsapp",
  instagram: "ce-instagram",
  consent: "ce-consent",
};

function Hero() {
  return (
    <div className={styles.photo}>
      <Image
        src="/clockend/hero.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className={styles.photoImg}
      />
      <div className={styles.fade} aria-hidden="true" />
    </div>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.tagline}>Football is nothing without the fans.</p>
      <p className={styles.wordmark}>The Reflective Football</p>
    </footer>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className={styles.error} role="alert">
      {children}
    </p>
  );
}

function Choice({ selected, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${selected ? styles.choiceOn : ""}`}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function ClockEndSignup() {
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [groupSize, setGroupSize] = useState(null);
  const [watchStyles, setWatchStyles] = useState([]);
  const [filmConsent, setFilmConsent] = useState(null);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // null | "new" | "existing"
  const doneHeading = useRef(null);

  useEffect(() => {
    if (!done) return;
    window.scrollTo({ top: 0 });
    doneHeading.current?.focus();
  }, [done]);

  const intl = /^\s*(\+|00)/.test(whatsapp);

  function toggleList(setter, value) {
    setter((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  function pick(setter, value) {
    setter((current) => (current === value ? null : value));
  }

  function focusFirstError(next) {
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const next = {};
    if (fullName.trim().length < 2) next.name = SERVER_ERRORS["name-required"].text;
    if (!whatsapp.trim()) {
      next.whatsapp = SERVER_ERRORS["whatsapp-required"].text;
    } else if (!normalizeWhatsapp(whatsapp)) {
      next.whatsapp = SERVER_ERRORS["whatsapp-invalid"].text;
    }
    if (!normalizeInstagram(instagram).valid) {
      next.instagram = SERVER_ERRORS["instagram-invalid"].text;
    }
    if (!consent) next.consent = SERVER_ERRORS["consent-required"].text;
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(next);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/clockend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          whatsapp: whatsapp.trim(),
          instagram: instagram.trim(),
          arsenal_uae_member: member,
          attendance,
          group_size: groupSize,
          watch_styles: watchStyles,
          film_consent: filmConsent,
          contact_consent: consent,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const mapped = SERVER_ERRORS[data.reason] ?? GENERIC_ERROR;
        const nextErrors = { [mapped.field]: mapped.text };
        setErrors(nextErrors);
        focusFirstError(nextErrors);
        return;
      }
      setDone(data.already ? "existing" : "new");
    } catch {
      setErrors({ form: GENERIC_ERROR.text });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={styles.page}>
        <Hero />
        <div className={styles.content}>
          <div className={styles.column}>
            <h1
              ref={doneHeading}
              tabIndex={-1}
              className={styles.title}
              aria-live="polite"
            >
              {done === "existing" ? "You’re already " : "You’re "}
              <span className={styles.gold}>in.</span>
            </h1>
            <p className={styles.lead}>
              We&apos;ll message you on WhatsApp the moment the section is locked.
            </p>
            <p className={styles.bring}>Now bring the table.</p>
            <a
              className={styles.thanksPrimary}
              href={`https://wa.me/?text=${encodeURIComponent(CLOCKEND_SHARE_TEXT)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
            <a
              className={styles.thanksOutline}
              href={TRF_INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow @thereflectivefootball
            </a>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Hero />
      <div className={styles.content}>
        <div className={styles.column}>
          <h1 className={styles.title}>Clock End Dubai</h1>
          <p className={styles.lead}>
            Bring the noise. <span className={styles.gold}>Keep your seat.</span>
          </p>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <h2 className={styles.formTitle}>Put your name down</h2>
            <p className={styles.helper}>Takes 30 seconds. 9 quick answers.</p>

            <section className={styles.section} aria-labelledby="ce-about">
              <h3 id="ce-about" className={styles.sectionLabel}>
                About you
              </h3>

              <div className={styles.field}>
                <label htmlFor="ce-name" className={styles.label}>
                  Your name
                </label>
                <input
                  id="ce-name"
                  className={styles.input}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="First and last name"
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                  aria-invalid={errors.name ? "true" : undefined}
                  aria-describedby={errors.name ? "ce-name-error" : undefined}
                />
                <FieldError id="ce-name-error">{errors.name}</FieldError>
              </div>

              <div className={styles.field}>
                <label htmlFor="ce-whatsapp" className={styles.label}>
                  WhatsApp number
                </label>
                <div className={styles.phone}>
                  <span
                    className={`${styles.prefix} ${intl ? styles.prefixOff : ""}`}
                    aria-hidden="true"
                  >
                    +971
                  </span>
                  <input
                    id="ce-whatsapp"
                    className={`${styles.input} ${styles.phoneInput}`}
                    type="tel"
                    name="whatsapp"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="50 123 4567"
                    maxLength={30}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={submitting}
                    aria-invalid={errors.whatsapp ? "true" : undefined}
                    aria-describedby={
                      errors.whatsapp
                        ? "ce-whatsapp-help ce-whatsapp-error"
                        : "ce-whatsapp-help"
                    }
                  />
                </div>
                <p id="ce-whatsapp-help" className={styles.helper}>
                  This is how we tell you when the section is ready.
                </p>
                <FieldError id="ce-whatsapp-error">{errors.whatsapp}</FieldError>
              </div>

              <div className={styles.field}>
                <label htmlFor="ce-instagram" className={styles.label}>
                  Instagram (optional)
                </label>
                <input
                  id="ce-instagram"
                  className={styles.input}
                  type="text"
                  name="instagram"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="@yourhandle"
                  maxLength={40}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  disabled={submitting}
                  aria-invalid={errors.instagram ? "true" : undefined}
                  aria-describedby={errors.instagram ? "ce-instagram-error" : undefined}
                />
                <FieldError id="ce-instagram-error">{errors.instagram}</FieldError>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="ce-matchday">
              <h3 id="ce-matchday" className={styles.sectionLabel}>
                Your matchday
              </h3>

              <div className={styles.field} role="group" aria-labelledby="ce-member-label">
                <span id="ce-member-label" className={styles.label}>
                  Are you an Arsenal UAE member?
                </span>
                <div className={`${styles.choices} ${styles.cols2}`}>
                  <Choice
                    selected={member === true}
                    onClick={() => pick(setMember, true)}
                    disabled={submitting}
                  >
                    Yes
                  </Choice>
                  <Choice
                    selected={member === false}
                    onClick={() => pick(setMember, false)}
                    disabled={submitting}
                  >
                    No
                  </Choice>
                </div>
              </div>

              <div
                className={styles.field}
                role="group"
                aria-labelledby="ce-attendance-label"
                aria-describedby="ce-attendance-help"
              >
                <span id="ce-attendance-label" className={styles.label}>
                  When do you come to watch?
                </span>
                <p id="ce-attendance-help" className={styles.helper}>
                  Pick all that fit.
                </p>
                <div className={`${styles.choices} ${styles.cols2}`}>
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <Choice
                      key={option.value}
                      selected={attendance.includes(option.value)}
                      onClick={() => toggleList(setAttendance, option.value)}
                      disabled={submitting}
                    >
                      {option.label}
                    </Choice>
                  ))}
                </div>
              </div>

              <div className={styles.field} role="group" aria-labelledby="ce-size-label">
                <span id="ce-size-label" className={styles.label}>
                  How many of you usually come?
                </span>
                <div className={`${styles.choices} ${styles.cols4}`}>
                  {GROUP_SIZE_OPTIONS.map((option) => (
                    <Choice
                      key={option.value}
                      selected={groupSize === option.value}
                      onClick={() => pick(setGroupSize, option.value)}
                      disabled={submitting}
                    >
                      {option.label}
                    </Choice>
                  ))}
                </div>
              </div>

              <div
                className={styles.field}
                role="group"
                aria-labelledby="ce-style-label"
                aria-describedby="ce-style-help"
              >
                <span id="ce-style-label" className={styles.label}>
                  How do you like to watch?
                </span>
                <p id="ce-style-help" className={styles.helper}>
                  Pick all that fit.
                </p>
                <div className={`${styles.choices} ${styles.stack}`}>
                  {WATCH_STYLE_OPTIONS.map((option) => (
                    <Choice
                      key={option.value}
                      selected={watchStyles.includes(option.value)}
                      onClick={() => toggleList(setWatchStyles, option.value)}
                      disabled={submitting}
                    >
                      {option.label}
                    </Choice>
                  ))}
                </div>
              </div>

              <div className={styles.field} role="group" aria-labelledby="ce-film-label">
                <span id="ce-film-label" className={styles.label}>
                  Happy to appear in TRF videos?
                </span>
                <div className={`${styles.choices} ${styles.cols2}`}>
                  <Choice
                    selected={filmConsent === true}
                    onClick={() => pick(setFilmConsent, true)}
                    disabled={submitting}
                  >
                    Yes, film me
                  </Choice>
                  <Choice
                    selected={filmConsent === false}
                    onClick={() => pick(setFilmConsent, false)}
                    disabled={submitting}
                  >
                    Rather not
                  </Choice>
                </div>
              </div>
            </section>

            <div className={styles.field}>
              <label htmlFor="ce-consent" className={styles.check}>
                <input
                  id="ce-consent"
                  type="checkbox"
                  name="contact_consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={submitting}
                  aria-invalid={errors.consent ? "true" : undefined}
                  aria-describedby={errors.consent ? "ce-consent-error" : undefined}
                />
                <span>Message me on WhatsApp about Clock End Dubai.</span>
              </label>
              <FieldError id="ce-consent-error">{errors.consent}</FieldError>
            </div>

            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor="ce-website">Website</label>
              <input
                id="ce-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <FieldError id="ce-form-error">{errors.form}</FieldError>

            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? "Sending" : "I’m in"}
            </button>
            <p className={styles.never}>We never share your number.</p>
          </form>
        </div>
        <Footer />
      </div>
    </div>
  );
}
