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
  { label: "Learn", href: "/learn" },
];

export const footerNav = {
  // The most-used live tools. Finance dominates because finance is our deepest
  // category — not because the platform is defined by it. When another category
  // grows, it earns a place here on the same basis.
  tools: [
    { label: "EMI Calculator", href: "/tools/emi-calculator" },
    { label: "Home Loan Calculator", href: "/tools/home-loan-calculator" },
    { label: "SIP Calculator", href: "/tools/sip-calculator" },
    { label: "Income Tax Calculator", href: "/tools/income-tax-calculator" },
    { label: "GST Calculator", href: "/tools/gst-calculator" },
    { label: "Age Calculator", href: "/tools/age-calculator" },
  ],
  // Category-agnostic routes — these never need touching as categories are added.
  explore: [
    { label: "All Tools", href: "/tools" },
    { label: "Learn", href: "/learn" },
    { label: "New", href: "/new" },
    { label: "Popular", href: "/popular" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;
