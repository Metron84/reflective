/** Canonical Media Training terms shown on /training and recorded in notify email. */
export const TRAINING_TERMS = [
  "The course fee is AED 2,500 for the founding cohort, payable in full before the first session.",
  "The course runs for one month: three online sessions and one weekend live shoot in Dubai.",
  "Cohorts are capped at four participants and a seat is only held once payment is received.",
  "Transport to and from the shoot is your own cost.",
  "On completion you receive a certificate of participation, a written reference letter and individual written feedback.",
  "The course is training and does not include an offer of employment.",
];

export function trainingTermsPlainText() {
  return TRAINING_TERMS.join("\n");
}
