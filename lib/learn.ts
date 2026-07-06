/**
 * Esytol Learn Center — content layer.
 *
 * Reads the production-ready SEO articles under `content/articles/*.md` at build
 * time, parses their frontmatter and body, and exposes helpers for the listing
 * page, individual article pages, related content, and navigation.
 *
 * No external markdown/frontmatter dependency is used — the parser is a focused,
 * self-contained subset that covers exactly the constructs the articles use.
 * Rendering of the body to React lives in `features/learn/Markdown.tsx`.
 */

import fs from "node:fs";
import path from "node:path";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

/** Display order for categories on the listing page and prev/next navigation. */
const CATEGORY_ORDER = ["income-tax", "retirement", "everyday"];

export interface ArticleFrontmatter {
  title: string;
  metaTitle?: string;
  metaDescription: string;
  slug?: string;
  category: string;
  tags: string[];
  lastUpdated: string;
  reviewedBy: string;
}

export interface ArticleMeta {
  /** Route slug (the filename without `.md`). */
  slug: string;
  frontmatter: ArticleFrontmatter;
  /** Estimated reading time in minutes. */
  readingTime: number;
}

export interface ArticleFaq {
  question: string;
  answer: string;
}

export interface Article extends ArticleMeta {
  /** Markdown body (frontmatter stripped). */
  body: string;
  faqs: ArticleFaq[];
  /** Slugs of calculators linked from the body (`/tools/<slug>`). */
  relatedToolSlugs: string[];
}

// ── Frontmatter + body parsing ──────────────────────────────────────────────

export function parseFrontmatter(raw: string): { data: ArticleFrontmatter; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) {
    return { data: emptyFrontmatter(), body: normalized };
  }
  const [, block, body] = match;
  const data: Record<string, string | string[]> = {};

  for (const line of block.split("\n")) {
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2].trim();
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      data[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  return {
    data: {
      title: (data.title as string) ?? "",
      metaTitle: data.metaTitle as string | undefined,
      metaDescription: (data.metaDescription as string) ?? "",
      slug: data.slug as string | undefined,
      category: (data.category as string) ?? "general",
      tags: Array.isArray(data.tags) ? data.tags : [],
      lastUpdated: (data.lastUpdated as string) ?? "",
      reviewedBy: (data.reviewedBy as string) ?? "EasyTechLabs Finance Team",
    },
    body: body.trim(),
  };
}

function emptyFrontmatter(): ArticleFrontmatter {
  return {
    title: "",
    metaDescription: "",
    category: "general",
    tags: [],
    lastUpdated: "",
    reviewedBy: "EasyTechLabs Finance Team",
  };
}

/** ~200 words per minute, minimum 1 minute. */
export function readingTimeOf(body: string): number {
  const words = (body.match(/\S+/g) ?? []).length;
  return Math.max(1, Math.round(words / 200));
}

/** Strip inline markdown for use in plain-text contexts (e.g. JSON-LD answers). */
function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → label
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/`([^`]+)`/g, "$1") // code
    .replace(/_([^_]+)_/g, "$1") // italics
    .trim();
}

/**
 * Extract FAQ pairs from the article body. Articles use a
 * "## Frequently asked questions" section where each question is a bold-only
 * paragraph ending in "?" followed by an answer paragraph.
 */
export function extractFaqs(body: string): ArticleFaq[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const startIdx = lines.findIndex((l) => /^##\s+frequently asked questions/i.test(l.trim()));
  if (startIdx === -1) return [];

  const faqs: ArticleFaq[] = [];
  let pendingQuestion: string | null = null;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^##\s/.test(line)) break; // next section
    if (/^---+$/.test(line)) break; // end of section
    if (!line) continue;

    const q = /^\*\*(.+?)\*\*$/.exec(line);
    if (q && q[1].trim().endsWith("?")) {
      pendingQuestion = stripInline(q[1].trim());
      continue;
    }
    if (pendingQuestion) {
      faqs.push({ question: pendingQuestion, answer: stripInline(line) });
      pendingQuestion = null;
    }
  }
  return faqs;
}

/** Unique `/tools/<slug>` references in the body, in first-seen order. */
export function extractRelatedToolSlugs(body: string): string[] {
  const slugs: string[] = [];
  const re = /\/tools\/([a-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (!slugs.includes(m[1])) slugs.push(m[1]);
  }
  return slugs;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getArticleSlugs(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getArticleBySlug(slug: string): Article | null {
  const file = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, body } = parseFrontmatter(raw);
  return {
    slug,
    frontmatter: data,
    readingTime: readingTimeOf(body),
    body,
    faqs: extractFaqs(body),
    relatedToolSlugs: extractRelatedToolSlugs(body),
  };
}

function categoryRank(category: string): number {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

/** All articles, sorted by category order then title. */
export function getAllArticles(): ArticleMeta[] {
  return getArticleSlugs()
    .map((slug) => {
      const a = getArticleBySlug(slug);
      return a ? { slug: a.slug, frontmatter: a.frontmatter, readingTime: a.readingTime } : null;
    })
    .filter((a): a is ArticleMeta => a !== null)
    .sort((a, b) => {
      const r = categoryRank(a.frontmatter.category) - categoryRank(b.frontmatter.category);
      if (r !== 0) return r;
      return a.frontmatter.title.localeCompare(b.frontmatter.title);
    });
}

/** Articles grouped by category, in display order. */
export function getArticlesByCategory(): { category: string; articles: ArticleMeta[] }[] {
  const all = getAllArticles();
  const groups: { category: string; articles: ArticleMeta[] }[] = [];
  for (const a of all) {
    let group = groups.find((g) => g.category === a.frontmatter.category);
    if (!group) {
      group = { category: a.frontmatter.category, articles: [] };
      groups.push(group);
    }
    group.articles.push(a);
  }
  return groups;
}

export function getRelatedArticles(slug: string, limit = 4): ArticleMeta[] {
  const all = getAllArticles();
  const current = all.find((a) => a.slug === slug);
  if (!current) return [];
  const sameCategory = all.filter(
    (a) => a.slug !== slug && a.frontmatter.category === current.frontmatter.category
  );
  const others = all.filter(
    (a) => a.slug !== slug && a.frontmatter.category !== current.frontmatter.category
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export function getAdjacentArticles(slug: string): {
  prev: ArticleMeta | null;
  next: ArticleMeta | null;
} {
  const all = getAllArticles();
  const idx = all.findIndex((a) => a.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

export function categoryLabel(category: string): string {
  return category
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
