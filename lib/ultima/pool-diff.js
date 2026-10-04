/**
 * Compare the stored player pool for one league with a fresh provider pull.
 * Pure. No database, no clock.
 *
 * existing / fresh rows: { provider_id, name, club, active }
 */

const SAMPLE_SIZE = 8;
export const MIN_KEEP_RATIO = 0.7;

export function diffPool({
  existing,
  fresh,
  canDeactivateMissing = true,
  minKeepRatio = MIN_KEEP_RATIO,
}) {
  const stored = new Map((existing ?? []).map((row) => [row.provider_id, row]));
  const incoming = new Map((fresh ?? []).map((row) => [row.provider_id, row]));

  const added = [];
  const changedClub = [];
  const wentInactive = [];
  const reactivated = [];
  let unchanged = 0;

  for (const row of incoming.values()) {
    const old = stored.get(row.provider_id);
    if (!old) {
      added.push({ provider_id: row.provider_id, name: row.name, club: row.club });
      continue;
    }
    const clubMoved = old.club !== row.club;
    const nowInactive = old.active !== false && row.active === false;
    const nowActive = old.active === false && row.active !== false;
    if (clubMoved) changedClub.push({ provider_id: row.provider_id, name: row.name, from: old.club, to: row.club });
    if (nowInactive) wentInactive.push({ provider_id: row.provider_id, name: row.name, club: old.club, why: "provider" });
    if (nowActive) reactivated.push({ provider_id: row.provider_id, name: row.name });
    if (!clubMoved && !nowInactive && !nowActive) unchanged += 1;
  }

  // Stored and active, but absent from a fresh pull: left the five leagues or was released.
  const activeStored = [...stored.values()].filter((row) => row.active !== false);
  const missing = activeStored.filter((row) => !incoming.has(row.provider_id));

  let deactivateSkipped = null;
  const missingDeactivate = [];
  if (missing.length) {
    if (!canDeactivateMissing) {
      deactivateSkipped = "The draft has picks. Players who left are kept.";
    } else if (incoming.size < activeStored.length * minKeepRatio) {
      deactivateSkipped = `The fresh pull is under ${Math.round(minKeepRatio * 100)}% of the stored pool. Nobody was deactivated.`;
    } else {
      for (const row of missing) {
        missingDeactivate.push(row.provider_id);
        wentInactive.push({ provider_id: row.provider_id, name: row.name, club: row.club, why: "not in squads" });
      }
    }
  }

  return {
    storedActive: activeStored.length,
    fresh: incoming.size,
    added: added.length,
    changedClub: changedClub.length,
    wentInactive: wentInactive.length,
    reactivated: reactivated.length,
    unchanged,
    missingNotDeactivated: deactivateSkipped ? missing.length : 0,
    deactivateSkipped,
    missingDeactivate,
    samples: {
      added: added.slice(0, SAMPLE_SIZE).map((p) => `${p.name} (${p.club})`),
      changedClub: changedClub.slice(0, SAMPLE_SIZE).map((p) => `${p.name}: ${p.from} to ${p.to}`),
      wentInactive: wentInactive.slice(0, SAMPLE_SIZE).map((p) => `${p.name} (${p.club})`),
    },
  };
}
