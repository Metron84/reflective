"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaPracticeLobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rooms, setRooms] = useState([]);
  const [confirm, setConfirm] = useState(null);

  async function loadRooms() {
    try {
      const res = await fetch("/api/ultima/practice");
      const data = await res.json();
      if (res.ok) setRooms(data.rooms ?? []);
    } catch {
      /* keep last */
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
        return null;
      }
      if (data.code && (action === "create_solo" || action === "create_room" || action === "join")) {
        router.push(`/ultima/practice/${data.code}`);
        return data;
      }
      await loadRooms();
      return data;
    } catch {
      setError("Connection lost. Try again.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function deleteRoom(code) {
    const previous = rooms;
    setRooms((list) => list.filter((room) => room.code !== code));
    setConfirm(null);
    setBusy(`delete:${code}`);
    setError("");
    try {
      const res = await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRooms(previous);
        setToast(data.message ?? "Could not delete that room.");
        return;
      }
      setToast(`Deleted ${code}.`);
    } catch {
      setRooms(previous);
      setToast("Connection lost. Room restored.");
    } finally {
      setBusy("");
    }
  }

  async function deleteAllSaved() {
    const previous = rooms;
    const removing = new Set(
      previous.filter((room) => room.is_host && room.keep).map((room) => room.code),
    );
    setRooms((list) => list.filter((room) => !removing.has(room.code)));
    setConfirm(null);
    setBusy("delete_all");
    setError("");
    try {
      const res = await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_all" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRooms(previous);
        setToast(data.message ?? "Could not delete rooms.");
        return;
      }
      await loadRooms();
      setToast(
        data.count ? `Deleted ${data.count} room${data.count === 1 ? "" : "s"}.` : "No saved rooms to delete.",
      );
    } catch {
      setRooms(previous);
      setToast("Connection lost. Rooms restored.");
    } finally {
      setBusy("");
    }
  }

  const savedHostedCount = rooms.filter((room) => room.is_host && room.keep).length;

  return (
    <div className={styles.adminPage}>
      <p className={styles.lede}>
        Practice picks do not count. Thirty-second clock. Bots fill empty seats. Save a board to keep it.
      </p>

      {rooms.length > 0 ? (
        <section className={styles.adminSection}>
          <h2 className={styles.sectionTitle}>Your rooms</h2>
          <ul className={styles.roomList}>
            {rooms.map((room) => (
              <li key={room.code} className={styles.roomRow}>
                <div>
                  <p className={styles.roomCode}>{room.code}</p>
                  <p className={styles.hubNote}>
                    {room.solo ? "Solo" : "Room"}
                    {" · "}
                    {room.state}
                    {room.state === "live" || room.state === "complete"
                      ? ` · pick ${room.current_pick}`
                      : ""}
                    {room.keep ? " · saved" : ""}
                  </p>
                </div>
                <div className={styles.roomActions}>
                  <Link href={`/ultima/practice/${room.code}`} className={styles.primaryBtn}>
                    Resume
                  </Link>
                  {room.is_host ? (
                    <>
                      <button
                        type="button"
                        className={styles.queueBtnDark}
                        disabled={Boolean(busy)}
                        onClick={() => act(room.keep ? "forget" : "save", { code: room.code })}
                      >
                        {room.keep ? "Forget" : "Save"}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteTextBtn}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          setConfirm({ type: "one", code: room.code })
                        }
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {savedHostedCount > 0 ? (
            <button
              type="button"
              className={styles.deleteAllLink}
              disabled={Boolean(busy)}
              onClick={() => setConfirm({ type: "all" })}
            >
              Delete all saved rooms
            </button>
          ) : null}
        </section>
      ) : null}

      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>Start alone</h2>
        <p className={styles.hubNote}>You plus nine bots.</p>
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
      {toast ? <p className={styles.practiceToast}>{toast}</p> : null}

      {confirm ? (
        <div className={styles.confirmSheet} role="dialog" aria-modal="true">
          <div className={styles.confirmBackdrop} onClick={() => setConfirm(null)} aria-hidden />
          <div className={styles.confirmPanel}>
            <p className={styles.confirmCopy}>
              {confirm.type === "all"
                ? "Delete all saved practice rooms? This cannot be undone."
                : `Delete room ${confirm.code}? This cannot be undone.`}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.queueBtnDark}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteConfirmBtn}
                onClick={() =>
                  confirm.type === "all" ? deleteAllSaved() : deleteRoom(confirm.code)
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
