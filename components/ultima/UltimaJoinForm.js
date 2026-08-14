"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ultima.module.css";

export default function UltimaJoinForm({ code, signInHref }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ultima/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "That code did not work. Ask the commissioner.");
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
      <p className={styles.lede}>
        Invite code <strong>{code}</strong>
      </p>
      <button type="submit" className={styles.primaryBtn} disabled={busy}>
        {busy ? "Joining…" : "Join the league"}
      </button>
      {error ? <p className={`${styles.message} ${styles.messageError}`}>{error}</p> : null}
      <p className={styles.hubNote}>
        Not signed in?{" "}
        <a href={signInHref} className={styles.quietLink}>
          Sign in first
        </a>
      </p>
    </form>
  );
}
