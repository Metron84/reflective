"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { isGoogleAuthEnabled } from "@/lib/auth/config";

function GoogleLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignInForm({ nextPath = "/" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const googleEnabled = isGoogleAuthEnabled();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("[TRF auth] Sign-in env missing at mount:", {
        missingUrl: !url,
        missingAnonKey: !key,
      });
    }
  }, []);

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
      if (!supabase) {
        setError("Sign-in is not configured yet.");
        return;
      }
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
        <div className="mt-8">
          {googleEnabled ? (
            <>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-full bg-navy px-5 py-3.5 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <GoogleLogo className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-center pr-5">
                  Continue with Google
                </span>
              </button>

              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-navy/10" aria-hidden />
                <span className="text-xs uppercase tracking-widest text-navy/45">
                  or
                </span>
                <span className="h-px flex-1 bg-navy/10" aria-hidden />
              </div>
            </>
          ) : null}

          <form
            className={googleEnabled ? "mt-6 space-y-3" : "space-y-3"}
            onSubmit={sendMagicLink}
          >
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
                className="w-full border border-navy/20 bg-transparent px-4 py-2.5 text-sm text-navy outline-none transition-colors placeholder:text-navy/40 focus:border-navy/40"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full border border-navy/25 bg-transparent px-5 py-2.5 font-body text-sm text-navy/80 transition-colors hover:border-navy/45 hover:text-navy disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-signal">{error}</p> : null}
      <p className="mt-6 text-xs text-navy/50">
        No passwords. Magic link or Google only.
      </p>
    </div>
  );
}
