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
  icon: string;
  url: string;
  faq?: FAQ[];
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
