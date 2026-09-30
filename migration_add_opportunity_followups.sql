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

CREATE INDEX "OpportunityFollowUp_opportunityId_idx" ON "OpportunityFollowUp"("opportunityId");
CREATE INDEX "OpportunityFollowUp_userId_idx" ON "OpportunityFollowUp"("userId");
CREATE INDEX "OpportunityFollowUp_createdAt_idx" ON "OpportunityFollowUp"("createdAt");
