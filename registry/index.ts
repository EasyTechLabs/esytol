import type { Tool, ToolFilter } from "@/types/tool";

export const toolRegistry: Tool[] = [
  // ─── Developer ───────────────────────────────────────────────────────────
  {
    id: "json-formatter",
    name: "JSON Formatter",
    slug: "json-formatter",
    description: "Format, validate, and beautify JSON data with syntax highlighting.",
    category: "developer",
    tags: ["json", "formatter", "validator", "developer"],
    icon: "📋",
    url: "/tools/json-formatter",
    featured: true,
    popular: true,
  },
  {
    id: "base64-encoder",
    name: "Base64 Encoder / Decoder",
    slug: "base64-encoder",
    description: "Encode plain text or files to Base64 and decode Base64 strings instantly.",
    category: "encoder",
    tags: ["base64", "encoder", "decoder", "developer"],
    icon: "🔡",
    url: "/tools/base64-encoder",
    popular: true,
  },
  {
    id: "url-encoder",
    name: "URL Encoder / Decoder",
    slug: "url-encoder",
    description: "Percent-encode URLs for safe transmission and decode them back.",
    category: "encoder",
    tags: ["url", "encoder", "decoder", "percent-encoding"],
    icon: "🔗",
    url: "/tools/url-encoder",
    isNew: true,
  },

  // ─── Text ─────────────────────────────────────────────────────────────────
  {
    id: "word-counter",
    name: "Word Counter",
    slug: "word-counter",
    description: "Count words, characters, sentences, and paragraphs in any text.",
    category: "text",
    tags: ["word", "counter", "character", "text"],
    icon: "🔢",
    url: "/tools/word-counter",
    featured: true,
    popular: true,
  },
  {
    id: "case-converter",
    name: "Case Converter",
    slug: "case-converter",
    description: "Convert text between UPPER, lower, Title, camelCase, snake_case, and kebab-case.",
    category: "text",
    tags: ["case", "converter", "text", "camelCase", "snake_case"],
    icon: "🔡",
    url: "/tools/case-converter",
    popular: true,
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum Generator",
    slug: "lorem-ipsum",
    description: "Generate configurable placeholder text for wireframes and mockups.",
    category: "generator",
    tags: ["lorem", "ipsum", "placeholder", "generator", "text"],
    icon: "📄",
    url: "/tools/lorem-ipsum",
    isNew: true,
  },

  // ─── Security ─────────────────────────────────────────────────────────────
  {
    id: "password-generator",
    name: "Password Generator",
    slug: "password-generator",
    description: "Generate strong, cryptographically secure passwords with custom rules.",
    category: "security",
    tags: ["password", "generator", "security", "random"],
    icon: "🔑",
    url: "/tools/password-generator",
    featured: true,
  },
  {
    id: "hash-generator",
    name: "Hash Generator",
    slug: "hash-generator",
    description: "Compute MD5, SHA-1, SHA-256, and SHA-512 hashes for any string.",
    category: "security",
    tags: ["hash", "md5", "sha256", "sha512", "security"],
    icon: "🔏",
    url: "/tools/hash-generator",
    popular: true,
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    slug: "uuid-generator",
    description: "Generate RFC-4122 compliant UUIDs (v4) in bulk with one click.",
    category: "generator",
    tags: ["uuid", "guid", "generator", "random"],
    icon: "🆔",
    url: "/tools/uuid-generator",
    isNew: true,
  },
];

// ─── Slug index (O(1) lookup) ────────────────────────────────────────────────

const _slugIndex = new Map<string, Tool>(toolRegistry.map((t) => [t.slug, t]));

// ─── Query helpers ──────────────────────────────────────────────────────────

export function getTools(filter?: ToolFilter): Tool[] {
  let tools = [...toolRegistry];

  if (filter?.category) {
    tools = tools.filter((t) => t.category === filter.category);
  }
  if (filter?.featured) {
    tools = tools.filter((t) => t.featured === true);
  }
  if (filter?.popular) {
    tools = tools.filter((t) => t.popular === true);
  }
  if (filter?.isNew) {
    tools = tools.filter((t) => t.isNew === true);
  }
  if (filter?.query) {
    const q = filter.query.toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return tools;
}

export function getFeaturedTools(): Tool[] {
  return getTools({ featured: true });
}

export function getPopularTools(): Tool[] {
  return getTools({ popular: true });
}

export function getNewTools(): Tool[] {
  return getTools({ isNew: true });
}

export function getToolBySlug(slug: string): Tool | undefined {
  return _slugIndex.get(slug);
}

export function getToolCount(): number {
  return toolRegistry.length;
}
