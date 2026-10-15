ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "accountManagerId" TEXT;
CREATE INDEX IF NOT EXISTS "Company_accountManagerId_idx" ON "Company"("accountManagerId");

-- Resolve existing named managers only when the name identifies one user within the tenant.
UPDATE "Company" c SET "accountManagerId" = u.id
FROM "User" u
WHERE c."accountManagerId" IS NULL
  AND NULLIF(TRIM(c."accountManagerName"), '') IS NOT NULL
  AND LOWER(TRIM(c."accountManagerName")) = LOWER(TRIM(u.name))
  AND c."tenantCompanyId" IS NOT DISTINCT FROM u."tenantCompanyId"
  AND (SELECT COUNT(*) FROM "User" candidate
       WHERE LOWER(TRIM(candidate.name)) = LOWER(TRIM(u.name))
         AND candidate."tenantCompanyId" IS NOT DISTINCT FROM u."tenantCompanyId") = 1;
