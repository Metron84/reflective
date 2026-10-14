/**
 * The post-sign-in claim step. Each game saves what the player just earned through its own
 * existing path. A claim that fails or hangs must never keep the player from moving on, so
 * nothing here throws and the redirect always happens.
 */

const DEFAULT_STEP_MS = 6000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Run one step. Never throws.
 * @param {{name: string, run: () => Promise<{claimed?: boolean}|void>}} step
 * @returns {Promise<{name: string, ok: boolean, claimed: boolean, error?: string}>}
 */
export async function runStep(step, { timeoutMs = DEFAULT_STEP_MS } = {}) {
  try {
    const out = await withTimeout(Promise.resolve().then(() => step.run()), timeoutMs);
    return { name: step.name, ok: true, claimed: Boolean(out?.claimed) };
  } catch (err) {
    return { name: step.name, ok: false, claimed: false, error: String(err?.message ?? err) };
  }
}

/** Run every step side by side. Resolves with one result per step, whatever happens. */
export function runClaims(steps, opts = {}) {
  return Promise.all(steps.map((step) => runStep(step, opts)));
}

/**
 * Claim, then continue. `navigate` is called exactly once, even if every step fails.
 *
 * @param {{steps: object[], to: string, navigate: (to: string) => void, timeoutMs?: number}} args
 */
export async function claimAndContinue({ steps, to, navigate, timeoutMs }) {
  let results = [];
  try {
    results = await runClaims(steps, { timeoutMs });
  } finally {
    navigate(to);
  }
  return results;
}
