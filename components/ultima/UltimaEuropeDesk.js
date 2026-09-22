"use client";

import { useMemo, useState } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

const LEAGUE_FILTERS = ["all", ...ULTIMA_LEAGUES];

function formatKickoff(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}

function scoreText(row) {
  if (row.homeScore == null || row.awayScore == null) return null;
  return `${row.homeScore}-${row.awayScore}`;
}

function badge(status) {
  if (status === "LIVE" || status === "HT") return status;
  if (status === "FT") return "FT";
  return null;
}

function GameweekStrip({ desk }) {
  if (desk.emptyReason === "sync") {
    return (
      <section className={styles.deskBlock} aria-label="This Gameweek">
        <h3 className={styles.deskTitle}>This Gameweek</h3>
        <p className={styles.hubNote}>The Europe board did not sync. Try again after the next cron.</p>
      </section>
    );
  }

  if (desk.emptyReason === "break" || !desk.fixtures?.length) {
    return (
      <section className={styles.deskBlock} aria-label="This Gameweek">
        <h3 className={styles.deskTitle}>
          This Gameweek{desk.gameweek ? ` ${desk.gameweek}` : ""}
        </h3>
        <p className={styles.hubNote}>No gameweek this week. The leagues are on a break.</p>
      </section>
    );
  }

  return (
    <section className={styles.deskBlock} aria-label="This Gameweek">
      <h3 className={styles.deskTitle}>
        This Gameweek{desk.gameweek ? ` ${desk.gameweek}` : ""}
      </h3>
      <ul className={styles.gwList}>
        {desk.fixtures.map((row) => {
          const score = scoreText(row);
          const mark = badge(row.status);
          return (
            <li key={row.id} className={styles.gwRow}>
              <span className={styles.gwLeague}>{row.leagueCode}</span>
              <span className={styles.gwMatch}>
                <span className={`${styles.diffDot} ${styles[`diff_${row.homeDifficulty}`]}`} />
                {row.home || row.away ? `${row.home ?? ""} vs ${row.away ?? ""}` : "Fixture"}
                {score ? ` ${score}` : ""}
                <span className={`${styles.diffDot} ${styles[`diff_${row.awayDifficulty}`]}`} />
              </span>
              <span className={styles.gwMeta}>
                {mark ? <span className={mark === "FT" ? styles.badgeFt : styles.badgeLive}>{mark}</span> : null}
                {formatKickoff(row.kickoff)}
                {row.ownedCount ? ` · ${row.ownedCount} owned` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FormGuide({ form }) {
  const [tab, setTab] = useState("teams");
  const [league, setLeague] = useState("all");
  const [openId, setOpenId] = useState("");

  const teams = useMemo(() => {
    const pool = form?.teams?.all ?? [];
    const filtered = league === "all" ? pool : pool.filter((row) => row.league === league);
    const hot = [...filtered].sort((a, b) => b.heat - a.heat).slice(0, 5);
    const cold = [...filtered].sort((a, b) => a.heat - b.heat).slice(0, 5);
    return { hot, cold };
  }, [form, league]);

  const players = useMemo(() => {
    const pool = form?.players ?? [];
    return league === "all" ? pool : pool.filter((row) => row.league === league);
  }, [form, league]);

  if (!form?.teams?.all?.length && !form?.players?.length) return null;

  return (
    <section className={styles.deskBlock} aria-label="Form Guide">
      <h3 className={styles.deskTitle}>Form Guide</h3>
      <div className={styles.deskTabs}>
        <button type="button" className={tab === "teams" ? styles.deskTabOn : styles.deskTab} onClick={() => setTab("teams")}>
          Teams
        </button>
        <button type="button" className={tab === "players" ? styles.deskTabOn : styles.deskTab} onClick={() => setTab("players")}>
          Players
        </button>
      </div>
      <div className={styles.deskTabs}>
        {LEAGUE_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            className={league === id ? styles.deskTabOn : styles.deskTab}
            onClick={() => setLeague(id)}
          >
            {id === "all" ? "All" : ULTIMA_LEAGUE_SHORT[id]}
          </button>
        ))}
      </div>
      {tab === "teams" ? (
        <div className={styles.formSplit}>
          <div>
            <p className={styles.deskKicker}>Hot</p>
            <ul className={styles.formList}>
              {teams.hot.map((row) => (
                <li key={`hot-${row.clubId}`}>
                  <button type="button" className={styles.formBtn} onClick={() => setOpenId(openId === row.clubId ? "" : row.clubId)}>
                    <strong>{row.club}</strong>
                    <span className={styles.pills}>
                      {row.last5.map((r, i) => (
                        <span key={`${row.clubId}-${i}`} className={styles[`pill_${r}`]}>{r}</span>
                      ))}
                    </span>
                    <span className={styles.formMeta}>
                      {row.goals.for}f {row.goals.against}a
                    </span>
                  </button>
                  {openId === row.clubId ? (
                    <p className={styles.formSplitLine}>
                      Home {row.split.home.join(" ") || "-"} · Away {row.split.away.join(" ") || "-"}
                      {row.rates ? ` · O2.5 ${row.rates.over25}% · BTTS ${row.rates.btts}% · CS ${row.rates.cleanSheet}%` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={styles.deskKicker}>Cold</p>
            <ul className={styles.formList}>
              {teams.cold.map((row) => (
                <li key={`cold-${row.clubId}`}>
                  <strong>{row.club}</strong>
                  <span className={styles.pills}>
                    {row.last5.map((r, i) => (
                      <span key={`${row.clubId}-c-${i}`} className={styles[`pill_${r}`]}>{r}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className={styles.formList}>
          {players.map((row) => (
            <li key={row.playerId}>
              <strong>{row.name}</strong>
              <span className={styles.formMeta}>
                {row.club}
                {row.last3.rating != null && row.seasonRating != null ? (
                  <>
                    {" · "}
                    {row.ratingDelta >= 0 ? "↑" : "↓"} {Math.abs(row.ratingDelta).toFixed(2)}
                  </>
                ) : null}
                {` · 3: ${row.last3.goals}g ${row.last3.assists}a`}
                {` · 5: ${row.last5.goals}g ${row.last5.assists}a`}
                {row.minutesFlag ? " · mins < 60" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Movers({ movers }) {
  const lists = [
    ["Rising", movers?.rising],
    ["Falling", movers?.falling],
    ["Man of the Round", movers?.manOfRound],
    ["Upsets", movers?.upsets],
  ];
  if (!lists.some(([, rows]) => rows?.length)) return null;

  return (
    <section className={styles.deskBlock} aria-label="Movers">
      <h3 className={styles.deskTitle}>Movers</h3>
      {lists.map(([label, rows]) =>
        rows?.length ? (
          <div key={label}>
            <p className={styles.deskKicker}>{label}</p>
            <ul className={styles.formList}>
              {rows.map((row) => (
                <li key={row.playerId ?? row.id ?? row.line}>
                  <strong>{row.name ?? row.line}</strong>
                  <span className={styles.formMeta}>
                    {[row.club, row.leagueCode, row.stat, row.owner].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}

function Trending({ trending }) {
  const lists = [
    ["Most added", trending?.added, (row) => `${row.count}`],
    ["Most dropped", trending?.dropped, (row) => `${row.count}`],
    ["Most started", trending?.started, (row) => `${row.share}%`],
    ["Differentials", trending?.differentials, (row) => `${row.owned} squads`],
    ["Top Ultima scorers", trending?.scorers, (row) => `${row.points} · ${row.owner}`],
  ];
  const visible = lists.filter(([, rows]) => rows?.length);

  if (!visible.length) return null;

  return (
    <section className={styles.deskBlock} aria-label="Trending in Ultima">
      <h3 className={styles.deskTitle}>Trending in Ultima</h3>
      {visible.map(([label, rows, fmt]) => (
        <div key={label}>
          <p className={styles.deskKicker}>{label}</p>
          <ul className={styles.formList}>
            {rows.map((row) => (
              <li key={row.playerId}>
                <strong>{row.name}</strong>
                <span className={styles.formMeta}>
                  {[row.club, fmt(row)].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Tables({ standings }) {
  const [open, setOpen] = useState("");
  const hasRows = ULTIMA_LEAGUES.some((league) => (standings?.[league] ?? []).length);
  if (!hasRows) return null;

  return (
    <section className={styles.deskBlock} aria-label="Tables">
      <h3 className={styles.deskTitle}>Tables</h3>
      {ULTIMA_LEAGUES.map((league) => {
        const rows = standings?.[league] ?? [];
        if (!rows.length) return null;
        const last = rows.length;
        const preview = [...rows.slice(0, 4), ...rows.slice(Math.max(4, last - 3))];
        const shown = open === league ? rows : preview;
        return (
          <div key={league} className={styles.tableLeague}>
            <button type="button" className={styles.tableHead} onClick={() => setOpen(open === league ? "" : league)}>
              {ULTIMA_LEAGUE_SHORT[league]}
            </button>
            <ol className={styles.tableList}>
              {shown.map((row) => {
                const move =
                  row.previous_position != null ? row.previous_position - row.position : 0;
                return (
                  <li key={`${league}-${row.club_id}`}>
                    <span className={styles.tablePos}>{row.position}</span>
                    <span>{row.club_name}</span>
                    <span className={styles.tablePts}>{row.points}</span>
                    {move > 0 ? <span className={styles.moveUp}>↑</span> : null}
                    {move < 0 ? <span className={styles.moveDown}>↓</span> : null}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

export default function UltimaEuropeDesk({ desk }) {
  if (!desk) return null;

  return (
    <div className={styles.europeDesk}>
      <p className={styles.deskLabel}>Europe</p>
      <GameweekStrip desk={desk} />
      <FormGuide form={desk.form} />
      <Movers movers={desk.movers} />
      <Trending trending={desk.trending} />
      <Tables standings={desk.standings} />
    </div>
  );
}
