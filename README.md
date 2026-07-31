# AppScanner

Private single-user decision tool for Vienna rentals. It imports public listing data, preserves provenance, calculates an explainable all-in cost and score, tracks changes, and sends deduplicated actionable Telegram notifications.

## Product rules

- Unknown facts never earn points. Every score includes data completeness from 0–100%.
- A confirmed hard-requirement violation excludes a listing; `UNKNOWN` only lowers completeness.
- `monthlyLikelyTotal` is the comparable all-in monthly amount. Unknown recurring and upfront fields stay visible.
- Mock commute is visibly approximate and earns at most half of the commute category.
- A strong match requires score ≥70, completeness ≥70%, and no exclusion.
- Refresh never deletes a listing and never replaces confirmed/manual facts with `UNKNOWN`.

## Local setup

Requirements: Node.js 24 and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

Local development may use `APP_USER_EMAIL`. Production requires Clerk and `OWNER_EMAIL`.

## Quality gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run db:validate
npm run build
```

Database and browser tests are isolated from development/production data:

```bash
docker compose up -d postgres-e2e
export DATABASE_URL='postgresql://appscanner:appscanner@127.0.0.1:5433/appscanner_e2e'
export APP_USER_EMAIL='e2e@appscanner.local'
npm run db:e2e:migrate
npm run db:e2e:seed
npm run test:integration
npm run test:e2e
```

The guard rejects every E2E database whose name does not end in `_e2e`. Playwright runs desktop Chromium, a mobile viewport, axe WCAG checks, and a horizontal-overflow check.

## Production configuration

Required:

- Neon PostgreSQL `DATABASE_URL`.
- Clerk `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- `OWNER_EMAIL`, matching the only permitted Clerk account.
- Inngest `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.

Optional:

- Telegram: `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Real commute: `ROUTING_PROVIDER=google` and `GOOGLE_MAPS_API_KEY`; otherwise the labeled mock provider is used.

Production direct job routes return 404. Scheduled and manual production work goes through signed Inngest functions. The digest runs daily at 08:00 `Europe/Vienna`.

## Deployment

Install the Vercel CLI first:

```bash
npm i -g vercel
```

Then connect a private GitHub repository to Vercel, configure Clerk/Neon/Inngest environment variables, and require the `Quality (no database)` and `PostgreSQL 16 and browser gates` checks on `main`.

Release order:

1. Create a database backup.
2. Run `npm run db:migrate:deploy` against production.
3. Run `npm run db:bootstrap` to create the provider catalog without demo listings.
4. Deploy the tested `main` commit through Vercel.
5. Smoke-test owner login, Dashboard, Listings, Import, Settings, a signed Inngest run, and Telegram test notification.
6. Confirm Provider health and NotificationLog after the first scheduled runs.

Vercel previews are expected for pull requests; only protected `main` deploys production.

## Architecture invariants

- `src/server/recompute.ts` is the only writer of persisted cost/score results.
- `src/lib/cost.ts` and `src/lib/score.ts` contain pure domain logic.
- `src/server/listing-mapper.ts` owns the flat money-field mapping.
- `src/server/view-models.ts` converts Prisma `Decimal` before client boundaries.
- `src/providers/shared/safe-fetch.ts` is the only network path for provider adapters.
- `src/inngest/functions.ts` owns production schedules and durable job entry points.
- `SPEC.md` records the product invariants and implementation gates.

## Current release boundary

This version deliberately remains single-user and uses PostgreSQL + Inngest without Redis, a custom queue, Sentry, or a separate observability platform. Multi-user SaaS work starts only when the product actually needs it.
