// Small synthesised sound set. Everything is generated with the Web Audio API, so there are no audio files to license.
// Nothing plays and no AudioContext exists until the player's first tap, because phones block audio before then.

export const SOUND_NAMES = ["whoosh", "tick", "thunk", "correct", "wrong"];
const MUTE_KEY = "trf-play-muted";
const RATE = 22050;
const TAU = Math.PI * 2;

function noise(seed = 1) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2147483648 - 1;
  };
}

/** Samples for one sound as a mono Float32Array. Pure, so it can be checked without a browser. */
export function synth(name, rate = RATE) {
  const make = (secs, fn) => {
    const out = new Float32Array(Math.floor(rate * secs));
    for (let i = 0; i < out.length; i++) out[i] = fn(i / rate, i / out.length);
    return out;
  };
  const rnd = noise(7);
  switch (name) {
    case "whoosh": {
      let lp = 0;
      return make(0.4, (t, p) => {
        const a = 0.04 + 0.5 * Math.sin(Math.PI * p);
        lp += (rnd() - lp) * (0.04 + 0.4 * Math.sin(Math.PI * p));
        return lp * a * 1.6;
      });
    }
    case "tick":
      return make(0.04, (t, p) => Math.sin(TAU * 1800 * t) * (1 - p) ** 2 * 0.5);
    case "thunk":
      return make(0.16, (t, p) => (Math.sin(TAU * (60 + 70 * (1 - p) ** 2) * t) * 0.8 + rnd() * 0.1 * (1 - p)) * (1 - p) ** 1.5);
    case "correct":
      return make(0.4, (t, p) => {
        const f = t < 0.14 ? 784 : 1175;
        const local = t < 0.14 ? t : t - 0.14;
        const env = Math.min(1, local * 200) * (t < 0.14 ? 1 : Math.max(0, 1 - (t - 0.14) / 0.26));
        return (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * env * 0.3;
      });
    case "wrong":
      return make(0.32, (t, p) => {
        const saw = (f) => 2 * ((t * f) % 1) - 1;
        return (saw(110) + saw(116)) * 0.5 * Math.min(1, t * 150) * (1 - p) * 0.3;
      });
    default:
      return new Float32Array(0);
  }
}

let ctx = null;
let buffers = null;
let armed = false;
const listeners = new Set();

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Sound is on by default. */
export function isMuted() {
  try {
    return storage()?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    storage()?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  memo = muted;
  listeners.forEach((l) => l());
}

let memo = null;
export const getMuted = () => (memo === null ? (memo = isMuted()) : memo);
export function subscribeMuted(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Create the audio context and preload every buffer. Runs from the first tap only. */
function unlock() {
  if (ctx || typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    buffers = {};
    for (const name of SOUND_NAMES) {
      const data = synth(name, RATE);
      const buf = ctx.createBuffer(1, data.length, RATE);
      buf.getChannelData(0).set(data);
      buffers[name] = buf;
    }
    ctx.resume?.();
  } catch {
    ctx = null;
    buffers = null;
  }
}

/** Listen for the first tap or key press, then unlock audio. Safe to call more than once. */
export function armSound() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const go = () => {
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
    unlock();
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}

/** Play one sound. Silent before the first tap, when muted, or when the browser blocks audio. */
export function playSound(name) {
  try {
    if (!ctx || !buffers?.[name] || getMuted()) return;
    if (ctx.state === "suspended") ctx.resume?.();
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.connect(ctx.destination);
    src.start();
  } catch {
    // Blocked or unsupported: the game plays on without sound.
  }
}
