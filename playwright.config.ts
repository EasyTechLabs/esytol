/**
 * Real-browser validation for Vyora web sync (WEB-SYNC-004).
 *
 * Everything under `tests/e2e` runs in an actual Chromium. That is the whole
 * point of it existing: jsdom has no IndexedDB, no Web Locks, no service worker
 * and no second tab, so the four properties this suite exists to check —
 * durable local writes, real cross-tab locking, real offline, and convergence
 * with another client — cannot be observed there at all.
 *
 * The servers are **not** started by Playwright. Both the API and the Next dev
 * server are long-lived local processes with their own databases, and having a
 * test runner start and stop them would make an interrupted run leave a
 * half-migrated database behind. They are preconditions, checked in the first
 * test, and the suite says plainly when they are missing rather than starting
 * something it cannot clean up.
 *
 *   1. PostgreSQL on 127.0.0.1:55432
 *   2. cd vyora-api && npm run db:migrate && npm run start   (127.0.0.1:4000)
 *   3. cd esytol   && npm run dev                            (127.0.0.1:3000)
 *   4. cd esytol   && npx playwright test
 *
 * Serial, single worker, deliberately. These tests share one shop in one
 * database, and a parallel run would have two of them pushing to the same log
 * and reading each other's balances — which is a real scenario, but one this
 * suite tests explicitly in the two-tab case rather than accidentally
 * everywhere.
 */

import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE } from "./tests/e2e/shared";

export const WEB_URL = process.env.VYORA_E2E_WEB ?? "http://127.0.0.1:3000";
export const API_URL = process.env.VYORA_E2E_API_URL ?? "http://127.0.0.1:4000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*.(e2e|setup).ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous, because a first page load compiles the route in dev mode. Not a
  // way to make a failure disappear: every assertion inside a test has its own
  // expectation timeout, and none of them was raised to pass.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
  },
  projects: [
    // Signs in once and saves the state everything else reuses. Separate
    // because the API rate-limits sign-in codes, and a suite that asks for one
    // per test exhausts the bucket and then reads a 202 that delivered nothing.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /.*.e2e.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
    },
  ],
});
