#!/usr/bin/env node
/**
 * HEAD/GET check for published archive URLs.
 * Reads content/archive/entries.json. Writes scripts/archive-links-report.md.
 * Does not modify entries.
 *
 * Usage: node scripts/check-archive-links.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENTRIES_PATH = path.join(ROOT, "content/archive/entries.json");
const REPORT_PATH = path.join(ROOT, "scripts/archive-links-report.md");

const CONCURRENCY = 5;
const BATCH_PAUSE_MS = 200;
const TIMEOUT_MS = 10_000;
const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

const CHECKER_UA =
  "TheReflectiveFootballArchiveLinkCheck/1.0 (+https://thereflectivefootball.com)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function loadEntries() {
  const raw = JSON.parse(fs.readFileSync(ENTRIES_PATH, "utf8"));
  if (!Array.isArray(raw)) throw new Error("entries.json must be an array");
  return raw.filter((entry) => entry?.status === "published");
}

function stripTrailingPunct(url) {
  return String(url).replace(/[.,;:]+$/g, "");
}

function collectJobs(entries) {
  const jobs = [];
  const seen = new Set();

  for (const entry of entries) {
    const urls = [];
    if (entry.sourceUrl) urls.push(entry.sourceUrl);

    const where = String(entry.whereToFind || "");
    const found = where.match(URL_RE) || [];
    for (const match of found) urls.push(stripTrailingPunct(match));

    for (const url of urls) {
      const key = `${entry.id}::${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({
        id: entry.id,
        title: entry.title,
        url,
      });
    }
  }

  return jobs;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "(invalid)";
  }
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

async function request(method, url, userAgent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    return {
      status: response.status,
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timer);
  }
}

function headRejected(error) {
  if (!error) return false;
  const message = String(error.message || error);
  return /HEAD|method|405|not allowed/i.test(message);
}

async function checkUrl(url) {
  try {
    const head = await request("HEAD", url, CHECKER_UA);
    if (head.status === 405 || head.status === 501) {
      return await request("GET", url, CHECKER_UA);
    }
    return head;
  } catch (error) {
    if (headRejected(error)) {
      try {
        return await request("GET", url, CHECKER_UA);
      } catch (getError) {
        return {
          status: 0,
          finalUrl: url,
          error: String(getError.message || getError),
        };
      }
    }
    return { status: 0, finalUrl: url, error: String(error.message || error) };
  }
}

async function retryGetBrowser(url) {
  try {
    return await request("GET", url, BROWSER_UA);
  } catch (error) {
    return { status: 0, finalUrl: url, error: String(error.message || error) };
  }
}

function flagFor(originalUrl, status, finalUrl) {
  if (status !== 200) return "BROKEN";
  if (finalUrl && finalUrl !== originalUrl) return "REDIRECTED";
  return "OK";
}

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runBatches(items, label, worker) {
  const results = [];
  const batches = chunk(items, CONCURRENCY);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const checked = await Promise.all(batch.map(worker));
    results.push(...checked);
    process.stdout.write(
      `[archive-links] ${label} ${results.length}/${items.length} (batch ${i + 1}/${batches.length})\n`,
    );
    if (i < batches.length - 1) await sleep(BATCH_PAUSE_MS);
  }
  return results;
}

function listCounts(pairs) {
  if (!pairs.length) return ["_None._"];
  return pairs.map(([key, count]) => `- \`${key}\`: ${count}`);
}

async function main() {
  const entries = loadEntries();
  const jobs = collectJobs(entries);

  console.log(`[archive-links] entries=${entries.length} urls=${jobs.length}`);

  const firstPass = await runBatches(jobs, "pass1", async (job) => {
    const outcome = await checkUrl(job.url);
    const flag = flagFor(job.url, outcome.status, outcome.finalUrl);
    return {
      ...job,
      status: outcome.status,
      finalUrl: outcome.finalUrl,
      flag,
      retryStatus: "",
    };
  });

  const firstCounts = { OK: 0, REDIRECTED: 0, BROKEN: 0 };
  for (const row of firstPass) firstCounts[row.flag] += 1;

  const broken = firstPass.filter((row) => row.flag === "BROKEN");
  const byStatus = countBy(broken, (row) => String(row.status));
  const byDomain = countBy(broken, (row) => urlDomain(row.url));

  console.log(`[archive-links] retrying ${broken.length} BROKEN with browser GET`);

  const retryByKey = new Map();
  await runBatches(broken, "retry", async (row) => {
    const outcome = await retryGetBrowser(row.url);
    retryByKey.set(`${row.id}::${row.url}`, outcome);
    return row;
  });

  const results = firstPass.map((row) => {
    if (row.flag !== "BROKEN") return row;
    const retry = retryByKey.get(`${row.id}::${row.url}`);
    const retryStatus = retry ? retry.status : "";
    const next = {
      ...row,
      retryStatus,
      finalUrl: retry?.finalUrl || row.finalUrl,
    };
    if (retry && retry.status === 200) {
      next.flag = "OK-ON-RETRY";
    }
    return next;
  });

  const finalCounts = { OK: 0, REDIRECTED: 0, "OK-ON-RETRY": 0, BROKEN: 0 };
  for (const row of results) finalCounts[row.flag] += 1;

  const lines = [
    "# Beautiful Archive — link check",
    "",
    `Checked ${results.length} URLs from published entries.`,
    "",
    "## First pass",
    "",
    `- OK: ${firstCounts.OK}`,
    `- REDIRECTED: ${firstCounts.REDIRECTED}`,
    `- BROKEN: ${firstCounts.BROKEN}`,
    "",
    "### BROKEN by HTTP status",
    "",
    ...listCounts(byStatus),
    "",
    "### BROKEN by domain",
    "",
    ...listCounts(byDomain),
    "",
    "## After browser GET retry",
    "",
    `- OK: ${finalCounts.OK}`,
    `- REDIRECTED: ${finalCounts.REDIRECTED}`,
    `- OK-ON-RETRY: ${finalCounts["OK-ON-RETRY"]}`,
    `- BROKEN (true): ${finalCounts.BROKEN}`,
    "",
    "| id | title | url | status code | final URL after redirect | retry status | flag |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const row of results) {
    lines.push(
      `| ${esc(row.id)} | ${esc(row.title)} | ${esc(row.url)} | ${esc(row.status)} | ${esc(row.finalUrl)} | ${esc(row.retryStatus)} | ${esc(row.flag)} |`,
    );
  }

  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
  console.log(
    `[archive-links] wrote ${path.relative(ROOT, REPORT_PATH)} trueBROKEN=${finalCounts.BROKEN} OK-ON-RETRY=${finalCounts["OK-ON-RETRY"]}`,
  );
}

main().catch((error) => {
  console.error("[archive-links] failed:", error);
  process.exit(1);
});
