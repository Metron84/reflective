"use client";

import { useState } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

const LEAGUE_FILTERS = ["all", ...ULTIMA_LEAGUES];

export default function UltimaMarketClient({ freeAgents, roster }) {
  const [league, setLeague] = useState("all");
  const [selected, setSelected] = useState(null);
  const [dropId, setDropId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered =
    league === "all" ? freeAgents : freeAgents.filter((p) => p.league === league);

  async function confirmAdd() {
    if (!selected || !dropId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/market/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_player_id: selected.id,
          drop_player_id: dropId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Move failed.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.marketPage}>
      <section className={styles.officePanel}>
        <p className={styles.hubNote}>Free agent. Add him and someone has to go.</p>
        <div className={styles.deskTabs}>
          {LEAGUE_FILTERS.map((l) => (
            <button
              key={l}
              type="button"
              className={league === l ? styles.deskTabOn : styles.deskTab}
              onClick={() => setLeague(l)}
            >
              {l === "all" ? "All" : ULTIMA_LEAGUE_SHORT[l]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.officePanel} aria-label="Free agents">
        <h2 className={styles.panelTitle}>Free agents</h2>
        {filtered.length === 0 ? (
          <p className={styles.hubNote}>No free agents in this league right now.</p>
        ) : (
          <ul className={styles.inboxList}>
            {filtered.map((p) => (
              <li key={p.id} className={styles.inboxItem}>
                <span className={styles.inboxStamp}>{ULTIMA_LEAGUE_SHORT[p.league] || "EUR"}</span>
                <span className={styles.inboxLine}>
                  {p.name}
                  {p.bolt_eligible ? " · Bolt" : ""}
                </span>
                <span className={styles.marketRowAction}>
                  <span className={styles.inboxMeta}>{p.club}</span>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setSelected(p)}>
                    Add
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <div className={styles.sheetBackdrop}>
          <div className={styles.sheet}>
            <p className={styles.sheetTitle}>Add {selected.name}</p>
            <p className={styles.hubNote}>Drop someone from your squad:</p>
            <select
              className={styles.fieldSelect}
              value={dropId}
              onChange={(e) => setDropId(e.target.value)}
            >
              <option value="">Choose…</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {error ? <p className={styles.messageError}>{error}</p> : null}
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!dropId || loading}
              onClick={confirmAdd}
            >
              Confirm add
            </button>
            <button type="button" className={styles.quietLink} onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
