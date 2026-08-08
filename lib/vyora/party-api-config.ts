/**
 * Vyora — when the development Party API may be read.
 *
 * Three conditions, all required, none of which the browser can talk its way
 * past. They are here in one pure function rather than scattered across call
 * sites so the answer is testable and there is exactly one place to read.
 *
 *   1. the flag is explicitly "true" — absent, empty or anything else is off;
 *   2. the build is not a production build;
 *   3. the configured API URL is loopback.
 *
 * Condition 2 is what makes "production builds ignore an enabled development
 * flag" structurally true rather than a convention. `NEXT_PUBLIC_*` values are
 * inlined at build time, so a flag left on in a production build would
 * otherwise ship to real devices. Here it simply cannot switch anything on.
 *
 * Condition 3 means that even a mistakenly-enabled non-production build cannot
 * be pointed at a server that is not this machine.
 */

/** The public flag. Default OFF — absence must never mean "on". */
export const PARTY_READS_FLAG = "NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED";

/**
 * The write flag. Default OFF, and strictly narrower than the read flag.
 *
 * Writes require everything reads require **and then one more thing**, so a
 * developer cannot end up writing to the API while still reading locally. That
 * combination would show them a screen that disagrees with the thing they just
 * changed, which is exactly how someone concludes their data is lost.
 */
export const PARTY_WRITES_FLAG = "NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED";

/** Where the browser sends its reads: this app's own server-side proxy. */
export const PARTY_PROXY_PATH = "/api/vyora-dev/parties";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/** True when a URL points at this machine. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface PartyApiEnv {
  readonly flag: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly apiUrl: string | undefined;
}

export type PartyApiDecision =
  | { readonly enabled: true; readonly apiUrl: string }
  | { readonly enabled: false; readonly reason: string };

export const DEFAULT_API_URL = "http://127.0.0.1:4000";

/**
 * Decide whether development Party reads are permitted.
 *
 * Returns a *reason* when disabled rather than a bare false, because the most
 * confusing state for a developer is a flag that appears set while nothing
 * changes. The reason is shown in the developer-visible banner.
 */
export function decidePartyApi(env: PartyApiEnv): PartyApiDecision {
  if (env.flag !== "true") {
    return { enabled: false, reason: `${PARTY_READS_FLAG} is not "true" (default: disabled).` };
  }

  if (env.nodeEnv === "production") {
    return {
      enabled: false,
      reason:
        "This is a production build. Development API reads are ignored here, " +
        "even with the flag enabled.",
    };
  }

  const apiUrl = env.apiUrl ?? DEFAULT_API_URL;
  if (!isLoopbackUrl(apiUrl)) {
    return {
      enabled: false,
      reason: `The API URL is not loopback (${safeHost(apiUrl)}). Development reads are localhost-only.`,
    };
  }

  return { enabled: true, apiUrl };
}

/** Read the decision from the ambient environment (client-safe values only). */
export function partyApiDecision(): PartyApiDecision {
  return decidePartyApi({
    flag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_VYORA_API_URL,
  });
}

export interface PartyWriteEnv extends PartyApiEnv {
  readonly writeFlag: string | undefined;
}

/**
 * Decide whether development Party **writes** are permitted.
 *
 * Deliberately built on top of the read decision rather than beside it, so the
 * two can never disagree. Every reason reads can be refused is a reason writes
 * are refused, and the write flag only ever narrows further — it can never
 * widen. Production is therefore refused by construction, not by a second check
 * someone could forget to copy.
 *
 * The server-side identity is the fifth condition, and it is checked only on
 * the server (`forward.ts`): the browser has no way to know whether it is set,
 * and giving it one would leak the fact that a credential exists.
 */
export function decidePartyWrites(env: PartyWriteEnv): PartyApiDecision {
  const reads = decidePartyApi(env);
  if (!reads.enabled) {
    return { enabled: false, reason: `Writes require reads to be enabled first. ${reads.reason}` };
  }

  if (env.writeFlag !== "true") {
    return { enabled: false, reason: `${PARTY_WRITES_FLAG} is not "true" (default: disabled).` };
  }

  return { enabled: true, apiUrl: reads.apiUrl };
}

/** Read the write decision from the ambient environment (client-safe values only). */
export function partyWriteDecision(): PartyApiDecision {
  return decidePartyWrites({
    flag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED,
    writeFlag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_VYORA_API_URL,
  });
}

/** Host only — a URL may carry credentials and this string reaches the UI. */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "<unparseable>";
  }
}
