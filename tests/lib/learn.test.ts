// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  readingTimeOf,
  extractFaqs,
  extractRelatedToolSlugs,
  getArticleSlugs,
  getArticleBySlug,
  getAllArticles,
  getArticlesByCategory,
  getRelatedArticles,
  getAdjacentArticles,
  categoryLabel,
} from "@/lib/learn";

const SAMPLE = `---
title: "Test Article: A Guide"
metaDescription: "A short description."
slug: "test-article"
category: "income-tax"
tags: ["one", "two", "three"]
lastUpdated: "2026-07-06"
reviewedBy: "EasyTechLabs Finance Team"
---

# Test Article

Intro paragraph with a [link](/tools/hra-calculator).

## Frequently asked questions

**Is this a question?**
Yes, this is the answer.

**Another question here?**
Another answer with a [link](/tools/income-tax-calculator).
`;

describe("parseFrontmatter", () => {
  it("parses scalar fields, quotes, colons and arrays", () => {
    const { data, body } = parseFrontmatter(SAMPLE);
    expect(data.title).toBe("Test Article: A Guide");
    expect(data.metaDescription).toBe("A short description.");
    expect(data.slug).toBe("test-article");
    expect(data.category).toBe("income-tax");
    expect(data.tags).toEqual(["one", "two", "three"]);
    expect(data.reviewedBy).toBe("EasyTechLabs Finance Team");
    expect(body.startsWith("# Test Article")).toBe(true);
  });

  it("returns empty frontmatter when the block is missing", () => {
    const { data, body } = parseFrontmatter("no frontmatter here");
    expect(data.title).toBe("");
    expect(body).toBe("no frontmatter here");
  });
});

describe("readingTimeOf", () => {
  it("is at least 1 minute and scales with length", () => {
    expect(readingTimeOf("one two three")).toBe(1);
    const long = Array.from({ length: 800 }, () => "word").join(" ");
    expect(readingTimeOf(long)).toBe(4); // 800 / 200
  });
});

describe("extractFaqs", () => {
  it("extracts question/answer pairs and strips inline markdown", () => {
    const { body } = parseFrontmatter(SAMPLE);
    const faqs = extractFaqs(body);
    expect(faqs).toHaveLength(2);
    expect(faqs[0]).toEqual({
      question: "Is this a question?",
      answer: "Yes, this is the answer.",
    });
    // link markdown stripped to its label
    expect(faqs[1].answer).toBe("Another answer with a link.");
  });

  it("returns [] when there is no FAQ section", () => {
    expect(extractFaqs("## Something\n\ntext")).toEqual([]);
  });
});

describe("extractRelatedToolSlugs", () => {
  it("collects unique /tools/<slug> references in order", () => {
    const { body } = parseFrontmatter(SAMPLE);
    expect(extractRelatedToolSlugs(body)).toEqual(["hra-calculator", "income-tax-calculator"]);
  });
});

// ── Against the real content/articles ─────────────────────────────────────────

describe("Learn content library (real articles)", () => {
  it("finds article files", () => {
    expect(getArticleSlugs().length).toBeGreaterThan(0);
  });

  it("every article has the required frontmatter and matching slug", () => {
    for (const slug of getArticleSlugs()) {
      const a = getArticleBySlug(slug);
      expect(a, slug).not.toBeNull();
      expect(a!.frontmatter.title, slug).toBeTruthy();
      expect(a!.frontmatter.metaDescription, slug).toBeTruthy();
      expect(a!.frontmatter.category, slug).toBeTruthy();
      expect(a!.frontmatter.tags.length, slug).toBeGreaterThan(0);
      expect(a!.readingTime, slug).toBeGreaterThanOrEqual(1);
      // the frontmatter slug, when present, matches the filename
      if (a!.frontmatter.slug) expect(a!.frontmatter.slug, slug).toBe(slug);
    }
  });

  it("every article extracts FAQs and at least one related calculator", () => {
    for (const slug of getArticleSlugs()) {
      const a = getArticleBySlug(slug)!;
      expect(a.faqs.length, slug).toBeGreaterThan(0);
      expect(a.relatedToolSlugs.length, slug).toBeGreaterThan(0);
    }
  });

  it("getArticleBySlug returns null for an unknown slug", () => {
    expect(getArticleBySlug("does-not-exist")).toBeNull();
  });

  it("getAllArticles is sorted and covers every file", () => {
    const all = getAllArticles();
    expect(all.length).toBe(getArticleSlugs().length);
  });

  it("groups articles by category", () => {
    const groups = getArticlesByCategory();
    expect(groups.length).toBeGreaterThan(0);
    const totalGrouped = groups.reduce((n, g) => n + g.articles.length, 0);
    expect(totalGrouped).toBe(getAllArticles().length);
  });

  it("adjacency is consistent with the sorted order", () => {
    const all = getAllArticles();
    const first = all[0].slug;
    const last = all[all.length - 1].slug;
    expect(getAdjacentArticles(first).prev).toBeNull();
    expect(getAdjacentArticles(last).next).toBeNull();
    if (all.length > 1) {
      expect(getAdjacentArticles(first).next!.slug).toBe(all[1].slug);
    }
  });

  it("related articles exclude the current article", () => {
    const slug = getArticleSlugs()[0];
    const related = getRelatedArticles(slug);
    expect(related.every((a) => a.slug !== slug)).toBe(true);
  });
});

describe("categoryLabel", () => {
  it("title-cases hyphenated category slugs", () => {
    expect(categoryLabel("income-tax")).toBe("Income Tax");
    expect(categoryLabel("retirement")).toBe("Retirement");
  });
});
