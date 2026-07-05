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
  // Direct links to live calculators — a focused finance-calculator site.
  tools: [
    { label: "EMI Calculator", href: "/tools/emi-calculator" },
    { label: "Home Loan Calculator", href: "/tools/home-loan-calculator" },
    { label: "SIP Calculator", href: "/tools/sip-calculator" },
    { label: "FD Calculator", href: "/tools/fd-calculator" },
    { label: "GST Calculator", href: "/tools/gst-calculator" },
    { label: "Personal Loan Calculator", href: "/tools/personal-loan-calculator" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;
