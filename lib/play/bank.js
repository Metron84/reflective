import raw from "@/data/play/questions.json";

/** The full question bank, answers included. Import from API routes only, never from a client component. */
export const QUESTIONS = raw;

export function answerSeconds() {
  const n = Number(process.env.ANSWER_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 45;
}
