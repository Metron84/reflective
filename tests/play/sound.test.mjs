import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_NAMES, getMuted, playSound, setMuted, synth } from "@/lib/play/sound.js";

test("every sound is short, audible and within range", () => {
  for (const name of SOUND_NAMES) {
    const d = synth(name, 22050);
    assert.ok(d.length > 0 && d.length <= 22050 * 0.5, `${name} length ${d.length}`);
    const peak = d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(peak > 0.05 && peak <= 1, `${name} peak ${peak}`);
    assert.ok(d.every(Number.isFinite), name);
  }
});

test("nothing plays and nothing throws before the first tap or without Web Audio", () => {
  assert.doesNotThrow(() => playSound("correct"));
  assert.doesNotThrow(() => playSound("nope"));
});

test("sound defaults to on and mute survives missing storage", () => {
  assert.equal(getMuted(), false);
  assert.doesNotThrow(() => setMuted(true));
  assert.equal(getMuted(), true);
  setMuted(false);
  assert.equal(getMuted(), false);
});
