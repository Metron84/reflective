import { ULTIMA_LEAGUE_LABELS, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { deskFloorTokens, forcedCopy } from "@/lib/ultima/draft/floor";

export function floorFromState(state) {
  const floor = state?.floor;
  if (floor?.counts && floor?.deficits) return floor;
  return {
    counts: {},
    deficits: {},
    slotsLeft: 0,
    mode: "open",
    forced: [],
  };
}

export function deskFloorLine(floor) {
  return deskFloorTokens(floor.counts ?? {}, floor.deficits ?? {});
}

export function deskForcedLine(floor) {
  return forcedCopy(floor.forced ?? [], ULTIMA_LEAGUE_LABELS);
}

export function othersNeedLine(others = []) {
  const first = others[0];
  if (!first) return "";
  const short = ULTIMA_LEAGUE_SHORT[first.league] ?? first.league;
  return `${first.team_name} NEED ${short}`;
}

/** Async 24h turn copy. GST is UTC+4. */
export function formatPickDeadline(iso, timerSeconds, secondsRemaining) {
  if (Number(timerSeconds) !== 86400) return null;
  const remaining = Math.max(0, Number(secondsRemaining) || 0);
  const end = iso
    ? new Date(iso)
    : new Date(Date.now() + remaining * 1000);
  if (Number.isNaN(end.getTime())) return null;
  const gst = new Date(end.getTime() + 4 * 3600 * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = String(gst.getUTCHours()).padStart(2, "0");
  const mm = String(gst.getUTCMinutes()).padStart(2, "0");
  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  return `Your pick is open until ${days[gst.getUTCDay()]} ${hh}:${mm} GST · ${hours}h ${mins}m left`;
}
