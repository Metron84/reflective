"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import styles from "./ultima.module.css";

const PRIMARY = [
  { href: "/ultima", label: "Hub", icon: HubIcon },
  { href: "/ultima/draft", label: "Draft", icon: DraftIcon },
  { href: "/ultima/squad", label: "Squad", icon: SquadIcon },
  { href: "/ultima/standings", label: "Table", icon: TableIcon },
];

const MORE = [
  { href: "/ultima/market", label: "Market", icon: MarketIcon },
  { href: "/ultima/trades", label: "Trades", icon: TradesIcon },
  { href: "/ultima/practice", label: "Practice", icon: PracticeIcon },
];

const DESKTOP = [
  ...PRIMARY,
  ...MORE,
];

const CRUMB_LABELS = {
  "/ultima": "Ultima",
  "/ultima/draft": "Draft",
  "/ultima/squad": "Squad",
  "/ultima/standings": "Table",
  "/ultima/market": "Market",
  "/ultima/trades": "Trades",
  "/ultima/practice": "Practice",
  "/ultima/admin": "Admin",
  "/ultima/rules": "Rules",
  "/ultima/join": "Join",
  "/ultima/profile": "Profile",
  "/ultima/log": "Log",
};

function hideRail(pathname) {
  if (pathname === "/ultima/draft" || pathname.startsWith("/ultima/draft/")) return true;
  if (pathname.startsWith("/ultima/join")) return true;
  if (/^\/ultima\/practice\/[A-Z0-9]{4}/i.test(pathname)) return true;
  return false;
}

function hideBreadcrumb(pathname) {
  if (pathname === "/ultima/draft" || pathname.startsWith("/ultima/draft/")) return true;
  if (/^\/ultima\/practice\/[A-Z0-9]{4}/i.test(pathname)) return true;
  return false;
}

function isActive(pathname, href) {
  if (href === "/ultima") return pathname === "/ultima";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbsFor(pathname) {
  if (pathname === "/ultima") {
    return [
      { label: "Home", href: "/" },
      { label: "Ultima" },
    ];
  }

  const tradeMatch = pathname.match(/^\/ultima\/trades\/([^/]+)/);
  if (tradeMatch) {
    return [
      { label: "Ultima", href: "/ultima" },
      { label: "Trades", href: "/ultima/trades" },
      { label: "Trade" },
    ];
  }

  const joinMatch = pathname.match(/^\/ultima\/join(\/|$)/);
  if (joinMatch) {
    return [
      { label: "Ultima", href: "/ultima" },
      { label: "Join" },
    ];
  }

  const base = Object.keys(CRUMB_LABELS)
    .filter((href) => href !== "/ultima")
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));

  if (base) {
    return [
      { label: "Ultima", href: "/ultima" },
      { label: CRUMB_LABELS[base] },
    ];
  }

  return [
    { label: "Ultima", href: "/ultima" },
    { label: "Ultima" },
  ];
}

export default function UltimaShell({ manager, isCommissioner, children }) {
  const pathname = usePathname() ?? "";
  const showRail = Boolean(manager) && !hideRail(pathname);
  const showCrumb = !hideBreadcrumb(pathname);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("ultima-root");
    return () => document.body.classList.remove("ultima-root");
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreItems = [
    ...MORE,
    ...(isCommissioner
      ? [{ href: "/ultima/admin", label: "Admin", icon: AdminIcon }]
      : []),
  ];

  const desktopItems = [
    ...DESKTOP,
    ...(isCommissioner
      ? [{ href: "/ultima/admin", label: "Admin", icon: AdminIcon }]
      : []),
  ];

  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <div className={styles.ultimaRoot}>
      {showCrumb ? <Breadcrumb items={crumbsFor(pathname)} /> : null}

      <div className={showRail ? styles.shell : undefined}>
        {showRail ? (
          <>
            <nav className={`${styles.rail} ${styles.railDesktop}`} aria-label="Ultima">
              {desktopItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? styles.railLinkActive : styles.railLink}
                    title={item.label}
                  >
                    <Icon />
                    <span className={styles.railLabel}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <nav className={`${styles.rail} ${styles.railMobile}`} aria-label="Ultima">
              {PRIMARY.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? styles.railLinkActive : styles.railLink}
                    title={item.label}
                  >
                    <Icon />
                    <span className={styles.railLabel}>{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                className={moreActive || moreOpen ? styles.railLinkActive : styles.railLink}
                aria-expanded={moreOpen}
                aria-label="More"
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreIcon />
                <span className={styles.railLabel}>More</span>
              </button>
            </nav>
          </>
        ) : null}

        <div className={showRail ? styles.shellMain : undefined}>{children}</div>
      </div>

      {moreOpen ? (
        <div className={styles.moreSheet} role="dialog" aria-modal="true" aria-label="More">
          <div
            className={styles.moreBackdrop}
            aria-hidden
            onClick={() => setMoreOpen(false)}
          />
          <div className={styles.morePanel}>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? styles.moreItemActive : styles.moreItem}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M12 3.2 4 9.4V20h6.2v-6.2h3.6V20H20V9.4L12 3.2Z" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h14v2H5v-2Z" />
    </svg>
  );
}

function SquadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm-7.2 7.6c.4-3.2 3.4-5.4 7.2-5.4s6.8 2.2 7.2 5.4H4.8Z"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M4 5h16v14H4V5Zm2 2v3h12V7H6Zm0 5v5h5v-5H6Zm7 0v5h5v-5h-5Z" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M4 6h16l-1.4 10.2H5.4L4 6Zm3.2 12.4h9.6V20H7.2v-1.6Z" />
    </svg>
  );
}

function TradesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M7 7h7.2L12.4 5.2 14 3.6 20 9l-6 5.4-1.6-1.6L14.2 11H7V7Zm10 10H9.8l1.8 1.8L10 20.4 4 15l6-5.4 1.6 1.6L9.8 13H17v4Z"
      />
    </svg>
  );
}

function PracticeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path fill="currentColor" d="M8 5.2 19 12 8 18.8V5.2Z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.8 14.4 8l5.6.6-4.2 3.8 1.2 5.5L12 15.6 6.9 17.9l1.2-5.5L4 8.6 9.6 8 12 2.8Z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
