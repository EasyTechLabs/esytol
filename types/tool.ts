import type { CategorySlug } from "./category";

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CategorySlug;
  tags: string[];
  icon: string;
  url: string;
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
