/**
 * Same-tab sign-up URL for the matched club.
 *
 * @param {string} clubId
 */
export function crestSignupHref(clubId) {
  const params = new URLSearchParams({
    from: "crest",
    club: clubId,
    next: "/crest",
  });
  return `/signin?${params.toString()}`;
}
