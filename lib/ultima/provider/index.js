import { getMockProvider } from "@/lib/ultima/provider/mock";
import { SportmonksProvider } from "@/lib/ultima/provider/sportmonks";
import { sportmonksApiKey } from "@/lib/ultima/provider/sportmonks-config";

let sportmonksInstance = null;

/**
 * Returns the active stats provider.
 * Sportmonks when ULTIMA_PROVIDER=sportmonks and key is set; else mock.
 */
export function getStatsProvider() {
  const kind = process.env.ULTIMA_PROVIDER ?? "mock";
  if (kind === "sportmonks" && sportmonksApiKey()) {
    if (!sportmonksInstance) sportmonksInstance = new SportmonksProvider();
    return sportmonksInstance;
  }
  return getMockProvider();
}

export async function syncAllPlayersFromProvider() {
  const provider = getStatsProvider();
  if (typeof provider.fetchAllPlayers === "function") {
    return provider.fetchAllPlayers();
  }
  return provider.getAllPlayers();
}
