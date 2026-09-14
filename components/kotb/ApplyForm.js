"use client";

import { useState } from "react";
import styles from "./ApplyForm.module.css";

const MESSAGES = {
  "venue_name-required": "Add the venue name.",
  "venue_name-too-long": "That venue name is too long.",
  "area-required": "Add the area.",
  "area-too-long": "That area is too long.",
  "contact_name-required": "Add a contact name.",
  "contact_name-too-long": "That name is too long.",
  "contact_email-required": "Add a contact email.",
  "contact_email-invalid": "Check the email address.",
  "contact_mobile-required": "Add a mobile number.",
  "contact_mobile-too-long": "That mobile number is too long.",
  "burger_name-required": "Add the burger name.",
  "burger_name-too-long": "That burger name is too long.",
  "is_halal-required": "Say whether the burger is halal.",
  "shows_live_football-required": "Say whether you show live football.",
  "can_host_weekend_shoot-required": "Say whether you can host a weekend shoot.",
  "contact_ok-required": "Confirm we can contact you.",
  "filming_ok-required": "Confirm filming is allowed.",
  "rate-limited": "Too many tries just now. Wait an hour and try again.",
  unavailable: "Entries are paused right now. Try again soon.",
  "server-error": "Could not send. Try again in a moment.",
  "invalid-request": "Could not send. Try again in a moment.",
};

const EMPTY = {
  venue_name: "",
  area: "",
  outlet_count: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_mobile: "",
  instagram_handle: "",
  instagram_followers: "",
  burger_name: "",
  why_it_should_win: "",
  is_halal: "",
  shows_live_football: "",
  screen_count: "",
  matchday_footfall: "",
  can_host_weekend_shoot: "",
  availability_notes: "",
  what_winning_means: "",
};

export default function ApplyForm() {
  const [fields, setFields] = useState(EMPTY);
  const [contactOk, setContactOk] = useState(false);
  const [filmingOk, setFilmingOk] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  }

  function messageFor(reason) {
    return MESSAGES[reason] ?? MESSAGES["server-error"];
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!fields.venue_name.trim()) {
      setError(messageFor("venue_name-required"));
      return;
    }
    if (!fields.area.trim()) {
      setError(messageFor("area-required"));
      return;
    }
    if (!fields.contact_name.trim()) {
      setError(messageFor("contact_name-required"));
      return;
    }
    if (!fields.contact_email.trim()) {
      setError(messageFor("contact_email-required"));
      return;
    }
    if (!fields.contact_mobile.trim()) {
      setError(messageFor("contact_mobile-required"));
      return;
    }
    if (!fields.burger_name.trim()) {
      setError(messageFor("burger_name-required"));
      return;
    }
    if (fields.is_halal !== "yes" && fields.is_halal !== "no") {
      setError(messageFor("is_halal-required"));
      return;
    }
    if (
      fields.shows_live_football !== "yes" &&
      fields.shows_live_football !== "no"
    ) {
      setError(messageFor("shows_live_football-required"));
      return;
    }
    if (
      fields.can_host_weekend_shoot !== "yes" &&
      fields.can_host_weekend_shoot !== "no"
    ) {
      setError(messageFor("can_host_weekend_shoot-required"));
      return;
    }
    if (!contactOk) {
      setError(messageFor("contact_ok-required"));
      return;
    }
    if (!filmingOk) {
      setError(messageFor("filming_ok-required"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kotb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venue_name: fields.venue_name.trim(),
          area: fields.area.trim(),
          outlet_count: fields.outlet_count,
          contact_name: fields.contact_name.trim(),
          contact_role: fields.contact_role.trim(),
          contact_email: fields.contact_email.trim(),
          contact_mobile: fields.contact_mobile.trim(),
          instagram_handle: fields.instagram_handle.trim(),
          instagram_followers: fields.instagram_followers,
          burger_name: fields.burger_name.trim(),
          why_it_should_win: fields.why_it_should_win.trim(),
          is_halal: fields.is_halal === "yes",
          shows_live_football: fields.shows_live_football === "yes",
          screen_count: fields.screen_count,
          matchday_footfall: fields.matchday_footfall,
          can_host_weekend_shoot: fields.can_host_weekend_shoot === "yes",
          availability_notes: fields.availability_notes.trim(),
          what_winning_means: fields.what_winning_means.trim(),
          contact_ok: contactOk,
          filming_ok: filmingOk,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
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

  if (sent) {
    return (
      <div className={styles.confirm} role="status">
        <p className={styles.confirmTitle}>You are in.</p>
        <p className={styles.confirmBody}>
          We will write back. Reply with a logo TRF may use.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Field
        id="kotb-venue-name"
        label="Venue name"
        required
        value={fields.venue_name}
        onChange={(value) => setField("venue_name", value)}
        disabled={submitting}
        maxLength={160}
      />
      <Field
        id="kotb-area"
        label="Area"
        hint="Neighbourhood or city area"
        required
        value={fields.area}
        onChange={(value) => setField("area", value)}
        disabled={submitting}
        maxLength={120}
      />
      <Field
        id="kotb-outlets"
        label="Number of outlets"
        type="number"
        value={fields.outlet_count}
        onChange={(value) => setField("outlet_count", value)}
        disabled={submitting}
        min={1}
        max={999}
      />
      <Field
        id="kotb-contact-name"
        label="Contact name"
        required
        value={fields.contact_name}
        onChange={(value) => setField("contact_name", value)}
        disabled={submitting}
        autoComplete="name"
        maxLength={120}
      />
      <Field
        id="kotb-contact-role"
        label="Role"
        value={fields.contact_role}
        onChange={(value) => setField("contact_role", value)}
        disabled={submitting}
        maxLength={80}
      />
      <Field
        id="kotb-contact-email"
        label="Email"
        type="email"
        required
        value={fields.contact_email}
        onChange={(value) => setField("contact_email", value)}
        disabled={submitting}
        autoComplete="email"
        maxLength={160}
      />
      <Field
        id="kotb-contact-mobile"
        label="Mobile"
        type="tel"
        required
        value={fields.contact_mobile}
        onChange={(value) => setField("contact_mobile", value)}
        disabled={submitting}
        autoComplete="tel"
        maxLength={40}
      />
      <Field
        id="kotb-instagram"
        label="Instagram"
        hint="Handle only"
        value={fields.instagram_handle}
        onChange={(value) => setField("instagram_handle", value)}
        disabled={submitting}
        maxLength={80}
      />
      <Field
        id="kotb-followers"
        label="Instagram followers"
        type="number"
        value={fields.instagram_followers}
        onChange={(value) => setField("instagram_followers", value)}
        disabled={submitting}
        min={0}
      />
      <Field
        id="kotb-burger-name"
        label="Burger name"
        required
        value={fields.burger_name}
        onChange={(value) => setField("burger_name", value)}
        disabled={submitting}
        maxLength={160}
      />
      <Field
        id="kotb-why"
        label="Why it should win"
        textarea
        value={fields.why_it_should_win}
        onChange={(value) => setField("why_it_should_win", value)}
        disabled={submitting}
        maxLength={2000}
      />

      <YesNo
        name="is_halal"
        legend="Is it halal?"
        value={fields.is_halal}
        onChange={(value) => setField("is_halal", value)}
        disabled={submitting}
      />
      <YesNo
        name="shows_live_football"
        legend="Do you show live football?"
        value={fields.shows_live_football}
        onChange={(value) => setField("shows_live_football", value)}
        disabled={submitting}
      />
      <Field
        id="kotb-screens"
        label="Number of screens"
        type="number"
        value={fields.screen_count}
        onChange={(value) => setField("screen_count", value)}
        disabled={submitting}
        min={0}
        max={999}
      />
      <Field
        id="kotb-footfall"
        label="Matchday footfall"
        type="number"
        value={fields.matchday_footfall}
        onChange={(value) => setField("matchday_footfall", value)}
        disabled={submitting}
        min={0}
      />
      <YesNo
        name="can_host_weekend_shoot"
        legend="Can you host a weekend shoot?"
        value={fields.can_host_weekend_shoot}
        onChange={(value) => setField("can_host_weekend_shoot", value)}
        disabled={submitting}
      />
      <Field
        id="kotb-availability"
        label="Availability notes"
        textarea
        value={fields.availability_notes}
        onChange={(value) => setField("availability_notes", value)}
        disabled={submitting}
        maxLength={2000}
      />
      <Field
        id="kotb-winning"
        label="What winning would mean"
        textarea
        value={fields.what_winning_means}
        onChange={(value) => setField("what_winning_means", value)}
        disabled={submitting}
        maxLength={2000}
      />

      <label htmlFor="kotb-contact-ok" className={styles.check}>
        <input
          id="kotb-contact-ok"
          type="checkbox"
          name="contact_ok"
          checked={contactOk}
          onChange={(e) => {
            setContactOk(e.target.checked);
            if (error) setError("");
          }}
          disabled={submitting}
        />
        <span>You can contact me about King of the Burgers.</span>
      </label>

      <label htmlFor="kotb-filming-ok" className={styles.check}>
        <input
          id="kotb-filming-ok"
          type="checkbox"
          name="filming_ok"
          checked={filmingOk}
          onChange={(e) => {
            setFilmingOk(e.target.checked);
            if (error) setError("");
          }}
          disabled={submitting}
        />
        <span>I agree the venue can be filmed if selected.</span>
      </label>

      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="kotb-website">Website</label>
        <input
          id="kotb-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error ? (
        <p className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? "Sending" : "Enter your burger"}
      </button>

      <p className={styles.note}>Reply with a logo TRF may use.</p>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  required,
  type = "text",
  textarea,
  autoComplete,
  maxLength,
  min,
  max,
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.labelBlock}>
        <span className={styles.label}>
          {label}
          {required ? " *" : ""}
        </span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </label>
      {textarea ? (
        <textarea
          id={id}
          className={styles.input}
          name={id}
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
        />
      ) : (
        <input
          id={id}
          className={styles.input}
          type={type}
          name={id}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          min={min}
          max={max}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function YesNo({ name, legend, value, onChange, disabled }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend} *</legend>
      <div className={styles.options}>
        {[
          { id: `${name}-yes`, value: "yes", label: "Yes" },
          { id: `${name}-no`, value: "no", label: "No" },
        ].map((option) => (
          <label key={option.id} htmlFor={option.id} className={styles.option}>
            <input
              id={option.id}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              required
              disabled={disabled}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
