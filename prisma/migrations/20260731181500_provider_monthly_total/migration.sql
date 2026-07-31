ALTER TABLE "Listing"
ADD COLUMN "advertisedMonthlyTotalAmount" DECIMAL(10,2),
ADD COLUMN "advertisedMonthlyTotalConfidence" "FinancialConfidence" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "advertisedMonthlyTotalSourceText" TEXT;
