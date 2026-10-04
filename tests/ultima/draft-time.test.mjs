import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { DRAFT_ROOM_OPENS_MINUTES_BEFORE } from "../../lib/ultima/constants.js";
import { draftRoomWindow } from "../../lib/ultima/draft-window.js";
import {
  formatCountdown,
  formatGstDateTime,
  formatGstTime,
  fromGstInput,
  toGstInputValue,
} from "../../lib/ultima/gst.js";

// Today's draft: 16:00 GST on 4 Oct 2026 is 12:00 UTC.
const SCHEDULED = "2026-10-04T12:00:00.000Z";
const gst = (hms) => Date.parse(`2026-10-04T${hms}+04:00`);

test("the room opens 10 minutes before the first pick", () => {
  assert.equal(DRAFT_ROOM_OPENS_MINUTES_BEFORE, 10);
});

test("admin: entering 16:00 saves 12:00 UTC", () => {
  assert.equal(fromGstInput("2026-10-04T16:00"), "2026-10-04T12:00:00.000Z");
  assert.equal(fromGstInput("2026-10-04T16:00:00"), "2026-10-04T12:00:00.000Z");
});

test("admin: the saved value displays as 16:00 GST", () => {
  assert.equal(toGstInputValue(SCHEDULED), "2026-10-04T16:00");
  assert.equal(formatGstTime(SCHEDULED), "16:00");
  assert.equal(formatGstDateTime(SCHEDULED), "Sun 4 Oct, 16:00");
});

test("admin: re-saving the displayed value keeps 12:00 UTC", () => {
  assert.equal(fromGstInput(toGstInputValue(SCHEDULED)), SCHEDULED);
});

test("admin: GST is read the same on a server in any timezone", () => {
  const script = `
    import { fromGstInput, toGstInputValue } from "./lib/ultima/gst.js";
    const saved = fromGstInput("2026-10-04T16:00");
    console.log(saved, toGstInputValue(saved));
  `;
  for (const tz of ["UTC", "America/New_York", "Pacific/Auckland", "Asia/Dubai"]) {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, TZ: tz },
      cwd: new URL("../..", import.meta.url).pathname,
    })
      .toString()
      .trim();
    assert.equal(out, "2026-10-04T12:00:00.000Z 2026-10-04T16:00", `TZ=${tz}`);
  }
});

test("admin: an input that already has an offset is respected, junk is rejected", () => {
  assert.equal(fromGstInput("2026-10-04T12:00:00Z"), "2026-10-04T12:00:00.000Z");
  assert.equal(fromGstInput("2026-10-04T16:00:00+04:00"), "2026-10-04T12:00:00.000Z");
  assert.equal(fromGstInput(""), null);
  assert.equal(fromGstInput(null), null);
  assert.equal(fromGstInput("tomorrow"), null);
});

test("room boundary: closed at 15:49:59 GST", () => {
  const w = draftRoomWindow({ scheduledAt: SCHEDULED, now: gst("15:49:59") });
  assert.equal(w.open, false);
  assert.equal(w.startUnlocked, false);
  assert.equal(w.msToOpen, 1000);
  assert.equal(w.opensAt, "2026-10-04T11:50:00.000Z");
});

test("room boundary: open at 15:50:00 GST, Start still locked", () => {
  const w = draftRoomWindow({ scheduledAt: SCHEDULED, now: gst("15:50:00") });
  assert.equal(w.open, true);
  assert.equal(w.startUnlocked, false);
  assert.equal(w.msToOpen, 0);
  assert.equal(w.msToStart, 10 * 60 * 1000);
});

test("room boundary: Start unlocks at 16:00:00 GST, not before", () => {
  assert.equal(draftRoomWindow({ scheduledAt: SCHEDULED, now: gst("15:59:59") }).startUnlocked, false);
  const w = draftRoomWindow({ scheduledAt: SCHEDULED, now: gst("16:00:00") });
  assert.equal(w.open, true);
  assert.equal(w.startUnlocked, true);
  assert.equal(w.msToStart, 0);
});

test("room: no scheduled time means open and unlocked, as before", () => {
  for (const scheduledAt of [null, undefined, "", "garbage"]) {
    const w = draftRoomWindow({ scheduledAt, now: gst("03:00:00") });
    assert.equal(w.open, true);
    assert.equal(w.startUnlocked, true);
    assert.equal(w.scheduled, false);
  }
});

test("countdown text", () => {
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(9 * 60_000 + 41_000), "9:41");
  assert.equal(formatCountdown(1000), "0:01");
  assert.equal(formatCountdown(3_723_000), "1:02:03");
  assert.equal(formatCountdown(-5), "0:00");
});
