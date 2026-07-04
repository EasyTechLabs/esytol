import type { Category } from "@/types/category";

export const categories: Category[] = [
  {
    slug: "developer",
    name: "Developer",
    description: "JSON, regex, encoders, formatters and more for developers.",
    icon: "⚙️",
  },
  {
    slug: "text",
    name: "Text",
    description: "Word counters, case converters, and text manipulation tools.",
    icon: "📝",
  },
  {
    slug: "converter",
    name: "Converters",
    description: "Unit, color, currency, and file format converters.",
    icon: "🔄",
  },
  {
    slug: "generator",
    name: "Generators",
    description: "Lorem ipsum, passwords, UUIDs, and placeholder generators.",
    icon: "✨",
  },
  {
    slug: "formatter",
    name: "Formatters",
    description: "Format and beautify JSON, HTML, CSS, SQL, and more.",
    icon: "🎨",
  },
  {
    slug: "encoder",
    name: "Encoders",
    description: "Base64, URL, HTML entity encoding and decoding.",
    icon: "🔐",
  },
  {
    slug: "color",
    name: "Color",
    description: "Color pickers, converters, palette generators.",
    icon: "🌈",
  },
  {
    slug: "security",
    name: "Security",
    description: "Password generators, hash tools, and security utilities.",
    icon: "🛡️",
  },
  {
    slug: "image",
    name: "Image",
    description: "Image compressors, resizers, and format converters.",
    icon: "🖼️",
  },
  {
    slug: "calculator",
    name: "Calculators",
    description: "EMI, percentage, tax, and financial calculators.",
    icon: "🧮",
  },
  {
    slug: "misc",
    name: "Miscellaneous",
    description: "All the other useful tools that don't fit a category.",
    icon: "🔧",
  },
];
