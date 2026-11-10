/**
 * The UDHARPE pilot end-to-end run: the money paths over HTTP and the admin
 * panel in a real browser, against a local API and web server only.
 *
 * Kept apart from `playwright.config.ts` (the web-sync suite) because the two
 * need different preconditions: this one signs in several people and an
 * administrator, and must never share that administrator's browser state with
 * anything else. That state lives in `tests/udharpe-e2e/.auth/`, gitignored and
 * written owner-only.
 *
 *   UDHARPE_E2E_API (default http://127.0.0.1:4000), UDHARPE_E2E_WEB (:3000)
 *   npx playwright test -c playwright.udharpe.config.ts
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/udharpe-e2e",
  testMatch: /.*\.(e2e|setup)\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "tests/udharpe-e2e/.auth/results.json" }]],
  use: {
    baseURL: process.env.UDHARPE_E2E_WEB ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
  },
  projects: [
    { name: "admin-setup", testMatch: /admin\.setup\.ts/ },
    { name: "api", testMatch: /pilot-api\.e2e\.ts/ },
    {
      name: "admin-web",
      testMatch: /admin-web\.e2e\.ts/,
      dependencies: ["admin-setup"],
      use: { ...devices["Desktop Chrome"], storageState: "tests/udharpe-e2e/.auth/admin.json" },
    },
  ],
});
