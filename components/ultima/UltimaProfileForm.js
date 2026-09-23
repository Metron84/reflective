"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ULTIMA_KIT_COLOURS,
  ULTIMA_NOTIFY_PREFS,
  normalizeNotifyPrefs,
  ultimaColourHex,
} from "@/lib/ultima/constants";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

export default function UltimaProfileForm({
  defaultManagerName = "",
  defaultTeamName = "",
  defaultColour = "navy",
  defaultNotifyPrefs = null,
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState(defaultTeamName);
  const [managerName, setManagerName] = useState(defaultManagerName);
  const [colour, setColour] = useState(defaultColour);
  const [prefs, setPrefs] = useState(() => normalizeNotifyPrefs(defaultNotifyPrefs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const root = document.querySelector(`.${styles.office}`);
    if (root) root.style.setProperty("--team", ultimaColourHex(colour));
  }, [colour]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ultima/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: teamName,
          manager_name: managerName,
          colour,
          notify_prefs: prefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not save your profile.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.utPage} onSubmit={onSubmit}>
      <UltimaPanel title="Club">
        <div className={styles.utPad}>
          <div className={styles.field}>
            <label htmlFor="ultima-team">Club name</label>
            <input
              id="ultima-team"
              name="team_name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              minLength={3}
              maxLength={24}
              required
              autoComplete="off"
            />
          </div>
          <fieldset className={styles.field}>
            <legend>Team colour</legend>
            <div className={styles.colourGrid}>
              {ULTIMA_KIT_COLOURS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`${styles.colourChip} ${colour === chip.id ? styles.colourChipSelected : ""}`}
                  style={{ background: chip.hex }}
                  aria-label={chip.label}
                  aria-pressed={colour === chip.id}
                  onClick={() => setColour(chip.id)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </UltimaPanel>

      <UltimaPanel title="Manager">
        <div className={styles.utPad}>
          <div className={styles.field}>
            <label htmlFor="ultima-manager">Display name</label>
            <input
              id="ultima-manager"
              name="manager_name"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              maxLength={48}
              required
            />
          </div>
        </div>
      </UltimaPanel>

      <UltimaPanel title="Notifications">
        {ULTIMA_NOTIFY_PREFS.map((item) => (
          <UltimaRow
            key={item.id}
            primary={item.label}
            meta={prefs[item.id] ? "On" : "Off"}
            onClick={() =>
              setPrefs((current) => ({ ...current, [item.id]: !current[item.id] }))
            }
          />
        ))}
      </UltimaPanel>

      <div className={styles.utActions}>
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {saved ? <p className={styles.utNote}>Saved.</p> : null}
      {error ? (
        <UltimaStaffMessage subject="The profile did not save" body={error} />
      ) : null}
    </form>
  );
}
