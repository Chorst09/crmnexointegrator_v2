-- Migration: Add OpportunityFollowUp table
-- Description: Adiciona tabela para armazenar acompanhamentos/interações de oportunidades
-- Date: 2026-06-25

CREATE TABLE IF NOT EXISTS "OpportunityFollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OpportunityFollowUp_opportunityId_idx" ON "OpportunityFollowUp"("opportunityId");
CREATE INDEX IF NOT EXISTS "OpportunityFollowUp_userId_idx" ON "OpportunityFollowUp"("userId");
CREATE INDEX IF NOT EXISTS "OpportunityFollowUp_createdAt_idx" ON "OpportunityFollowUp"("createdAt");

DO $$ BEGIN
 CREATE TYPE "AttentionSeverity" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
 CREATE TYPE "AttentionStatus" AS ENUM ('PENDENTE', 'RESOLVIDO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
 CREATE TYPE "LearningCategory" AS ENUM ('NEGOCIACAO', 'CONCORRENCIA', 'EDITAL_JURIDICO', 'ESCOPO_TECNICO', 'PERDA_DE_DEAL', 'RELACIONAMENTO', 'PRECIFICACAO', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OpportunityAttentionPoint" (
 "id" TEXT PRIMARY KEY,
 "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "description" TEXT NOT NULL,
 "severity" "AttentionSeverity" NOT NULL DEFAULT 'MEDIA',
 "status" "AttentionStatus" NOT NULL DEFAULT 'PENDENTE',
 "resolvedAt" TIMESTAMP(3),
 "resolvedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "tenantCompanyId" TEXT REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "OpportunityAttentionPoint_opportunityId_idx" ON "OpportunityAttentionPoint"("opportunityId");
CREATE INDEX IF NOT EXISTS "OpportunityAttentionPoint_tenantCompanyId_idx" ON "OpportunityAttentionPoint"("tenantCompanyId");

CREATE TABLE IF NOT EXISTS "OpportunityLearning" (
 "id" TEXT PRIMARY KEY,
 "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "category" "LearningCategory" NOT NULL,
 "description" TEXT NOT NULL,
 "tenantCompanyId" TEXT REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "OpportunityLearning_opportunityId_idx" ON "OpportunityLearning"("opportunityId");
CREATE INDEX IF NOT EXISTS "OpportunityLearning_tenantCompanyId_idx" ON "OpportunityLearning"("tenantCompanyId");
