# Esytol

**Free online tools — one platform.**

Built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

---

## Tech Stack

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Framework | Next.js 15 (App Router)        |
| UI        | React 19 + Tailwind CSS        |
| Language  | TypeScript (strict)            |
| Lint      | ESLint + Prettier              |
| Testing   | Vitest + React Testing Library |
| CI        | GitHub Actions                 |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command              | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Production build         |
| `npm run lint`       | ESLint check             |
| `npm run format`     | Prettier format          |
| `npm run type-check` | TypeScript check         |
| `npm run test`       | Run tests (watch)        |
| `npm run test:run`   | Run tests once           |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

## Project Structure

```
esytol/
├── app/                # Next.js App Router
├── components/         # Shared UI components
│   ├── layout/         # Header, Footer, Navigation
│   └── ui/             # Atomic components
├── features/           # Feature-specific modules
│   └── home/           # Home page sections
├── registry/           # Tool registry and query helpers
├── types/              # TypeScript type definitions
├── config/             # Site and navigation config
├── seo/                # Metadata, JSON-LD, OpenGraph helpers
├── lib/                # Utility functions
├── hooks/              # Custom React hooks
├── styles/             # Font and style configuration
├── analytics/          # Analytics stub
├── ads/                # Ads stub
└── tests/              # Vitest test suite
```

See [`docs/FolderStructure.md`](docs/FolderStructure.md) for the full structure.

## Documentation

**Engineering**

- [Architecture](docs/Architecture.md)
- [Folder Structure](docs/FolderStructure.md)
- [Development Guide](docs/DevelopmentGuide.md)

**Deployment & Growth**

- [Deployment Guide](DEPLOYMENT.md)
- [Launch Checklist](docs/LaunchChecklist.md)
- [Post-Launch Checklist](docs/PostLaunchChecklist.md)
- [Google Search Console](docs/SearchConsole.md)
- [Bing Webmaster Tools](docs/BingWebmaster.md)
- [Google Analytics](docs/GoogleAnalytics.md)
- [Microsoft Clarity](docs/MicrosoftClarity.md)
- [AdSense Preparation](docs/AdSensePreparation.md)
