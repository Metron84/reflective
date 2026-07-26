"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FadeUp from "@/components/FadeUp";
import NomineeCard from "./NomineeCard";
import BestVideoSection from "./BestVideoSection";
import CompletionState from "./CompletionState";
import ComingShortlyCover from "./ComingShortlyCover";
import YouTubeFacade from "./YouTubeFacade";
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

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {showFullComplete ? (
          <CompletionState total={totalCategoryCount} />
        ) : null}

        {bodyCategories.map((category, index) => {
          const nominees = nomineesByCategory[category.slug] ?? [];
          const categoryVoted = voted.includes(category.slug);
          const categoryPending = pendingVote?.category === category.slug;
          const isOpen = category.open;
          const hasNominees = nominees.length > 0;

          if (category.slug === "best-video" && isOpen && hasNominees) {
            return (
              <BestVideoSection
                key={category.slug}
                category={category}
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
              className={`scroll-mt-32 border-b py-16 last:border-b-0 ${
                isOpen ? "border-navy/10" : "border-navy/5 opacity-70"
              }`}
            >
              <FadeUp>
                <p
                  className={`text-xs uppercase tracking-[0.3em] ${
                    isOpen ? "text-navy/40" : "text-navy/30"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(bodyCategories.length).padStart(2, "0")}
                </p>
                <h2
                  className={`mt-2 font-display text-3xl sm:text-4xl ${
                    isOpen ? "text-navy" : "text-navy/55"
                  }`}
                >
                  {category.name}
                </h2>
                <div
                  className={`mt-4 h-px w-16 ${isOpen ? "bg-signal" : "bg-navy/15"}`}
                />
              </FadeUp>

              {!isOpen ? <ComingShortlyCover /> : null}

              {errors[category.slug] ? (
                <p className="mt-6 text-sm text-signal">{errors[category.slug]}</p>
              ) : null}

              {isOpen && hasNominees ? (
                <>
                  {category.category_youtube_id ? (
                    <div className="mt-8 max-w-3xl">
                      <YouTubeFacade
                        youtubeId={category.category_youtube_id}
                        title={`${category.name} nominees`}
                        posterSrc={category.category_poster ?? null}
                      />
                    </div>
                  ) : null}

                  <div
                    className={`mt-8 grid gap-6 sm:grid-cols-2 ${
                      nominees.length >= 7
                        ? "lg:grid-cols-3"
                        : "lg:grid-cols-4"
                    }`}
                  >
                    {nominees.map((nominee) => (
                      <NomineeCard
                        key={nominee.id}
                        nominee={nominee}
                        votingOpen={votingOpen}
                        categoryVoted={categoryVoted}
                        isPick={picks[category.slug] === nominee.id}
                        pending={
                          categoryPending && pendingVote?.nomineeId === nominee.id
                        }
                        disabled={categoryPending}
                        canVote={isSignedIn}
                        onVote={() => handleVote(category.slug, nominee.id)}
                      />
                    ))}
                  </div>

                  {categoryVoted ? (
                    <CategoryStandings
                      standings={standingsByCategory[category.slug]}
                      pickId={picks[category.slug]}
                    />
                  ) : !isSignedIn ? (
                    <div className="mt-8 border border-navy/15 p-5 text-sm text-navy/60">
                      <Link
                        href="/signin?next=/reflections"
                        className="font-medium text-navy underline underline-offset-4 hover:text-signal"
                      >
                        Sign up free to vote
                      </Link>
                      . The race for this category opens after your pick.
                    </div>
                  ) : (
                    <p className="mt-8 text-sm text-navy/55">
                      Vote to open this category&apos;s race.
                    </p>
                  )}
                </>
              ) : null}

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
