import type { CategorySlug } from "./category";

export interface FAQ {
  question: string;
  answer: string;
}

/**
 * Lifecycle status of a tool.
 * - "live" (default when omitted): fully implemented and interactive.
 * - "coming-soon": registered/listed but not yet implemented. Such tools are
 *   excluded from the sitemap and marked noindex, and are badged in listings.
 */
export type ToolStatus = "live" | "coming-soon";

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CategorySlug;
  tags: string[];
  keywords?: string[];
  /**
   * Alternative names a user might search for (e.g. "beautify", "prettify", "minify").
   * Optional and indexed by the global search when present — no page renders them directly.
   */
  aliases?: string[];
  /**
   * Concrete tasks the tool solves (e.g. "debug an API response"). Optional; indexed by search.
   */
  useCases?: string[];
  icon: string;
  url: string;
  faq?: FAQ[];
  /**
   * Curated related-tool slugs. Optional — when omitted or short, `getRelatedTools` derives
   * related tools from shared tags/category so no tool is ever an internal-linking orphan.
   */
  relatedTools?: string[];
  lastUpdated?: string;
  version?: string;
  featured?: boolean;
  popular?: boolean;
  isNew?: boolean;
  /** Defaults to "live" when omitted. */
  status?: ToolStatus;
}

export type ToolFilter = {
  category?: CategorySlug;
  query?: string;
  featured?: boolean;
  popular?: boolean;
  isNew?: boolean;
};
