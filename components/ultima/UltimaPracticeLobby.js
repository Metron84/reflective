"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function statusChip(state) {
  if (state === "live" || state === "paused") return "Drafting";
  if (state === "complete" || state === "cancelled") return "Complete";
  return "Lobby";
}

function enterLabel(state) {
  return state === "live" || state === "paused" ? "Resume" : "Enter";
}

export default function UltimaPracticeLobby({ rooms: initialRooms = [] }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [rooms, setRooms] = useState(initialRooms);
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

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setJoinError("");
    try {
      const res = await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (action === "join" && (data.code === "INVITE_INVALID" || !data.code)) {
          setJoinError("That code doesn't match a room.");
        } else {
          setError(data.message ?? "That did not work.");
        }
        return null;
      }
      if (data.code && action === "join") {
        router.push(`/ultima/practice/${data.code}`);
        return data;
      }
      await loadRooms();
      return data;
    } catch {
      if (action === "join") setJoinError("That code doesn't match a room.");
      else setError("Connection lost.");
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
        setError(data.message ?? "Could not delete that room.");
      }
    } catch {
      setRooms(previous);
      setError("Connection lost.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.prPage}>
      <p className={styles.prNote}>Practice rooms don&apos;t count toward the season.</p>

      <div className={styles.prDesk}>
        <UltimaPanel raised title="Actions">
          <div className={styles.prActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={Boolean(busy)}
              onClick={() => act("create_solo")}
            >
              {busy === "create_solo" ? "Creating…" : "Create solo room"}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={Boolean(busy)}
              onClick={() => act("create_room")}
            >
              {busy === "create_room" ? "Creating…" : "Create shared room"}
            </button>
          </div>
          <form
            className={styles.prJoin}
            onSubmit={(event) => {
              event.preventDefault();
              if (joinCode.trim().length === 4) {
                act("join", { code: joinCode.trim() });
              }
            }}
          >
            <label className={styles.dPickSr} htmlFor="practice-code">
              Join by code
            </label>
            <input
              id="practice-code"
              className={styles.dPickSearch}
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError("");
              }}
              maxLength={4}
              autoComplete="off"
              placeholder="Join by code"
              aria-label="Join by code"
            />
            <button
              type="submit"
              className={styles.secondaryBtn}
              disabled={Boolean(busy) || joinCode.trim().length !== 4}
            >
              {busy === "join" ? "Joining…" : "Join"}
            </button>
          </form>
          {joinError ? <UltimaStaffMessage subject={joinError} /> : null}
        </UltimaPanel>

        <UltimaPanel raised title="Your rooms" action={<span>{rooms.length}</span>}>
          {rooms.length ? (
            rooms.map((room) => (
              <div key={room.code} className={styles.prRow}>
                <div className={styles.prRowCopy}>
                  <p className={styles.prCode}>{room.code}</p>
                  <p className={styles.prMeta}>
                    {room.solo ? "Solo" : "Shared"}
                    {" · "}
                    {room.seats_filled ?? 0}/{room.seats_cap ?? 10}
                    {" · "}
                    {room.last_activity ? (
                      <UltimaLocalTime value={room.last_activity} />
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
                <span className={styles.trChip}>{statusChip(room.state)}</span>
                <div className={styles.prRowActs}>
                  <Link href={`/ultima/practice/${room.code}`} className={styles.secondaryBtn}>
                    {enterLabel(room.state)}
                  </Link>
                  {room.is_host ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={Boolean(busy)}
                      onClick={() => setConfirm(room.code)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <UltimaStaffMessage
              subject="Run a mock draft before the real one."
              actionLabel="Create solo room"
              onAction={() => act("create_solo")}
            />
          )}
        </UltimaPanel>
      </div>

      {error ? (
        <UltimaStaffMessage
          subject={error}
          actionLabel="Retry"
          onAction={loadRooms}
        />
      ) : null}

      {confirm ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label="Delete room">
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Close"
            onClick={() => setConfirm(null)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Delete {confirm}?</p>
            <p className={styles.dSheetMeta}>This room leaves the list. Picks were never season picks.</p>
            <div className={styles.dSheetActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => deleteRoom(confirm)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
