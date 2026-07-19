import Link from "next/link";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      {/* Plain img so the precached brand asset works without /_next/image when offline. */}
      <img
        src="/brand/trf-crest-transparent.png"
        alt="The Reflective Football"
        width={112}
        height={112}
        className="mb-8 h-28 w-28"
      />
      <h1 className="font-display text-3xl text-navy sm:text-4xl">
        You&apos;re offline
      </h1>
      <p className="mt-3 max-w-sm text-base text-navy/70">
        Reconnect to watch films, vote, and play The Guesser.
      </p>
      <Link
        href="/"
        className="mt-8 border border-navy bg-navy px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-navy/90 active:scale-[0.98]"
      >
        Try again
      </Link>
    </div>
  );
}
