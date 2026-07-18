import { formatMemberNumber } from "@/lib/auth/config";
import {
  buildModeStats,
  buildShareStatsLine,
  buildProgrammeTodayLine,
} from "@/lib/account/guesser-stats";
import { getMemberBallot } from "@/lib/account/reflections-ballot";
import {
  buildHonoursContext,
  computeHonours,
  loadPlaysForUser,
} from "@/lib/account/badges";
import { getClubOptions } from "@/lib/auth/clubs";

export function formatMemberSince(createdAt) {
  if (!createdAt) return "";
  return new Date(createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

export async function getProgrammeData(user, profile) {
  const plays = await loadPlaysForUser(user.id);
  const modeStats = buildModeStats(plays);
  const ballot = await getMemberBallot(user.id);
  const honoursContext = await buildHonoursContext(user.id, profile);
  const honours = await computeHonours(user.id, honoursContext);
  const shareStats = buildShareStatsLine(modeStats);
  const todayLine = buildProgrammeTodayLine(modeStats, ballot);

  return {
    profile: {
      preferredName: profile.preferred_name,
      memberNumber: formatMemberNumber(profile.member_number),
      memberSince: formatMemberSince(profile.created_at),
      clubs: profile.clubs ?? [],
      marketingConsent: profile.marketing_consent,
    },
    email: user.email ?? "",
    modeStats,
    ballot,
    honours,
    shareStats,
    todayLine,
    clubOptions: getClubOptions(),
  };
}
