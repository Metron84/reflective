import { ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import { getBotPersonas } from "@/lib/ultima/personas";
import { getUltimaDb } from "@/lib/ultima/server/db";

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Seat one bot per unfilled draft slot when draft goes live.
 */
export async function seatBots(competitionId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, draft_slot, is_bot")
    .eq("competition_id", competitionId);

  const seated = managers ?? [];
  const humans = seated.filter((m) => !m.is_bot);
  const bots = seated.filter((m) => m.is_bot);
  const need = ULTIMA_MAX_SEATS - seated.length;

  if (need <= 0) return { ok: true, seated: 0 };

  const personas = getBotPersonas();
  const usedPersonas = new Set(bots.map((b) => b.persona_id).filter(Boolean));
  const available = shuffle(
    personas.filter((p) => !usedPersonas.has(p.id)),
  );

  const takenSlots = new Set(
    seated.map((m) => m.draft_slot).filter(Boolean),
  );
  const freeSlots = [];
  for (let s = 1; s <= ULTIMA_MAX_SEATS; s += 1) {
    if (!takenSlots.has(s)) freeSlots.push(s);
  }

  const inserts = [];
  for (let i = 0; i < need && i < available.length; i += 1) {
    const persona = available[i];
    inserts.push({
      competition_id: competitionId,
      is_bot: true,
      persona_id: persona.id,
      team_name: persona.name,
      manager_name: persona.name,
      colour: "slate",
      draft_slot: freeSlots[i] ?? i + 1 + humans.length,
      profile_complete: true,
    });
  }

  if (!inserts.length) return { ok: false, error: "no_personas" };

  const { data, error } = await db
    .from("ultima_managers")
    .insert(inserts)
    .select("id");

  if (error) return { ok: false, error: error.message };
  return { ok: true, seated: data?.length ?? 0 };
}
