import Link from "next/link";
import { headers } from "next/headers";
import { TRAINING_ENABLED } from "@/lib/config";
import { hubUrl } from "@/lib/hosts";
import { DOORS, LINKEDIN, SOCIALS } from "@/lib/nav";
import { SOCIAL_ICONS } from "./nav/SocialIcons";

const footerLink =
  "inline-flex min-h-[2rem] items-center text-sm text-paper transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const emailLink =
  "inline-flex min-h-[2rem] items-center break-words text-xs text-paper transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:text-sm";

const columnHeading =
  "text-xs font-medium uppercase tracking-widest text-paper/50";

const MAIL = "partnerships@thereflectivefootball.com";

export default async function SiteFooter() {
  const host = (await headers()).get("host") ?? "";
  const to = (path) => hubUrl(path, host);
  const workWithUs = [
    {
      label: "For Venues",
      href: `mailto:${MAIL}?subject=Venue%20Partnership`,
    },
    {
      label: "For Brands & Sponsors",
      href: `mailto:${MAIL}?subject=Brand%20%26%20Sponsor%20Inquiry`,
    },
    {
      label: "Press & Licensing",
      href: "mailto:press@thereflectivefootball.com?subject=Press%20%26%20Licensing",
    },
    ...(TRAINING_ENABLED ? [{ label: "Training", href: to("/training") }] : []),
  ];

  const watch = [
    { label: "Films", href: to("/films") },
    ...SOCIALS.map(({ label, href }) => ({ label, href, external: true })),
  ];

  return (
    <>
      <div className="border-t border-navy/10 bg-paper">
        <div className="mx-auto flex max-w-6xl justify-center px-4 sm:px-6">
          <a
            href="#"
            className="inline-flex min-h-12 items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-navy transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Back to top <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    <footer className="border-t border-paper/15 bg-navy text-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mb-10 flex flex-col gap-3 lg:mb-12">
          <p className="font-display text-xl uppercase leading-tight tracking-wide sm:text-2xl">
            The Reflective Football
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-paper/75">
            Football is nothing without the fans.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 lg:grid-cols-[1fr_1fr_1fr_1.6fr] lg:gap-8">
          <nav aria-label="Take part" className="flex flex-col gap-3">
            <p className={columnHeading}>Take part</p>
            <ul className="flex flex-col gap-1">
              {DOORS.map((door) => (
                <li key={door.key}>
                  <Link href={to(door.href)} className={footerLink}>
                    {door.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Watch" className="flex flex-col gap-3">
            <p className={columnHeading}>Watch</p>
            <ul className="flex flex-col gap-1">
              {watch.map((item) => (
                <li key={item.label}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={footerLink}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} className={footerLink}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Work with us" className="flex flex-col gap-3">
            <p className={columnHeading}>Work With Us</p>
            <ul className="flex flex-col gap-1">
              {workWithUs.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("/") ? (
                    <Link href={item.href} className={footerLink}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className={footerLink}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <p className={columnHeading}>Contact</p>
            <ul className="flex flex-col gap-1">
              <li>
                <a
                  href="mailto:info@thereflectivefootball.com"
                  className={emailLink}
                >
                  info@thereflectivefootball.com
                </a>
              </li>
              <li>
                <a href={`mailto:${MAIL}`} className={emailLink}>
                  {MAIL}
                </a>
              </li>
            </ul>
            <div className="mt-1 flex items-center gap-4">
              {[...SOCIALS, LINKEDIN].map((social) => {
                const Icon = SOCIAL_ICONS[social.key];
                return (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="text-paper transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-paper/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-paper/45">
            © 2026 The Reflective Football LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href={to("/privacy")}
              className="text-xs text-paper/45 transition-colors hover:text-signal"
            >
              Privacy
            </Link>
            <Link
              href={to("/terms")}
              className="text-xs text-paper/45 transition-colors hover:text-signal"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
