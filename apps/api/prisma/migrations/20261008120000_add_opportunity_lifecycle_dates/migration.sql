ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "leadEntryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "customerTurnDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exitDate" TIMESTAMP(3);

UPDATE "Opportunity"
SET "leadEntryDate" = COALESCE("leadEntryDate", "createdAt", CURRENT_TIMESTAMP);

UPDATE "Opportunity"
SET "customerTurnDate" = COALESCE("customerTurnDate", "actualCloseDate")
WHERE "stage" = 'WON';

UPDATE "Opportunity"
SET "exitDate" = COALESCE("exitDate", "actualCloseDate")
WHERE "stage" = 'LOST';
