"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ULTIMA_COLOUR_PALETTE } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

export default function UltimaProfileForm({
  defaultManagerName = "",
  defaultTeamName = "",
  defaultColour = "navy",
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState(defaultTeamName);
  const [managerName, setManagerName] = useState(defaultManagerName);
  const [colour, setColour] = useState(defaultColour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ultima/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: teamName, manager_name: managerName, colour }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not save your profile.");
        return;
      }
      router.push("/ultima");
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
        <label htmlFor="ultima-team">Team name</label>
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
      <div className={styles.field}>
        <label htmlFor="ultima-manager">Manager name</label>
        <input
          id="ultima-manager"
          name="manager_name"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          maxLength={48}
          required
        />
      </div>
      <fieldset className={styles.field}>
        <legend>Colour chip</legend>
        <div className={styles.colourGrid}>
          {ULTIMA_COLOUR_PALETTE.map((chip) => (
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
      <button type="submit" className={styles.primaryBtn} disabled={busy}>
        {busy ? "Saving…" : "Save and continue"}
      </button>
      {error ? <p className={`${styles.message} ${styles.messageError}`}>{error}</p> : null}
    </form>
  );
}
