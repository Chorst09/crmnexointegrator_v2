const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRE_SALES';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TYPE "PreSalesStatus" ADD VALUE IF NOT EXISTS 'ENVIADA';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TYPE "PreSalesStatus" ADD VALUE IF NOT EXISTS 'APROVADO';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TYPE "PreSalesStatus" ADD VALUE IF NOT EXISTS 'REPROVADO';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "accessB2B" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "accessB2G" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessManagement" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "tenantCompanyId" TEXT,
      ADD COLUMN IF NOT EXISTS "permissionOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "isCompanyOwner" BOOLEAN NOT NULL DEFAULT false;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "TenantCompanyStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'CANCELED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "LicenseBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TenantCompany" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "legalName" TEXT,
      "cnpj" TEXT UNIQUE,
      "email" TEXT,
      "phone" TEXT,
      "status" "TenantCompanyStatus" NOT NULL DEFAULT 'PROSPECT',
      "notes" TEXT,
      "accessB2B" BOOLEAN NOT NULL DEFAULT true,
      "accessB2G" BOOLEAN NOT NULL DEFAULT false,
      "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
      "accessManagement" BOOLEAN NOT NULL DEFAULT false,
      "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
      "rolePolicyOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LicensePlan" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "code" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "billingCycle" "LicenseBillingCycle" NOT NULL,
      "price" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'BRL',
      "seatsIncluded" INTEGER NOT NULL DEFAULT 1,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "features" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CompanyLicense" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "tenantCompanyId" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "status" "LicenseStatus" NOT NULL DEFAULT 'PENDING',
      "seats" INTEGER NOT NULL DEFAULT 1,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "priceAtPurchase" DOUBLE PRECISION NOT NULL,
      "notes" TEXT,
      "paymentReference" TEXT UNIQUE,
      "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
      "paymentConfirmedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CompanyLicense_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CompanyLicense_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LicensePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TenantCompany"
      ADD COLUMN IF NOT EXISTS "accessB2B" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "accessB2G" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessManagement" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "rolePolicyOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TenantCompany_status_createdAt_idx" ON "TenantCompany"("status", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LicensePlan_isActive_sortOrder_idx" ON "LicensePlan"("isActive", "sortOrder");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CompanyLicense_tenantCompanyId_status_endDate_idx" ON "CompanyLicense"("tenantCompanyId", "status", "endDate");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CompanyLicense_paymentStatus_createdAt_idx" ON "CompanyLicense"("paymentStatus", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_tenantCompanyId_idx" ON "User"("tenantCompanyId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Company"
      ADD COLUMN IF NOT EXISTS "accessB2B" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "accessB2G" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessManagement" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "tenantCompanyId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Company_tenantCompanyId_idx"
      ON "Company"("tenantCompanyId");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Product"
      ADD COLUMN IF NOT EXISTS "tenantCompanyId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Product_tenantCompanyId_idx"
      ON "Product"("tenantCompanyId");
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Company"
      SET "accessManagement" = true
      WHERE "accessB2B" = true AND "accessB2G" = true;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Opportunity"
      ADD COLUMN IF NOT EXISTS "number" TEXT,
      ADD COLUMN IF NOT EXISTS "projectName" TEXT,
      ADD COLUMN IF NOT EXISTS "projectClientType" TEXT,
      ADD COLUMN IF NOT EXISTS "b2gStage" TEXT,
      ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
      ADD COLUMN IF NOT EXISTS "projectMonths" INTEGER,
      ADD COLUMN IF NOT EXISTS "stageDecisionDetails" JSONB,
      ADD COLUMN IF NOT EXISTS "tenantCompanyId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Opportunity"
      SET "projectName" = "title"
      WHERE "projectName" IS NULL;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_number_key"
      ON "Opportunity"("number");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Opportunity_b2gStage_idx"
      ON "Opportunity"("b2gStage");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Opportunity_tenantCompanyId_idx"
      ON "Opportunity"("tenantCompanyId");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Activity"
      ADD COLUMN IF NOT EXISTS "tenantCompanyId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Activity_tenantCompanyId_idx"
      ON "Activity"("tenantCompanyId");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Commission"
      ADD COLUMN IF NOT EXISTS "calculationBase" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
      ADD COLUMN IF NOT EXISTS "projectMonths" INTEGER;
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Erro ao verificar schema de comissionamento:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
