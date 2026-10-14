/**
 * The single best next action for a member, in priority order:
 * 1. today's counted quiz game is still open
 * 2. Crest leagues are still hidden
 * 3. Codemaster is in progress
 * 4. fallback: spin the wheel
 *
 * @param {{quizOpen: boolean, unrevealed: number, codemasterInProgress: boolean}} input
 * @returns {{key: string, title: string, cta: string, href: string, scrollTo?: string}}
 */
export function pickNextUp({ quizOpen, unrevealed, codemasterInProgress }) {
  if (quizOpen) {
    return { key: "quiz", title: "Your daily spin is still open", cta: "Spin", href: "/play" };
  }
  if (unrevealed > 0) {
    return {
      key: "crest",
      title:
        unrevealed === 1
          ? "1 league still hiding your club"
          : `${unrevealed} leagues still hiding your club`,
      cta: "Reveal",
      href: "#crest-tile",
      scrollTo: "crest-tile",
    };
  }
  if (codemasterInProgress) {
    return { key: "codemaster", title: "Your next code is waiting", cta: "Continue", href: "/codemaster" };
  }
  return { key: "fallback", title: "Spin the wheel", cta: "Spin", href: "/play" };
}
