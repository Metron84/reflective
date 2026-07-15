"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PRIMARY_NAV } from "@/lib/nav";

function MenuOverlay({ onClose, auth }) {
  const signedIn = auth?.isSignedIn && auth?.profile;
  const name = auth?.profile?.preferred_name ?? "Account";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-navy sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <div className="flex h-16 items-center justify-between border-b border-paper/10 px-4">
        <span className="font-display text-lg text-paper">
          The Reflective Football
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center text-2xl text-paper/70"
          aria-label="Close menu"
        >
          ×
        </button>
      </div>
      <nav className="flex flex-1 flex-col justify-center gap-8 px-8">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="font-display text-3xl text-paper transition-opacity hover:opacity-80"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-3 border-t border-paper/10 p-6">
        {signedIn ? (
          <>
            <Link
              href="/account"
              onClick={onClose}
              className="block rounded-full border border-paper/30 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
            >
              My Programme
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="block w-full rounded-full border border-paper/20 py-3 text-center text-sm text-paper/70"
              >
                Sign out ({name})
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/signin"
            onClick={onClose}
            className="block rounded-full border border-paper/30 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MobileMenu({ auth = null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 sm:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <span className="block h-0.5 w-5 bg-navy" />
        <span className="block h-0.5 w-5 bg-navy" />
        <span className="block h-0.5 w-5 bg-navy" />
      </button>

      {mounted && open
        ? createPortal(
            <MenuOverlay onClose={() => setOpen(false)} auth={auth} />,
            document.body
          )
        : null}
    </>
  );
}
