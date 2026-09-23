"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import UltimaClubBar from "./UltimaClubBar";
import styles from "./ultima.module.css";

const DESKTOP_NAV = [
  { href: "/ultima", label: "Hub", icon: HubIcon },
  { href: "/ultima/practice", label: "Pre-draft", icon: PracticeIcon },
  { href: "/ultima/draft", label: "Draft", icon: DraftIcon },
  { href: "/ultima/squad", label: "Squad", icon: SquadIcon },
  { href: "/ultima/standings", label: "Table", icon: TableIcon },
  { href: "/ultima/market", label: "Market", icon: MarketIcon },
  { href: "/ultima/trades", label: "Trade", icon: TradesIcon },
];

const CRUMB_LABELS = {
  "/ultima": "Ultima",
  "/ultima/draft": "Draft",
  "/ultima/squad": "Squad",
  "/ultima/standings": "Table",
  "/ultima/market": "Market",
  "/ultima/trades": "Trade",
  "/ultima/practice": "Pre-draft",
  "/ultima/admin": "Admin",
  "/ultima/rules": "Rules",
  "/ultima/join": "Join",
  "/ultima/profile": "Profile",
  "/ultima/log": "Log",
  "/ultima/sample": "SAMPLE",
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
  if (pathname === "/ultima/sample" || pathname.startsWith("/ultima/sample")) return true;
  return false;
}

function isSamplePath(pathname) {
  return pathname === "/ultima/sample" || pathname.startsWith("/ultima/sample");
}

function isPaperPath(pathname, seated) {
  if (pathname.startsWith("/ultima/join")) return true;
  if (pathname.startsWith("/ultima/rules") && !seated) return true;
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

function mobilePrimary(draftLive) {
  return [
    { href: "/ultima", label: "Hub", icon: HubIcon },
    { href: "/ultima/squad", label: "Squad", icon: SquadIcon },
    draftLive
      ? { href: "/ultima/draft", label: "Draft", icon: DraftIcon }
      : { href: "/ultima/market", label: "Market", icon: MarketIcon },
    { href: "/ultima/standings", label: "Table", icon: TableIcon },
  ];
}

function mobileMore({ draftLive, isCommissioner }) {
  const items = [
    { href: "/ultima/practice", label: "Pre-draft", icon: PracticeIcon },
    { href: "/ultima/draft", label: "Draft", icon: DraftIcon },
    draftLive ? { href: "/ultima/market", label: "Market", icon: MarketIcon } : null,
    { href: "/ultima/trades", label: "Trade", icon: TradesIcon },
    { href: "/ultima/rules", label: "Rules", icon: RulesIcon },
    { href: "/ultima/profile", label: "Profile", icon: ProfileIcon },
    { href: "/ultima/log", label: "Log", icon: LogIcon },
    isCommissioner ? { href: "/ultima/admin", label: "Admin", icon: AdminIcon } : null,
  ];
  return items.filter(Boolean);
}

export default function UltimaShell({
  manager,
  isCommissioner,
  teamColour,
  club = null,
  children,
}) {
  const pathname = usePathname() ?? "";
  const seated = Boolean(manager);
  const sample = isSamplePath(pathname);
  const office =
    ((seated || isCommissioner || sample) && !isPaperPath(pathname, seated)) || sample;
  const showRail = (seated || isCommissioner || sample) && !hideRail(pathname);
  const showCrumb = !office && !hideBreadcrumb(pathname);
  const barClub =
    club ??
    (office && showRail
      ? {
          teamName: sample ? "SAMPLE" : "Ultima",
          seasonLine: sample ? "Development" : "Commissioner",
          continue: { label: "Go to hub", href: "/ultima" },
        }
      : null);
  const draftLive = Boolean(club?.draftLive);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("ultima-root");
    if (office) document.body.classList.add("ultima-office");
    return () => {
      document.body.classList.remove("ultima-root", "ultima-office");
    };
  }, [office]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const desktopNav = [
    ...DESKTOP_NAV,
    ...(isCommissioner
      ? [{ href: "/ultima/admin", label: "Admin", icon: AdminIcon }]
      : []),
  ];
  const primary = mobilePrimary(draftLive);
  const moreItems = mobileMore({ draftLive, isCommissioner });
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <div
      className={office ? `${styles.ultimaRoot} ${styles.office}` : styles.ultimaRoot}
      style={office && teamColour ? { "--team": teamColour } : undefined}
    >
      {showCrumb ? <Breadcrumb items={crumbsFor(pathname)} /> : null}

      <div className={showRail ? styles.shell : undefined}>
        {showRail ? (
          <>
            <nav className={`${styles.rail} ${styles.railDesktop}`} aria-label="Ultima">
              {desktopNav.map((item) => {
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
              {primary.map((item) => {
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
                aria-controls="ultima-more"
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreIcon />
                <span className={styles.railLabel}>More</span>
              </button>
            </nav>
          </>
        ) : null}

        <div className={showRail ? styles.shellMain : undefined}>
          {office && showRail && barClub ? (
            <div className={styles.shellClub}>
              <UltimaClubBar
                teamName={barClub.teamName}
                seasonLine={barClub.seasonLine}
                continueAction={barClub.continue}
                sample={sample}
              />
            </div>
          ) : null}
          {children}
        </div>
      </div>

      {moreOpen && showRail ? (
        <div className={styles.moreSheet} id="ultima-more" role="dialog" aria-modal="true" aria-label="More">
          <div className={styles.moreBackdrop} onClick={() => setMoreOpen(false)} aria-hidden />
          <div className={styles.morePanel}>
            <p className={styles.moreHeading}>More</p>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? styles.moreLinkOn : styles.moreLink}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
            <button type="button" className={styles.moreClose} onClick={() => setMoreOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M4 20V9.2L12 3l8 6.2V20h-6.2v-6.4H10.2V20H4Zm2-1.6h2.6v-6.4h6.8V18.4H18V10L12 5.4 6 10v8.4Z"
      />
    </svg>
  );
}

function PracticeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M7 3.6h10a1.6 1.6 0 0 1 1.6 1.6v15.2H5.4V5.2A1.6 1.6 0 0 1 7 3.6Zm0 1.6v13.6h10V5.2H7Zm2 3.2h6V8.4H9v.4Zm0 3.2h6v-1.6H9v1.6Zm0 3.2h4V14H9v1.2Z"
      />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M5 5.2h2.2V7H5V5.2Zm4.2 0H19V7H9.2V5.2ZM5 10.4h2.2v1.8H5v-1.8Zm4.2 0H19v1.8H9.2v-1.8ZM5 15.6h2.2V17.4H5v-1.8Zm4.2 0H19v1.8H9.2v-1.8Z"
      />
    </svg>
  );
}

function SquadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M8.2 4.4 12 3.2l3.8 1.2 2.4 2.2v4.4c0 4.2-2.4 7.2-6.2 8.8-3.8-1.6-6.2-4.6-6.2-8.8V6.6l2.4-2.2Zm.6 1.8-1.2 1.1v3.7c0 3.2 1.7 5.5 4.4 6.8 2.7-1.3 4.4-3.6 4.4-6.8V7.3L15.2 6.2 12 5.2 8.8 6.2Z"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2 13.8 8h5.2l-4.2 3.2 1.6 5.2L12 13.8 7.6 16.4l1.6-5.2L5 8h5.2L12 3.2Z"
      />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M4 6.2 6.4 4h11.2L20 6.2V8H4V6.2ZM5.4 9.6h13.2V20H5.4V9.6Zm1.8 1.6v7.2h9.6v-7.2H7.2Z"
      />
    </svg>
  );
}

function TradesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M7.2 6.4h6.4l-1.6-1.6L13.4 3.4 20 9l-6.6 5.6-1.4-1.4 1.6-1.6H7.2V6.4Zm9.6 11.2H10.4l1.6 1.6-1.4 1.4L4 15l6.6-5.6 1.4 1.4-1.6 1.6h6.4v5.2Z"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2 18.4 6v5.2c0 4.2-2.8 7.2-6.4 8.6-3.6-1.4-6.4-4.4-6.4-8.6V6L12 3.2Zm0 1.8L7.2 7v4.2c0 3.2 2.1 5.6 4.8 6.8 2.7-1.2 4.8-3.6 4.8-6.8V7L12 5Z"
      />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 3.6h11.2v16.8H6.4V3.6Zm1.6 1.6v13.6h8V5.2H8Zm1.6 2h4.8V8.8H9.6V7.2Zm0 3.2h4.8v1.6H9.6v-1.6Z"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm-6.8 7.2c.4-3.2 3.4-5.2 6.8-5.2s6.4 2 6.8 5.2H5.2Z"
      />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 3.6h11.2v16.8H6.4V3.6Zm1.6 1.6v13.6h8V5.2H8Zm1.6 2.2h4.8v1.4H9.6V7.4Zm0 3h4.8v1.4H9.6v-1.4Zm0 3h3.2v1.4H9.6v-1.4Z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M6 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z"
      />
    </svg>
  );
}
