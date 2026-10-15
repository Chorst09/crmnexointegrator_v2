ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "accountManagerId" TEXT;

-- Migrate legacy names only when exactly one user in the same tenant matches.
UPDATE "Company" c SET "accountManagerId" = u."id"
FROM "User" u
WHERE c."accountManagerId" IS NULL
  AND c."accountManagerName" = u."name"
  AND c."tenantCompanyId" IS NOT DISTINCT FROM u."tenantCompanyId"
  AND (SELECT COUNT(*) FROM "User" other
       WHERE other."name" = c."accountManagerName"
         AND other."tenantCompanyId" IS NOT DISTINCT FROM c."tenantCompanyId") = 1;
