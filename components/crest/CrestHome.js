"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CLUBS, CREST_GROUP_LABEL, CREST_GROUPS } from "@/lib/crest/clubs";
import styles from "./CrestHome.module.css";

const SCOPE_KEY = "crest:scope";

/**
 * @param {string|null} group
 */
export function readStoredScope() {
  try {
    const saved = window.localStorage.getItem(SCOPE_KEY);
    if (!saved || saved === "everywhere") return null;
    return CREST_GROUPS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null} group
 */
export function writeStoredScope(group) {
  try {
    window.localStorage.setItem(SCOPE_KEY, group || "everywhere");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Opening screen. Scope lives in the parent; this screen starts play
 * and opens the league sheet.
 *
 * @param {{
 *   group: string|null,
 *   onScope: (group: string|null) => void,
 *   onStart: () => void,
 *   onOpenSaved?: () => void,
 *   saved?: {clubName: string, roomPct: number, clubColor?: string}|null,
 *   backHref?: string|null,
 * }} props
 */
export default function CrestHome({
  group,
  onScope,
  onStart,
  onOpenSaved,
  saved = null,
  backHref = "/games",
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hint, setHint] = useState(0);
  const tapped = useRef(false);
  const chipRef = useRef(null);
  const counts = {
    all: CLUBS.length,
    ...Object.fromEntries(CREST_GROUPS.map((g) => [g, CLUBS.filter((c) => c.group === g).length])),
  };

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;
    const first = window.setTimeout(() => {
      if (!tapped.current) setHint(1);
    }, 800);
    const second = window.setTimeout(() => {
      if (!tapped.current) setHint(2);
    }, 800 + 1600 + 8000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  function markTap() {
    tapped.current = true;
    setHint(0);
  }

  function start() {
    markTap();
    onStart();
  }

  function openSheet() {
    markTap();
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    window.requestAnimationFrame(() => chipRef.current?.focus());
  }

  const scopeName = group ? CREST_GROUP_LABEL[group] : "everywhere";

  return (
    <div className={styles.home}>
      <Road />
      <header className={styles.topbar}>
        {backHref ? (
          <Link href={backHref} className={styles.back} aria-label="Back to games">
            <ArrowLeft />
          </Link>
        ) : (
          <span />
        )}
        <span className={styles.brand}>The Crest</span>
      </header>

      <div className={styles.layout}>
        <div className={styles.copy}>
          <h1 className={styles.headline}>Eighteen swipes. One club that sounds like you.</h1>
          <p className={styles.subline}>{CLUBS.length} clubs. Two minutes.</p>
        </div>

        <button type="button" className={styles.stack} onClick={start} data-hint={hint || undefined}>
          <span className={`${styles.card} ${styles.backTwo}`} aria-hidden="true" />
          <span className={`${styles.card} ${styles.backOne}`} aria-hidden="true" />
          <span key={hint} className={`${styles.card} ${styles.front}`}>
            <span className={styles.cardKicker}>Card 1 of 18</span>
            <span className={styles.cardQuestion}>Living is about fun, or work?</span>
            <span className={styles.cardRow}>
              <span className={styles.cardLeft}>
                <ArrowOut left />
                Fun
              </span>
              <span className={styles.cardRight}>
                Work
                <ArrowOut />
              </span>
            </span>
          </span>
        </button>

        {saved ? (
          <div className={styles.saved} style={{ "--club": saved.clubColor || "#D8232A" }}>
            <p className={styles.savedKicker}>Your club</p>
            <p className={styles.savedName}>{saved.clubName}</p>
            <p className={styles.savedPct}>{saved.roomPct}% of the last room</p>
            <div className={styles.savedRow}>
              <button type="button" className={styles.savedOpen} onClick={onOpenSaved}>
                Open
              </button>
              <button type="button" className={styles.savedAgain} onClick={start}>
                Swipe again
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.cta}>
          <button type="button" className={styles.primary} onClick={start}>
            {saved ? "Find another club" : "Find my club"}
          </button>
          <button
            ref={chipRef}
            type="button"
            className={styles.chip}
            onClick={openSheet}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
          >
            Searching {scopeName} · <span>Change</span>
          </button>
          <p className={styles.voices}>How each club sees itself, and how the game sees it.</p>
        </div>
      </div>

      <ScopeSheet
        open={sheetOpen}
        group={group}
        counts={counts}
        onScope={onScope}
        onClose={closeSheet}
      />
    </div>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   group: string|null,
 *   onScope: (group: string|null) => void,
 *   onClose: () => void,
 * }} props
 */
function ScopeSheet({ open, group, counts, onScope, onClose }) {
  const dialogRef = useRef(null);
  const drag = useRef({ y: 0, active: false });
  const [offset, setOffset] = useState(0);
  const legendId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  function pick(next) {
    onScope(next);
  }

  function onDialogClick(event) {
    if (event.target === dialogRef.current) onClose();
  }

  function onHandleDown(event) {
    drag.current = { y: event.clientY, active: true };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandleMove(event) {
    if (!drag.current.active) return;
    setOffset(Math.max(0, event.clientY - drag.current.y));
  }

  function onHandleUp() {
    const dy = offset;
    drag.current.active = false;
    setOffset(0);
    if (dy > 80) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={legendId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onDialogClick}
    >
      <div
        className={styles.sheetInner}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.handle}
          aria-label="Close"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        />
        <h2 id={legendId} className={styles.sheetTitle}>
          Where should we look?
        </h2>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Country</legend>
          <ScopeRow
            checked={!group}
            label="Everywhere"
            count={counts.all}
            onPick={() => pick(null)}
          />
          {CREST_GROUPS.map((g) => (
            <ScopeRow
              key={g}
              checked={group === g}
              label={CREST_GROUP_LABEL[g]}
              count={counts[g]}
              onPick={() => pick(g)}
            />
          ))}
        </fieldset>
        <button type="button" className={styles.done} onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}

function ScopeRow({ checked, label, count, onPick }) {
  const id = useId();
  return (
    <label className={`${styles.row} ${checked ? styles.rowOn : ""}`} htmlFor={id}>
      <input
        id={id}
        type="radio"
        name="crest-scope"
        checked={checked}
        onChange={onPick}
      />
      <span className={styles.rowName}>{label}</span>
      {checked ? <Check /> : null}
      <span className={styles.rowCount}>{count} clubs</span>
    </label>
  );
}

function Road() {
  return (
    <svg className={styles.road} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="crest-horizon" cx="50%" cy="38%" r="40%">
          <stop offset="0" stopColor="#1B2742" stopOpacity="0.6" />
          <stop offset="1" stopColor="#1B2742" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="844" fill="url(#crest-horizon)" />
      <path d="M-20 844 L195 300" fill="none" stroke="#F2EDE4" strokeOpacity="0.06" strokeWidth="1" />
      <path d="M410 844 L195 300" fill="none" stroke="#F2EDE4" strokeOpacity="0.06" strokeWidth="1" />
    </svg>
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

function ArrowOut({ left = false }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      {left ? (
        <path d="M7.5 2.5 3.5 6l4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M4.5 2.5 8.5 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Check() {
  return (
    <svg className={styles.check} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.2 6.4 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
