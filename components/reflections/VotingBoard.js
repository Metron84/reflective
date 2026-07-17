"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import FadeUp from "@/components/FadeUp";
import NomineeCard from "./NomineeCard";
import PostVotePopup from "./PostVotePopup";
import CompletionState from "./CompletionState";
import PartialCompletionState from "./PartialCompletionState";
import ComingShortlyCover from "./ComingShortlyCover";
import YouTubeFacade from "./YouTubeFacade";
import { getFingerprint } from "@/lib/fingerprint";

const POPUP_DISMISSED_KEY = "trf_popup_dismissed";
const COMPLETION_ID = "reflections-complete";
const SCROLL_BEAT_MS = 800;

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

export default function VotingBoard({
  navCategories,
  bodyCategories,
  totalCategoryCount,
  nomineesByCategory,
  initialVoted,
  initialPicks,
  votingState,
  isSignedIn,
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [picks, setPicks] = useState(initialPicks);
  const [pendingVote, setPendingVote] = useState(null);
  const [errors, setErrors] = useState({});
  const [popupOpen, setPopupOpen] = useState(false);
  const resumeTargetRef = useRef(null);

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
  const votedOpenCount = openSlugs.filter((s) => voted.includes(s)).length;
  const allOpenVoted =
    openSlugs.length > 0 && openSlugs.every((s) => voted.includes(s));
  const allCategoriesVoted =
    totalCategoryCount > 0 &&
    navCategories.every((c) => voted.includes(c.slug));
  const showPartialComplete = allOpenVoted && !allCategoriesVoted;
  const showFullComplete = allCategoriesVoted;

  function nextUnvotedOpen(votedList) {
    return openCategories.find((c) => !votedList.includes(c.slug))?.slug ?? null;
  }

  function resumeTarget(votedList) {
    if (navCategories.every((c) => votedList.includes(c.slug))) {
      return COMPLETION_ID;
    }
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

        const isFirstVoteInCategory = !voted.includes(categorySlug);
        const target = isFirstVoteInCategory ? resumeTarget(newVoted) : null;
        if (isFirstVoteInCategory && !sessionStorage.getItem(POPUP_DISMISSED_KEY)) {
          resumeTargetRef.current = target;
          setPopupOpen(true);
        } else if (isFirstVoteInCategory) {
          advanceAfterBeat(target);
        }
      } else if (res.status === 401 && data.reason === "account-required") {
        setErrors((prev) => ({
          ...prev,
          [categorySlug]: "Sign in free to cast your vote.",
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

  function dismissPopup() {
    sessionStorage.setItem(POPUP_DISMISSED_KEY, "1");
    setPopupOpen(false);
    const target = resumeTargetRef.current;
    resumeTargetRef.current = null;
    advanceAfterBeat(target);
  }

  const progressPct =
    openSlugs.length > 0 ? (votedOpenCount / openSlugs.length) * 100 : 0;

  return (
    <>
      <nav className="sticky top-16 z-30 border-b border-navy/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          {votingOpen && openSlugs.length > 0 ? (
            <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-navy/60">
              {votedOpenCount} of {openSlugs.length} votes in
            </span>
          ) : null}
          <div className="flex items-center gap-4 overflow-x-auto">
            {navCategories.map((category) => {
              const isOpen = category.open;
              const isVoted = voted.includes(category.slug);
              const inBody = bodySlugs.has(category.slug);
              const className = `shrink-0 text-sm transition-colors ${
                inBody ? "hover:text-navy" : "cursor-default"
              } ${
                isVoted
                  ? "text-signal"
                  : isOpen
                    ? "text-navy/70"
                    : "text-navy/35"
              }`;

              if (!inBody) {
                return (
                  <span key={category.slug} className={className}>
                    {category.name}
                  </span>
                );
              }

              return (
                <a
                  key={category.slug}
                  href={`#${category.slug}`}
                  className={className}
                >
                  {category.name}
                </a>
              );
            })}
          </div>
        </div>
        {votingOpen && openSlugs.length > 0 ? (
          <div
            className="h-0.5 bg-signal transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        ) : null}
      </nav>

      {votingOpen && !isSignedIn ? (
        <div className="border-b border-navy/10 bg-paper px-4 py-4 sm:px-6">
          <p className="mx-auto max-w-6xl text-sm text-navy/70">
            Sign in free to cast your vote.{" "}
            <Link
              href="/signin?next=/reflections"
              className="text-navy underline underline-offset-4 hover:text-signal"
            >
              Sign in
            </Link>
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {showFullComplete ? (
          <CompletionState total={totalCategoryCount} />
        ) : showPartialComplete ? (
          <PartialCompletionState
            openCount={openSlugs.length}
            totalCount={totalCategoryCount}
          />
        ) : null}

        {bodyCategories.map((category, index) => {
          const nominees = nomineesByCategory[category.slug] ?? [];
          const categoryVoted = voted.includes(category.slug);
          const categoryPending = pendingVote?.category === category.slug;
          const isOpen = category.open;
          const hasNominees = nominees.length > 0;

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
                      />
                    </div>
                  ) : null}

                  <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

                  <div className="mt-8 border border-navy/15 p-5 text-sm text-navy/60">
                    Live standings are for members.{" "}
                    <Link
                      href="/signin?next=/reflections"
                      className="text-navy underline underline-offset-4 hover:text-signal"
                    >
                      Sign in free
                    </Link>{" "}
                    to watch the race.
                  </div>
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

      {popupOpen ? <PostVotePopup onClose={dismissPopup} /> : null}
    </>
  );
}
