// SERVER ONLY. Turns engine state into what a player may see, and runs one request against a stored run.
import {
  ANSWER_MS,
  CLUE_COUNT,
  MAX_SCORE,
  PLAYERS_PER_BOARD,
  ROUND_MS,
  answer as engineAnswer,
  buzz as engineBuzz,
  cluesAt,
  currentIndex,
  elapsed,
  isComplete,
  newBoard,
  score,
  settle,
  start as engineStart,
  valueAt,
} from "./engine";
import { findRun } from "./store";

/**
 * What the client may see right now. Clue text is only included once the server's own clock says it
 * is unlocked, the answer is only included once a player is done, and the person ids never leave.
 *
 * @param {object} board  engine state
 * @param {{ids: string[], now: number, day: string, number: number,
 *   cluesFor: (id: string) => string[], nameFor: (id: string) => string, hasRun: boolean}} ctx
 */
export function describe(board, ctx) {
  const { ids, now } = ctx;
  const i = currentIndex(board);
  const complete = isComplete(board);

  const players = board.players.map((p, n) => ({
    n: n + 1,
    state: p.st,
    points: p.st === "done" ? p.pts : null,
    correct: p.st === "done" ? p.ok : null,
    name: p.st === "done" ? ctx.nameFor(ids[n]) : null,
  }));

  let current = null;
  if (i >= 0 && board.players[i].st === "live") {
    const p = board.players[i];
    const ms = elapsed(p, now);
    const frozen = p.bz != null;
    const unlocked = cluesAt(ms);
    current = {
      n: i + 1,
      clues: ctx.cluesFor(ids[i]).slice(0, unlocked),
      unlocked,
      elapsedMs: ms,
      frozen,
      lockedOut: Boolean(p.w),
      value: valueAt(ms),
      answerRemainingMs: frozen ? Math.max(0, ANSWER_MS - (now - p.bz)) : null,
    };
  }

  const status = complete ? "complete" : current ? "live" : ctx.hasRun || i > 0 ? "between" : "intro";

  return {
    day: ctx.day,
    number: ctx.number,
    status,
    index: i >= 0 ? i + 1 : null,
    total: PLAYERS_PER_BOARD,
    clueCount: CLUE_COUNT,
    roundMs: ROUND_MS,
    answerMs: ANSWER_MS,
    maxScore: MAX_SCORE,
    score: score(board),
    players,
    current,
    serverNow: now,
  };
}

/**
 * Run one request. Reads today's run, applies the action with the server clock, and saves. If another
 * request saved first, it reads again and retries once.
 *
 * @param {{action: "state"|"start"|"buzz"|"answer", body?: object}} req
 * @param {{store: object, userId: string|null, hash: string|null, day: string, now: () => number,
 *   ids: string[], cluesFor: Function, nameFor: Function, number: number,
 *   resolveText: (t: string) => object, personExists: (id: string) => boolean}} deps
 * @returns {Promise<{status: number, body: object}>}
 */
export async function runAction(req, deps) {
  const { store, userId, hash, day, ids } = deps;
  const pidAt = (n) => ids[n];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = deps.now();
    const found = await findRun(store, { userId, hash, day });
    let run = found.run;
    const view = (board, extra = {}) => ({
      status: 200,
      body: { ok: true, ...extra, ...describe(board, { ...deps, now, hasRun: Boolean(run) }) },
    });

    if (req.action === "state") {
      if (!run) return view(newBoard());
      const settled = settle(run.board, now, pidAt);
      if (JSON.stringify(settled.players) !== JSON.stringify(run.board.players)) {
        if (!(await store.save(run, settled))) continue;
      }
      return view(settled);
    }

    if (req.action === "start") {
      if (!userId && !hash) return { status: 400, body: { ok: false, reason: "no-session" } };
      if (!run) {
        run = await store.create({ userId, hash, day, board: newBoard() });
        if (!run) return { status: 503, body: { ok: false, reason: "no-store" } };
      }
      const next = engineStart(run.board, now, pidAt);
      if (JSON.stringify(next.players) !== JSON.stringify(run.board.players) && !(await store.save(run, next))) continue;
      return view(next);
    }

    if (!run) return { status: 409, body: { ok: false, reason: "not-started" } };

    if (req.action === "buzz") {
      const res = engineBuzz(run.board, now, pidAt);
      if (JSON.stringify(res.board.players) !== JSON.stringify(run.board.players) && !(await store.save(run, res.board))) continue;
      return view(res.board, { outcome: res.ok ? "frozen" : res.reason });
    }

    if (req.action === "answer") {
      const settled = settle(run.board, now, pidAt);
      const i = currentIndex(settled);
      const p = i >= 0 ? settled.players[i] : null;
      if (!p || p.st !== "live" || p.bz == null) {
        // The window closed while the answer was on its way, or nothing was frozen.
        if (JSON.stringify(settled.players) !== JSON.stringify(run.board.players) && !(await store.save(run, settled))) continue;
        return view(settled, { outcome: "late" });
      }

      let guessPid = typeof req.body?.personId === "string" ? req.body.personId : null;
      if (guessPid && !deps.personExists(guessPid)) guessPid = null;
      if (!guessPid) {
        const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 80) : "";
        const found2 = deps.resolveText(text);
        // Unclear text does not use up the guess: the player is asked to pick from the list.
        if (found2.type === "none") return view(settled, { outcome: "unknown" });
        if (found2.type === "ambiguous") return view(settled, { outcome: "ambiguous", options: found2.options });
        guessPid = found2.personId;
      }

      const res = engineAnswer(settled, now, guessPid, ids[i], pidAt);
      if (!res.ok) return view(res.board, { outcome: res.reason });
      if (!(await store.save(run, res.board))) continue;
      return view(res.board, { outcome: res.correct ? "correct" : "wrong", points: res.points });
    }

    return { status: 400, body: { ok: false, reason: "bad-action" } };
  }
  return { status: 409, body: { ok: false, reason: "busy" } };
}
