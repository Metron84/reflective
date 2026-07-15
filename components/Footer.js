import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-navy/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-navy/70 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-base text-navy">The Reflective Football</p>
          <p className="mt-1">Football is nothing without the fans.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href="https://www.youtube.com/@TheReflectiveFootball"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-navy"
          >
            YouTube
          </a>
          <a
            href="https://www.instagram.com/thereflectivefootball"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-navy"
          >
            Instagram
          </a>
          <Link href="/about" className="transition-colors hover:text-navy">
            About
          </Link>
          <a
            href="mailto:melo@thereflectivefootball.com"
            className="transition-colors hover:text-navy"
          >
            Contact
          </a>
          <Link href="/privacy" className="transition-colors hover:text-navy">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
