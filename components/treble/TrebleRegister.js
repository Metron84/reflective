"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TREBLE_REGISTER } from "@/lib/treble";
import styles from "./treble.module.css";

const FIELDS = TREBLE_REGISTER.fields;

function messageFor(reason, role) {
  if (reason === "org_name-required") {
    return role === "host"
      ? TREBLE_REGISTER.errors["org_name-required-host"]
      : TREBLE_REGISTER.errors["org_name-required-club"];
  }
  return TREBLE_REGISTER.errors[reason] ?? TREBLE_REGISTER.errors["server-error"];
}

function Field({ id, label, hint, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function TrebleRegister({ initialRole = "club" }) {
  const [role, setRole] = useState(initialRole === "host" ? "host" : "club");
  const [fullName, setFullName] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubSupported, setClubSupported] = useState("");
  const [members, setMembers] = useState("");
  const [orgName, setOrgName] = useState("");
  const [interest, setInterest] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRole(initialRole === "host" ? "host" : "club");
  }, [initialRole]);

  useEffect(() => {
    if (window.location.hash !== "#register") return;
    document.getElementById(TREBLE_REGISTER.id)?.scrollIntoView();
  }, [initialRole]);

  function chooseRole(next) {
    setRole(next);
    setError("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const org = role === "club" ? clubName.trim() : orgName.trim();
    if (!fullName.trim()) {
      setError(messageFor("full_name-required", role));
      return;
    }
    if (!org) {
      setError(messageFor("org_name-required", role));
      return;
    }
    if (role === "club" && !clubSupported.trim()) {
      setError(messageFor("club_supported-required", role));
      return;
    }
    if (role === "club" && !members.trim()) {
      setError(messageFor("members-required", role));
      return;
    }
    if (role === "club" && !/^\d+$/.test(members.trim())) {
      setError(messageFor("members-invalid", role));
      return;
    }
    if (role === "host" && !interest) {
      setError(messageFor("interest-required", role));
      return;
    }
    if (!whatsapp.trim()) {
      setError(messageFor("whatsapp-required", role));
      return;
    }
    if (!email.trim()) {
      setError(messageFor("email-required", role));
      return;
    }
    if (!consent) {
      setError(messageFor("consent-required", role));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/treble", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          full_name: fullName.trim(),
          org_name: org,
          club_supported: role === "club" ? clubSupported.trim() : "",
          members: role === "club" ? members.trim() : "",
          interest: role === "host" ? interest : "",
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          consent,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(messageFor(data.reason, role));
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError(messageFor("server-error", role));
      setSubmitting(false);
    }
  }

  return (
    <section
      id={TREBLE_REGISTER.id}
      className={`${styles.section} ${styles.divided} ${styles.register}`}
      aria-labelledby="treble-register"
    >
      <div className={styles.inner}>
        <h2 id="treble-register" className={styles.headline}>
          {TREBLE_REGISTER.headline}
        </h2>
        {sent ? (
          <div role="status">
            <p className={styles.successLine}>{TREBLE_REGISTER.success}</p>
            <Link
              href={TREBLE_REGISTER.successNextHref}
              className={`${styles.primary} ${styles.successLink}`}
            >
              {TREBLE_REGISTER.successNextLabel}
            </Link>
          </div>
        ) : (
          <>
            <p className={styles.lede}>{TREBLE_REGISTER.body}</p>
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <div
                className={styles.toggle}
                role="group"
                aria-label={TREBLE_REGISTER.roleLegend}
              >
                {TREBLE_REGISTER.roles.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.toggleBtn}
                    aria-pressed={role === option.id}
                    onClick={() => chooseRole(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <Field id="treble-full-name" label={FIELDS.fullName}>
                <input
                  id="treble-full-name"
                  className={styles.input}
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  disabled={submitting}
                />
              </Field>

              {role === "club" ? (
                <>
                  <Field id="treble-club-name" label={FIELDS.clubName}>
                    <input
                      id="treble-club-name"
                      className={styles.input}
                      name="org_name"
                      type="text"
                      autoComplete="organization"
                      maxLength={160}
                      value={clubName}
                      onChange={(event) => setClubName(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </Field>
                  <Field id="treble-club-supported" label={FIELDS.clubSupported}>
                    <input
                      id="treble-club-supported"
                      className={styles.input}
                      name="club_supported"
                      type="text"
                      autoComplete="off"
                      maxLength={120}
                      value={clubSupported}
                      onChange={(event) => setClubSupported(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </Field>
                  <Field id="treble-members" label={FIELDS.members}>
                    <input
                      id="treble-members"
                      className={styles.input}
                      name="members"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={members}
                      onChange={(event) => setMembers(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field id="treble-org-name" label={FIELDS.orgName}>
                    <input
                      id="treble-org-name"
                      className={styles.input}
                      name="org_name"
                      type="text"
                      autoComplete="organization"
                      maxLength={160}
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </Field>
                  <Field id="treble-interest" label={FIELDS.interest}>
                    <select
                      id="treble-interest"
                      className={styles.select}
                      name="interest"
                      value={interest}
                      onChange={(event) => setInterest(event.target.value)}
                      required
                      disabled={submitting}
                    >
                      <option value="">{TREBLE_REGISTER.interestPlaceholder}</option>
                      {TREBLE_REGISTER.interestOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              <Field id="treble-whatsapp" label={FIELDS.whatsapp} hint={FIELDS.whatsappHint}>
                <input
                  id="treble-whatsapp"
                  className={styles.input}
                  name="whatsapp"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  required
                  disabled={submitting}
                />
              </Field>

              <Field id="treble-email" label={FIELDS.email}>
                <input
                  id="treble-email"
                  className={styles.input}
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={submitting}
                />
              </Field>

              <label htmlFor="treble-consent" className={styles.check}>
                <input
                  id="treble-consent"
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                  disabled={submitting}
                />
                <span>{TREBLE_REGISTER.consent}</span>
              </label>

              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="treble-website">Website</label>
                <input
                  id="treble-website"
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

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? TREBLE_REGISTER.submitting : TREBLE_REGISTER.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
