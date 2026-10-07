import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { claimSession } from "./claim.js";
import { summarize } from "./game.js";
import { signInHrefFor } from "./host.js";

/**
 * Shared tail of /finish and /claim: summary plus either the saved result
 * (signed in) or the signup wall signal (signed out). The score never comes from the client.
 */
export async function saveOrWall(client, row) {
  const summary = summarize(row.state);
  const user = await getSessionUser();
  if (!user) {
    // Return to the host the player started on: /play on the main site, / on the play host.
    const host = (await headers()).get("host");
    return { status: 200, body: { summary, signedIn: false, signInHref: signInHrefFor(host) } };
  }
  const r = await claimSession(client, row, user.id);
  if (r.status !== 200) return { status: r.status, body: { summary, signedIn: true, error: r.error } };
  return { status: 200, body: { summary, signedIn: true, saved: r.saved } };
}
