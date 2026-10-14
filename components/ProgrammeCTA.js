import { PROGRAMME_COPY } from "@/lib/programme/copy";
import { ACCOUNT_PATH, programmeSignInHref } from "@/lib/programme/links";
import styles from "./ProgrammeCTA.module.css";

/**
 * The end-of-game prompt shared by every game that has a Programme result.
 *
 * Signed out: keep the score by starting a Programme. The sign-in goes through the claim step
 * (lib/claim), which saves what the player just earned, then lands on /account.
 * Signed in: the score is saved, with a way to see it.
 *
 * @param {{
 *   signedIn: boolean,
 *   tone?: "light"|"dark",
 *   claim?: boolean,
 *   signInHref?: string,
 *   signInOrigin?: string,
 *   accountOrigin?: string,
 *   onStart?: () => void,
 *   className?: string,
 * }} props
 *   tone "light" is for cream backgrounds (navy text), "dark" for navy or coloured ones.
 *   claim false skips the claim step, for a game with nothing to claim.
 *   signInHref overrides the whole sign-up link, for a host that keeps its own sign-in.
 *   onStart runs before the browser leaves, for a game that must park its result first.
 */
export default function ProgrammeCTA({
  signedIn,
  tone = "dark",
  claim = true,
  signInHref,
  signInOrigin = "",
  accountOrigin = "",
  onStart,
  className = "",
}) {
  const href = signedIn
    ? `${accountOrigin}${ACCOUNT_PATH}`
    : (signInHref ?? programmeSignInHref({ claim, origin: signInOrigin }));

  return (
    <aside
      className={`${styles.cta} ${tone === "light" ? styles.light : styles.dark} ${className}`}
      aria-label="Your Programme"
    >
      <p className={styles.line}>
        {signedIn ? PROGRAMME_COPY.signedInLine : PROGRAMME_COPY.signedOutLine}
      </p>
      <a href={href} className={styles.button} onClick={signedIn ? undefined : onStart}>
        {signedIn ? PROGRAMME_COPY.signedInButton : PROGRAMME_COPY.signedOutButton}
      </a>
    </aside>
  );
}
