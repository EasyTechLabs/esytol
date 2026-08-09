import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // `vyora-api/` is a separate Node service with its own vitest config: it
    // needs the node environment, serial execution and a live PostgreSQL
    // database. Running its suite here under jsdom fails for reasons that have
    // nothing to do with the web app. Run it with `npm test` inside vyora-api/.
    exclude: [...configDefaults.exclude, "vyora-api/**", "vyora-mobile/**"],
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", ".next/", "tests/"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
