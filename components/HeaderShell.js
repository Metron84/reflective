"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PRIMARY_NAV } from "@/lib/nav";
import MobileMenu from "./MobileMenu";

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
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-navy/25 py-1.5 pl-1.5 pr-4 text-navy/90 transition-colors hover:border-navy/60 hover:text-navy"
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

export default function HeaderShell({ auth }) {
  const signedIn = auth?.isSignedIn && auth?.profile;

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="max-w-[55vw] truncate font-display text-base tracking-wide text-navy sm:max-w-none sm:text-lg"
        >
          The Reflective Football
        </Link>
        <nav className="flex items-center gap-4 text-sm sm:gap-6">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-navy/70 transition-colors hover:text-navy sm:block"
            >
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <UserMenu profile={auth.profile} />
          ) : (
            <Link
              href="/signin"
              className="hidden rounded-full bg-signal px-4 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 sm:block"
            >
              Sign in
            </Link>
          )}
          <MobileMenu auth={auth} />
        </nav>
      </div>
    </header>
  );
}
