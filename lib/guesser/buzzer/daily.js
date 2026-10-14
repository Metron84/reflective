// SERVER ONLY.
import { getServiceClient } from "@/lib/supabase";
import { getPerson } from "@/lib/guesser/registry";
import { BOARD_SIZE } from "./schedule";
import { scheduledBoardIds } from "./pool";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function validIds(ids) {
  return (
    Array.isArray(ids) &&
    ids.length === BOARD_SIZE &&
    new Set(ids).size === BOARD_SIZE &&
    ids.every((id) => typeof id === "string" && getPerson(id)?.clues?.length >= 4)
  );
}

/**
 * The 5 person ids for a Dubai day, in play order. A row in `guesser_boards` wins, so a day can be
 * set by hand. With no row, the schedule decides and the pick is written to the table as a record
 * (best effort: the game works without the table).
 *
 * @param {string} day  yyyy-mm-dd
 * @param {object|null} [db]
 * @returns {Promise<string[]>}
 */
export async function getDailyIds(day, db = getServiceClient()) {
  const hit = cache.get(day);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ids;

  const scheduled = scheduledBoardIds(day);
  let ids = scheduled;
  if (db) {
    try {
      const { data } = await db.from("guesser_boards").select("person_ids").eq("board_date", day).maybeSingle();
      if (validIds(data?.person_ids)) ids = data.person_ids;
      else if (!data) {
        await db
          .from("guesser_boards")
          .upsert({ board_date: day, person_ids: scheduled }, { onConflict: "board_date", ignoreDuplicates: true });
      }
    } catch {
      // Table missing or unreachable: use the schedule.
    }
  }
  if (cache.size > 30) cache.clear();
  cache.set(day, { ids, at: Date.now() });
  return ids;
}
