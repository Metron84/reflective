"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_SECTIONS, WORK_WITH_US_HREF } from "@/lib/config";
import MobileMenu from "./MobileMenu";

function isActiveSection(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <div className="relative hidden lg:block" ref={ref}>
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
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="max-w-[55vw] truncate font-display text-base tracking-wide text-navy sm:max-w-none sm:text-lg"
        >
          The Reflective Football
        </Link>
        <nav className="flex items-center gap-4 text-sm lg:gap-5">
          <div className="hidden items-center gap-5 lg:flex">
            {SITE_SECTIONS.map((item) => {
              const active = isActiveSection(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative py-1 text-navy/70 transition-[color,opacity,transform] duration-100 hover:text-navy active:scale-[0.98] active:opacity-75 motion-reduce:active:scale-100 ${
                    active ? "text-navy" : ""
                  }`}
                >
                  {item.label}
                  {active ? (
                    <span
                      className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-signal"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
            <a
              href={WORK_WITH_US_HREF}
              className="text-navy/55 transition-colors hover:text-navy"
            >
              Work With Us
            </a>
          </div>
          {signedIn ? (
            <UserMenu profile={auth.profile} />
          ) : (
            <Link
              href="/signin"
              className="hidden rounded-full bg-signal px-4 py-1.5 text-sm font-medium text-paper transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.98] active:opacity-80 lg:block motion-reduce:active:scale-100"
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
