/**
 * Global tool search engine (PLATFORM-006).
 *
 * A pure, dependency-free, weighted fuzzy search over the tool registry. It indexes every field a
 * user might search by — name, description, keywords, tags, category, aliases, and use cases — so a
 * new tool becomes searchable the moment it is registered, with **zero search code per tool**.
 *
 * Deterministic and side-effect free (the caller passes the tool list), which keeps it unit-testable
 * and reusable by the command palette, the /tools page, and any future search surface.
 */

import type { Tool } from "@/types/tool";
import { categories } from "@/registry/categories";
import { getLiveTools } from "@/registry";

export interface SearchResult {
  tool: Tool;
  score: number;
}

const CATEGORY_NAME = new Map(categories.map((c) => [c.slug, c.name.toLowerCase()]));

/** Every field of a tool that search should look at, lower-cased once. */
interface Indexed {
  tool: Tool;
  name: string;
  keywords: string[];
  aliases: string[];
  tags: string[];
  useCases: string[];
  category: string;
  description: string;
}

function indexTool(tool: Tool): Indexed {
  return {
    tool,
    name: tool.name.toLowerCase(),
    keywords: (tool.keywords ?? []).map((k) => k.toLowerCase()),
    aliases: (tool.aliases ?? []).map((a) => a.toLowerCase()),
    tags: tool.tags.map((t) => t.toLowerCase()),
    useCases: (tool.useCases ?? []).map((u) => u.toLowerCase()),
    category: `${tool.category} ${CATEGORY_NAME.get(tool.category) ?? ""}`.trim(),
    description: tool.description.toLowerCase(),
  };
}

/** True if all characters of `needle` appear in `haystack` in order — cheap typo/partial tolerance. */
export function fuzzySubsequence(needle: string, haystack: string): boolean {
  if (needle === "") return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Score one search term against one indexed tool. Higher = more relevant; 0 = no match. */
function scoreTerm(term: string, doc: Indexed): number {
  let score = 0;

  if (doc.name === term) score = Math.max(score, 100);
  else if (doc.name.startsWith(term)) score = Math.max(score, 60);
  else if (doc.name.includes(term)) score = Math.max(score, 40);

  if (doc.keywords.some((k) => k === term)) score = Math.max(score, 34);
  else if (doc.keywords.some((k) => k.includes(term))) score = Math.max(score, 24);

  if (doc.aliases.some((a) => a === term)) score = Math.max(score, 30);
  else if (doc.aliases.some((a) => a.includes(term))) score = Math.max(score, 20);

  if (doc.tags.some((t) => t === term)) score = Math.max(score, 22);
  else if (doc.tags.some((t) => t.includes(term))) score = Math.max(score, 12);

  if (doc.category.includes(term)) score = Math.max(score, 10);
  if (doc.useCases.some((u) => u.includes(term))) score = Math.max(score, 9);
  if (doc.description.includes(term)) score = Math.max(score, 8);

  // Typo/partial tolerance: only when nothing above matched, and only against the name.
  if (score === 0 && term.length >= 3 && fuzzySubsequence(term, doc.name)) score = 5;

  return score;
}

/**
 * Rank tools for a query. Multi-word queries are AND-ish: every term must match somewhere, so
 * "json format" ranks the JSON Formatter above tools that match only one word.
 */
export function searchTools(query: string, tools: Tool[] = getLiveTools()): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];
  for (const tool of tools) {
    const doc = indexTool(tool);
    let total = 0;
    let allTermsMatch = true;
    for (const term of terms) {
      const s = scoreTerm(term, doc);
      if (s === 0) {
        allTermsMatch = false;
        break;
      }
      total += s;
    }
    if (!allTermsMatch) continue;

    // Phrase bonus: the full query appearing in the name/keywords beats scattered term matches.
    if (terms.length > 1) {
      if (doc.name.includes(q)) total += 30;
      else if (doc.keywords.some((k) => k.includes(q))) total += 12;
    }
    // Gentle popularity tiebreaker so equally-relevant tools order sensibly.
    if (tool.featured) total += 1;
    if (tool.popular) total += 1;

    if (total > 0) results.push({ tool, score: total });
  }

  results.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return results;
}

/** Convenience: just the tools, ranked, optionally capped. */
export function searchToolList(query: string, limit?: number, tools?: Tool[]): Tool[] {
  const ranked = searchTools(query, tools).map((r) => r.tool);
  return limit ? ranked.slice(0, limit) : ranked;
}
