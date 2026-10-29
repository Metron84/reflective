"use client";

import { useState } from "react";
import {
  clubsIn,
  divisionsIn,
  foldName,
  PICKER_COUNTRIES,
  searchClubs,
} from "@/lib/crest/clubs";
import home from "./CrestHome.module.css";
import want from "./CrestWant.module.css";
import swipe from "./CrestSwipe.module.css";
import styles from "./CrestRoots.module.css";

const RUN_TOTAL = 12;

/**
 * @typedef {import("@/lib/crest/roots.js").RootClub} RootClub
 * @typedef {import("@/lib/crest/roots.js").CrestRoots} CrestRootsState
 */

/**
 * Four taps after scope, before the stake and the Life cards.
 *
 * @param {{
 *   onDone: (roots: CrestRootsState) => void,
 *   onBack: () => void,
 * }} props
 */
export default function CrestRoots({ onDone, onBack }) {
  const [step, setStep] = useState(/** @type {"r1"|"r2"|"r3"|"r4"} */ ("r1"));
  const [picking, setPicking] = useState(/** @type {null|"family"|"grew"|"hooked"} */ (null));
  const [hookSource, setHookSource] = useState(/** @type {"player"|"match"|null} */ (null));
  const [family, setFamily] = useState(/** @type {RootClub|null} */ (null));
  const [grew, setGrew] = useState(/** @type {RootClub|null} */ (null));
  const [hooked, setHooked] = useState(
    /** @type {CrestRootsState["hooked"]} */ (null),
  );

  function chooseClub(club) {
    if (picking === "family") {
      setFamily(club);
      setPicking(null);
      setStep("r2");
    } else if (picking === "grew") {
      setGrew(club);
      setPicking(null);
      setStep("r3");
    } else if (picking === "hooked") {
      setHooked({ source: hookSource || "player", club });
      setPicking(null);
      setHookSource(null);
      setStep("r4");
    }
  }

  function finish(stay) {
    onDone({ family, grew, hooked, stay });
  }

  function back() {
    if (picking) {
      setPicking(null);
      return;
    }
    if (step === "r1") {
      onBack();
      return;
    }
    if (step === "r2") setStep("r1");
    else if (step === "r3") setStep("r2");
    else setStep("r3");
  }

  const done = step === "r1" ? 0 : step === "r2" ? 1 : step === "r3" ? 2 : 3;

  return (
    <div className={home.home}>
      <header className={home.topbar}>
        <button type="button" className={`${home.back} ${want.back}`} onClick={back} aria-label="Back">
          <ArrowLeft />
        </button>
        <span className={home.brand}>Find Your FC</span>
        <span />
      </header>
      <p className={swipe.progressLabel}>{done} of {RUN_TOTAL}</p>
      <div
        className={swipe.progressBar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={RUN_TOTAL}
        aria-valuenow={done}
      >
        <span style={{ width: `${Math.round((done / RUN_TOTAL) * 100)}%` }} />
      </div>
      <div className={`${want.layout} ${styles.shell}`}>
        {picking ? (
          <Picker
            title={picking === "hooked" ? hookTitle(hookSource) : "Which club?"}
            onPick={chooseClub}
          />
        ) : null}

        {!picking && step === "r1" ? (
          <Question
            q="Did someone hand you a club?"
            s="A parent, grandparent, or sibling passed their team down to you."
            options={[
              ["yes", "Yes, my family's club"],
              ["no", "No"],
            ]}
            onPick={(id) => {
              if (id === "yes") setPicking("family");
              else {
                setFamily(null);
                setStep("r2");
              }
            }}
          />
        ) : null}

        {!picking && step === "r2" ? (
          <Question
            q="Is there a club from where you grew up that you still feel for?"
            s="A local club you still care about today, not just one that was nearby."
            options={[
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            onPick={(id) => {
              if (id === "yes") setPicking("grew");
              else {
                setGrew(null);
                setStep("r3");
              }
            }}
          />
        ) : null}

        {!picking && step === "r3" ? (
          <Question
            q="What hooked you on football first?"
            s="The first thing that made you fall for the game."
            options={[
              ["player", "A player"],
              ["tournament", "A tournament"],
              ["match", "A match I was at"],
              ["nothing", "Nothing in particular"],
            ]}
            onPick={(id) => {
              if (id === "player" || id === "match") {
                setHookSource(id);
                setPicking("hooked");
                return;
              }
              setHooked({ source: id === "tournament" ? "tournament" : "nothing", club: null });
              setStep("r4");
            }}
          />
        ) : null}

        {!picking && step === "r4" ? (
          <Question
            q="Your team loses for three seasons. Do you stay?"
            s="This tells us whether your loyalty comes from birth or from choice."
            options={[
              ["always", "Always"],
              ["probably", "Probably"],
              ["drift", "I'd drift"],
            ]}
            onPick={(id) => finish(/** @type {"always"|"probably"|"drift"} */ (id))}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {"player"|"match"|null} source
 */
function hookTitle(source) {
  if (source === "match") return "Which home club?";
  return "His club at the time?";
}

/**
 * @param {{
 *   q: string,
 *   s: string,
 *   options: [string, string][],
 *   onPick: (id: string) => void,
 * }} props
 */
function Question({ q, s, options, onPick }) {
  return (
    <>
      <div className={`${home.copy} ${want.copy}`}>
        <h1 className={`${home.headline} ${want.headline}`}>{q}</h1>
        <p className={styles.explain}>{s}</p>
      </div>
      <ul className={want.list}>
        {options.map(([id, label]) => (
          <li key={id}>
            <button type="button" className={want.chip} onClick={() => onPick(id)}>
              <span className={want.label}>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * @param {{ title: string, onPick: (club: RootClub) => void }} props
 */
function Picker({ title, onPick }) {
  const [country, setCountry] = useState(/** @type {string|null} */ (null));
  const [division, setDivision] = useState(/** @type {string|null} */ (null));
  const [query, setQuery] = useState("");
  const secondLabel = country === "Rest of the World" ? "League" : "Division";
  const divisions = country ? divisionsIn(country) : [];
  const clubs = country && division ? clubsIn(country, division) : [];
  const matches = searchClubs(query, 6);
  const trimmed = query.trim();
  const exact = trimmed && matches.some((club) => foldName(club.name) === foldName(trimmed));

  return (
    <div>
      <div className={`${home.copy} ${want.copy}`}>
        <h1 className={`${home.headline} ${want.headline}`}>{title}</h1>
        <p className={styles.explain}>Country, then {secondLabel.toLowerCase()}, then the club.</p>
      </div>

      {!country ? (
        <ul className={want.list}>
          {PICKER_COUNTRIES.map((name) => (
            <li key={name}>
              <button type="button" className={want.chip} onClick={() => setCountry(name)}>
                <span className={want.label}>{name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.picker}>
          <button
            type="button"
            className={styles.crumb}
            onClick={() => {
              if (division) setDivision(null);
              else setCountry(null);
            }}
          >
            {division ? `${country} · ${division}` : country}
          </button>
          {!division ? (
            <ul className={want.list}>
              {divisions.map((name) => (
                <li key={name}>
                  <button type="button" className={want.chip} onClick={() => setDivision(name)}>
                    <span className={want.label}>{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={want.list}>
              {clubs.map((club) => (
                <li key={club.slug}>
                  <button
                    type="button"
                    className={want.chip}
                    onClick={() => onPick({ slug: club.slug, name: club.name, typed: false })}
                  >
                    <span className={want.label}>{club.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.search}>
        <label htmlFor="crest-club-search">Can&apos;t find it? Type it</label>
        <input
          id="crest-club-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {matches.length ? (
          <ul className={want.list}>
            {matches.map((club) => (
              <li key={club.slug}>
                <button
                  type="button"
                  className={want.chip}
                  onClick={() => onPick({ slug: club.slug, name: club.name, typed: false })}
                >
                  <span className={want.label}>{club.name}</span>
                  <span className={want.line}>{club.division || club.league}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {trimmed && !exact ? (
          <button
            type="button"
            className={`${want.chip} ${styles.typed}`}
            onClick={() => onPick({ slug: null, name: trimmed, typed: true })}
          >
            <span className={want.label}>Use what I typed</span>
            <span className={want.line}>{trimmed}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11 3.5 5.5 9 11 14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
