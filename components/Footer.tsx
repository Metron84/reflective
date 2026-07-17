import Link from "next/link";

const footerLink =
  "text-sm text-paper transition-colors hover:text-signal";

const socialLink =
  "text-paper transition-colors hover:text-signal";

function InstagramIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YouTubeIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.8 8.001a2.5 2.5 0 0 0-1.76-1.765C18.12 6 12 6 12 6s-6.12 0-8.04.236A2.5 2.5 0 0 0 2.2 8.001 26.3 26.3 0 0 0 2 12a26.3 26.3 0 0 0 .2 3.999 2.5 2.5 0 0 0 1.76 1.765C5.88 18 12 18 12 18s6.12 0 8.04-.236a2.5 2.5 0 0 0 1.76-1.765A26.3 26.3 0 0 0 22 12a26.3 26.3 0 0 0-.2-3.999ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  );
}

function LinkedInIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.98 3.5a1.75 1.75 0 1 1-.02 3.5 1.75 1.75 0 0 1 .02-3.5ZM3.5 8.75h2.96V20.5H3.5V8.75Zm5.32 0H11.7v1.59h.04c.45-.86 1.55-1.77 3.19-1.77 3.41 0 4.04 2.24 4.04 5.16V20.5h-2.96v-5.84c0-1.39-.03-3.18-1.94-3.18-1.94 0-2.24 1.52-2.24 3.09V20.5H8.82V8.75Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-navy text-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col gap-3">
            <p className="font-display text-xl leading-tight tracking-wide sm:text-2xl">
              The Reflective Football
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-paper/75">
              Football is nothing without the fans.
            </p>
            <p className="text-xs text-paper/45">The Reflective Football LLC</p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-paper/50">
              Watch
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/films"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  Episodes
                </Link>
              </li>
              <li>
                <Link
                  href="/films"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  We Are Football
                </Link>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/@TheReflectiveFootball"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  YouTube
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-paper/50">
              Work With Us
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="mailto:partnerships@thereflectivefootball.com?subject=Venue%20Partnership"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  For Venues
                </a>
              </li>
              <li>
                <a
                  href="mailto:partnerships@thereflectivefootball.com?subject=Brand%20%26%20Sponsor%20Inquiry"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  For Brands &amp; Sponsors
                </a>
              </li>
              <li>
                <a
                  href="mailto:press@thereflectivefootball.com?subject=Press%20%26%20Licensing"
                  className="text-sm text-paper transition-colors hover:text-signal"
                >
                  Press &amp; Licensing
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-paper/50">
              Contact
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <a href="mailto:info@thereflectivefootball.com" className={footerLink}>
                  info@thereflectivefootball.com
                </a>
              </li>
              <li>
                <a
                  href="mailto:partnerships@thereflectivefootball.com"
                  className={footerLink}
                >
                  partnerships@thereflectivefootball.com
                </a>
              </li>
            </ul>
            <div className="mt-1 flex items-center gap-4">
              <a
                href="https://www.instagram.com/thereflectivefootball"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLink}
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.youtube.com/@TheReflectiveFootball"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLink}
                aria-label="YouTube"
              >
                <YouTubeIcon />
              </a>
              <a
                href="https://www.linkedin.com/company/thereflectivefootball"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLink}
                aria-label="LinkedIn"
              >
                <LinkedInIcon />
              </a>
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
            <Link href="/privacy" className="text-xs text-paper/45 transition-colors hover:text-signal">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-paper/45 transition-colors hover:text-signal">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
