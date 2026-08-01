/**
 * Vyora — cold-start replay benchmark (ENG-010).
 *
 * `reduceEvents` runs on every app open, before anything renders: the provider
 * reads the log, folds it, and only then can a screen paint. QA-001 computed it
 * as O(E²); this measures it.
 *
 * Scales follow the milestone: 500 contacts against 2k / 10k / 15k / 20k
 * entries. Logs are built from the deterministic generator, so a run today is
 * comparable to a run tomorrow.
 */

import { bench, describe } from "vitest";
import { reduceEvents } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";
import { migrateLegacyData } from "@/lib/vyora/store";
import { generateData } from "./legacy-selectors";

const SCALES = [2_000, 10_000, 15_000, 20_000];

for (const entries of SCALES) {
  const log = migrateLegacyData(generateData(9001, 500, entries));

  describe(`${entries} entries / 500 contacts (${log.length} events)`, () => {
    // The cold-start path, in the order the provider runs it.
    bench("replay — reduceEvents", () => {
      reduceEvents(log);
    });

    bench("cold start — replay + buildLedger", () => {
      buildLedger(reduceEvents(log));
    });
  });
}
