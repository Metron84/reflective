import { cache } from "react";
import { isXiComplete } from "@/lib/ultima/lineup/slots";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { loadDraftContext } from "@/lib/ultima/server/draft";
import { getLineup } from "@/lib/ultima/server/lineup";
import { listHubTradeCards } from "@/lib/ultima/server/trades";
import { safeResolve } from "@/lib/ultima/server/safe";

const HUB = { label: "Go to hub", href: "/ultima" };

const draftClock = cache(async function draftClock(competitionId) {
  return safeResolve(loadDraftContext(competitionId, { includeAvailable: false }), null);
});

export function formatClubSeasonLine(seasonLabel, gameweekNumber) {
  const parts = [];
  if (seasonLabel) parts.push(seasonLabel);
  if (Number.isInteger(gameweekNumber) && gameweekNumber > 0) {
    parts.push(`Gameweek ${gameweekNumber}`);
  }
  return parts.join(" · ") || "Ultima";
}

export const resolveContinue = cache(async function resolveContinue(
  competitionId,
  managerId,
) {
  if (!competitionId || !managerId) return HUB;

  const ctx = await draftClock(competitionId);
  const draftState = ctx?.state?.state ?? "lobby";

  if (draftState === "live" && ctx?.onClock?.managerId === managerId) {
    return { label: "Make your pick", href: "/ultima/draft" };
  }

  const cards = await safeResolve(listHubTradeCards(competitionId, managerId), []);
  const open = (cards ?? []).find(
    (card) => (card.can_accept || (card.can_veto && !card.already_vetoed)),
  );
  if (open) {
    return { label: "Answer trade", href: `/ultima/trades/${open.id}` };
  }

  if (draftState === "complete") {
    const gameweek = await safeResolve(getCurrentGameweek(competitionId), null);
    if (gameweek?.id) {
      const lineup = await safeResolve(getLineup(managerId, gameweek.id), []);
      if (!isXiComplete(lineup)) {
        return { label: "Set your XV", href: "/ultima/squad" };
      }
    }
  }

  return HUB;
});

export const getClubBarContext = cache(async function getClubBarContext(userId) {
  if (!userId) return null;
  const manager = await getManagerForUser(userId);
  if (!manager) return null;

  const competition = await getActiveCompetition();
  const gameweek = competition
    ? await safeResolve(getCurrentGameweek(competition.id), null)
    : null;
  const continueAction = competition
    ? await resolveContinue(competition.id, manager.id)
    : HUB;
  const ctx = competition ? await draftClock(competition.id) : null;

  return {
    teamName: manager.team_name || "Ultima",
    colour: manager.colour,
    seasonLine: formatClubSeasonLine(
      competition?.season_label,
      gameweek?.number,
    ),
    continue: continueAction,
    draftLive: ctx?.state?.state === "live",
  };
});
