# Development Guide

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm 10+**
- **Git**

## Initial Setup

```bash
# Clone
git clone https://github.com/EasyTechLabs/esytol.git
cd esytol

# Install (also initialises Husky hooks)
npm install

# Copy environment variables
cp .env.example .env.local
```

## Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Next.js Fast Refresh is enabled — edits reflect instantly.

## Available Scripts

| Script                  | Purpose                 |
| ----------------------- | ----------------------- |
| `npm run dev`           | Dev server with HMR     |
| `npm run build`         | Production build        |
| `npm run start`         | Serve production build  |
| `npm run lint`          | ESLint check            |
| `npm run format`        | Prettier (write)        |
| `npm run format:check`  | Prettier (check only)   |
| `npm run type-check`    | TypeScript strict check |
| `npm run test`          | Vitest watch mode       |
| `npm run test:run`      | Vitest single run       |
| `npm run test:coverage` | Coverage report         |

## Adding a New Tool

1. Open `registry/index.ts`
2. Add a `Tool` object to the `toolRegistry` array:

```typescript
{
  id: "my-tool",             // unique, kebab-case
  name: "My Tool",
  slug: "my-tool",           // matches the URL /tools/my-tool
  description: "What it does in one sentence.",
  category: "developer",     // must be a valid CategorySlug
  tags: ["tag1", "tag2"],
  icon: "🔧",                // emoji
  url: "/tools/my-tool",
  featured: false,
  popular: false,
  isNew: true,
},
```

3. Create the tool page at `app/tools/my-tool/page.tsx`
4. The tool is automatically included in the sitemap, category pages, and search.

## Adding a New Category

1. Open `types/category.ts` — add the slug to `CategorySlug`
2. Open `registry/categories.ts` — add a `Category` object
3. The category card appears automatically on the home grid and category index.

## Code Quality

### ESLint

```bash
npm run lint
```

Config: `eslint.config.mjs`. Extends `next/core-web-vitals` and `next/typescript`.

### Prettier

```bash
npm run format        # fix
npm run format:check  # CI check
```

Config: `.prettierrc`. Uses `prettier-plugin-tailwindcss` to sort class names.

### TypeScript

```bash
npm run type-check
```

`strict: true` is enabled. No `any` without explicit justification.

### Husky + lint-staged

Installed automatically on `npm install`. Before each commit:

- ESLint fix → Prettier format (`.ts`, `.tsx`)
- Prettier format (`.json`, `.md`, `.css`, `.yaml`)

## Testing

Tests live in `tests/` and use Vitest + React Testing Library.

```bash
npm run test        # watch mode (dev)
npm run test:run    # single run (CI)
```

### Writing Tests

- Utility tests → `tests/lib/*.test.ts`
- Component tests → `tests/components/*.test.tsx`
- Registry tests → `tests/registry/*.test.ts`

Example component test:

```typescript
import { render, screen } from "@testing-library/react";
import { ToolCard } from "@/components/ui/ToolCard";
import { toolRegistry } from "@/registry";

it("renders tool name", () => {
  render(<ToolCard tool={toolRegistry[0]} />);
  expect(screen.getByText(toolRegistry[0].name)).toBeInTheDocument();
});
```

## Environment Variables

| Variable                 | Required | Description                                   |
| ------------------------ | -------- | --------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`   | No       | Full site URL (default: `https://esytol.com`) |
| `NEXT_PUBLIC_SITE_NAME`  | No       | Site display name (default: `Esytol`)         |
| `NEXT_PUBLIC_GA_ID`      | No       | Google Analytics measurement ID               |
| `NEXT_PUBLIC_ADSENSE_ID` | No       | Google AdSense publisher ID                   |

## CI / CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push and PR:

1. Checkout + Node 20 setup
2. `npm ci`
3. Type check
4. ESLint
5. Prettier check
6. Vitest
7. `next build`

All steps must pass before merge.
