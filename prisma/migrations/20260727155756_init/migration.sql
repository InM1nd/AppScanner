-- CreateEnum
CREATE TYPE "FinancialConfidence" AS ENUM ('EXACT', 'ESTIMATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportMethod" AS ENUM ('MANUAL', 'URL_METADATA', 'EMAIL_ALERT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('NEW', 'REVIEWING', 'CONTACTED', 'VIEWING', 'SHORTLISTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('UNLIMITED', 'FIXED_TERM', 'TEMPORARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('RENTAL', 'SALE', 'SHARED_ROOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FurnishedLevel" AS ENUM ('UNFURNISHED', 'PARTLY_FURNISHED', 'FURNISHED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KitchenType" AS ENUM ('FITTED', 'BASIC', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WashingMachineOption" AS ENUM ('MACHINE_INCLUDED', 'CONNECTION_ONLY', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ParkingAvailability" AS ENUM ('INCLUDED', 'AVAILABLE_EXTRA_COST', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TriState" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HeatingType" AS ENUM ('DISTRICT', 'GAS', 'ELECTRIC', 'FLOOR', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommuteRating" AS ENUM ('EXCELLENT', 'ACCEPTABLE', 'WARNING', 'POOR', 'NOT_CALCULATED');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('WILLHABEN', 'IMMOSCOUT24_AT', 'IMMOWELT_AT', 'DER_STANDARD', 'FINDMYHOME', 'GENERIC_URL', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProviderHealth" AS ENUM ('OK', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PARSED', 'NEEDS_REVIEW', 'SAVED', 'DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "SnapshotChangeType" AS ENUM ('IMPORTED', 'PRICE_CHANGE', 'DESCRIPTION_CHANGE', 'STATUS_CHANGE', 'AVAILABILITY_CHANGE', 'REFRESHED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_HIGH_SCORE', 'PRICE_DROP', 'VIEWING_REMINDER', 'URGENCY_WARNING', 'DAILY_DIGEST');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RATE_LIMITED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "city" TEXT NOT NULL DEFAULT 'Wien',
    "preferredDistricts" INTEGER[] DEFAULT ARRAY[14, 15, 16]::INTEGER[],
    "secondaryDistricts" INTEGER[] DEFAULT ARRAY[6, 7, 10, 11, 12]::INTEGER[],
    "workDestinationLabel" TEXT NOT NULL DEFAULT 'Schweglerstraße 20/19, 1150 Wien',
    "workDestinationLat" DOUBLE PRECISION NOT NULL DEFAULT 48.19790,
    "workDestinationLng" DOUBLE PRECISION NOT NULL DEFAULT 16.32340,
    "maxCommuteMinutes" INTEGER NOT NULL DEFAULT 30,
    "requireSeparateBedroom" BOOLEAN NOT NULL DEFAULT true,
    "minRooms" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "targetMonthlyMin" DECIMAL(10,2) NOT NULL DEFAULT 900,
    "targetMonthlyMax" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "absoluteMonthlyMax" DECIMAL(10,2) NOT NULL DEFAULT 1100,
    "moveInEarliest" TIMESTAMP(3) NOT NULL DEFAULT '2026-09-15 00:00:00 +00:00',
    "moveInLatest" TIMESTAMP(3) NOT NULL DEFAULT '2026-10-01 00:00:00 +00:00',
    "needsFittedKitchen" BOOLEAN NOT NULL DEFAULT true,
    "needsWashingMachine" BOOLEAN NOT NULL DEFAULT true,
    "parkingRequired" BOOLEAN NOT NULL DEFAULT false,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "preferNoCommission" BOOLEAN NOT NULL DEFAULT true,
    "longTermOnly" BOOLEAN NOT NULL DEFAULT true,
    "scoringWeights" JSONB NOT NULL DEFAULT '{"budget":25,"commute":25,"layout":15,"condition":10,"parking":8,"moveIn":7,"contract":5,"infrastructure":5}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" "ProviderName" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" "ProviderHealth" NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheckAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "emailAlertInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "method" "ImportMethod" NOT NULL,
    "inputUrl" TEXT,
    "inputEmailRaw" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "rawParsed" JSONB,
    "resultListingId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceListingId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "importMethod" "ImportMethod" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtSource" TIMESTAMP(3),
    "listingType" "ListingType" NOT NULL DEFAULT 'UNKNOWN',
    "city" TEXT NOT NULL DEFAULT 'Wien',
    "address" TEXT,
    "postalCode" TEXT,
    "district" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rooms" DOUBLE PRECISION,
    "squareMeters" DOUBLE PRECISION,
    "hasSeparateBedroom" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "furnishedLevel" "FurnishedLevel" NOT NULL DEFAULT 'UNKNOWN',
    "baseRentAmount" DECIMAL(10,2),
    "baseRentConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "baseRentSourceText" TEXT,
    "operatingCostsAmount" DECIMAL(10,2),
    "operatingCostsConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "operatingCostsSourceText" TEXT,
    "heatingCostAmount" DECIMAL(10,2),
    "heatingCostConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "heatingCostSourceText" TEXT,
    "hotWaterCostAmount" DECIMAL(10,2),
    "hotWaterCostConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "hotWaterCostSourceText" TEXT,
    "electricityEstimateAmount" DECIMAL(10,2),
    "electricityEstimateConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "electricityEstimateSourceText" TEXT,
    "internetEstimateAmount" DECIMAL(10,2),
    "internetEstimateConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "internetEstimateSourceText" TEXT,
    "parkingMonthlyCostAmount" DECIMAL(10,2),
    "parkingMonthlyCostConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "parkingMonthlyCostSourceText" TEXT,
    "depositAmount" DECIMAL(10,2),
    "depositConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "depositSourceText" TEXT,
    "commissionAmount" DECIMAL(10,2),
    "commissionConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "commissionSourceText" TEXT,
    "contractFeeAmount" DECIMAL(10,2),
    "contractFeeConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "contractFeeSourceText" TEXT,
    "monthlyKnownCost" DECIMAL(10,2),
    "monthlyLikelyTotal" DECIMAL(10,2),
    "hasUnknownMandatoryCost" BOOLEAN NOT NULL DEFAULT true,
    "upfrontCostEstimate" DECIMAL(10,2),
    "costRedFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilityDate" TIMESTAMP(3),
    "contractType" "ContractType" NOT NULL DEFAULT 'UNKNOWN',
    "kitchen" "KitchenType" NOT NULL DEFAULT 'UNKNOWN',
    "washingMachine" "WashingMachineOption" NOT NULL DEFAULT 'UNKNOWN',
    "parkingAvailability" "ParkingAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "elevator" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "balcony" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "airConditioning" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "storage" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "quietCourtyardSignal" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "newerOrRenovatedSignal" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "heatingType" "HeatingType" NOT NULL DEFAULT 'UNKNOWN',
    "energyRating" TEXT,
    "description" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactMethod" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'NEW',
    "rejectionReason" TEXT,
    "duplicateClusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" "SnapshotChangeType" NOT NULL,
    "fields" JSONB NOT NULL,
    "rawSnapshot" JSONB,
    "changeSummary" TEXT,

    CONSTRAINT "ListingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCluster" (
    "id" TEXT NOT NULL,
    "primaryListingId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuteEstimate" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER,
    "walkingMinutes" INTEGER,
    "transfers" INTEGER,
    "routeSummary" TEXT,
    "rating" "CommuteRating" NOT NULL DEFAULT 'NOT_CALCULATED',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommuteEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreBreakdown" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "isZeroed" BOOLEAN NOT NULL DEFAULT false,
    "zeroReason" TEXT,
    "categories" JSONB NOT NULL,
    "weightsSnapshot" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifyOnPriceChange" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SearchProfile_userId_idx" ON "SearchProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE INDEX "SavedSearch_providerId_idx" ON "SavedSearch"("providerId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "Listing_providerId_idx" ON "Listing"("providerId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_district_idx" ON "Listing"("district");

-- CreateIndex
CREATE INDEX "Listing_monthlyKnownCost_idx" ON "Listing"("monthlyKnownCost");

-- CreateIndex
CREATE INDEX "Listing_duplicateClusterId_idx" ON "Listing"("duplicateClusterId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_providerId_sourceListingId_key" ON "Listing"("providerId", "sourceListingId");

-- CreateIndex
CREATE INDEX "ListingSnapshot_listingId_idx" ON "ListingSnapshot"("listingId");

-- CreateIndex
CREATE INDEX "CommuteEstimate_listingId_idx" ON "CommuteEstimate"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreBreakdown_listingId_key" ON "ScoreBreakdown"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_listingId_key" ON "WatchlistItem"("userId", "listingId");

-- CreateIndex
CREATE INDEX "Note_listingId_idx" ON "Note"("listingId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_listingId_idx" ON "NotificationLog"("listingId");

-- AddForeignKey
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_duplicateClusterId_fkey" FOREIGN KEY ("duplicateClusterId") REFERENCES "DuplicateCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSnapshot" ADD CONSTRAINT "ListingSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommuteEstimate" ADD CONSTRAINT "CommuteEstimate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreBreakdown" ADD CONSTRAINT "ScoreBreakdown_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
