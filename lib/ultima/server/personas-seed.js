import { getBotPersonas } from "@/lib/ultima/personas";

/**
 * Seed ultima_bot_personas from data/ultima/personas.json.
 * Idempotent upsert via service role.
 */
export async function seedBotPersonas(db) {
  const personas = getBotPersonas();
  const rows = personas.map((p) => ({
    id: p.id,
    name: p.name,
    risk: p.risk,
    horizon: p.horizon,
    discipline: p.discipline,
    wobble: p.wobble,
    weights: p.weights,
    rationale_lines: p.rationale_lines,
  }));

  const { error } = await db.from("ultima_bot_personas").upsert(rows, {
    onConflict: "id",
  });

  if (error) throw error;
  return rows.length;
}
