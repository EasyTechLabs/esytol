/**
 * OPTIMIZATION-001 — weekly observation snapshot.
 *
 * Pulls every growth provider through lib/growth (the single implementation —
 * this script adds no fetching logic of its own) and writes a dated JSON
 * snapshot to .forge/observations/. Run every Monday during the observation
 * window; commit the snapshot. The day-30 backlog is produced by diffing these.
 *
 * Usage:  node --experimental-strip-types scripts/observe.mjs   (Node >= 22)
 *    or:  npx tsx scripts/observe.mjs
 *
 * Honesty contract: providers that are unconfigured or erroring appear in the
 * snapshot with that status and empty data — a snapshot never contains a number
 * nobody saw.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// pathToFileURL: on Windows a bare absolute path is not a valid ESM specifier.
const { getGrowthData } = await import(pathToFileURL(join(root, "lib/growth/index.ts")).href);

const now = new Date();
const data = await getGrowthData(now);

const summary = {
  takenAt: now.toISOString(),
  providers: Object.fromEntries(
    ["searchConsole", "analytics", "clarity", "github", "vercel"].map((key) => [
      key,
      { status: data[key].status, note: data[key].note ?? null },
    ])
  ),
  noneLive: data.noneLive,
};

const dir = join(root, ".forge", "observations");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${now.toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ summary, data }, null, 2), "utf8");

console.log(`snapshot written: ${file}`);
for (const [key, value] of Object.entries(summary.providers)) {
  console.log(`  ${key.padEnd(14)} ${value.status}${value.note ? `  — ${value.note}` : ""}`);
}
if (summary.noneLive) {
  console.log("\nGate 0 is still closed: no provider is live. See OBSERVATION.md.");
  process.exitCode = 1;
}
