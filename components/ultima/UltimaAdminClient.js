"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaAdminClient({ seasonLabel }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  async function act(action, extra = {}) {
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Action failed.");
      else {
        setMessage(data.code ? `Invite: ${data.code}` : "Done.");
        if (data.code) setInviteCode(data.code);
      }
    } catch {
      setError("Connection lost.");
    }
  }

  return (
    <div className={styles.adminPage}>
      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Draft control</h2>
        <div className={styles.adminActions}>
          <button type="button" className={styles.primaryBtn} onClick={() => act("start_draft")}>
            Start draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("pause_draft")}>
            Pause draft
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("resume_draft")}>
            Resume draft
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              const when = prompt("Draft start time (ISO, e.g. 2026-08-20T18:00:00+04:00):");
              if (when) act("schedule_draft", { scheduled_at: when });
            }}
          >
            Schedule draft
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Invites</h2>
        <button type="button" className={styles.secondaryBtn} onClick={() => act("issue_invite")}>
          Issue invite code
        </button>
        {inviteCode ? <p className={styles.messageOk}>Code: {inviteCode}</p> : null}
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Bootstrap and sync</h2>
        <div className={styles.adminActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("bootstrap")}>
            Sync players and sample GW12
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => act("sync_gameweek")}>
            Sync active gameweek
          </button>
        </div>
      </section>

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Cancel draft</h2>
        <button
          type="button"
          className={styles.destructiveBtn}
          onClick={() => {
            const reason = prompt("Reason for cancellation:");
            const confirm = prompt(`Type season label to confirm: ${seasonLabel}`);
            if (reason && confirm) act("cancel_draft", { reason, confirm });
          }}
        >
          Cancel draft
        </button>
      </section>

      {message ? <p className={styles.messageOk}>{message}</p> : null}
      {error ? <p className={styles.messageError}>{error}</p> : null}

      <Link href="/ultima" className={styles.quietLink}>
        Back to hub
      </Link>
    </div>
  );
}
