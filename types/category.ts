export type CategorySlug =
  | "text"
  | "developer"
  | "converter"
  | "generator"
  | "formatter"
  | "encoder"
  | "color"
  | "security"
  | "image"
  | "misc";

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
  icon: string;
  toolCount?: number;
}
