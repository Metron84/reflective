import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  formatGstDateTime,
  formatGstTime,
  fromGstInput,
  toGstInputValue,
} from "../../lib/ultima/gst.js";

// Today's draft: 16:00 GST on 4 Oct 2026 is 12:00 UTC.
const SCHEDULED = "2026-10-04T12:00:00.000Z";

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
