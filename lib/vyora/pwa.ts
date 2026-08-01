/**
 * Vyora — install and offline state (V2-005).
 *
 * Pure, testable detection. Everything that decides *what to show* lives here;
 * the React layer only renders it.
 *
 * No telemetry, no push, no account. The service worker is scoped to `/vyora/`
 * so the rest of the esytol origin is untouched.
 */

export const SW_PATH = "/vyora/sw.js";
export const SW_SCOPE = "/vyora/";

/** How the merchant is running Vyora right now. */
export type DisplayMode = "browser" | "standalone";

export type Platform = "ios" | "android" | "desktop";

export interface InstallState {
  readonly mode: DisplayMode;
  readonly installed: boolean;
  readonly platform: Platform;
  /** iOS has no install prompt — it needs Share → Add to Home Screen. */
  readonly needsManualInstall: boolean;
}

interface NavigatorLike {
  readonly userAgent?: string;
  /** iOS Safari's own standalone flag, which predates display-mode. */
  readonly standalone?: boolean;
}

interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
}

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  // iPadOS 13+ reports as Macintosh, so touch capability is what separates them.
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Installed means "running as an app", which is two different checks:
 * `display-mode: standalone` everywhere, and `navigator.standalone` on iOS,
 * which shipped years before the media query.
 */
export function detectInstallState(win: WindowLike, nav: NavigatorLike): InstallState {
  const standaloneQuery = win.matchMedia?.("(display-mode: standalone)")?.matches === true;
  const iosStandalone = nav.standalone === true;
  const installed = standaloneQuery || iosStandalone;
  const platform = detectPlatform(nav.userAgent ?? "");
  return {
    mode: installed ? "standalone" : "browser",
    installed,
    platform,
    needsManualInstall: platform === "ios" && !installed,
  };
}

// ─── What the merchant has already dismissed ─────────────────────────────────

/**
 * Dismissals are stored per-key so a merchant is never nagged twice.
 *
 * Kept in their own localStorage key rather than in merchant settings: this is
 * UI state about this device's browser, not a business preference, and it must
 * survive "clear all data" — erasing the ledger should not make the tutorial
 * reappear.
 */
export const PWA_STATE_KEY = "vyora.pwa.v1";

export interface PwaFlags {
  readonly installBannerDismissed: boolean;
  readonly tutorialSeen: boolean;
}

export const DEFAULT_PWA_FLAGS: PwaFlags = {
  installBannerDismissed: false,
  tutorialSeen: false,
};

export function normalizePwaFlags(raw: unknown): PwaFlags {
  if (!raw || typeof raw !== "object") return DEFAULT_PWA_FLAGS;
  const value = raw as Partial<PwaFlags>;
  return {
    installBannerDismissed: value.installBannerDismissed === true,
    tutorialSeen: value.tutorialSeen === true,
  };
}

/** Show the install banner only when it can actually lead somewhere. */
export function shouldShowInstallBanner(
  state: InstallState,
  flags: PwaFlags,
  canPrompt: boolean
): boolean {
  if (state.installed) return false;
  if (flags.installBannerDismissed) return false;
  // Android/desktop need a real prompt to offer; iOS gets instructions instead.
  return canPrompt || state.needsManualInstall;
}

/** First launch only, and never again once dismissed. */
export function shouldShowTutorial(flags: PwaFlags): boolean {
  return !flags.tutorialSeen;
}

export interface TutorialPage {
  readonly title: string;
  readonly body: string;
  readonly icon: string;
}

/** Three pages, because a fourth is one nobody reads. */
export const TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    icon: "👤",
    title: "Add a customer",
    body: "Just type their name while recording — Vyora creates them for you. No forms, no setup.",
  },
  {
    icon: "📒",
    title: "Record credit",
    body: "Amount, name, one tap for when it's due. Faster than writing it in the notebook.",
  },
  {
    icon: "📢",
    title: "Recover money",
    body: "Vyora ranks who to chase first and writes the message. You send it yourself.",
  },
];
