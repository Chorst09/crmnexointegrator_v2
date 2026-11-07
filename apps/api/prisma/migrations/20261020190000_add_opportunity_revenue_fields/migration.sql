-- Compatível com bases onde estes campos já foram adicionados manualmente.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "revenueType" TEXT,
  ADD COLUMN IF NOT EXISTS "contractPeriodMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyRecurringValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalContractValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalProductsValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "setupValue" DOUBLE PRECISION;
