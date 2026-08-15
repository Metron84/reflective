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

/** Name of the provider actually in use, for admin reporting. */
export function getProviderName() {
  const kind = process.env.ULTIMA_PROVIDER ?? "mock";
  return kind === "sportmonks" && sportmonksApiKey() ? "sportmonks" : "mock";
}

export async function syncAllPlayersFromProvider() {
  const provider = getStatsProvider();
  if (typeof provider.fetchAllPlayers === "function") {
    return provider.fetchAllPlayers();
  }
  return provider.getAllPlayers();
}

/** Why each league returned nothing, when the provider can say. */
export function getProviderDiagnostics() {
  const provider = getStatsProvider();
  return typeof provider.getDiagnostics === "function" ? provider.getDiagnostics() : {};
}
