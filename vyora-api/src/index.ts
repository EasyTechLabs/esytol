/**
 * Entrypoint.
 *
 * The startup gates in `loadConfig` run before anything listens. If a gate
 * fails the process exits non-zero — a server that refuses to start is the
 * point, not a regrettable side effect.
 */

import { loadConfig, StartupError } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { app } = buildServer(config);

  await app.listen({ port: config.port, host: config.host });
  console.log(
    `vyora-api listening on http://${config.host}:${config.port}  ` +
      `(env=${config.nodeEnv}, devAuth=${config.devAuthEnabled})`
  );
}

main().catch((err) => {
  if (err instanceof StartupError) {
    console.error(`STARTUP REFUSED: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
