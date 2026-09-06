# Esytol — production image.
#
# Three stages so the runtime carries neither the toolchain nor the source: the
# builder needs 2–4 GB of memory for `next build`, and the shared VM has roughly
# 2.5 GB free once PostgreSQL and the Vyora API are running. That is the whole
# reason images are built in CI and only ever pulled here — a build on the VM
# would not fail politely, it would have the kernel choose between a website and
# a merchant's ledger.
#
# ## sharp
#
# Deliberately absent. `next/image` is imported nowhere in this application
# (verified across app/, components/ and features/), so Next's image optimiser
# never runs and the `images.formats` setting is inert. `sharp` appears in the
# lockfile only as an optional transitive dependency of Next itself.
#
# **If `next/image` is ever used, add `sharp` to dependencies and rebuild** —
# without it Next falls back to an unoptimised path at runtime and logs a
# warning rather than failing, which is the kind of regression that is noticed
# in a bandwidth bill rather than in CI.

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copied alone so this layer caches against source changes.
COPY package.json package-lock.json ./

# `npm ci` from the lockfile: a deploy must install the exact tree CI tested,
# not whatever the registry resolves to today. Dev dependencies are needed here
# because `next build` runs TypeScript and Tailwind.
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off: a build should not phone home from CI.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build arguments rather than runtime environment. Changing the
# canonical URL therefore requires a NEW IMAGE, not a restart — the one
# behaviour that differs from Vercel, where a redeploy did this implicitly.
#
# These are not secrets. Every one of them ships inside the JavaScript bundle
# and is readable by anyone who opens devtools; putting a credential here would
# publish it. Real secrets arrive at runtime from Secret Manager.
ARG NEXT_PUBLIC_SITE_URL=https://esytol.com
ARG NEXT_PUBLIC_SITE_NAME=Esytol
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_CLARITY_ID=
ARG NEXT_PUBLIC_ADSENSE_ID=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID \
    NEXT_PUBLIC_ADSENSE_ID=$NEXT_PUBLIC_ADSENSE_ID

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# `dumb-init` as PID 1. Without it SIGTERM does not reliably reach Node, so a
# `docker compose up -d esytol` would kill the old container mid-response
# instead of letting it drain.
RUN apt-get update \
 && apt-get install --no-install-recommends -y dumb-init \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Exactly the three things a standalone build needs, and nothing else. No
# source, no node_modules tree, no tests, no .env — the image contains no
# credential and no development file.
#
# `.next/standalone` already carries a minimal node_modules and its own
# `server.js`; `static` and `public` are the assets that server expects to find
# beside it.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Ships with the base image as uid 1000. Running as root inside a container is
# not a sandbox escape by itself, but it removes the last barrier if one is
# found.
USER node

EXPOSE 3000

# Uses the application's own health route, so a container that boots but cannot
# serve is reported unhealthy rather than left in the rotation.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
