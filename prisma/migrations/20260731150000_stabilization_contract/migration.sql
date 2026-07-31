-- Stabilization contract: preserve source state, persist explainability, and
-- make notification/import idempotency enforceable by PostgreSQL.

CREATE TYPE "SourceAvailability" AS ENUM ('ACTIVE', 'RESERVED', 'GONE', 'UNKNOWN');

ALTER TYPE "NotificationType" ADD VALUE 'TELEGRAM_TEST';

ALTER TABLE "Provider"
  ADD COLUMN "lastError" TEXT;

ALTER TABLE "Listing"
  ADD COLUMN "normalizedCanonicalUrl" TEXT,
  ADD COLUMN "sourceAvailability" "SourceAvailability" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lastSourceCheckedAt" TIMESTAMP(3),
  ADD COLUMN "monthlyHousingSubtotal" DECIMAL(10,2),
  ADD COLUMN "unknownRecurringFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "hasUnknownUpfrontCost" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "upfrontKnownTotal" DECIMAL(10,2),
  ADD COLUMN "unknownUpfrontFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "recomputePending" BOOLEAN NOT NULL DEFAULT false;

-- Conservatively normalize existing URLs without dropping meaningful query
-- parameters or changing case-sensitive paths. Runtime matching performs the
-- stronger tracking-parameter cleanup for all future imports.
WITH normalized AS (
  SELECT
    "id",
    regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i') AS norm,
    row_number() OVER (
      PARTITION BY regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i')
      ORDER BY "importedAt", "id"
    ) AS position,
    count(*) OVER (
      PARTITION BY regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i')
    ) AS collision_count
  FROM "Listing"
), collision_groups AS (
  SELECT norm, 'migration_' || md5(norm) AS cluster_id
  FROM normalized
  WHERE collision_count > 1
  GROUP BY norm
)
INSERT INTO "DuplicateCluster" ("id", "primaryListingId", "reason", "createdAt")
SELECT g.cluster_id, n."id", 'SAME_URL', CURRENT_TIMESTAMP
FROM collision_groups g
JOIN normalized n ON n.norm = g.norm AND n.position = 1
ON CONFLICT ("id") DO NOTHING;

WITH normalized AS (
  SELECT
    "id",
    regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i') AS norm,
    row_number() OVER (
      PARTITION BY regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i')
      ORDER BY "importedAt", "id"
    ) AS position,
    count(*) OVER (
      PARTITION BY regexp_replace(split_part(trim("canonicalUrl"), '#', 1), '^http://', 'https://', 'i')
    ) AS collision_count
  FROM "Listing"
)
UPDATE "Listing" l
SET
  "normalizedCanonicalUrl" = CASE WHEN n.position = 1 THEN n.norm ELSE NULL END,
  "duplicateClusterId" = CASE
    WHEN n.collision_count > 1 THEN 'migration_' || md5(n.norm)
    ELSE l."duplicateClusterId"
  END
FROM normalized n
WHERE l."id" = n."id";

CREATE UNIQUE INDEX "Listing_normalizedCanonicalUrl_key" ON "Listing"("normalizedCanonicalUrl");

-- The scheduled recovery job backfills every newly added persisted total and
-- score field after an upgrade.
UPDATE "Listing" SET "recomputePending" = true;

ALTER TABLE "ScoreBreakdown"
  ADD COLUMN "dataCompleteness" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WatchlistItem"
  ADD COLUMN "scheduledViewingAt" TIMESTAMP(3);

ALTER TABLE "NotificationLog"
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "NotificationLog" SET "dedupeKey" = 'legacy:' || "id" WHERE "dedupeKey" IS NULL;

ALTER TABLE "NotificationLog" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");
