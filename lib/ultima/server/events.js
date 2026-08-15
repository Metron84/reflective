/**
 * In-process SSE event bus for Ultima live updates.
 * Single Node instance only; sufficient for dev and Vercel single-region preview.
 */

const listeners = new Set();

export function subscribeUltimaEvents(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function publishUltimaEvent(type, payload) {
  const event = { type, payload, at: Date.now() };
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function formatSseMessage(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
