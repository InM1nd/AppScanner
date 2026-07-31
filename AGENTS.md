<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AppScanner conventions

## Ingestion rules (non-negotiable)

Site adapters ARE allowed to fetch public pages for personal use.

Every persisted listing must set `importMethod` accurately
(`MANUAL` / `URL_METADATA` / `EMAIL_ALERT`). Never mark something as scraped
metadata if it was hand-entered, and never fabricate a field value from a
vague description — leave it `UNKNOWN` with `amount: null`.

## The money-field pattern

Every financial field on `Listing` is three flat columns:
`{field}Amount` (Decimal?), `{field}Confidence` (`EXACT`/`ESTIMATE`/`UNKNOWN`),
`{field}SourceText` (String?, free text explaining where it came from). The
field list lives in one place: `MONEY_FIELDS` in `src/server/listing-mapper.ts`.
Add a new money field there (schema + mapper), not by hand-wiring three new
columns somewhere else.

`src/lib/cost.ts` groups these back into `FinancialFact` (`{ amount,
confidence, sourceText }`) for the pure domain logic — that file has zero
Prisma/Next.js imports and is the one place cost totals are computed.

## Score/cost recomputation has one entry point

`src/server/recompute.ts`'s `recomputeListing(listingId)` is the only place
that writes `monthlyKnownCost`, `monthlyLikelyTotal`, `costRedFlags`, and the
`ScoreBreakdown` row. Every code path that changes something affecting those
numbers (import/save, a commute result arriving, scoring weights changing)
must call it — never recompute cost or score inline elsewhere.

## Prisma Decimal can't cross the Server -> Client Component boundary

`@prisma/client`'s `Decimal` type fails silently-then-loudly (a runtime error,
not a type error caught by `tsc`) when passed as a prop to a Client Component
or returned from a Server Action to client code. Use
`src/server/view-models.ts` (`toListingCardVM` / `toListingDetailVM`) or
`src/server/decimal.ts`'s `toNum()` before crossing that boundary. Server
Actions in `src/app/actions.ts` return small explicit shapes
(`{ id, title }`, not the raw Prisma row) for the same reason.

## shadcn/ui here uses Base UI, not Radix

`components.json` is configured with the `base` (Base UI) component library,
not Radix. There is no `asChild` prop — use `render={<Component />}` instead.
`Select`/`Tabs` `onValueChange` signatures are `(value: string | null,
eventDetails) => void`, not a bare `Dispatch<SetStateAction<string>>` — wrap
state setters (`(v) => v !== null && setX(v)`) rather than passing them
directly.

## Prisma 7 config

Migration/runtime config lives in `prisma.config.ts` (Prisma 7 removed
`datasource.url` from `schema.prisma`). The `PrismaClient` is constructed with
the `@prisma/adapter-pg` driver adapter in `src/lib/db.ts` — always import the
singleton `db` from there, never `new PrismaClient()` directly.

## Testing

Pure logic in `src/lib/` gets Vitest unit tests in `src/lib/__tests__/` with
zero DB dependency — keep it that way so `npm test` never needs Postgres.
E2E flows live in `e2e/` (Playwright); `playwright.config.ts` boots its own
dev server on port 3100, so `npm run test:e2e` needs no manual setup.
