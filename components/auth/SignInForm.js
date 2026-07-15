"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { isGoogleAuthEnabled } from "@/lib/auth/config";

export default function SignInForm({ nextPath = "/" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const googleEnabled = isGoogleAuthEnabled();

  async function sendMagicLink(event) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Sign-in is not configured yet.");
        return;
      }
      const origin = window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (authError) {
        setError("That email did not go through. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("That email did not go through. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const origin = window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (authError) setError("Google sign-in is unavailable right now.");
    } catch {
      setError("Google sign-in is unavailable right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md border border-navy/10 bg-paper p-8 shadow-[0_12px_40px_rgba(10,17,31,0.08)]">
      <h1 className="font-display text-3xl leading-tight text-navy sm:text-4xl">
        Sign in to The Reflective Football
      </h1>
      <p className="mt-3 text-sm text-navy/70">
        Free account. Live results, daily games, and your programme in one place.
      </p>

      {sent ? (
        <p className="mt-8 text-sm text-navy/80">
          Check your inbox. The link expires in an hour.
        </p>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={sendMagicLink}>
          <div>
            <label htmlFor="signin-email" className="sr-only">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-navy/20 bg-paper px-4 py-3 text-navy outline-none transition-colors placeholder:text-navy/40 focus:border-navy/50"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-signal px-6 py-3 text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send me a link"}
          </button>
        </form>
      )}

      {googleEnabled ? (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-navy/10" aria-hidden />
            <span className="text-xs uppercase tracking-widest text-navy/45">or</span>
            <span className="h-px flex-1 bg-navy/10" aria-hidden />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={pending}
            className="mt-4 w-full rounded-full border border-navy/25 px-6 py-3 text-sm text-navy/90 transition-colors hover:border-navy/50 hover:text-navy disabled:opacity-60"
          >
            Continue with Google
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-signal">{error}</p> : null}
      <p className="mt-6 text-xs text-navy/50">No passwords. Magic link or Google only.</p>
    </div>
  );
}
