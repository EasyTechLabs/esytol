# Esytol

**Free online tools — one platform.**

Built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

---

## Running the Vyora stack locally

The web app talks to a local `vyora-api`. Both, plus PostgreSQL and Metro, come
up with one command from the `vyora` repository:

```powershell
.\scripts\dev-stack.ps1 start     # database + API + web + Metro, then verify
.\scripts\dev-stack.ps1 status    # ports, PIDs, URLs
.\scripts\dev-stack.ps1 stop      # stops processes; NEVER deletes data
```

This web app alone (local-first, no API):

```bash
npm ci
npm run dev                       # http://127.0.0.1:3000/vyora
```

The four `NEXT_PUBLIC_VYORA_API_*` flags are `false` in committed configuration.
`dev-stack.ps1` sets them in the process environment only; starting `next dev`
by hand leaves the app purely local, which is the intended default.

Full four-process workflow and troubleshooting:
[`vyora/architecture/local-development.md`](https://github.com/EasyTechLabs/vyora/blob/main/architecture/local-development.md)

## Vyora platform

Vyora is the credit-ledger product inside this app. Its backend and mobile app
live in their own repositories; this one holds the **web** app and a
development-only adapter that talks to a local API.

|                                                                        |                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`docs/platform/PROJECT_CONTEXT.md`](docs/platform/PROJECT_CONTEXT.md) | **Start here.** The durable handoff — read cold, do not rely on chat history. |
| [`vyora-api`](https://github.com/EasyTechLabs/vyora-api)               | Backend: Fastify, PostgreSQL, the OpenAPI contract.                           |
| [`vyora-mobile`](https://github.com/EasyTechLabs/vyora-mobile)         | Expo / React Native app.                                                      |
| [`vyora`](https://github.com/EasyTechLabs/vyora)                       | Knowledge base and product planning.                                          |

All Vyora remote-API flags are committed as `false` and are development-only.

### Shop sign-in and setup

`/vyora/shop` signs a merchant in by email code, creates or chooses a shop, and
shows its QR and code. `/vyora/shop/verify` resolves somebody else's code
before anything acts on it.

**The session token is never in browser JavaScript.** It is set as an httpOnly
cookie by a route handler under `/api/vyora-shops`, read only on the server, and
attached there to requests the browser cannot make itself. `localStorage` was
rejected: every dependency in the bundle can read it, forever. See ADR-0009 in
`vyora-api/docs/adr/`.

This flow is gated on `NODE_ENV !== "production"` **and** a loopback API URL, by
`decideShopApi`. It deliberately does **not** use the party-read flag or the
shared fixture identity — the credential here is a real person's own session, and
requiring a fixture identity to sign in as yourself would be the wrong shape.
A build that cannot reach a local API shows no email box rather than accepting an
address and delivering nothing.
Production refuses every `/api/vyora-dev/*` route regardless of flags.

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
