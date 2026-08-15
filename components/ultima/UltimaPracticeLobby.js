"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaPracticeLobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "That did not work.");
        return;
      }
      if (data.code) {
        router.push(`/ultima/practice/${data.code}`);
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.adminPage}>
      <p className={styles.lede}>
        Practice picks do not count. Thirty-second clock. Bots fill empty seats.
      </p>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Start alone</h2>
        <p className={styles.hubNote}>You plus nine bots. Reset anytime.</p>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={Boolean(busy)}
          onClick={() => act("create_solo")}
        >
          {busy === "create_solo" ? "Starting…" : "Start solo practice"}
        </button>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Open a room</h2>
        <p className={styles.hubNote}>
          Share the four-letter code with other invitees. You start the draft when ready.
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={Boolean(busy)}
          onClick={() => act("create_room")}
        >
          {busy === "create_room" ? "Opening…" : "Open a room"}
        </button>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Join a room</h2>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (joinCode.trim().length === 4) {
              act("join", { code: joinCode.trim() });
            }
          }}
        >
          <div className={styles.field}>
            <label htmlFor="practice-code">Room code</label>
            <input
              id="practice-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              autoComplete="off"
              placeholder="ABCD"
            />
          </div>
          <button
            type="submit"
            className={styles.secondaryBtn}
            disabled={Boolean(busy) || joinCode.trim().length !== 4}
          >
            {busy === "join" ? "Joining…" : "Join room"}
          </button>
        </form>
      </section>

      {error ? <p className={styles.messageError}>{error}</p> : null}

      <Link href="/ultima" className={styles.quietLink}>
        Back to hub
      </Link>
    </div>
  );
}
