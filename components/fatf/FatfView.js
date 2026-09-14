"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FATF_CONSENT_LINE,
  FATF_PENDING_COOKIE,
  FATF_ROLES,
  fatfSignInHref,
} from "@/lib/fatf";
import styles from "./FatfView.module.css";

function setPendingCookie() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${FATF_PENDING_COOKIE}=1; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
}

function clearPendingCookie() {
  document.cookie = `${FATF_PENDING_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function hasPendingCookie() {
  return document.cookie.split("; ").includes(`${FATF_PENDING_COOKIE}=1`);
}

function track(event) {
  fetch("/api/fatf/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

function InterestedButton({ pending, onClick, variant = "primary" }) {
  return (
    <button
      type="button"
      className={variant === "secondary" ? styles.secondary : styles.primary}
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : null}
      {pending ? "Saving" : "Interested"}
    </button>
  );
}

/**
 * @param {{ signedIn: boolean; interested: boolean; role: string | null }} props
 */
export default function FatfView({
  signedIn,
  interested: interestedStart,
  role: roleStart,
}) {
  const [interested, setInterested] = useState(interestedStart);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [roleSaved, setRoleSaved] = useState(Boolean(roleStart));
  const headingRef = useRef(null);
  const shouldFocus = useRef(false);

  useEffect(() => {
    track("fatf_page_view");
  }, []);

  useEffect(() => {
    if (!signedIn || interested || !hasPendingCookie()) return;
    registerInterest({ fromCookie: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, interested]);

  useEffect(() => {
    if (interested && shouldFocus.current) {
      headingRef.current?.focus();
      shouldFocus.current = false;
    }
  }, [interested]);

  async function registerInterest({ fromCookie = false } = {}) {
    setError(null);
    setPending(true);
    if (!fromCookie) track("fatf_interest_click");
    try {
      const res = await fetch("/api/fatf/interest", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setPendingCookie();
        window.location.href = fatfSignInHref();
        return;
      }
      if (!res.ok) {
        setError(
          data.message ?? "We could not save that just now. Please try again.",
        );
        return;
      }
      clearPendingCookie();
      shouldFocus.current = true;
      setInterested(true);
      if (data.role) setRoleSaved(true);
      track("fatf_interest_complete");
    } catch {
      setError("We could not save that just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function onInterested() {
    if (interested || pending) return;
    if (!signedIn) {
      track("fatf_interest_click");
      setPendingCookie();
      window.location.href = fatfSignInHref();
      return;
    }
    registerInterest();
  }

  async function saveRole(nextRole) {
    setError(null);
    try {
      const res = await fetch("/api/fatf/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        setError("We could not save that just now. Please try again.");
        return;
      }
      setRoleSaved(true);
      track("fatf_role_selected");
    } catch {
      setError("We could not save that just now. Please try again.");
    }
  }

  async function skipRole() {
    setError(null);
    try {
      const res = await fetch("/api/fatf/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip: true }),
      });
      if (!res.ok) {
        setError("We could not save that just now. Please try again.");
        return;
      }
      setRoleSaved(true);
      track("fatf_role_skipped");
    } catch {
      setError("We could not save that just now. Please try again.");
    }
  }

  const reveal = (
    <div className={styles.reveal}>
      <h2 ref={headingRef} tabIndex={-1} className={styles.revealHeading}>
        Your interest is registered.
      </h2>
      <p className={styles.revealBody}>
        Thank you. When the first For All The Fans night is set, we email you
        before anyone else. There is nothing else you need to do.
      </p>
      {!roleSaved ? (
        <div className={styles.roleBlock}>
          <p className={styles.roleLead}>One thing, if you have a second.</p>
          <p className={styles.roleQ}>Which one are you?</p>
          <div className={styles.roleRow} role="group" aria-label="Which one are you?">
            {FATF_ROLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.roleBtn}
                onClick={() => saveRole(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.skip} onClick={skipRole}>
            Skip this
          </button>
        </div>
      ) : (
        <p className={styles.gotIt}>Got it, thank you.</p>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="fatf-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>For All The Fans</p>
          <h1 id="fatf-title" className={styles.headline}>
            One night a month, the room goes to them.
          </h1>
          <p className={styles.sub}>
            Every matchday in Dubai, a room fills with fans. The people who
            pour the drinks, park the cars, carry the plates and keep the doors
            never sit down. For All The Fans gives them the room.
          </p>
          {interested ? (
            reveal
          ) : (
            <>
              <InterestedButton pending={pending} onClick={onInterested} />
              <p className={styles.micro}>
                Free. One click. We tell you when the first night is set.
              </p>
            </>
          )}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className={styles.heroMedia}>
          <Image
            src="/fatf/hero.jpg"
            alt="Supporters at a table during a match."
            width={1280}
            height={720}
            className={styles.heroImage}
            priority
          />
        </div>
      </section>

      <section className={styles.idea} aria-labelledby="fatf-idea">
        <h2 id="fatf-idea" className={styles.h2}>
          The room nobody looks at.
        </h2>
        <p>
          A matchday only works because people are working through it. They
          hear the goal go in from the corridor. They watch the room celebrate
          and then clear the glasses. They are supporters too, and they almost
          never get to be one.
        </p>
        <p>
          For All The Fans takes one night a month and hands that room over.
          Same venue, same screens, same tables, same menu. The night is filmed
          and published as an episode that week.
        </p>
      </section>

      <section className={styles.how} aria-labelledby="fatf-how">
        <h2 id="fatf-how" className={styles.srOnly}>
          How a night works
        </h2>
        <ol className={styles.steps}>
          <li>
            <span className={styles.num} aria-hidden="true">
              01
            </span>
            <div>
              <p className={styles.stepTitle}>A venue gives the room.</p>
              <p>
                A partner venue opens for one night, with the screens on and the
                kitchen running.
              </p>
            </div>
          </li>
          <li>
            <span className={styles.num} aria-hidden="true">
              02
            </span>
            <div>
              <p className={styles.stepTitle}>
                A supporters club brings the atmosphere.
              </p>
              <p>
                A club fills the seats alongside the guests, so it feels like a
                matchday, not an event.
              </p>
            </div>
          </li>
          <li>
            <span className={styles.num} aria-hidden="true">
              03
            </span>
            <div>
              <p className={styles.stepTitle}>We film it and publish it.</p>
              <p>
                The night becomes an episode on The Reflective Football that
                same week.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.audience} aria-labelledby="fatf-who">
        <h2 id="fatf-who" className={styles.h2}>
          Three ways in.
        </h2>
        <div className={styles.ways}>
          <div>
            <h3 className={styles.h3}>If you work matchdays</h3>
            <p>
              Hospitality, security, drivers, delivery riders, retail and venue
              teams across Dubai. You do not need to explain anything or prove
              how much you love football. Register your interest and we tell
              you when a night is set.
            </p>
          </div>
          <div>
            <h3 className={styles.h3}>If you run a venue</h3>
            <p>
              You have the room, the screens and the night that is quietest on
              your calendar. We bring the film crew, the audience and the
              episode.
            </p>
          </div>
          <div>
            <h3 className={styles.h3}>If you run a supporters club</h3>
            <p>
              Your members already turn up for every kickoff. This is the night
              they turn up for someone else.
            </p>
          </div>
        </div>
        {interested ? (
          <p className={styles.quiet}>Your interest is registered.</p>
        ) : (
          <InterestedButton
            pending={pending}
            onClick={onInterested}
            variant="secondary"
          />
        )}
      </section>

      <section className={styles.promise} aria-labelledby="fatf-promise">
        <h2 id="fatf-promise" className={styles.h2}>
          How guests are treated.
        </h2>
        <ul className={styles.lines}>
          <li>As supporters and guests, not as a story.</li>
          <li>Same room, same view, same hospitality as every other table.</li>
          <li>Full details of the night before anyone commits to attending.</li>
          <li>
            A separate and clearly explained choice about appearing on camera.
          </li>
          <li>No speeches, no labels, no questions about anyone&apos;s circumstances.</li>
        </ul>
      </section>

      <section className={styles.close} aria-labelledby="fatf-close">
        <h2 id="fatf-close" className={styles.closeHeadline}>
          One game. One room. Everyone gets a seat.
        </h2>
        <p className={styles.closeSub}>
          Nothing is scheduled yet. Register your interest and you hear first
          when Night 01 is set.
        </p>
        {interested ? (
          <p className={styles.quiet}>Your interest is registered.</p>
        ) : (
          <InterestedButton pending={pending} onClick={onInterested} />
        )}
        <p className={styles.consentNote}>
          {FATF_CONSENT_LINE}{" "}
          <Link href="/privacy">Privacy notice</Link>.
        </p>
      </section>
    </div>
  );
}
