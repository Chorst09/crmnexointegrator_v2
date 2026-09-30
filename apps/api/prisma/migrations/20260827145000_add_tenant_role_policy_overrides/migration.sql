ALTER TABLE "TenantCompany"
  ADD COLUMN IF NOT EXISTS "rolePolicyOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb;
