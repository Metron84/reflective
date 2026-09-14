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
  const qf = matchesForRound("QF");
  const sf = matchesForRound("SF");
  const final = matchesForRound("F");

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
              <MatchCard key={match.id} match={match} onOpen={setOpen} />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.scroller}>
          <div className={styles.tree}>
            <p className={`${styles.colTitle} ${styles.headQ}`}>Quarters</p>
            <p className={`${styles.colTitle} ${styles.headS}`}>Semis</p>
            <p className={`${styles.colTitle} ${styles.headF}`}>Final</p>

            <Slot
              className={styles.qf1}
              match={qf[0]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />
            <Slot
              className={styles.qf2}
              match={qf[1]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />
            <Slot
              className={styles.qf3}
              match={qf[2]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />
            <Slot
              className={styles.qf4}
              match={qf[3]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />

            <Gutter
              className={styles.wireQf12}
              hotA={route.has("qf1")}
              hotB={route.has("qf2")}
            />
            <Gutter
              className={styles.wireQf34}
              hotA={route.has("qf3")}
              hotB={route.has("qf4")}
            />

            <Slot
              className={styles.sf1}
              match={sf[0]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />
            <Slot
              className={styles.sf2}
              match={sf[1]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />

            <Gutter
              className={styles.wireSf}
              hotA={route.has("sf1")}
              hotB={route.has("sf2")}
            />

            <Slot
              className={styles.f1}
              match={final[0]}
              route={route}
              onHot={setHot}
              onOpen={setOpen}
            />
          </div>
        </div>
      )}

      <MatchDetail match={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function Slot({ className, match, route, onHot, onOpen }) {
  if (!match) return null;
  const dim = route.size > 0 && !route.has(match.id);

  return (
    <div
      className={`${styles.slot} ${className} ${dim ? styles.dim : ""}`}
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
  );
}

function Gutter({ className, hotA, hotB }) {
  return (
    <svg
      className={`${styles.gutterSvg} ${className}`}
      viewBox="0 0 48 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className={hotA ? styles.wireHot : styles.wire}
        d="M0 25 H24 V50 H48"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
      <path
        className={hotB ? styles.wireHot : styles.wire}
        d="M0 75 H24 V50 H48"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
    </svg>
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
