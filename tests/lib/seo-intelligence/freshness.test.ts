/**
 * Freshness module tests (GROWTH-002).
 *
 * The module's evidence is real dates — so the tests pin the two clocks (dated
 * facts vs evergreen) and the SEO-001 doctrine: the recommendation asks for
 * source verification, never a blind year-bump.
 */

import { describe, it, expect } from "vitest";
import {
  freshnessModule,
  DATED_STALE_DAYS,
  EVERGREEN_STALE_DAYS,
} from "@/lib/seo-intelligence/modules/freshness";
import { makeContext, article as baseArticle } from "../marketing-agent/fixtures";

const NOW = new Date("2026-07-16T08:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

function article(slug: string, lastUpdated: string, body: string) {
  return baseArticle({ slug, frontmatter: { lastUpdated } as never, body });
}

describe("freshnessModule", () => {
  it("flags a dated-facts article after the statutory clock", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [
        article("tax-guide", daysAgo(DATED_STALE_DAYS + 10), "Rules per FY 2025-26 apply."),
      ],
    });
    const recs = freshnessModule.run(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("content-freshness-tax-guide");
    expect(recs[0].reason).toMatch(/financial-year-dated/);
    // The fix is verification, not a year bump.
    expect(recs[0].title).toMatch(/Verify against the source/);
  });

  it("does NOT flag a dated-facts article inside the window", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [article("tax-guide", daysAgo(30), "Rules per FY 2025-26 apply.")],
    });
    expect(freshnessModule.run(ctx)).toHaveLength(0);
  });

  it("gives evergreen articles the longer clock", () => {
    const body = "Age is computed from your date of birth.";
    const inside = makeContext({
      now: NOW,
      articles: [article("age-guide", daysAgo(DATED_STALE_DAYS + 10), body)],
    });
    expect(freshnessModule.run(inside)).toHaveLength(0);

    const beyond = makeContext({
      now: NOW,
      articles: [article("age-guide", daysAgo(EVERGREEN_STALE_DAYS + 1), body)],
    });
    expect(freshnessModule.run(beyond)).toHaveLength(1);
  });

  it("evidence carries the real dates, not adjectives", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [article("tax-guide", daysAgo(200), "Finance Act 2025 changed the slabs.")],
    });
    const evidence = freshnessModule.run(ctx)[0].evidence;
    expect(evidence.find((e) => e.label === "Last updated")?.value).toBe(daysAgo(200));
    expect(evidence.find((e) => e.label === "Age")?.value).toBe("200 days");
  });

  it("needs no analytics — runs identically when every provider is blind", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [article("tax-guide", daysAgo(400), "Per FY 2025-26.")],
    });
    ctx.growth.noneLive = true;
    expect(freshnessModule.run(ctx)).toHaveLength(1);
  });
});
