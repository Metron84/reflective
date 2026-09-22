"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { isLiveStatus } from "@/lib/ultima/fixture-status";
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
  if (row?.homeScore == null || row?.awayScore == null) return null;
  return `${row.homeScore}-${row.awayScore}`;
}

function badge(status) {
  if (status === "LIVE" || status === "HT") return status;
  if (status === "FT") return "FT";
  return null;
}

function countdownTo(value) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function clubKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function fixturesForClub(fixtures, club) {
  const key = clubKey(club);
  if (!key) return [];
  return (fixtures ?? [])
    .filter((row) => clubKey(row.home) === key || clubKey(row.away) === key)
    .slice(0, 3)
    .map((row) => {
      const home = clubKey(row.home) === key;
      return {
        opponent: home ? row.away : row.home,
        venue: home ? "H" : "A",
        difficulty: home ? row.homeDifficulty : row.awayDifficulty,
      };
    });
}

function playerTags(row) {
  const tags = [];
  if (row.ratingDelta != null && row.ratingDelta >= 0.2) tags.push("Rising");
  if (row.ratingDelta != null && row.ratingDelta <= -0.2) tags.push("Cooling");
  if ((row.last3?.goals ?? 0) + (row.last3?.assists ?? 0) >= 3) tags.push("Hot");
  if (row.minutesFlag) tags.push("Minutes risk");
  if (row.owner === "Free agent") tags.push("Free agent");
  return tags;
}

function pickHeadline(fixtures) {
  if (!fixtures?.length) return null;
  const live = fixtures.find((row) => isLiveStatus(row.status));
  if (live) return live;
  const now = Date.now() - 3 * 60 * 60 * 1000;
  const upcoming = [...fixtures]
    .filter((row) => row.status === "NS" || row.status === "POSTP")
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .find((row) => new Date(row.kickoff).getTime() >= now);
  if (upcoming) return upcoming;
  return fixtures[0];
}

function ScoutActions() {
  return (
    <div className={styles.scoutActions}>
      <Link href="/ultima/market" className={styles.primaryBtn}>
        Scout the market
      </Link>
      <Link href="/ultima/squad" className={styles.secondaryBtn}>
        My squad
      </Link>
    </div>
  );
}

function NextMatch({ desk, refreshing }) {
  const rising = desk?.movers?.rising?.length ?? 0;
  const falling = desk?.movers?.falling?.length ?? 0;
  const signals =
    rising || falling ? `${rising} rising · ${falling} falling` : null;

  if (desk?.emptyReason === "sync") {
    return (
      <article className={styles.nextMatch} aria-label="Scouting window">
        <p className={styles.nextKicker}>Scouting window</p>
        <h2 className={styles.nextTitle}>The market stays open</h2>
        <p className={styles.nextMeta}>
          {refreshing
            ? "Filling the Europe desk from Sportmonks."
            : "The Europe board has not synced yet. Scout while it fills."}
        </p>
        {signals ? <p className={styles.nextMeta}>{signals}</p> : null}
        <ScoutActions />
      </article>
    );
  }

  if (desk?.emptyReason === "break" || !desk?.fixtures?.length) {
    return (
      <article className={styles.nextMatch} aria-label="Scouting window">
        <p className={styles.nextKicker}>League break</p>
        <h2 className={styles.nextTitle}>The market stays open</h2>
        <p className={styles.nextMeta}>
          No gameweek on the slate. Scout form and free agents before lock.
        </p>
        {signals ? <p className={styles.nextMeta}>{signals}</p> : null}
        <ScoutActions />
      </article>
    );
  }

  const row = pickHeadline(desk.fixtures);
  if (!row) return null;

  const score = scoreText(row);
  const mark = badge(row.status);
  const live = isLiveStatus(row.status);
  const until = !live && row.status !== "FT" ? countdownTo(row.kickoff) : null;

  return (
    <article className={live ? styles.nextMatchLive : styles.nextMatch} aria-label="Next match">
      <p className={styles.nextKicker}>
        {live ? "Live now" : row.status === "FT" ? "Last result" : "Next match"}
        {row.leagueCode ? ` · ${row.leagueCode}` : ""}
        {desk.gameweek ? ` · Gameweek ${desk.gameweek}` : ""}
      </p>
      <div className={styles.nextSides}>
        <strong className={styles.nextHome}>{row.home || "Home"}</strong>
        <span className={styles.nextScore}>{score ?? "v"}</span>
        <strong className={styles.nextAway}>{row.away || "Away"}</strong>
      </div>
      <p className={styles.nextMeta}>
        {mark ? (
          <span className={mark === "FT" ? styles.badgeFt : styles.badgeLive}>{mark}</span>
        ) : null}
        {until ? `Kickoff in ${until} · ` : null}
        {formatKickoff(row.kickoff)}
        {row.ownedCount ? ` · ${row.ownedCount} owned` : ""}
      </p>
      {signals ? <p className={styles.nextMeta}>{signals}</p> : null}
    </article>
  );
}

function FixtureTickets({ tickets }) {
  if (!tickets?.length) return null;
  return (
    <ul className={styles.ticketRow} aria-label="Next fixtures">
      {tickets.map((fix, i) => (
        <li key={`${fix.opponent}-${i}`} className={`${styles.ticket} ${styles[`ticket_${fix.difficulty}`] || ""}`}>
          <span>{fix.venue}</span>
          <strong>{fix.opponent || "TBD"}</strong>
        </li>
      ))}
    </ul>
  );
}

function FormSpark({ recent }) {
  if (!recent?.length) return null;
  return (
    <span className={styles.spark} aria-label="Recent output">
      {recent.map((row, i) => {
        const n = (row.goals ?? 0) + (row.assists ?? 0);
        return (
          <span key={i} className={n > 0 ? styles.sparkOn : styles.sparkOff}>
            {n}
          </span>
        );
      })}
    </span>
  );
}

function FixtureInbox({ desk }) {
  const headline = pickHeadline(desk?.fixtures);
  const rest = (desk?.fixtures ?? []).filter((row) => row.id !== headline?.id);

  if (!rest.length) return null;

  return (
    <section className={styles.officePanel} aria-label="Europe inbox">
      <h3 className={styles.panelTitle}>Europe</h3>
      <ul className={styles.inboxList}>
        {rest.map((row) => {
          const score = scoreText(row);
          const mark = badge(row.status);
          return (
            <li key={row.id} className={styles.inboxItem}>
              <span className={styles.inboxStamp}>{row.leagueCode || "EUR"}</span>
              <span className={styles.inboxLine}>
                {row.home || row.away ? `${row.home ?? ""} v ${row.away ?? ""}` : "Fixture"}
                {score ? ` ${score}` : ""}
              </span>
              <span className={styles.inboxMeta}>
                {mark ? (
                  <span className={mark === "FT" ? styles.badgeFt : styles.badgeLive}>{mark}</span>
                ) : null}
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

function FormGuide({ form, fixtures, tab, setTab }) {
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
    <section className={styles.officePanel} id="ultima-form" aria-label="Form Guide">
      <h3 className={styles.panelTitle}>Form</h3>
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
        players.length === 0 ? (
          <p className={styles.hubNote}>Player data for this league is being prepared.</p>
        ) : (
        <ul className={styles.playerMarket}>
          {players.map((row) => {
            const tags = playerTags(row);
            const tickets = fixturesForClub(fixtures, row.club);
            const up = row.ratingDelta != null && row.ratingDelta >= 0;
            return (
              <li key={row.playerId} className={styles.playerCard}>
                <div className={styles.playerCardTop}>
                  <strong>{row.name}</strong>
                  <span className={styles.inboxStamp}>{row.leagueCode || ULTIMA_LEAGUE_SHORT[row.league]}</span>
                </div>
                <p className={styles.formMeta}>
                  {row.club}
                  {row.owner ? ` · ${row.owner}` : ""}
                </p>
                <p className={styles.formMeta}>
                  {`3: ${row.last3.goals}g ${row.last3.assists}a`}
                  {` · 5: ${row.last5.goals}g ${row.last5.assists}a`}
                  {row.last3.rating != null ? ` · Form ${row.last3.rating.toFixed(1)}` : ""}
                  {row.ratingDelta != null ? (
                    <span className={up ? styles.moveUp : styles.moveDown}>
                      {` ${up ? "↗" : "↘"} ${Math.abs(row.ratingDelta).toFixed(2)}`}
                    </span>
                  ) : null}
                </p>
                <FormSpark recent={row.recent} />
                <FixtureTickets tickets={tickets} />
                {tags.length ? (
                  <p className={styles.tagRow}>
                    {tags.map((tag) => (
                      <span key={tag} className={styles.formTag}>{tag}</span>
                    ))}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        )
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
    <section className={styles.officePanel} aria-label="Movers">
      <h3 className={styles.panelTitle}>Movers</h3>
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
    <section className={styles.officePanel} aria-label="Trending in Ultima">
      <h3 className={styles.panelTitle}>Trending</h3>
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
    <section className={styles.officePanel} aria-label="Tables">
      <h3 className={styles.panelTitle}>Tables</h3>
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
                    {move > 0 ? <span className={styles.moveUp}>↗ {move}</span> : null}
                    {move < 0 ? <span className={styles.moveDown}>↘ {Math.abs(move)}</span> : null}
                    {move === 0 ? <span className={styles.moveFlat}>stable</span> : null}
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

export default function UltimaEuropeDesk({
  desk,
  doors = null,
  lead = null,
  briefing = null,
  inboxExtra = null,
  radio = null,
}) {
  const [live, setLive] = useState(desk);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("teams");

  useEffect(() => {
    setLive(desk);
  }, [desk]);

  useEffect(() => {
    if (desk?.emptyReason !== "sync") return undefined;
    let cancelled = false;
    setRefreshing(true);
    fetch("/api/ultima/europe?refresh=1")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.desk) setLive(data.desk);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [desk?.emptyReason]);

  if (!live && !doors && !lead) return null;

  return (
    <div className={styles.officeHome}>
      <NextMatch desk={live} refreshing={refreshing} />
      {doors}
      {briefing}
      {lead}
      <div className={styles.officeGrid}>
        <div className={styles.officeCol}>
          {inboxExtra}
          {live ? <FixtureInbox desk={live} /> : null}
        </div>
        <div className={styles.officeSide}>
          {radio}
          {live && tab === "teams" ? <Tables standings={live.standings} /> : null}
        </div>
      </div>
      {live ? (
        <>
          <FormGuide form={live.form} fixtures={live.fixtures} tab={tab} setTab={setTab} />
          <Movers movers={live.movers} />
          <Trending trending={live.trending} />
        </>
      ) : null}
    </div>
  );
}
