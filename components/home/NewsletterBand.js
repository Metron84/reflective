"use client";

import Link from "next/link";
import { useState } from "react";

const MESSAGES = {
  success:
    "You are on the list. We will be in touch when something new drops.",
  "invalid-email": "Enter a valid email address.",
  "consent-required": "Please confirm you are happy to hear from us.",
  "already-subscribed": "That email is already on the list.",
  "rate-limited": "Too many tries. Wait a minute and try again.",
  unavailable: "Sign-ups are unavailable right now. Try again soon.",
  "server-error": "Something went wrong. Try again in a moment.",
  "invalid-request": "Something went wrong. Try again in a moment.",
};

export default function NewsletterBand() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent,
          website: "",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.ok) {
        setStatus("success");
        setMessage(MESSAGES.success);
        setEmail("");
        setConsent(false);
        return;
      }

      setStatus("error");
      setMessage(MESSAGES[data.reason] ?? MESSAGES["server-error"]);
    } catch {
      setStatus("error");
      setMessage(MESSAGES["server-error"]);
    }
  }

  return (
    <section
      aria-label="Newsletter sign-up"
      className="border-b border-navy/10 bg-paper px-6 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-2xl text-navy sm:text-3xl">
          First to new films, games, and results.
        </h2>

        {status === "success" ? (
          <p
            className="mt-6 text-sm text-navy/80 sm:text-base"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 text-left">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email"
                className="min-w-0 flex-1 border border-navy/20 bg-paper px-4 py-3 text-sm text-navy placeholder:text-navy/40 focus:border-navy/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-full bg-signal px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {status === "loading" ? "Subscribing…" : "Subscribe"}
              </button>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 text-left">
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
              />
              <span className="text-xs leading-relaxed text-navy/55">
                I agree to receive updates from The Reflective Football.{" "}
                <Link href="/privacy" className="text-navy/70 underline-offset-2 hover:text-navy hover:underline">
                  Privacy
                </Link>
                .
              </span>
            </label>

            {status === "error" && message ? (
              <p
                className="mt-4 text-sm text-signal"
                role="alert"
                aria-live="polite"
              >
                {message}
              </p>
            ) : null}

            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
          </form>
        )}
      </div>
    </section>
  );
}
