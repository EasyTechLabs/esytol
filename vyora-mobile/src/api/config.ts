/**
 * Where the API is, and who this build says it is.
 *
 * Both are development-only, and both are refused unless the app was built in
 * development. The reasoning is the same as the web app's gate: a build that
 * could be handed to a merchant must not carry a path to a developer's server
 * or a fixture identity, whatever a configuration file says.
 *
 * **The loopback problem.** `127.0.0.1` on an Android emulator is the emulator
 * itself, not the host machine — so a host API on `127.0.0.1:4000` is
 * unreachable under that name. The emulator exposes the host at the fixed alias
 * `10.0.2.2`. A physical device on the same Wi-Fi needs the host's LAN address
 * instead. Getting this wrong produces a connection timeout that looks
 * identical to "the server is down", which is why the default is chosen from
 * the platform rather than left to a developer to remember.
 */

import { Platform } from "react-native";

export const DEFAULT_PORT = 4000;

/** Android emulator alias for the host machine's loopback interface. */
export const ANDROID_EMULATOR_HOST = "10.0.2.2";

/** iOS simulator shares the host's network stack, so loopback is literal. */
export const IOS_SIMULATOR_HOST = "127.0.0.1";

export interface ApiConfig {
  readonly baseUrl: string;
  readonly identity: string;
}

export interface ConfigInput {
  readonly baseUrl?: string | undefined;
  readonly identity?: string | undefined;
  readonly isDev: boolean;
  readonly platform?: string | undefined;
}

export type ConfigDecision =
  | { readonly enabled: true; readonly config: ApiConfig }
  | { readonly enabled: false; readonly reason: string };

/** The host that reaches the developer's machine from this runtime. */
export function defaultHost(platform: string = Platform.OS): string {
  return platform === "android" ? ANDROID_EMULATOR_HOST : IOS_SIMULATOR_HOST;
}

export function defaultBaseUrl(platform: string = Platform.OS): string {
  return `http://${defaultHost(platform)}:${DEFAULT_PORT}`;
}

/**
 * Hosts this app will talk to. Loopback, the emulator's host alias, and private
 * LAN ranges for a real device on the developer's own network.
 *
 * A public address is refused outright. There is no legitimate development
 * reason to point this build at one, and the failure mode if it happened by
 * accident — a device sending synthetic writes to something on the internet —
 * is not one worth leaving reachable.
 */
export function isLocalHost(host: string): boolean {
  if (host === "localhost" || host === ANDROID_EMULATOR_HOST) return true;
  if (host === "::1" || host === "[::1]") return true;

  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets as [number, number, number, number];

  if (a === 127) return true; // loopback
  if (a === 10) return true; // private class A
  if (a === 192 && b === 168) return true; // private class C
  if (a === 172 && b >= 16 && b <= 31) return true; // private class B
  return false;
}

function hostOf(url: string): string | null {
  // `new URL` is available in Hermes, but a malformed value must not throw its
  // way up into a screen render.
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Decide whether this build may talk to an API at all.
 *
 * Order matters: the production check comes first, so no configuration value
 * can produce an "enabled" answer in a release build.
 */
export function decideApi(input: ConfigInput): ConfigDecision {
  if (!input.isDev) {
    return {
      enabled: false,
      reason: "This is a release build. The development API is unreachable here, by construction.",
    };
  }

  const baseUrl = input.baseUrl?.trim() || defaultBaseUrl(input.platform ?? Platform.OS);
  const host = hostOf(baseUrl);
  if (!host) {
    return { enabled: false, reason: `The API URL is not a valid URL (${baseUrl}).` };
  }
  if (!isLocalHost(host)) {
    return {
      enabled: false,
      reason: `The API host ${host} is not local. This build talks to loopback and private networks only.`,
    };
  }

  const identity = input.identity?.trim();
  if (!identity) {
    return {
      enabled: false,
      reason:
        "No development identity is configured. Set one on the setup screen; it names a seeded synthetic workspace.",
    };
  }

  return { enabled: true, config: { baseUrl: baseUrl.replace(/\/$/, ""), identity } };
}
