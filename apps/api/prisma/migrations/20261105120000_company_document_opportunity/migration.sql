ALTER TABLE "CompanyDocument"
  ADD COLUMN IF NOT EXISTS "opportunityId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'DOCUMENT';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyDocument_opportunityId_fkey') THEN
    ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CompanyDocument_companyId_opportunityId_idx"
  ON "CompanyDocument"("companyId", "opportunityId");
