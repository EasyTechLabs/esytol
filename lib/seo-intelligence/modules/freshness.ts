/**
 * 7 — Content Freshness (GROWTH-002).
 *
 * The one opportunity class detectable with zero analytics: staleness is a fact of
 * the repository, not of user behaviour. Evidence is real dates and real dated
 * facts in the text — never a guess about rankings.
 *
 * Two tiers, because not all staleness is equal:
 * - an article whose body cites financial-year-dated rules (FY 20xx-xx, AY, "Budget
 *   20xx", Finance Act) drifts out of truth on a statutory calendar — flagged
 *   sooner and harder;
 * - an evergreen article merely ages — flagged later, gently.
 *
 * The fix is verification against the official source, not a blind year-bump:
 * SEO-001's standing lesson is that freshness must be earned, not typed.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import { buildRecommendation, businessValueForPage } from "@/lib/marketing-agent/scoring";
import type { SeoContext, SeoModule } from "../types";

/** Dated-fact markers that put an article on the statutory clock. */
const DATED_FACT = /FY\s?20\d{2}-\d{2}|AY\s?20\d{2}-\d{2}|Finance Act,? 20\d{2}|Budget 20\d{2}/;

/** Days before a dated-facts article is due for source verification. */
export const DATED_STALE_DAYS = 120;
/** Days before any article is worth a review pass. */
export const EVERGREEN_STALE_DAYS = 365;

const PER_RULE_LIMIT = 6;

export const freshnessModule: SeoModule = {
  key: "freshness",
  label: "Content Freshness",
  purpose: "Articles whose dated facts or age put their accuracy on the clock",
  run(ctx: SeoContext): Recommendation[] {
    const out: Recommendation[] = [];

    const aged = ctx.articles
      .map((article) => {
        const updated = Date.parse(article.frontmatter.lastUpdated);
        const ageDays = Number.isFinite(updated)
          ? Math.floor((ctx.now.getTime() - updated) / 86_400_000)
          : Number.MAX_SAFE_INTEGER;
        const dated = DATED_FACT.test(article.body);
        return { article, ageDays, dated };
      })
      .filter(
        ({ ageDays, dated }) =>
          (dated && ageDays > DATED_STALE_DAYS) || ageDays > EVERGREEN_STALE_DAYS
      )
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, PER_RULE_LIMIT);

    for (const { article, ageDays, dated } of aged) {
      const page = `/learn/${article.slug}`;
      out.push(
        buildRecommendation({
          id: `content-freshness-${article.slug}`,
          agent: "content",
          title: `Verify against the source — ${article.frontmatter.title}`,
          reason: dated
            ? `Cites financial-year-dated rules and was last verified ${ageDays} days ago — statutory facts drift on a Finance-Act calendar.`
            : `Last reviewed ${ageDays} days ago — a review pass keeps the E-E-A-T update date honest.`,
          expectedImpact: dated
            ? "Confirms the figures against the current Act (or corrects them) — protecting the accuracy the brand is built on."
            : "A verified update date is a freshness signal that is actually true.",
          effort: "S",
          confidence: dated ? 0.8 : 0.6,
          owner: "Content",
          page,
          evidence: [
            { label: "Last updated", value: article.frontmatter.lastUpdated },
            { label: "Age", value: `${ageDays} days` },
            { label: "Dated facts", value: dated ? "yes (FY/Finance Act references)" : "no" },
          ],
          trafficPotential: 0.3,
          businessValue: businessValueForPage(page, ctx.tools),
          deadlineDays: dated ? 14 : 45,
          now: ctx.now,
        })
      );
    }
    return out;
  },
};
