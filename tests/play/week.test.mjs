import test from "node:test";
import assert from "node:assert/strict";
import { dubaiWeekStart, lastDubaiWeekStart, weekLabel } from "@/lib/play/week.js";

test("week starts on Monday in Dubai time", () => {
  // Wed 7 Oct 2026 12:00 UTC
  assert.equal(dubaiWeekStart(new Date("2026-10-07T12:00:00Z")), "2026-10-05");
  assert.equal(lastDubaiWeekStart(new Date("2026-10-07T12:00:00Z")), "2026-09-28");
});

test("Sunday 23:59 Dubai is still the old week, Monday 00:00 Dubai starts the new one", () => {
  // Sun 11 Oct 23:59 Dubai = 19:59 UTC
  assert.equal(dubaiWeekStart(new Date("2026-10-11T19:59:00Z")), "2026-10-05");
  // Mon 12 Oct 00:00 Dubai = Sun 20:00 UTC
  assert.equal(dubaiWeekStart(new Date("2026-10-11T20:00:00Z")), "2026-10-12");
});

test("labels a week", () => {
  assert.equal(weekLabel("2026-10-05"), "5 Oct to 11 Oct");
});
