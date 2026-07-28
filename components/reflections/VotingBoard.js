"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryBallotSection from "./CategoryBallotSection";
import CompletionState from "./CompletionState";
import ComingShortlyCover from "./ComingShortlyCover";
import { getFingerprint } from "@/lib/fingerprint";
import styles from "./VotingBoard.module.css";

const COMPLETION_ID = "reflections-complete";
const SCROLL_BEAT_MS = 800;

const NAV_SHORT = {
  "best-video": "Best Video",
  "best-supporters-club": "Supporters Club",
  "best-celebration": "Celebration",
  "best-chant": "Chant",
  "best-supporter": "Supporter",
  "best-message": "Message",
  "best-interview": "Interview",
  "best-soundbite": "Soundbite",
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToId(id, instant = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: instant || prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function CategoryStandings({ standings, pickId }) {
  if (!standings?.length) {
    return (
      <p className="mt-8 text-sm text-navy/55">
        Your vote is in. The race fills as more fans vote.
      </p>
    );
  }

  return (
    <div className="mt-8 border border-navy/15 bg-paper p-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
        Live race
      </p>
      <ol className="mt-4 space-y-2">
        {standings.map((row, i) => {
          const isPick = pickId === row.nominee_id;
          return (
            <li
              key={row.nominee_id}
              className={`flex items-baseline justify-between gap-3 text-sm ${
                isPick ? "text-navy" : "text-navy/70"
              }`}
            >
              <span>
                <span className="tabular-nums text-navy/40">{i + 1}.</span>{" "}
                {row.title}
                {isPick ? (
                  <span className="ml-2 text-xs uppercase tracking-widest text-signal">
                    Your pick
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums text-navy/50">
                {row.votes}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function VotingBoard({
  navCategories,
  bodyCategories,
  totalCategoryCount,
  nomineesByCategory,
  initialVoted,
  initialPicks,
  initialStandings = {},
  votingState,
  isSignedIn,
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [picks, setPicks] = useState(initialPicks);
  const [standingsByCategory, setStandingsByCategory] =
    useState(initialStandings);
  const [pendingVote, setPendingVote] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeSlug, setActiveSlug] = useState(
    () => navCategories.find((c) => c.open)?.slug ?? navCategories[0]?.slug
  );

  const bodySlugs = useMemo(
    () => new Set(bodyCategories.map((c) => c.slug)),
    [bodyCategories]
  );

  const openCategories = useMemo(
    () => navCategories.filter((c) => c.open),
    [navCategories]
  );
  const openSlugs = useMemo(
    () => openCategories.map((c) => c.slug),
    [openCategories]
  );

  const votingOpen = votingState === "open";
  const allOpenVoted =
    openSlugs.length > 0 && openSlugs.every((s) => voted.includes(s));
  const showFullComplete = allOpenVoted;

  function nextUnvotedOpen(votedList) {
    return openCategories.find((c) => !votedList.includes(c.slug))?.slug ?? null;
  }

  function resumeTarget(votedList) {
    if (openSlugs.every((s) => votedList.includes(s))) {
      return COMPLETION_ID;
    }
    const next = nextUnvotedOpen(votedList);
    if (next && bodySlugs.has(next)) return next;
    return null;
  }

  useEffect(() => {
    if (
      votingOpen &&
      initialVoted.length > 0 &&
      initialVoted.length < openSlugs.length
    ) {
      const next = nextUnvotedOpen(initialVoted);
      if (next && bodySlugs.has(next)) scrollToId(next, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sections = bodyCategories
      .map((c) => document.getElementById(c.slug))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSlug(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.35, 0.55] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [bodyCategories]);

  function advanceAfterBeat(target) {
    if (!target) return;
    setTimeout(() => scrollToId(target), SCROLL_BEAT_MS);
  }

  async function handleVote(categorySlug, nomineeId) {
    const category = navCategories.find((c) => c.slug === categorySlug);
    if (!category?.open) return;
    if (!votingOpen || pendingVote) return;
    if (!isSignedIn) return;
    setPendingVote({ category: categorySlug, nomineeId });
    setErrors((prev) => ({ ...prev, [categorySlug]: null }));
    try {
      const fingerprint = await getFingerprint();
      const res = await fetch("/api/reflections/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: categorySlug,
          nomineeId,
          fingerprint,
          website: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const newVoted = data.voted ?? [...new Set([...voted, categorySlug])];
        setVoted(newVoted);
        setPicks(data.picks ?? { ...picks, [categorySlug]: nomineeId });
        if (Array.isArray(data.standings)) {
          setStandingsByCategory((prev) => ({
            ...prev,
            [categorySlug]: data.standings,
          }));
        }

        const isFirstVoteInCategory = !voted.includes(categorySlug);
        if (isFirstVoteInCategory) {
          advanceAfterBeat(resumeTarget(newVoted));
        }
      } else if (res.status === 401 && data.reason === "account-required") {
        setErrors((prev) => ({
          ...prev,
          [categorySlug]: "Sign up free to vote.",
        }));
      } else if (res.status === 409) {
        setVoted(data.voted ?? [...voted, categorySlug]);
        setErrors((prev) => ({
          ...prev,
          [categorySlug]: "You already voted in this category.",
        }));
      } else if (data.reason === "category-closed") {
        setErrors((prev) => ({
          ...prev,
          [categorySlug]: "This category is not open for voting yet.",
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          [categorySlug]: "That vote did not go through. Try again.",
        }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        [categorySlug]: "That vote did not go through. Try again.",
      }));
    } finally {
      setPendingVote(null);
    }
  }

  return (
    <>
      <p className={styles.framing}>
        Fan moments from the summer. You vote, the crowd decides.
      </p>

      <nav className={styles.subnav} aria-label="Award categories">
        <div className={styles.subnavTrack}>
          {navCategories.map((category, index) => {
            const isActive = activeSlug === category.slug;
            const isVoted = voted.includes(category.slug);
            const label = NAV_SHORT[category.slug] ?? category.name;
            return (
              <a
                key={category.slug}
                href={`#${category.slug}`}
                className={`${styles.subnavLink} ${
                  isActive ? styles.subnavActive : ""
                }`}
                onClick={() => setActiveSlug(category.slug)}
              >
                <span className={styles.subnavNum}>
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                {label}
                {isVoted ? <span className={styles.subnavDot} aria-hidden /> : null}
              </a>
            );
          })}
        </div>
      </nav>

      <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${styles.ballot}`}>
        {showFullComplete ? (
          <CompletionState total={totalCategoryCount} />
        ) : null}

        {bodyCategories.map((category, index) => {
          const nominees = nomineesByCategory[category.slug] ?? [];
          const categoryVoted = voted.includes(category.slug);
          const isOpen = category.open;
          const hasNominees = nominees.length > 0;

          if (isOpen && hasNominees) {
            return (
              <CategoryBallotSection
                key={category.slug}
                category={category}
                index={index}
                nominees={nominees}
                votingOpen={votingOpen}
                categoryVoted={categoryVoted}
                picks={picks}
                pendingVote={pendingVote}
                canVote={isSignedIn}
                standings={standingsByCategory[category.slug]}
                errors={errors[category.slug]}
                isSignedIn={isSignedIn}
                CategoryStandings={CategoryStandings}
                onVote={(nomineeId) => handleVote(category.slug, nomineeId)}
              />
            );
          }

          return (
            <section
              key={category.slug}
              id={category.slug}
              className="scroll-mt-32 border-b border-navy/5 py-16 opacity-70 last:border-b-0"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-navy/30">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(bodyCategories.length).padStart(2, "0")}
              </p>
              <h2 className="mt-2 font-display text-3xl text-navy/55 sm:text-4xl">
                {category.name}
              </h2>
              <div className="mt-4 h-px w-16 bg-navy/15" />
              {!isOpen ? <ComingShortlyCover /> : null}
              {isOpen && !hasNominees ? (
                <p className="mt-8 text-sm text-navy/50">
                  Nominees loading for this category.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
