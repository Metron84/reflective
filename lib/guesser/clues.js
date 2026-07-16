// Clue ladder: 5 clues per person, hardest (1) to easiest (5).
// Clue 1 is always visible. Clues 2–5 unlock after each wrong
// guess (after guess 1 → clue 2, after guess 4 → clue 5).
// Reveals are optional taps tracked server-side.

export const CLUE_COUNT = 5;

/** Display labels for tap-to-reveal chips (clue 1 is The Opening). */
export const CLUE_CHIP_LABELS = {
  1: "The Opening",
  2: "Identity",
  3: "Career",
  4: "The Moment",
  5: "The Giveaway",
};

export function formatClueChipLabel(num) {
  const name = CLUE_CHIP_LABELS[num] ?? `Clue ${num}`;
  return `CLUE ${num} — ${name}`;
}

export const CLUE_OPENING_LABEL = formatClueChipLabel(1);

/** Highest clue number the player may tap to reveal (1 always shown). */
export function maxUnlockedClue(attempts, solved) {
  if (solved) return CLUE_COUNT;
  return Math.min(1 + attempts, CLUE_COUNT);
}

/** Clues 2–5 the player chose to reveal (clue 1 is auto, not counted). */
export function revealedClueCount(revealed = []) {
  return revealed.filter((n) => n >= 2 && n <= CLUE_COUNT).length;
}

export function shareClueSuffix(revealed = []) {
  const n = revealedClueCount(revealed);
  return n === 0 ? "no clues" : `${n} clue${n === 1 ? "" : "s"}`;
}

// Safe client payload: only clue 1 text plus chip states. Unrevealed
// clue text never ships until the player taps. No person_id included.
export function buildClueState(answer, game) {
  const clues = answer?.clues ?? [];
  const unlocked = maxUnlockedClue(game.attempts, game.solved);
  const revealed = game.revealedClues ?? [];

  return {
    opening: clues[0] ?? null,
    unlocked,
    chips: [2, 3, 4, 5].map((num) => {
      const idx = num - 1;
      const label = formatClueChipLabel(num);
      if (num > unlocked) {
        return { num, label, status: "locked" };
      }
      if (revealed.includes(num)) {
        return { num, label, status: "revealed", text: clues[idx] ?? null };
      }
      return { num, label, status: "unlocked" };
    }),
  };
}
