/**
 * Vyora — merchant productivity tests (V2-006).
 *
 * This milestone removes taps, so the tests are about ORDER: the customer a
 * merchant wants must be the one nearest their thumb, and the list must not
 * scramble itself when they pin someone.
 */

import { describe, it, expect } from "vitest";
import { readSearch } from "@/lib/vyora/ledger";
import {
  MAX_RECENT,
  QUICK_AMOUNTS,
  isFavorite,
  quickAmounts,
  quickPickCustomers,
  recentCustomers,
  toggleFavorite,
  touchRecent,
  withFavoritesFirst,
} from "@/lib/vyora/productivity";
import { DEFAULT_SETTINGS, type MerchantSettings } from "@/lib/vyora/settings";
import { normalizeSettings } from "@/lib/vyora/settings";
import { CORE_ROUTES, MODULES, moreRoutes, navRoutes } from "@/features/vyora/modules";
import { goldenLedger } from "./golden-ledger";

const LEDGER = goldenLedger();
const IDS = LEDGER.data.parties.slice(0, 12).map((p) => p.id);

function settingsWith(patch: Partial<MerchantSettings>): MerchantSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe("recent customers", () => {
  it("puts the most recently used first", () => {
    let recent: readonly string[] = [];
    recent = touchRecent(recent, "a");
    recent = touchRecent(recent, "b");
    recent = touchRecent(recent, "c");
    expect(recent).toEqual(["c", "b", "a"]);
  });

  it("moves a repeat use back to the front instead of duplicating it", () => {
    const recent = touchRecent(touchRecent(touchRecent([], "a"), "b"), "a");
    expect(recent).toEqual(["a", "b"]);
  });

  it("never grows past the cap", () => {
    let recent: readonly string[] = [];
    for (let i = 0; i < MAX_RECENT + 15; i++) recent = touchRecent(recent, `c${i}`);
    expect(recent).toHaveLength(MAX_RECENT);
    expect(recent[0]).toBe(`c${MAX_RECENT + 14}`);
  });

  it("drops ids whose contact no longer exists, rather than showing a blank", () => {
    const settings = settingsWith({ recentContactIds: [IDS[0], "deleted-contact", IDS[1]] });
    const resolved = recentCustomers(LEDGER, settings);
    expect(resolved.map((p) => p.id)).toEqual([IDS[0], IDS[1]]);
  });

  it("is empty for a merchant who has recorded nothing", () => {
    expect(recentCustomers(LEDGER, DEFAULT_SETTINGS)).toEqual([]);
  });
});

describe("favourites", () => {
  it("pins and unpins", () => {
    expect(toggleFavorite([], "a")).toEqual(["a"]);
    expect(toggleFavorite(["a", "b"], "a")).toEqual(["b"]);
  });

  it("reports pinned state", () => {
    expect(isFavorite(settingsWith({ favoriteContactIds: ["a"] }), "a")).toBe(true);
    expect(isFavorite(DEFAULT_SETTINGS, "a")).toBe(false);
  });

  it("puts pinned customers first", () => {
    const all = readSearch(LEDGER, "");
    const pinnedId = all[5].party.id;
    const settings = settingsWith({ favoriteContactIds: [pinnedId] });
    const ordered = withFavoritesFirst(all, settings, (b) => b.party.id);
    expect(ordered[0].party.id).toBe(pinnedId);
  });

  it("keeps the ledger's own order inside each group — pinning scrambles nothing", () => {
    const all = readSearch(LEDGER, "");
    const settings = settingsWith({ favoriteContactIds: [all[5].party.id, all[9].party.id] });
    const ordered = withFavoritesFirst(all, settings, (b) => b.party.id);
    const unpinned = ordered.slice(2).map((b) => b.party.id);
    const expected = all
      .filter((b) => !settings.favoriteContactIds.includes(b.party.id))
      .map((b) => b.party.id);
    expect(unpinned).toEqual(expected);
    expect(ordered).toHaveLength(all.length);
  });

  it("returns the list untouched when nothing is pinned", () => {
    const all = readSearch(LEDGER, "");
    expect(withFavoritesFirst(all, DEFAULT_SETTINGS, (b) => b.party.id)).toBe(all);
  });
});

describe("the quick-pick row", () => {
  it("shows pinned customers before recent ones", () => {
    const settings = settingsWith({
      favoriteContactIds: [IDS[7]],
      recentContactIds: [IDS[0], IDS[1]],
    });
    expect(quickPickCustomers(LEDGER, settings).map((p) => p.id)).toEqual([IDS[7], IDS[0], IDS[1]]);
  });

  it("never lists the same customer twice", () => {
    const settings = settingsWith({
      favoriteContactIds: [IDS[0]],
      recentContactIds: [IDS[0], IDS[1]],
    });
    const picks = quickPickCustomers(LEDGER, settings).map((p) => p.id);
    expect(picks).toEqual([IDS[0], IDS[1]]);
    expect(new Set(picks).size).toBe(picks.length);
  });

  it("respects the cap", () => {
    const settings = settingsWith({ recentContactIds: IDS });
    expect(quickPickCustomers(LEDGER, settings, 4)).toHaveLength(4);
  });
});

describe("quick amount chips", () => {
  it("offers the common amounts", () => {
    expect(quickAmounts(0)).toEqual([...QUICK_AMOUNTS]);
  });

  it("promotes the merchant's own last amount to the front", () => {
    expect(quickAmounts(250)).toEqual([250, 100, 500, 1000, 2000]);
  });

  it("does not duplicate an amount that is already a chip", () => {
    expect(quickAmounts(500)).toEqual([...QUICK_AMOUNTS]);
  });

  it("ignores a nonsense last amount", () => {
    expect(quickAmounts(-5)).toEqual([...QUICK_AMOUNTS]);
    expect(quickAmounts(0)).toEqual([...QUICK_AMOUNTS]);
  });
});

describe("preferences survive a corrupt file", () => {
  it("drops junk ids and keeps good ones", () => {
    const loaded = normalizeSettings({
      recentContactIds: ["a", "", 7, "b", "a"],
      favoriteContactIds: ["x", null, "y"],
      lastAmount: "lots",
    });
    expect(loaded.recentContactIds).toEqual(["a", "b"]);
    expect(loaded.favoriteContactIds).toEqual(["x", "y"]);
    expect(loaded.lastAmount).toBe(0);
  });

  it("caps the recent list on read as well as on write", () => {
    const many = Array.from({ length: 40 }, (_, i) => `c${i}`);
    expect(normalizeSettings({ recentContactIds: many }).recentContactIds).toHaveLength(10);
  });
});

describe("navigation is down to four destinations", () => {
  it("shows exactly Home, Chase, Parties and More in the bar", () => {
    expect(navRoutes().map((r) => r.label)).toEqual(["Home", "Chase", "Parties", "More"]);
  });

  it("keeps capture out of the bar — it is a floating action", () => {
    const paths = navRoutes().map((r) => r.path);
    expect(paths).not.toContain("/vyora/credit");
    expect(paths).not.toContain("/vyora/payment");
  });

  it("moves Settings, Closing and Founder Mode under More", () => {
    const paths = moreRoutes().map((r) => r.path);
    expect(paths).toContain("/vyora/settings");
    expect(paths).toContain("/vyora/closing");
    expect(paths).toContain("/vyora/founder");
  });

  it("never puts a detail route in More", () => {
    for (const route of moreRoutes()) expect(route.path).not.toContain("[");
  });

  it("still owns a route for every registered module", () => {
    const all = [...CORE_ROUTES, ...MODULES.flatMap((m) => m.routes)];
    for (const route of navRoutes()) expect(all).toContain(route);
    for (const route of moreRoutes()) expect(all).toContain(route);
  });
});

describe("search stays fast at golden scale", () => {
  it("filters 500 contacts well inside the 50ms budget", () => {
    const started = performance.now();
    for (let i = 0; i < 50; i++) readSearch(LEDGER, "contact 1");
    const perQuery = (performance.now() - started) / 50;
    expect(perQuery).toBeLessThan(50);
  });

  it("returns everyone instantly for an empty query", () => {
    expect(readSearch(LEDGER, "").length).toBe(LEDGER.data.parties.length);
  });
});
