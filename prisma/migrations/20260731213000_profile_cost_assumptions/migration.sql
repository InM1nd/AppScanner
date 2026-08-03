ALTER TABLE "SearchProfile"
ADD COLUMN "energyMonthlyEstimate" DECIMAL(10,2) NOT NULL DEFAULT 130,
ADD COLUMN "internetMonthlyEstimate" DECIMAL(10,2) NOT NULL DEFAULT 30;

ALTER TABLE "Listing"
ADD COLUMN "recurringEstimateAssumptions" JSONB NOT NULL DEFAULT '{}';
