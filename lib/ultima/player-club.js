/** Club line + muted loan label for every Ultima player surface. */

export function formatClubLine(player) {
  const club = player?.club || "-";
  if (player?.on_loan && player?.parent_club) {
    return `${club} · on loan from ${player.parent_club}`;
  }
  return club;
}

export function loanFromLine(player) {
  if (player?.on_loan && player?.parent_club) {
    return `on loan from ${player.parent_club}`;
  }
  return null;
}
