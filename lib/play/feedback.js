/** Round counter text, for example "ROUND 2 OF 10". Capped at the last round once the game is full. */
export function roundLabel(answered, max) {
  return `ROUND ${Math.min(answered + 1, max)} OF ${max}`;
}

/** Streak after an answer: counts correct answers in a row, any miss or timeout resets it. */
export function nextStreak(streak, correct) {
  return correct ? streak + 1 : 0;
}

/** The "x2" badge appears from two correct in a row. */
export function streakBadge(streak) {
  return streak >= 2 ? `x${streak}` : null;
}

const GOLD = "#F5C451";
const CREAM = "#F2EDE4";

/** Deterministic confetti burst: same pieces every time, so render stays pure. */
export function confettiPieces(count = 28) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + ((i * 37) % 11) * 0.05;
    const dist = 90 + ((i * 53) % 80);
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist - 60),
      rot: (i * 97) % 360,
      color: i % 7 === 0 ? CREAM : GOLD,
      delay: (i % 5) * 20,
    };
  });
}
