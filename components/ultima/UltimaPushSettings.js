"use client";

import { useCallback, useEffect, useState } from "react";
import UltimaPanel from "./UltimaPanel";
import styles from "./ultima.module.css";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function keyToBytes(base64) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Push for this device. Permission is only asked after the manager taps
 * "Turn on notifications", never on page load.
 */
export default function UltimaPushSettings({ publicKey = null }) {
  // loading | off-config | needs-install | unsupported | blocked | off | on
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const detect = useCallback(async () => {
    if (!publicKey) return setState("off-config");
    if (isIos() && !isStandalone()) return setState("needs-install");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setState("unsupported");
    }
    if (Notification.permission === "denied") return setState("blocked");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setState("off");
    }
  }, [publicKey]);

  useEffect(() => {
    const timer = setTimeout(detect, 0);
    return () => clearTimeout(timer);
  }, [detect]);

  async function turnOn() {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(publicKey),
        }));
      const res = await fetch("/api/ultima/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        setNote("Could not turn notifications on. Try again.");
        return;
      }
      setState("on");
    } catch {
      setNote("Could not turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNote("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/ultima/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setNote("Could not turn notifications off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/ultima/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? "Test sent." : (data.message ?? "The test did not send. Try again."));
    } catch {
      setNote("The test did not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  let body = null;
  if (state === "loading") {
    body = null;
  } else if (state === "off-config") {
    body = <p className={styles.pushLine}>Notifications are not set up yet.</p>;
  } else if (state === "needs-install") {
    body = <p className={styles.pushLine}>Add Ultima to your Home Screen to get notifications</p>;
  } else if (state === "unsupported") {
    body = <p className={styles.pushLine}>This browser cannot get notifications.</p>;
  } else if (state === "blocked") {
    body = (
      <p className={styles.pushLine}>
        Notifications are blocked. Allow them in your browser settings, then come back.
      </p>
    );
  } else if (state === "off") {
    body = (
      <div className={styles.pushActions}>
        <button type="button" className={styles.primaryBtn} onClick={turnOn} disabled={busy}>
          Turn on notifications
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <p className={styles.pushLine}>Notifications are on for this device.</p>
        <div className={styles.pushActions}>
          <button type="button" className={styles.secondaryBtn} onClick={sendTest} disabled={busy}>
            Send test notification
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={turnOff} disabled={busy}>
            Turn off
          </button>
        </div>
      </>
    );
  }

  return (
    <UltimaPanel title="Push">
      <div className={styles.utPad}>
        <div className={styles.pushBox}>
          {body}
          {note ? <p className={styles.counter}>{note}</p> : null}
          <p className={styles.counter}>Quiet hours 01:00 to 08:00 GST. Pushes wait, the inbox still updates.</p>
        </div>
      </div>
    </UltimaPanel>
  );
}
