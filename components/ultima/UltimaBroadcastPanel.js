"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
} from "@/lib/ultima/notifications/limits";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

/** Commissioner broadcast: write it, preview it, confirm, send. */
export default function UltimaBroadcastPanel({ managerCount = 0 }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pinned, setPinned] = useState(false);
  const [step, setStep] = useState("write"); // write | preview | confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const ready = title.trim().length > 0 && message.trim().length > 0;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, pinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "The broadcast did not send.");
        return;
      }
      setDone(`Sent to ${data.managers} managers.`);
      setTitle("");
      setMessage("");
      setPinned(false);
      setStep("write");
      router.refresh();
    } catch {
      setError("The broadcast did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <UltimaPanel title="Broadcast">
      <div className={styles.utPad}>
        {step === "write" ? (
          <>
            <label className={styles.field}>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={BROADCAST_TITLE_MAX}
              />
              <span className={styles.counter}>
                {title.length}/{BROADCAST_TITLE_MAX}
              </span>
            </label>
            <label className={styles.field}>
              Message
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={BROADCAST_BODY_MAX}
              />
              <span className={styles.counter}>
                {message.length}/{BROADCAST_BODY_MAX}
              </span>
            </label>
            <label className={styles.field}>
              <span>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />{" "}
                Pin to Hub
              </span>
            </label>
            <div className={styles.pushActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!ready}
                onClick={() => setStep("preview")}
              >
                Preview
              </button>
            </div>
          </>
        ) : null}

        {step !== "write" ? (
          <>
            <div className={styles.previewCard}>
              <UltimaStaffMessage subject={title.trim()} body={message.trim()} />
            </div>
            <p className={styles.counter}>
              Push, inbox and email{pinned ? ", plus a pinned Hub card" : ""}.
            </p>
          </>
        ) : null}

        {step === "preview" ? (
          <div className={styles.pushActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep("write")}>
              Edit
            </button>
            <button type="button" className={styles.primaryBtn} onClick={() => setStep("confirm")}>
              Send
            </button>
          </div>
        ) : null}

        {step === "confirm" ? (
          <>
            <p className={styles.pushLine}>Send to all {managerCount} managers?</p>
            <div className={styles.pushActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStep("preview")}
                disabled={busy}
              >
                Back
              </button>
              <button type="button" className={styles.primaryBtn} onClick={send} disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        ) : null}

        {done ? <p className={styles.counter}>{done}</p> : null}
        {error ? <UltimaStaffMessage subject="The broadcast did not send" body={error} /> : null}
      </div>
    </UltimaPanel>
  );
}
