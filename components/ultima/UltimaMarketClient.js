"use client";

import { useState } from "react";
import Link from "next/link";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_LABELS } from "@/lib/ultima/constants";
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
      <p className={styles.lede}>Free agent. Add him and someone has to go.</p>

      <div className={styles.leagueTabs}>
        {LEAGUE_FILTERS.map((l) => (
          <button
            key={l}
            type="button"
            className={league === l ? styles.leagueTabActiveCream : styles.leagueTabCream}
            onClick={() => setLeague(l)}
          >
            {l === "all" ? "All" : ULTIMA_LEAGUE_LABELS[l]}
          </button>
        ))}
      </div>

      <ul className={styles.playerListCream}>
        {filtered.map((p) => (
          <li key={p.id} className={styles.playerRowCream}>
            <div>
              <strong>{p.name}</strong>
              <span className={styles.playerMeta}>{p.club}</span>
              {p.bolt_eligible ? <span className={styles.boltTag}>Bolt</span> : null}
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={() => setSelected(p)}>
              Add
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className={styles.emptyState}>No free agents in this league right now.</p>
      ) : null}

      {selected ? (
        <div className={styles.sheetBackdrop}>
          <div className={styles.sheet}>
            <p className={styles.sheetTitle}>Add {selected.name}</p>
            <p>Drop someone from your squad:</p>
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

      <Link href="/ultima" className={styles.quietLink}>
        Back to hub
      </Link>
    </div>
  );
}
