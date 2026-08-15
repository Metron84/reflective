"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaJoinForm({ signInHref, mode = "password", code: initialCode = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [secret, setSecret] = useState(initialCode);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "code"
          ? { code: secret.trim().toUpperCase() }
          : { password: secret.trim() };

      const res = await fetch("/api/ultima/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "That invite did not work. Check with the commissioner.");
        return;
      }
      router.push("/ultima/profile");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="ultima-join-secret">
          {mode === "code" ? "Invite code" : "Invite password"}
        </label>
        <input
          id="ultima-join-secret"
          name="secret"
          type={mode === "password" ? "password" : "text"}
          autoComplete="off"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={mode === "code" ? "8-character code" : "Enter invite password"}
          required
        />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true" />
      <button type="submit" className={styles.primaryBtn} disabled={busy || !secret.trim()}>
        {busy ? "Joining…" : "Join Ultima"}
      </button>
      {error ? <p className={`${styles.message} ${styles.messageError}`}>{error}</p> : null}
      <p className={styles.hubNote}>
        Not signed in?{" "}
        <a href={signInHref} className={styles.quietLink}>
          Sign in first
        </a>
        {" · "}
        <Link href="/ultima/rules" className={styles.quietLink}>
          Read the rules
        </Link>
      </p>
    </form>
  );
}
