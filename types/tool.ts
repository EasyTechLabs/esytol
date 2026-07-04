import type { CategorySlug } from "./category";

export interface FAQ {
  question: string;
  answer: string;
}

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
}

export type ToolFilter = {
  category?: CategorySlug;
  query?: string;
  featured?: boolean;
  popular?: boolean;
  isNew?: boolean;
};
