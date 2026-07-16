/**
 * Domains — how a *visitor* browses the platform.
 *
 * This is a presentation-level view over the registry, not a second taxonomy and
 * not a change to any tool's `category`.
 *
 * ## Why this exists
 * `Tool.category` is a **format** taxonomy (calculator, converter, formatter,
 * encoder…). Every live tool is currently `category: "calculator"`, so
 * `getLiveCategories()` returns exactly one entry and the homepage's "Browse by
 * Category" grid renders a single card reading *Calculators*. That one line does
 * more to brand Esytol as a calculator website than any copy on the page.
 *
 * The obvious fix — retagging tools to `finance`/`everyday` — is **not** available:
 * `category === "calculator"` is load-bearing in `ToolLayout` (it gates the entire
 * E-E-A-T trust surface: methodology, official sources, reviewer, disclaimer), in
 * `marketing-agent/scoring` (business value), and in three registry tests. Retagging
 * would silently strip the trust surface from every finance page and destroy the SEO
 * equity it earns. Fixing that gate means changing the Tool Framework.
 *
 * So domains sit **beside** the format taxonomy rather than replacing it: they are
 * derived from tags the registry already carries, they change no data, and they leave
 * `category` — and therefore every trust surface, schema and URL — untouched.
 *
 * ## Adding a domain later
 * Add an entry below. Nothing else changes: the homepage renders whatever
 * `getLiveDomains()` returns, and a domain with no live tools never appears. That is
 * the "future categories without another redesign" requirement — the design scales,
 * and it never advertises a category we cannot yet deliver.
 *
 * Known overlap: `marketing-agent/scoring.isFinanceTool()` and
 * `seo-intelligence/clusters.ts` each encode their own notion of "finance" for
 * internal analytics. Those answer different questions (business weight, topical
 * clusters) from this one (how a visitor browses), but the tag vocabulary is shared
 * and consolidating it is worth a future sprint.
 */

import type { Tool } from "@/types/tool";
import { getLiveTools } from "./index";

export interface Domain {
  slug: string;
  name: string;
  /** One line a first-time visitor can act on. */
  description: string;
  icon: string;
  /** A tool belongs to this domain if it carries any of these tags. */
  tags: string[];
}

/**
 * Ordered by strategic weight. Finance is first and stays first — it is the
 * strongest category and the revenue-adjacent one — but it no longer defines the
 * whole brand.
 */
export const DOMAINS: Domain[] = [
  {
    slug: "finance",
    name: "Finance",
    description: "Loans, tax, investments and retirement — built for India.",
    icon: "₹",
    // Deliberately broad: FD and RD carry "savings"/"bank"/"deposit" but no
    // "finance" tag, so a narrower list silently drops them from the homepage.
    // A tool missing from its domain is invisible — see the coverage test.
    tags: [
      "finance",
      "tax",
      "investment",
      "retirement",
      "loan",
      "emi",
      "savings",
      "bank",
      "deposit",
    ],
  },
  {
    slug: "everyday",
    name: "Everyday",
    description: "Dates, ages and everyday utilities.",
    icon: "🗓️",
    tags: ["everyday", "utility", "date", "age"],
  },
  {
    slug: "developer",
    name: "Developer",
    description: "JSON, encoders, formatters and regex.",
    icon: "⚙️",
    tags: ["developer", "json", "encoder", "formatter", "regex"],
  },
  {
    slug: "text",
    name: "Text",
    description: "Counters, converters and text utilities.",
    icon: "📝",
    tags: ["text", "case", "word"],
  },
];

export function toolsInDomain(domain: Domain, tools: Tool[] = getLiveTools()): Tool[] {
  return tools.filter((tool) => {
    const tags = tool.tags.map((t) => t.toLowerCase());
    return domain.tags.some((tag) => tags.includes(tag));
  });
}

/** The domain a tool browses under. First match wins, so DOMAINS order is precedence. */
export function domainForTool(tool: Tool): Domain | null {
  return DOMAINS.find((d) => toolsInDomain(d, [tool]).length > 0) ?? null;
}

/**
 * Only domains that actually have live tools, each with its real count.
 * A domain we have not built yet never reaches the homepage — the design makes room
 * for it, the copy does not promise it.
 */
export function getLiveDomains(): (Domain & { toolCount: number })[] {
  const live = getLiveTools();
  return DOMAINS.map((d) => ({ ...d, toolCount: toolsInDomain(d, live).length })).filter(
    (d) => d.toolCount > 0
  );
}
