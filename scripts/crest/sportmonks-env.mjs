/**
 * Sportmonks base URL and API key for Crest scripts only.
 * Values must stay aligned with lib/ultima/provider/sportmonks-config.js.
 * We do not import that module here because it pulls @/ path aliases.
 */

export const SPORTMONKS_BASE = "https://api.sportmonks.com/v3/football";

export function sportmonksApiKey() {
  return process.env.SPORTMONKS_API_KEY?.trim() ?? "";
}
