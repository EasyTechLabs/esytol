/**
 * Vyora API — no CSS pipeline.
 *
 * This file exists solely to stop Vite/Vitest inheriting the parent web
 * application's Tailwind/PostCSS configuration. PostCSS config resolution walks
 * *upward* from the working directory, so without this file it escapes
 * `vyora-api/`, finds the repository root's `postcss.config.mjs`, and tries to
 * load `tailwindcss` — a root dependency this package deliberately does not
 * have. In CI, where only `vyora-api/node_modules` is installed, that fails and
 * the whole test run dies before a single test loads.
 *
 * An explicitly empty plugin set terminates the upward search here. The API
 * serves JSON and renders nothing, so there is no CSS to process.
 */

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {},
};

export default config;
