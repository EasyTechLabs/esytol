# SEO, Navigation & Discoverability Platform — PLATFORM-006

> **Type:** Platform-engineering sprint (not a tool sprint). **Status:** ✅ Live · **Last Updated:** 2026-07-19
> **Objective:** make every _future_ page automatically inherit SEO, navigation, internal linking,
> structured data, discovery, and accessibility — with no per-page implementation — and enforce it so
> each sprint is easier to rank than the last.

---

## What already existed (kept, not duplicated)

Esytol already had a strong SEO base: `buildToolMetadata` (title/description/**canonical**/OG/Twitter/
dynamic OG image), JSON-LD builders (SoftwareApplication, BreadcrumbList, FAQPage, WebSite+SearchAction,
Organization, Article), a sitemap + robots, a visible Breadcrumb, hand-set related tools, category pages,
domain routing, GA4/Clarity analytics, and SEO tests (metadata/sitemap/jsonld/routes/registry/domains).
PLATFORM-006 **builds on** all of it and fills the gaps rather than re-implementing.

## Gaps closed → new reusable platform capabilities

### 1. Global search (⌘K / Ctrl+K) — `lib/search/toolSearch.ts` + `features/search/*`

A permanent, site-wide command palette mounted **once** in the root layout, so every page inherits it.

- **`lib/search/toolSearch.ts`** — a pure, weighted, typo-tolerant search engine that auto-indexes the
  registry across **name, keywords, aliases, tags, category, use cases, description**. Multi-word queries
  are AND-ish; a fuzzy subsequence fallback tolerates small typos. **Adding a tool needs zero search
  code** — it is searchable the moment it is registered (guaranteed by a test).
- **`features/search/CommandPalette.tsx`** — ⌘K/Ctrl+K (and a header-button event) open it anywhere;
  keyboard navigation (↑↓/Enter/Esc), empty-state shows recent + popular + browse-by-category,
  screen-reader friendly (dialog + combobox + listbox + option, `aria-activedescendant`), body-scroll
  lock, focus returns to the opener on close, mobile-friendly.
- **`features/search/SearchTrigger.tsx`** — the header search button, decoupled via a window event.

### 2. Metadata-driven related tools & internal-link graph — `registry/index.ts`

- **`getRelatedTools(tool, limit)`** — curated `relatedTools` first (author intent), then **derived** from
  shared tags → category → keywords, then topped up (same-category → popular → featured) so the list is
  **always full and never an orphan**. No hand-maintained end-to-end lists required going forward.
- **`getAdjacentTools(tool)`** — Previous/Next within the category (wrapping), for sequential navigation.
- `ToolSidebar` now renders related + prev/next automatically; `RelatedTools` became a pure presenter.

### 3. Structured data for listing pages — `seo/jsonld.ts` `collectionPageSchema`

- **CollectionPage + ItemList** JSON-LD, generated from the registry, now emitted on **category pages**
  and the **/tools** listing — an explicit, ordered inventory for crawlers (the structured-data twin of
  the internal-link graph). Category pages also gained a visible Breadcrumb, BreadcrumbList JSON-LD, an
  overview line, and cross-category links.

### 4. Technical-SEO enforcement — `tests/seo/technicalSeo.test.ts`

The heart of the platform: a guardrail suite that holds **every live tool** to one SEO contract —
unique title, unique non-thin description, correct canonical, ≥1 FAQ, ≥1 keyword, ≥3 related tools, a
browse domain, a sitemap entry, global-search findability, and SoftwareApplication + BreadcrumbList
(+ FAQPage) JSON-LD — plus no duplicate titles/descriptions/slugs and no internal-link dead ends. A new
tool that skips any of this **fails CI**. (It already caught real internal-linking orphans during this
sprint and drove the always-fill related-tools fix.)

### 5. Standing SEO auditor — `AI/Agents/SEOChief.md` (ProductFactory)

A permanent review role that runs after every sprint: confirms the automated SEO suite is green and
applies a judgment checklist (titles/headings/content depth/internal links/schema/CWV/canonical/crawl).
It never relaxes a guardrail — it fixes the page.

## How a future tool inherits everything (zero SEO work)

Register the tool (name, description, category, tags, keywords, FAQ) and add its 3-line page. It then
automatically gets: metadata + canonical + OG/Twitter + dynamic OG image (`buildToolMetadata`);
SoftwareApplication + Breadcrumb + FAQ JSON-LD (`ToolMetadata`); a sitemap entry; a domain + category
listing; global-search indexing; related tools + prev/next; a trust surface + FAQ section. The guardrail
suite then verifies all of it. **No SEO code is written per tool.**

## Engineering review (9 lenses) — applied

- **Architect:** each capability is a small, pure, reusable unit (search lib, related engine, schema
  builder, guardrail); no duplication; metadata-driven throughout.
- **SEO Lead:** added CollectionPage/ItemList to listing pages, breadcrumb schema on categories,
  always-full internal links, and duplicate/thin/orphan enforcement.
- **Frontend:** one palette drives global search; header trigger decoupled via event.
- **Backend:** search + related engines are pure and deterministic (unit-tested).
- **Performance:** search is O(n) over ~36 tools; the palette renders nothing until opened; listing
  schema is build-time static — no CLS/LCP regression.
- **Accessibility:** dialog/combobox/listbox semantics, full keyboard control, focus return, labelled
  controls, visible breadcrumbs.
- **Security:** no network, no eval; JSON-LD is built from our own registry data; recents are local-only.
- **QA:** +133 tests across search, palette, related engine, and the technical-SEO contract (1,932 total).
- **Release:** shipped via the ReleaseWorkflow (push → deploy → production-verify).

## Files added / changed

**Added:** `lib/search/toolSearch.ts`, `features/search/CommandPalette.tsx`,
`features/search/SearchTrigger.tsx`, `tests/lib/search/toolSearch.test.ts`,
`tests/features/search/CommandPalette.test.tsx`, `tests/seo/technicalSeo.test.ts`,
`tests/registry/relatedTools.test.ts`, `docs/SeoDiscoverabilityPlatform.md`,
`AI/Agents/SEOChief.md` (ProductFactory).
**Changed:** `types/tool.ts` (+aliases/useCases), `registry/index.ts` (related/adjacent engine),
`seo/jsonld.ts` (+collectionPageSchema), `features/tool/RelatedTools.tsx`, `features/tool/ToolSidebar.tsx`,
`app/categories/[slug]/page.tsx`, `app/tools/page.tsx`, `app/layout.tsx`, `components/layout/Header.tsx`.

## Future platform capabilities unlocked

- Any new listing/landing page inherits CollectionPage schema by calling one builder.
- The search engine is ready for a `/search` page, per-category scoping, and command actions (not just
  tools) — all without touching tool code.
- `aliases`/`useCases` fields let tools opt into richer search matching over time.
- The guardrail suite is the template for future contracts (e.g. per-page CWV budgets).
