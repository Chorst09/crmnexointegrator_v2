ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "subsegment" TEXT,
  ADD COLUMN IF NOT EXISTS "accountManagerName" TEXT;

ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "negotiationType" TEXT,
  ADD COLUMN IF NOT EXISTS "projectClassification" TEXT,
  ADD COLUMN IF NOT EXISTS "projectTower" TEXT,
  ADD COLUMN IF NOT EXISTS "projectDetail" TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "licenseCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "contractMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "installationFee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "leadSourceDetail" TEXT,
  ADD COLUMN IF NOT EXISTS "importSource" TEXT,
  ADD COLUMN IF NOT EXISTS "importSourceRow" INTEGER;

CREATE INDEX IF NOT EXISTS "Opportunity_importSource_importSourceRow_idx"
  ON "Opportunity"("importSource", "importSourceRow");
