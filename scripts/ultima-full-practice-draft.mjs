#!/usr/bin/env node
/**
 * Drive a full 300-pick solo practice draft via the local API.
 *
 * Requires: next dev on :4343 with SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   node --env-file=.env.local scripts/ultima-full-practice-draft.mjs
 */
const BASE = process.env.ULTIMA_DRAFT_BASE_URL ?? "http://localhost:4343";
const TOTAL = 300;

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      const fallback = res.headers.get("set-cookie");
      const list = raw.length ? raw : fallback ? [fallback] : [];
      for (const line of list) {
        const [pair] = line.split(";");
        const eq = pair.indexOf("=");
        if (eq < 0) continue;
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function fetchJson(path, { method = "GET", body, cookies } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookies.header() ? { cookie: cookies.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  cookies.store(res);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

async function followAuthRedirect(url, cookies) {
  let current = url;
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: cookies.header() ? { cookie: cookies.header() } : {},
    });
    cookies.store(res);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Auth redirect loop");
}

async function main() {
  const cookies = cookieJar();
  const started = Date.now();
  let pickTakenWarnings = 0;

  const sign = await fetch(`${BASE}/api/dev/test-sign-in?next=/ultima/practice&ultima=1`, {
    redirect: "manual",
  });
  if (sign.status === 403) {
    const body = await sign.text();
    throw new Error(`test-sign-in blocked: ${body}`);
  }
  const action = sign.headers.get("location");
  if (!action) throw new Error(`test-sign-in expected redirect, got ${sign.status}`);
  await followAuthRedirect(action, cookies);

  const created = await fetchJson("/api/ultima/practice", {
    method: "POST",
    body: { action: "create_solo" },
    cookies,
  });
  if (!created.res.ok || !created.data?.code) {
    throw new Error(`create practice failed: ${JSON.stringify(created.data)}`);
  }
  const code = created.data.code;
  console.log("room", code);

  const startedRoom = await fetchJson("/api/ultima/practice", {
    method: "POST",
    body: { action: "start", code },
    cookies,
  });
  if (!startedRoom.res.ok && !startedRoom.data?.already) {
    throw new Error(`start failed: ${JSON.stringify(startedRoom.data)}`);
  }

  await fetchJson("/api/ultima/practice", {
    method: "POST",
    body: { action: "auto_draft", code, enabled: true },
    cookies,
  });

  let loops = 0;
  let lastPick = null;
  while (loops < 400) {
    loops += 1;
    const adv = await fetchJson("/api/ultima/practice/advance", {
      method: "POST",
      body: { code },
      cookies,
    });

    const msg = adv.data?.message ?? "";
    if (/PICK_TAKEN|already drafted|Unique conflict/i.test(msg)) {
      pickTakenWarnings += 1;
      console.warn("PICK_TAKEN-ish response", adv.data);
    }

    const state = await fetchJson(
      `/api/ultima/practice/state?code=${encodeURIComponent(code)}`,
      { cookies },
    );
    const current = state.data?.current_pick ?? adv.data?.current_pick;
    const draftState = state.data?.state;
    if (current != null && current !== lastPick) {
      lastPick = current;
      if (current % 25 === 0 || current >= TOTAL) {
        console.log(`pick ${current} state=${draftState}`);
      }
    }

    if (draftState === "complete" || (current != null && current > TOTAL)) {
      const elapsedMs = Date.now() - started;
      console.log(
        JSON.stringify(
          {
            ok: true,
            code,
            completed: true,
            current_pick: current,
            elapsed_ms: elapsedMs,
            elapsed_s: Math.round(elapsedMs / 1000),
            advance_loops: loops,
            pick_taken_responses: pickTakenWarnings,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!adv.res.ok) {
      const elapsedMs = Date.now() - started;
      console.error(
        JSON.stringify(
          {
            ok: false,
            code,
            completed: false,
            status: adv.res.status,
            body: adv.data,
            current_pick: current,
            elapsed_ms: elapsedMs,
            pick_taken_responses: pickTakenWarnings,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
  }

  throw new Error("Exceeded advance loops without completion");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
