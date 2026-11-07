ALTER TABLE "Contract" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "Contract" ALTER COLUMN "endDate" DROP NOT NULL;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "sourceDocumentId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "sourceOpportunityLabel" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "expirationAlert" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_sourceDocumentId_key" ON "Contract"("sourceDocumentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contract_opportunityId_fkey') THEN
    ALTER TABLE "Contract" ADD CONSTRAINT "Contract_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
