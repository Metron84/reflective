/** Lowercase, strip accents, hyphens/slashes to spaces, drop punctuation, collapse spaces, drop a leading "the". */
export function normalize(input) {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-/‐-―]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.replace(/^the\s+/, "");
}

export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0 for 4 chars or fewer, 1 for 5 to 8, 2 for 9 or more. */
export function tolerance(accepted) {
  const n = accepted.length;
  if (n <= 4) return 0;
  if (n <= 8) return 1;
  return 2;
}

function containsPhrase(input, phrase) {
  if (!phrase) return false;
  return ` ${input} `.includes(` ${phrase} `);
}

function fuzzyMatches(input, accepted) {
  for (const raw of accepted) {
    const a = normalize(raw);
    if (!a) continue;
    if (input === a || containsPhrase(input, a)) return true;
    if (editDistance(input, a) <= tolerance(a)) return true;
  }
  return false;
}

function strictMatches(input, accepted) {
  for (const raw of accepted) {
    const a = normalize(raw);
    if (!a) continue;
    if (input === a || input === `in ${a}`) return true;
  }
  return false;
}

function groupsMatched(input, groups, required) {
  const cleaned = input
    .split(" ")
    .filter((t) => t !== "and")
    .join(" ");
  const tokens = cleaned.split(" ").filter(Boolean);
  let count = 0;
  for (const group of groups) {
    const hit = group.some((raw) => {
      const a = normalize(raw);
      if (!a) return false;
      if (containsPhrase(cleaned, a)) return true;
      // single-word alias: allow per-token typo tolerance
      if (!a.includes(" ")) {
        return tokens.some((t) => editDistance(t, a) <= tolerance(a));
      }
      return editDistance(cleaned, a) <= tolerance(a);
    });
    if (hit) count++;
  }
  return count >= required;
}

/** Pure answer check. `raw` is the player's text; `spec` carries matchMode and acceptedAnswers or answerGroups. */
export function isCorrect(raw, spec) {
  // "&" and "," separate names; replace before normalize drops them
  const input = normalize(raw.replace(/[&,]/g, " "));
  if (!input) return false;
  if (spec.answerGroups?.length) {
    return groupsMatched(input, spec.answerGroups, spec.requiredCount ?? spec.answerGroups.length);
  }
  const accepted = spec.acceptedAnswers ?? [];
  return spec.matchMode === "strict" ? strictMatches(input, accepted) : fuzzyMatches(input, accepted);
}
