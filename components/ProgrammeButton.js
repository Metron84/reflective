import Link from "next/link";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/**
 * The Programme button in the site header, between the logo block and the menu icon.
 *
 * Signed out: a red "Join free" pill. Signed in: an outlined navy pill with a navy initials
 * circle and the member number, plus a red dot when Next up has something waiting.
 * The link itself is 44px tall for touch; the pill inside is drawn smaller.
 * Under 380px the signed-in pill shrinks to the initials circle so the logo text, the pill and
 * the menu icon never touch.
 *
 * @param {{signedIn: boolean, initials?: string, memberNumber?: string, pending?: boolean}} props
 */
export default function ProgrammeButton({ signedIn, initials = "", memberNumber = "", pending = false }) {
  if (!signedIn) {
    return (
      <Link
        prefetch={false}
        href="/account"
        aria-label="Join free"
        className={`flex h-11 shrink-0 items-center ${focusRing}`}
      >
        <span className="flex h-9 items-center whitespace-nowrap rounded-full bg-signal px-3 text-sm font-medium leading-none text-paper min-[380px]:px-4">
          Join free
        </span>
      </Link>
    );
  }

  return (
    <Link
      prefetch={false}
      href="/account"
      aria-label="My Programme"
      className={`relative flex h-11 shrink-0 items-center ${focusRing}`}
    >
      <span className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-navy p-[3px] text-sm font-medium leading-none text-navy min-[380px]:pr-3">
        <span
          aria-hidden="true"
          className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-medium uppercase tracking-wide text-paper"
        >
          {initials}
        </span>
        <span className="hidden min-[380px]:inline">{memberNumber}</span>
      </span>
      {pending ? (
        <span
          aria-hidden="true"
          data-testid="programme-dot"
          className="absolute right-0 top-1 h-3 w-3 rounded-full bg-signal ring-2 ring-paper"
        />
      ) : null}
    </Link>
  );
}
