/**
 * Configuration and the startup safety gates.
 *
 * Two gates run before the server can listen. Both exist because the
 * development identity scheme (`X-Vyora-Dev-Identity`) is a real bypass if it
 * ever escapes a developer's machine, and a warning is a thing people stop
 * reading. Failing to boot is not.
 */

export interface Config {
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly port: number;
  readonly host: string;
  readonly databaseUrl: string;
  readonly devAuthEnabled: boolean;
  readonly cursorSecret: string;
  readonly retentionDays: number;
  readonly schemaVersion: number;
  readonly minSchemaVersion: number;
  readonly maxBatchEvents: number;
}

/** Thrown by a startup gate. Distinct type so tests can assert the gate, not any error. */
export class StartupError extends Error {
  override readonly name = "StartupError";
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0:0:0:0:0:0:0:1"]);

/** True when a database URL points at this machine. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    // The postgres:// scheme parses as a URL; hostname is what we care about.
    return LOOPBACK.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const devAuthEnabled = env.VYORA_DEV_AUTH === "true";

  // ── Gate 1 ────────────────────────────────────────────────────────────────
  // The development identity scheme must not exist in production. This is the
  // control that makes "dev auth can never become a production bypass"
  // structurally true rather than merely intended.
  if (isProduction && devAuthEnabled) {
    throw new StartupError(
      "VYORA_DEV_AUTH=true is refused when NODE_ENV=production. " +
        "The development identity scheme must never run in production mode."
    );
  }

  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new StartupError("DATABASE_URL is required.");
  }

  // ── Gate 2 ────────────────────────────────────────────────────────────────
  // This milestone is synthetic-data-only and localhost-only. A remote database
  // URL is refused outright so no configuration slip can point a development
  // build at data that is not synthetic.
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new StartupError(
      `DATABASE_URL must point at localhost. Refusing to start against a remote database: ` +
        `${safeHost(databaseUrl)}. This build is synthetic-data-only.`
    );
  }

  return {
    nodeEnv,
    isProduction,
    port: int(env.PORT, 4000),
    host: env.HOST ?? "127.0.0.1",
    databaseUrl,
    devAuthEnabled,
    cursorSecret: env.SYNC_CURSOR_SECRET ?? "local-development-only-not-a-secret",
    retentionDays: int(env.SYNC_RETENTION_DAYS, 90),
    schemaVersion: int(env.SYNC_SCHEMA_VERSION, 1),
    minSchemaVersion: int(env.SYNC_MIN_SCHEMA_VERSION, 1),
    maxBatchEvents: int(env.SYNC_MAX_BATCH_EVENTS, 500),
  };
}

/** Host only — never echo a connection string, it carries a password. */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "<unparseable>";
  }
}
