# Architecture

## Overview

Esytol is a static-first, SEO-optimised tool platform built on Next.js 15 App Router.
All tools run client-side — no server processing, no database, no user data stored.

## Principles

| Principle                | Implementation                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Static-first             | Pages are Server Components by default; only interactive leaves use `"use client"`                                              |
| Registry-driven          | Every tool is a TypeScript record in `registry/index.ts` — one source of truth                                                  |
| SEO by default           | Metadata, OpenGraph, Twitter Cards, and JSON-LD are generated at the module level via `seo/` helpers                            |
| Scalable to 5000+ tools  | Category-based routing, static sitemap, and server-rendered index pages ensure O(1) cold navigation regardless of registry size |
| Zero auth / zero backend | No authentication, no API routes, no database — intentional for privacy and simplicity                                          |

## Data Flow

```
registry/index.ts  (tool definitions — extended with faq, keywords, relatedTools, version)
       │
       ├─► app/page.tsx              (home — server component)
       │       └─► features/home/*  (section components)
       │               └─► components/ui/ToolCard
       │
       ├─► app/tools/[slug]/page.tsx (tool page — server component)
       │       ├─► seo/metadata.ts  buildToolMetadata(tool)  → Next.js Metadata
       │       ├─► features/tool/ToolMetadata  → JSON-LD scripts
       │       └─► features/tool/ToolLayout
       │               ├─► ToolHeader (Breadcrumb, icon, title, version)
       │               ├─► ToolContainer (children slot for tool UI)
       │               ├─► FAQSection [Client] (accordion)
       │               └─► ToolSidebar
       │                       ├─► ShareButtons [Client] (copy link, Twitter)
       │                       ├─► RelatedTools → registry (slug lookup)
       │                       └─► ReportIssue (anchor to GitHub Issues)
       │
       ├─► app/sitemap.ts            (generated sitemap)
       ├─► app/robots.ts             (generated robots.txt)
       │
       └─► hooks/useSearch.ts        (client-side search)
               └─► components/ui/SearchBar
```

## Key Modules

### `registry/`

Central data store. `toolRegistry` is a typed `Tool[]` array.
Query helpers (`getTools`, `getFeaturedTools`, etc.) filter the array — no database needed.
A private `Map<string, Tool>` index (`_slugIndex`) is built at module initialisation, making
`getToolBySlug(slug)` an O(1) operation regardless of registry size.

**Client component rule:** The registry module must only be imported in Server Components
(pages, layouts, sitemap, etc.) or in hooks designed for client-side search. It must never
be imported at the top level of a `'use client'` component, to avoid bundling the full
registry into the client JS. Data needed by client components (e.g. `toolCount`) must be
computed in the server component and passed down as a prop.

### `seo/`

- `metadata.ts` — generates Next.js `Metadata` objects from options; `buildToolMetadata(tool)` produces full tool-page metadata (title, description, canonical, OG, Twitter, keywords) without duplication
- `jsonld.ts` — Schema.org JSON-LD generators: `webSiteSchema`, `organizationSchema`, `toolSchema`, `breadcrumbSchema`, `faqSchema`
- `og.ts` — OpenGraph metadata helpers
- `tool-seo.ts` — `buildToolSchemas(tool)` assembles the ordered JSON-LD script array for a tool page (SoftwareApplication + BreadcrumbList + FAQPage when FAQ data is present)

### `features/tool/` — Tool Framework

Every production tool page is composed from these reusable Server/Client Components:

| Component       | Type       | Responsibility                                                    |
| --------------- | ---------- | ----------------------------------------------------------------- |
| `ToolLayout`    | Server     | Root layout: header + two-column grid (main + sidebar)            |
| `ToolHeader`    | Server     | Breadcrumb, icon, name, description, version, lastUpdated         |
| `ToolContainer` | Server     | White card wrapper for the interactive tool content area          |
| `ToolSidebar`   | Server     | Composes ShareButtons + RelatedTools + ReportIssue                |
| `ToolMetadata`  | Server     | Renders all JSON-LD `<script>` tags (tool, breadcrumb, FAQ)       |
| `Breadcrumb`    | Server     | Accessible breadcrumb nav with `aria-current="page"` on last item |
| `FAQSection`    | **Client** | Accordion FAQ; requires interactivity (toggle state)              |
| `ShareButtons`  | **Client** | Copy link + Twitter/X share; requires Clipboard API               |
| `RelatedTools`  | Server     | Reads registry directly; renders link list of related tools       |

**Rendering boundary rule:** `FAQSection` and `ShareButtons` are the only Client Components in the tool framework. All props they receive must be serializable (strings, plain objects). The server parent (`ToolLayout` / `ToolSidebar`) computes all data before passing it down.

### `features/home/`

Each section (Hero, CategoryGrid, FeaturedTools, PopularTools, RecentTools) is a separate
Server Component. Sections read directly from the registry — no state, no API calls.
`HeroSection` receives `toolCount` as a prop (computed in `app/page.tsx`) so that the
client component does not need to import the registry module.

### `components/`

Shared, reusable components split into `layout/` (Header, Footer, Navigation) and `ui/`
(ToolCard, CategoryCard, SearchBar, EmptyState). UI components are intentionally stateless
where possible.

## Routing Strategy

```
/                   → Home (static, ISR-ready)
/tools              → All Tools (static, filterable client-side)
/tools/[slug]       → Individual Tool page (static, generateStaticParams from registry)
/categories         → Category index (static)
/categories/[slug]  → Category page (static, generateStaticParams from categories)
/popular            → Popular tools (static)
/new                → New/recent tools (static)
/about              → About page (static)
/blog               → Blog index (placeholder, static)
/privacy            → Privacy policy (static)
/terms              → Terms of service (static)
```

## SEO Infrastructure

- `app/robots.ts` — generated robots.txt with sitemap reference
- `app/sitemap.ts` — dynamic sitemap covering all tools and categories
- `app/manifest.ts` — Web App Manifest for PWA
- `buildMetadata()` in `seo/metadata.ts` — canonical URLs, OG, Twitter Cards
- JSON-LD structured data injected in `app/layout.tsx`

## Scaling to 5000+ Tools

The registry pattern already has O(1) slug lookup (`getToolBySlug` uses a `Map` index).
For 5000+ tools, additionally consider:

1. **Lazy loading** — implement virtual scrolling on the all-tools page
2. **Indexed search** — replace in-memory filter with a local Fuse.js index
3. **Static generation** — `generateStaticParams` per tool slug for full SSG (already implemented for `app/tools/[slug]` and `app/categories/[slug]`)
4. **Category sharding** — split `registry/index.ts` into per-category files
   imported dynamically by `getTools({ category })`

## Known Limitations

- `public/og-default.png`, `icon-192.png`, `icon-512.png` are 1×1 pixel placeholders. Replace with actual branded artwork before launch.
- `app/favicon.ico` is a minimal placeholder ICO wrapping the same 1×1 pixel PNG.
- `app/blog/page.tsx` is an empty placeholder — content pipeline not yet implemented.
- The `color-contrast` axe rule is disabled in Vitest (jsdom lacks canvas). Verify colour contrast in a real browser with axe DevTools or Playwright + axe-playwright.
