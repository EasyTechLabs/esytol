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
    keywords: ["json formatter online", "json validator", "json beautifier", "json pretty print"],
    icon: "📋",
    url: "/tools/json-formatter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["base64-encoder", "url-encoder"],
    faq: [
      {
        question: "Is my JSON data sent to a server?",
        answer:
          "No. All formatting and validation happens entirely in your browser. Nothing is sent to any server.",
      },
      {
        question: "What is the maximum JSON size I can format?",
        answer:
          "There is no hard limit; however, very large JSON files (10 MB+) may be slower depending on your device.",
      },
      {
        question: "Can I use this to validate JSON syntax errors?",
        answer:
          "Yes. The formatter highlights syntax errors and shows the exact position of the issue.",
      },
    ],
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
    keywords: ["base64 encoder", "base64 decoder", "base64 online", "encode decode base64"],
    icon: "🔡",
    url: "/tools/base64-encoder",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["url-encoder", "json-formatter"],
    faq: [
      {
        question: "What is Base64 encoding?",
        answer:
          "Base64 converts binary or text data into 64 printable ASCII characters, making it safe to transmit over text-only systems.",
      },
      {
        question: "Is Base64 the same as encryption?",
        answer:
          "No. Base64 is encoding, not encryption. Anyone can decode a Base64 string — it provides no security.",
      },
      {
        question: "Can I encode files to Base64?",
        answer:
          "Yes. Use the file input option to encode any file's binary content to a Base64 string.",
      },
    ],
    popular: true,
  },
  {
    id: "url-encoder",
    name: "URL Encoder / Decoder",
    slug: "url-encoder",
    description: "Percent-encode URLs for safe transmission and decode them back.",
    category: "encoder",
    tags: ["url", "encoder", "decoder", "percent-encoding"],
    keywords: ["url encoder online", "url decoder", "percent encoding", "urlencode", "urldecode"],
    icon: "🔗",
    url: "/tools/url-encoder",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["base64-encoder", "json-formatter"],
    faq: [
      {
        question: "What is URL encoding?",
        answer:
          "URL encoding (percent-encoding) replaces unsafe ASCII characters with a % followed by two hex digits so they can be safely included in a URL.",
      },
      {
        question: "When should I URL-encode a string?",
        answer:
          "Encode strings before appending them as query parameters or path segments to avoid breaking the URL structure.",
      },
    ],
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
    keywords: ["word counter online", "character counter", "word count tool", "sentence counter"],
    icon: "🔢",
    url: "/tools/word-counter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["case-converter", "lorem-ipsum"],
    faq: [
      {
        question: "Does the word counter include punctuation in character counts?",
        answer:
          "The character count with spaces includes every character including punctuation. The count without spaces excludes whitespace only.",
      },
      {
        question: "How are words defined?",
        answer:
          "A word is any sequence of non-whitespace characters separated by spaces, tabs, or newlines.",
      },
    ],
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
    keywords: [
      "case converter online",
      "camelcase converter",
      "snake case converter",
      "text case changer",
    ],
    icon: "🔡",
    url: "/tools/case-converter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["word-counter", "lorem-ipsum"],
    faq: [
      {
        question: "What is camelCase?",
        answer:
          "camelCase joins words without spaces and capitalises the first letter of each word except the first (e.g. myVariableName).",
      },
      {
        question: "What is the difference between snake_case and kebab-case?",
        answer:
          "snake_case uses underscores between words; kebab-case uses hyphens. Both are lowercase.",
      },
    ],
    popular: true,
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum Generator",
    slug: "lorem-ipsum",
    description: "Generate configurable placeholder text for wireframes and mockups.",
    category: "generator",
    tags: ["lorem", "ipsum", "placeholder", "generator", "text"],
    keywords: ["lorem ipsum generator", "placeholder text", "dummy text generator", "filler text"],
    icon: "📄",
    url: "/tools/lorem-ipsum",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["word-counter", "case-converter"],
    faq: [
      {
        question: "What is Lorem Ipsum?",
        answer:
          'Lorem Ipsum is dummy text derived from Cicero\'s "de Finibus Bonorum et Malorum" (45 BC). It has been the standard placeholder text in the printing industry since the 1500s.',
      },
      {
        question: "Can I generate Lorem Ipsum in different languages?",
        answer:
          "Currently the generator produces classic Latin-based Lorem Ipsum. Multi-language support is planned.",
      },
    ],
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
    keywords: [
      "password generator online",
      "strong password generator",
      "random password",
      "secure password",
    ],
    icon: "🔑",
    url: "/tools/password-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["hash-generator", "uuid-generator"],
    faq: [
      {
        question: "Are generated passwords stored anywhere?",
        answer:
          "No. Passwords are generated client-side using the Web Crypto API and are never sent to any server.",
      },
      {
        question: "What makes a password cryptographically secure?",
        answer:
          "The generator uses window.crypto.getRandomValues(), which uses the operating system's entropy source, making it suitable for security-sensitive applications.",
      },
      {
        question: "How long should my password be?",
        answer:
          "Security experts recommend at least 16 characters for most accounts and 24+ for high-value accounts.",
      },
    ],
    featured: true,
  },
  {
    id: "hash-generator",
    name: "Hash Generator",
    slug: "hash-generator",
    description: "Compute MD5, SHA-1, SHA-256, and SHA-512 hashes for any string.",
    category: "security",
    tags: ["hash", "md5", "sha256", "sha512", "security"],
    keywords: ["hash generator", "sha256 online", "md5 generator", "sha512 hash", "checksum"],
    icon: "🔏",
    url: "/tools/hash-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["password-generator", "uuid-generator"],
    faq: [
      {
        question: "What is a hash function?",
        answer:
          "A hash function maps arbitrary-length input to a fixed-length output. The same input always produces the same hash, and it is computationally infeasible to reverse.",
      },
      {
        question: "Is MD5 still safe to use?",
        answer:
          "MD5 is broken for security purposes (collision attacks exist). Use SHA-256 or SHA-512 for integrity verification.",
      },
    ],
    popular: true,
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    slug: "uuid-generator",
    description: "Generate RFC-4122 compliant UUIDs (v4) in bulk with one click.",
    category: "generator",
    tags: ["uuid", "guid", "generator", "random"],
    keywords: ["uuid generator online", "guid generator", "random uuid", "uuid v4"],
    icon: "🆔",
    url: "/tools/uuid-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["hash-generator", "password-generator"],
    faq: [
      {
        question: "What is a UUID?",
        answer:
          "A UUID (Universally Unique Identifier) is a 128-bit label used to uniquely identify objects in computer systems without central coordination.",
      },
      {
        question: "What is the difference between UUID v4 and other versions?",
        answer:
          "UUID v4 is randomly generated. v1 is time-based, v3/v5 are name-based (hashed). v4 is the most common for general-purpose unique IDs.",
      },
    ],
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
