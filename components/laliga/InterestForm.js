"use client";

import { useState } from "react";
import { LALIGA_CLUBS } from "@/lib/laliga/options";
import styles from "./InterestForm.module.css";

const FILM_URL = "https://www.youtube.com/watch?v=RyvKEf5OFdk";

const MESSAGES = {
  "first_name-required": "Add your first name.",
  "first_name-too-long": "That name is too long. Shorten it.",
  "whatsapp-required": "Add a WhatsApp number with the country code.",
  "whatsapp-too-long": "That WhatsApp number is too long.",
  "club-required": "Pick your club.",
  "club-invalid": "Pick a club from the list.",
  "frequency-required": "Choose how often you would come.",
  "group_size-required": "Choose your usual group size.",
  "best_day-required": "Choose the day that works best.",
  "miss_most-too-long": "That answer is too long. Shorten it.",
  "rate-limited": "Too many tries just now. Wait an hour and try again.",
  unavailable: "Sign-ups are paused right now. Try again soon.",
  "server-error": "Could not send. Try again in a moment.",
  "invalid-request": "Could not send. Try again in a moment.",
};

function FieldLabel({ htmlFor, spanish, english }) {
  return (
    <label htmlFor={htmlFor} className={styles.labelBlock}>
      <span className={styles.label}>{spanish}</span>
      <span className={styles.hint}>{english}</span>
    </label>
  );
}

const FREQUENCY_CHOICES = [
  { value: "Cada semana", label: "Cada semana (Every week)" },
  { value: "Cada dos semanas", label: "Cada dos semanas (Every two weeks)" },
  { value: "Una vez al mes", label: "Una vez al mes (Once a month)" },
];

const GROUP_SIZE_CHOICES = [
  { value: "1", label: "1" },
  { value: "2 a 4", label: "2 a 4 (2 to 4)" },
  { value: "5 a 8", label: "5 a 8 (5 to 8)" },
  { value: "Más de 8", label: "Más de 8 (More than 8)" },
];

const BEST_DAY_CHOICES = [
  { value: "Sábado", label: "Sábado (Saturday)" },
  { value: "Domingo", label: "Domingo (Sunday)" },
  { value: "Entre semana", label: "Entre semana (Weeknight)" },
];

function clubLabel(name) {
  return name === "Otro" ? "Otro (Other)" : name;
}

function RadioGroup({ legend, hint, name, value, options, onChange, disabled }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.labelBlock}>
        <span className={styles.label}>{legend}</span>
        <span className={styles.hint}>{hint}</span>
      </legend>
      <div className={styles.options}>
        {options.map((option, index) => {
          const id = `${name}-${index}`;
          return (
            <label key={option.value} htmlFor={id} className={styles.option}>
              <input
                id={id}
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
          );
        })}
      </div>
    </fieldset>
  );
}

export default function InterestForm() {
  const [firstName, setFirstName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [club, setClub] = useState("");
  const [frequency, setFrequency] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [bestDay, setBestDay] = useState("");
  const [missMost, setMissMost] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [filmingOk, setFilmingOk] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function messageFor(reason) {
    return MESSAGES[reason] ?? MESSAGES["server-error"];
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!firstName.trim()) {
      setError(messageFor("first_name-required"));
      return;
    }
    if (!whatsapp.trim()) {
      setError(messageFor("whatsapp-required"));
      return;
    }
    if (!club) {
      setError(messageFor("club-required"));
      return;
    }
    if (!frequency) {
      setError(messageFor("frequency-required"));
      return;
    }
    if (!groupSize) {
      setError(messageFor("group_size-required"));
      return;
    }
    if (!bestDay) {
      setError(messageFor("best_day-required"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/laliga", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          whatsapp: whatsapp.trim(),
          club,
          frequency,
          group_size: groupSize,
          best_day: bestDay,
          miss_most: missMost.trim(),
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
        <p className={styles.confirmTitle} lang="es">
          Nos vemos pronto.
        </p>
        <p className={styles.confirmBody} lang="es">
          Te escribimos con el primer partido.
        </p>
        <p className={styles.confirmLink}>
          <a href={FILM_URL} target="_blank" rel="noopener noreferrer">
            Watch They Invited Us Home on YouTube
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <FieldLabel
          htmlFor="laliga-first-name"
          spanish="Nombre"
          english="First name"
        />
        <input
          id="laliga-first-name"
          className={styles.input}
          type="text"
          name="first_name"
          autoComplete="given-name"
          required
          maxLength={100}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className={styles.field}>
        <FieldLabel
          htmlFor="laliga-whatsapp"
          spanish="WhatsApp con prefijo internacional"
          english="WhatsApp with country code"
        />
        <input
          id="laliga-whatsapp"
          className={styles.input}
          type="tel"
          name="whatsapp"
          autoComplete="tel"
          inputMode="tel"
          required
          maxLength={40}
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className={styles.field}>
        <FieldLabel
          htmlFor="laliga-club"
          spanish="¿A qué club apoyas?"
          english="Your club"
        />
        <select
          id="laliga-club"
          className={styles.select}
          name="club"
          required
          value={club}
          onChange={(e) => setClub(e.target.value)}
          disabled={submitting}
        >
          <option value="">Elige un club (Choose your club)</option>
          {LALIGA_CLUBS.map((name) => (
            <option key={name} value={name}>
              {clubLabel(name)}
            </option>
          ))}
        </select>
      </div>

      <RadioGroup
        legend="¿Con qué frecuencia vendrías?"
        hint="How often would you come"
        name="frequency"
        value={frequency}
        options={FREQUENCY_CHOICES}
        onChange={setFrequency}
        disabled={submitting}
      />

      <RadioGroup
        legend="¿Cuántos venís normalmente?"
        hint="Usual group size"
        name="group_size"
        value={groupSize}
        options={GROUP_SIZE_CHOICES}
        onChange={setGroupSize}
        disabled={submitting}
      />

      <RadioGroup
        legend="¿Qué día te viene mejor?"
        hint="Best day"
        name="best_day"
        value={bestDay}
        options={BEST_DAY_CHOICES}
        onChange={setBestDay}
        disabled={submitting}
      />

      <div className={styles.field}>
        <FieldLabel
          htmlFor="laliga-miss-most"
          spanish="¿Por qué quieres venir?"
          english="Why do you want to come?"
        />
        <textarea
          id="laliga-miss-most"
          className={styles.textarea}
          name="miss_most"
          rows={4}
          maxLength={2000}
          placeholder="Cuéntanos por qué quieres venir (Tell us why you want to come)"
          value={missMost}
          onChange={(e) => setMissMost(e.target.value)}
          disabled={submitting}
        />
      </div>

      <label htmlFor="laliga-contact-ok" className={styles.check}>
        <input
          id="laliga-contact-ok"
          type="checkbox"
          name="contact_ok"
          checked={contactOk}
          onChange={(e) => setContactOk(e.target.checked)}
          disabled={submitting}
        />
        <span className={styles.checkCopy}>
          <span>Podéis contactarme por WhatsApp sobre LaLiga Nights.</span>
          <span className={styles.checkEn}>
            You can contact me on WhatsApp about LaLiga Nights.
          </span>
        </span>
      </label>

      <label htmlFor="laliga-filming-ok" className={styles.check}>
        <input
          id="laliga-filming-ok"
          type="checkbox"
          name="filming_ok"
          checked={filmingOk}
          onChange={(e) => setFilmingOk(e.target.checked)}
          disabled={submitting}
        />
        <span className={styles.checkCopy}>
          <span>Acepto aparecer en cámara en los eventos.</span>
          <span className={styles.checkEn}>
            I agree to appear on camera at events.
          </span>
        </span>
      </label>

      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="laliga-website">Website</label>
        <input
          id="laliga-website"
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
        {submitting ? "Enviando…" : "Apúntame (Count me in)"}
      </button>
    </form>
  );
}
