"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import FanCard from "@/components/stand/FanCard";
import { buildCardState } from "@/lib/stand/card";
import {
  QUESTIONS_PER_DAY,
  STAND_STORAGE_KEY,
  gstDay,
} from "@/lib/stand/client-constants";
import styles from "./StandBoard.module.css";

let cachedRaw = null;
let cachedParsed = null;

function loadState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STAND_STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    cachedParsed = raw ? JSON.parse(raw) : null;
    return cachedParsed;
  } catch {
    cachedRaw = null;
    cachedParsed = null;
    return null;
  }
}

function saveState(state) {
  const raw = JSON.stringify(state);
  window.localStorage.setItem(STAND_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedParsed = state;
  window.dispatchEvent(new Event("trf-stand-storage"));
}

function subscribe(onStoreChange) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("trf-stand-storage", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("trf-stand-storage", onStoreChange);
  };
}

function defaultState(defaults) {
  return {
    badges: {
      clubId: defaults.defaultClubId,
      nationId: defaults.defaultNationId,
      personId: defaults.defaultPersonId,
    },
    activeBadge: "club",
    chapterId: defaults.defaultChapterId,
    answers: {},
    nextOrder: 1,
    dayUsage: {},
    onboardingDone: false,
  };
}

/** Chapter day that opens after today's wall (1-indexed). Null if chapter done. */
function nextOpenChapterDay(progress) {
  const answered = Object.keys(progress?.answers || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!answered.length) return 1;
  const maxOrder = Math.max(...answered);
  if (maxOrder >= 15) return null;
  if (maxOrder >= 10) return 3;
  if (maxOrder >= 5) return 2;
  return 1;
}

/** Stamp day just earned from answer progress (1, 2, or 3). */
function stampDayFromProgress(progress) {
  const answered = Object.keys(progress?.answers || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!answered.length) return null;
  const maxOrder = Math.max(...answered);
  if (maxOrder >= 15) return 3;
  if (maxOrder >= 10) return 2;
  if (maxOrder >= 5) return 1;
  return null;
}

function quietFollowLinks(chapter, complete) {
  const paths = Array.isArray(chapter?.next_paths) ? chapter.next_paths : [];
  const links = [];
  for (const line of paths) {
    const lower = String(line).toLowerCase();
    if (lower.includes("guesser") && !links.some((l) => l.href === "/guesser")) {
      links.push({ href: "/guesser", label: "Play The Guesser" });
    }
    if (
      (lower.includes("film") || lower.includes("films")) &&
      !links.some((l) => l.href === "/films")
    ) {
      links.push({ href: "/films", label: "Watch the films" });
    }
  }
  if (!links.length || !complete) {
    return [
      { href: "/guesser", label: "Play The Guesser" },
      { href: "/films", label: "Watch the films" },
    ];
  }
  return links.slice(0, 2);
}

export default function StandBoard({
  chapter: initialChapter,
  chaptersById,
  clubOptions,
  nationOptions,
  playerOptions,
  defaultClubId,
  defaultNationId,
  defaultPersonId,
  defaultChapterId,
  isSignedIn,
}) {
  const defaults = useMemo(
    () => ({
      defaultClubId,
      defaultNationId,
      defaultPersonId,
      defaultChapterId,
    }),
    [defaultChapterId, defaultClubId, defaultNationId, defaultPersonId],
  );

  const serverSnapshot = useMemo(() => defaultState(defaults), [defaults]);

  const persisted = useSyncExternalStore(
    subscribe,
    () => loadState() || serverSnapshot,
    () => serverSnapshot,
  );

  const [draft, setDraft] = useState(null);
  /** Animate stamp/title only when arriving at wall from answering, not on return. */
  const [wallMoment, setWallMoment] = useState(false);

  const state = draft ?? persisted;

  const commit = useCallback(
    (updater) => {
      setDraft((prev) => {
        const base = prev ?? loadState() ?? serverSnapshot;
        const next = typeof updater === "function" ? updater(base) : updater;
        saveState(next);
        return next;
      });
    },
    [serverSnapshot],
  );

  const chapter = chaptersById[state.chapterId] || initialChapter;
  const day = gstDay();
  const usedToday = state.dayUsage?.[day] ?? 0;
  const atWall = usedToday >= QUESTIONS_PER_DAY;
  const current = chapter.questions.find((q) => q.order === state.nextOrder);
  const complete = state.nextOrder > chapter.questions.length;
  const showWall = atWall || complete;

  const progressLabel = useMemo(() => {
    const answered = Object.keys(state.answers).length;
    return `${Math.min(answered, 15)}/15 · Day ${current?.day ?? 3} · ${usedToday}/${QUESTIONS_PER_DAY} today`;
  }, [state.answers, current, usedToday]);

  const cardState = useMemo(() => {
    const base = buildCardState(state, (id) => chaptersById[id] ?? null);
    return {
      ...base,
      claimed: Boolean(isSignedIn),
      badgeLabels: {
        club:
          clubOptions.find((c) => c.id === state.badges?.clubId)?.label ||
          null,
        nation:
          nationOptions.find((n) => n.id === state.badges?.nationId)?.label ||
          null,
        player:
          playerOptions.find((p) => p.id === state.badges?.personId)?.label ||
          null,
      },
    };
  }, [
    state,
    chaptersById,
    isSignedIn,
    clubOptions,
    nationOptions,
    playerOptions,
  ]);

  const nextDay = nextOpenChapterDay(state);
  const justEarnedStamp = stampDayFromProgress(state);
  const closingLine =
    chapter.questions?.[chapter.questions.length - 1]?.cliffhanger ||
    chapter.day_wall?.body;
  const wallLine = complete
    ? closingLine
    : chapter.day_wall?.body || chapter.day_wall?.headline;
  const followLinks = quietFollowLinks(chapter, complete);

  const startChapter = useCallback(
    (chapterId, activeBadge) => {
      commit((s) => ({
        ...s,
        chapterId,
        activeBadge,
        answers: {},
        nextOrder: 1,
        onboardingDone: true,
      }));
      setWallMoment(false);
    },
    [commit],
  );

  function resolveChapterId(badges, activeBadge) {
    if (activeBadge === "player" && badges.personId) {
      const id = `player.${badges.personId}.ch01`;
      if (chaptersById[id]) return id;
    }
    if (activeBadge === "nation" && badges.nationId) {
      const slug = badges.nationId.replace(/^nation-/, "");
      const id = `na.${slug}.ch01`;
      if (chaptersById[id]) return id;
    }
    if (activeBadge === "club" && badges.clubId) {
      const club = clubOptions.find((c) => c.id === badges.clubId);
      const league = club?.league;
      const prefix =
        league === "premier_league"
          ? "pl"
          : league === "serie_a"
            ? "sa"
            : league === "la_liga"
              ? "ll"
              : league === "bundesliga"
                ? "bl"
                : league === "ligue_1"
                  ? "l1"
                  : null;
      if (prefix) {
        const id = `${prefix}.${badges.clubId}.ch01`;
        if (chaptersById[id]) return id;
      }
    }
    return defaultChapterId;
  }

  function onConfirmBadges() {
    const chapterId = resolveChapterId(state.badges, state.activeBadge);
    startChapter(chapterId, state.activeBadge);
  }

  function answer(choiceId) {
    if (!current || atWall || complete) return;
    const nextUsed = usedToday + 1;
    const nextOrder = state.nextOrder + 1;
    const willWall = nextUsed >= QUESTIONS_PER_DAY;
    const willComplete = nextOrder > chapter.questions.length;
    if (willWall || willComplete) {
      setWallMoment(true);
    }
    commit((s) => {
      const dayUsage = { ...(s.dayUsage || {}) };
      dayUsage[day] = (dayUsage[day] ?? 0) + 1;
      return {
        ...s,
        answers: { ...s.answers, [String(current.order)]: choiceId },
        nextOrder: s.nextOrder + 1,
        dayUsage,
      };
    });
  }

  if (!state.onboardingDone) {
    return (
      <section className={styles.panel} aria-labelledby="stand-badges-heading">
        <p className={styles.eyebrow}>SAMPLE · The Stand</p>
        <h1 id="stand-badges-heading" className={styles.title}>
          Pick your badges
        </h1>
        <p className={styles.lede}>
          Club, nation, player. Then choose which Stand you take today. Five
          questions a day. Sign up to save the chapter overnight.
        </p>

        <label className={styles.label}>
          Club
          <select
            className={styles.select}
            value={state.badges.clubId}
            onChange={(e) =>
              commit((s) => ({
                ...s,
                badges: { ...s.badges, clubId: e.target.value },
              }))
            }
          >
            {clubOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Nation
          <select
            className={styles.select}
            value={state.badges.nationId}
            onChange={(e) =>
              commit((s) => ({
                ...s,
                badges: { ...s.badges, nationId: e.target.value },
              }))
            }
          >
            {nationOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Player
          <select
            className={styles.select}
            value={state.badges.personId}
            onChange={(e) =>
              commit((s) => ({
                ...s,
                badges: { ...s.badges, personId: e.target.value },
              }))
            }
          >
            {playerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Active Stand today</legend>
          {["club", "nation", "player"].map((badge) => (
            <label key={badge} className={styles.radio}>
              <input
                type="radio"
                name="activeBadge"
                checked={state.activeBadge === badge}
                onChange={() => commit((s) => ({ ...s, activeBadge: badge }))}
              />
              {badge}
            </label>
          ))}
        </fieldset>

        <button type="button" className={styles.primary} onClick={onConfirmBadges}>
          Begin chapter
        </button>
      </section>
    );
  }

  if (showWall) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>SAMPLE · The Stand</p>
          <h1 className={styles.title}>{chapter.title}</h1>
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => {
              setWallMoment(false);
              commit((s) => ({ ...s, onboardingDone: false }));
            }}
          >
            Change badges
          </button>
        </header>

        <section className={styles.wall} aria-label="Day wall">
          {wallLine ? <p className={styles.wallCopy}>{wallLine}</p> : null}

          <div className={styles.wallCard}>
            <FanCard
              cardState={cardState}
              variant="full"
              animateStampDay={
                wallMoment && !complete && justEarnedStamp
                  ? justEarnedStamp
                  : null
              }
              animateTitle={wallMoment && complete}
            />
          </div>

          {isSignedIn ? (
            !complete && nextDay ? (
              <p className={styles.tomorrowLine}>
                Day {nextDay} opens tomorrow
              </p>
            ) : null
          ) : (
            <Link
              href="/signin?next=%2Fstand"
              className={styles.claimBtn}
            >
              Claim your card
            </Link>
          )}

          <nav className={styles.quietLinks} aria-label="Continue">
            {followLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.quietLink}>
                {link.label}
              </Link>
            ))}
          </nav>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>SAMPLE · The Stand</p>
        <h1 className={styles.title}>{chapter.title}</h1>
        <p className={styles.meta}>
          {chapter.family} · {progressLabel}
        </p>
        <button
          type="button"
          className={styles.textBtn}
          onClick={() => commit((s) => ({ ...s, onboardingDone: false }))}
        >
          Change badges
        </button>
      </header>

      {current ? (
        <section className={styles.panel} aria-labelledby="stand-q">
          <p className={styles.qMeta}>
            Question {current.order} of 15 · Day {current.day}
          </p>
          <p className={styles.scene}>{current.scene}</p>
          <h2 id="stand-q" className={styles.h2}>
            {current.prompt}
          </h2>
          <ul className={styles.choices}>
            {current.choices.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.choice}
                  onClick={() => answer(c.id)}
                >
                  <span className={styles.choiceId}>{c.id}</span>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
