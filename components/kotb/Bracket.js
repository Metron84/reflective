"use client";

import { useMemo, useState } from "react";
import MatchCard from "./MatchCard";
import MatchDetail from "./MatchDetail";
import { MATCHES, matchesForRound } from "@/lib/kotb";
import styles from "./Bracket.module.css";

const TABS = [
  { id: "QF", label: "Quarters 4" },
  { id: "SF", label: "Semis 2" },
  { id: "F", label: "Final 1" },
];

export default function Bracket() {
  const [round, setRound] = useState("QF");
  const [overview, setOverview] = useState(false);
  const [open, setOpen] = useState(null);
  const [hot, setHot] = useState(null);

  const cards = useMemo(() => matchesForRound(round), [round]);
  const route = useMemo(() => routeFor(hot), [hot]);

  return (
    <section className={styles.wrap} aria-labelledby="kotb-bracket">
      <div className={styles.head}>
        <h2 id="kotb-bracket" className={styles.title}>
          The bracket
        </h2>
        <button
          type="button"
          className={styles.overviewBtn}
          onClick={() => setOverview((v) => !v)}
        >
          {overview ? "Rounds" : "Overview"}
        </button>
      </div>

      {!overview ? (
        <>
          <div className={styles.tabs} role="tablist" aria-label="Rounds">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={round === tab.id}
                className={round === tab.id ? styles.tabOn : styles.tab}
                onClick={() => setRound(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={styles.list}>
            {cards.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onOpen={setOpen}
              />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.scroller}>
          <div className={styles.tree}>
            <Column
              title="Quarters"
              matches={matchesForRound("QF")}
              onOpen={setOpen}
              route={route}
              onHot={setHot}
            />
            <span className={styles.gutter} aria-hidden="true" />
            <Column
              title="Semis"
              matches={matchesForRound("SF")}
              onOpen={setOpen}
              route={route}
              onHot={setHot}
            />
            <span className={styles.gutter} aria-hidden="true" />
            <Column
              title="Final"
              matches={matchesForRound("F")}
              onOpen={setOpen}
              route={route}
              onHot={setHot}
            />
            <svg
              className={styles.wires}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className={route.has("qf1") ? styles.wireHot : styles.wire}
                d="M31 16 H48 V28 H53"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              <path
                className={route.has("qf2") ? styles.wireHot : styles.wire}
                d="M31 38 H48 V28 H53"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              <path
                className={route.has("qf3") ? styles.wireHot : styles.wire}
                d="M31 62 H48 V72 H53"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              <path
                className={route.has("qf4") ? styles.wireHot : styles.wire}
                d="M31 84 H48 V72 H53"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              <path
                className={route.has("sf1") ? styles.wireHot : styles.wire}
                d="M69 28 H84 V50 H88"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              <path
                className={route.has("sf2") ? styles.wireHot : styles.wire}
                d="M69 72 H84 V50 H88"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      <MatchDetail match={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function Column({ title, matches, onOpen, route, onHot }) {
  return (
    <div className={styles.col}>
      <p className={styles.colTitle}>{title}</p>
      <div className={styles.colStack}>
        {matches.map((match) => (
          <div
            key={match.id}
            className={`${styles.slot} ${!route.has(match.id) && route.size ? styles.dim : ""}`}
            onMouseEnter={() => onHot(match.id)}
            onMouseLeave={() => onHot(null)}
            onFocus={() => onHot(match.id)}
            onBlur={() => onHot(null)}
          >
            <MatchCard
              match={match}
              onOpen={onOpen}
              highlight={route.has(match.id) && route.size > 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function routeFor(id) {
  const set = new Set();
  if (!id) return set;
  set.add(id);
  const match = MATCHES.find((row) => row.id === id);
  if (match?.winnerTo) {
    for (const extra of routeFor(match.winnerTo)) set.add(extra);
  }
  for (const row of MATCHES) {
    if (row.winnerTo === id) {
      set.add(row.id);
    }
  }
  return set;
}
