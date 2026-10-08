ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "leadEntryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Company"
SET "leadEntryDate" = COALESCE("leadEntryDate", "createdAt", CURRENT_TIMESTAMP);

UPDATE "Opportunity" AS o
SET "leadEntryDate" = COALESCE(c."leadEntryDate", c."createdAt", o."leadEntryDate")
FROM "Company" AS c
WHERE o."companyId" = c."id";
