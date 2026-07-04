export type NavItem = {
  label: string;
  href: string;
};

export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "All Tools", href: "/tools" },
  { label: "Categories", href: "/categories" },
  { label: "New", href: "/new" },
  { label: "Popular", href: "/popular" },
];

export const footerNav = {
  tools: [
    { label: "Text Tools", href: "/categories/text" },
    { label: "Developer Tools", href: "/categories/developer" },
    { label: "Converters", href: "/categories/converter" },
    { label: "Generators", href: "/categories/generator" },
    { label: "Encoders", href: "/categories/encoder" },
    { label: "Security", href: "/categories/security" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;
