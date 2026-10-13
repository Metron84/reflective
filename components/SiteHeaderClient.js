"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DOORS, PARTNERS, SOCIALS, isActivePath } from "@/lib/nav";
import { SOCIAL_ICONS } from "./nav/SocialIcons";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function Wordmark({ tone = "navy", onClick }) {
  return (
    <Link
      prefetch={false}
      href="/"
      onClick={onClick}
      className={`flex items-center gap-2.5 ${focusRing}`}
      aria-label="The Reflective Football, home"
    >
      <Image
        src="/brand/trf-crest-transparent.png"
        alt=""
        width={32}
        height={32}
        priority
        className="h-8 w-8 shrink-0"
      />
      <span
        className={`font-display text-sm uppercase leading-none tracking-wide sm:text-base ${
          tone === "cream" ? "text-paper" : "text-navy"
        }`}
      >
        The Reflective
        <br className="sm:hidden" /> Football
      </span>
    </Link>
  );
}

function SocialIconLinks({ tone = "navy", className = "" }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {SOCIALS.map((social) => {
        const Icon = SOCIAL_ICONS[social.key];
        return (
          <a
            key={social.key}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className={`flex h-11 w-11 items-center justify-center transition-colors ${focusRing} ${
              tone === "cream"
                ? "text-paper hover:text-paper/70"
                : "text-navy hover:text-signal"
            }`}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}

function UserMenu({ profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = profile?.preferred_name ?? "Account";
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    function onDocClick(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-full border border-navy/25 py-1.5 pl-1.5 pr-4 text-navy/90 transition-colors hover:border-navy/60 hover:text-navy ${focusRing}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-medium text-paper">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate text-sm">{name}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] border border-navy/10 bg-paper py-1 shadow-lg"
        >
          <Link
            prefetch={false}
            href="/account"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-navy/80 transition-colors hover:bg-navy/5 hover:text-navy"
            onClick={() => setOpen(false)}
          >
            My Programme
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm text-navy/80 transition-colors hover:bg-navy/5 hover:text-navy"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuSheet({ onClose, auth, pathname }) {
  const signedIn = auth?.isSignedIn && auth?.profile;
  const name = auth?.profile?.preferred_name ?? "Account";
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-y-auto bg-navy lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-paper/10 px-4">
        <Wordmark tone="cream" onClick={onClose} />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`flex h-11 w-11 items-center justify-center text-3xl leading-none text-paper/80 ${focusRing}`}
          aria-label="Close menu"
        >
          ×
        </button>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col justify-center">
        <ul>
          {DOORS.map((door) => {
            const active = isActivePath(pathname, door.href);
            return (
              <li key={door.key} className="border-b border-paper/10">
                <Link
                  prefetch={false}
                  href={door.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[4.5rem] items-center justify-between px-6 font-display text-3xl uppercase tracking-wide text-paper transition-opacity active:opacity-70 ${focusRing}`}
                >
                  <span className="relative">
                    {door.label}
                    {active ? (
                      <span
                        className="absolute inset-x-0 -bottom-1 h-0.5 bg-signal"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="text-xl text-paper/50" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 space-y-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SocialIconLinks tone="cream" className="-ml-3" />
        {signedIn ? (
          <div className="space-y-3">
            <Link
              prefetch={false}
              href="/account"
              onClick={onClose}
              className={`block rounded-full border border-paper/30 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60 ${focusRing}`}
            >
              My Programme
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className={`block w-full rounded-full py-3 text-center text-sm text-paper/70 ${focusRing}`}
              >
                Sign out ({name})
              </button>
            </form>
          </div>
        ) : (
          <Link
            prefetch={false}
            href="/signin"
            onClick={onClose}
            className={`block rounded-full border border-paper/30 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60 ${focusRing}`}
          >
            Sign in
          </Link>
        )}
        <a
          href={PARTNERS.href}
          className={`block rounded-full border-2 border-signal py-3 text-center text-sm font-semibold uppercase tracking-widest text-paper transition-colors hover:bg-signal ${focusRing}`}
        >
          {PARTNERS.label}
        </a>
      </div>
    </div>
  );
}

export default function SiteHeaderClient({ auth }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const signedIn = auth?.isSignedIn && auth?.profile;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (pathname === "/crest" || pathname.startsWith("/crest/")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <Wordmark />
        </div>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {DOORS.map((door) => {
            const active = isActivePath(pathname, door.href);
            return (
              <Link
                prefetch={false}
                key={door.key}
                href={door.href}
                aria-current={active ? "page" : undefined}
                className={`relative py-1 text-sm font-semibold uppercase tracking-widest transition-colors hover:text-navy ${focusRing} ${
                  active ? "text-navy" : "text-navy/70"
                }`}
              >
                {door.label}
                {active ? (
                  <span
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-signal"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end gap-1 lg:gap-3">
          <SocialIconLinks className="hidden lg:flex" />
          <div className="hidden lg:block">
            {signedIn ? (
              <UserMenu profile={auth.profile} />
            ) : (
              <Link
                prefetch={false}
                href="/signin"
                className={`px-2 py-2 text-sm font-semibold uppercase tracking-widest text-navy/80 transition-colors hover:text-navy ${focusRing}`}
              >
                Sign in
              </Link>
            )}
          </div>
          <a
            href={PARTNERS.href}
            className={`hidden rounded-full border-2 border-signal px-5 py-2 text-sm font-semibold uppercase tracking-widest text-navy transition-colors hover:bg-signal hover:text-paper lg:inline-block ${focusRing}`}
          >
            {PARTNERS.label}
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex h-11 w-11 flex-col items-center justify-center gap-1.5 lg:hidden ${focusRing}`}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <span className="block h-0.5 w-5 bg-navy" />
            <span className="block h-0.5 w-5 bg-navy" />
            <span className="block h-0.5 w-5 bg-navy" />
          </button>
        </div>
      </div>

      {open
        ? createPortal(
            <MenuSheet
              onClose={() => setOpen(false)}
              auth={auth}
              pathname={pathname}
            />,
            document.body,
          )
        : null}
    </header>
  );
}
