# Folder Structure

```
esytol/
│
├── app/                          # Next.js App Router root
│   ├── globals.css               # Tailwind directives + CSS variables
│   ├── layout.tsx                # Root layout (html, body, Header, Footer)
│   ├── page.tsx                  # Home page
│   ├── not-found.tsx             # 404 page
│   ├── loading.tsx               # Global loading skeleton
│   ├── error.tsx                 # Global error boundary (client)
│   ├── robots.ts                 # Generated robots.txt
│   ├── sitemap.ts                # Generated XML sitemap
│   └── manifest.ts               # Web App Manifest
│
├── components/                   # Shared, reusable UI components
│   ├── layout/
│   │   ├── Header.tsx            # Sticky header with logo + nav
│   │   ├── Footer.tsx            # Site footer with link groups
│   │   └── Navigation.tsx        # Desktop + mobile nav (client)
│   └── ui/
│       ├── ToolCard.tsx          # Tool card for grids
│       ├── CategoryCard.tsx      # Category card for grids
│       ├── SearchBar.tsx         # Controlled search input (client)
│       └── EmptyState.tsx        # Empty state fallback
│
├── features/                     # Feature-specific module groupings
│   └── home/
│       ├── HeroSection.tsx       # Hero with search (client)
│       ├── CategoryGrid.tsx      # 10-category grid
│       ├── FeaturedTools.tsx     # Featured tool cards
│       ├── PopularTools.tsx      # Popular tool cards
│       └── RecentTools.tsx       # Recently added tool cards
│
├── registry/                     # Tool data and query layer
│   ├── index.ts                  # Tool registry + query helpers
│   └── categories.ts             # Category definitions
│
├── types/                        # TypeScript type definitions
│   ├── tool.ts                   # Tool, ToolFilter
│   └── category.ts               # Category, CategorySlug
│
├── config/                       # Static application configuration
│   ├── site.ts                   # Site name, URL, description, keywords
│   └── nav.ts                    # Main nav + footer nav link arrays
│
├── seo/                          # SEO utility layer
│   ├── metadata.ts               # buildMetadata() → Next.js Metadata
│   ├── jsonld.ts                 # Schema.org JSON-LD generators
│   └── og.ts                     # OpenGraph metadata helpers
│
├── lib/                          # Pure utility functions
│   ├── cn.ts                     # clsx + tailwind-merge class merger
│   └── utils.ts                  # slugToTitle, truncate, formatNumber, absoluteUrl
│
├── hooks/                        # Custom React hooks
│   └── useSearch.ts              # Client-side tool search hook
│
├── styles/                       # Styling configuration
│   └── fonts.ts                  # Inter + JetBrains Mono font setup
│
├── analytics/
│   └── index.ts                  # Analytics stub (trackEvent, trackPageView)
│
├── ads/
│   └── index.ts                  # Ads stub (adsConfig, AdSlot type)
│
├── public/                       # Static assets (images, icons, og images)
│
├── tests/                        # Vitest test suite
│   ├── setup.ts                  # @testing-library/jest-dom setup
│   ├── lib/
│   │   ├── cn.test.ts            # cn() utility tests
│   │   └── utils.test.ts         # utils tests
│   └── registry/
│       └── index.test.ts         # Registry query tests
│
├── docs/                         # Engineering documentation
│   ├── Architecture.md
│   ├── FolderStructure.md        # ← this file
│   └── DevelopmentGuide.md
│
├── .github/workflows/
│   └── ci.yml                    # GitHub Actions CI
│
├── .husky/
│   └── pre-commit                # Runs lint-staged on commit
│
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── vitest.config.ts
├── .prettierrc
├── .prettierignore
├── .lintstagedrc.json
└── .env.example
```

## Naming Conventions

| Pattern           | Convention     | Example                 |
| ----------------- | -------------- | ----------------------- |
| React components  | PascalCase     | `ToolCard.tsx`          |
| Utilities / hooks | camelCase      | `useSearch.ts`, `cn.ts` |
| Config / data     | camelCase      | `site.ts`, `nav.ts`     |
| Test files        | `*.test.ts(x)` | `cn.test.ts`            |
| Route segments    | kebab-case     | `app/tools/[slug]/`     |
