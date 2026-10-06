-- ============================================================
-- Migration: Opportunity Enhancements
-- Data: 2026-10-06
-- Descrição:
--   1. Novos campos de contato do cliente na Opportunity
--   2. Novos campos no OpportunityProduct (notes, createdAt)
--   3. Remove @@unique([opportunityId, productId]) do OpportunityProduct
--      para permitir múltiplos produtos por oportunidade
--
-- SEGURO para produção: todos os novos campos são nullable ou
-- têm DEFAULT, sem risco de quebrar registros existentes.
-- ============================================================

BEGIN;

-- ─── 1. Campos de contato do cliente na Opportunity ───────────────────────────
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "contactName"     TEXT,
  ADD COLUMN IF NOT EXISTS "contactFullName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail"    TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone"    TEXT;

-- ─── 2. Campos adicionais em OpportunityProduct ──────────────────────────────
ALTER TABLE "OpportunityProduct"
  ADD COLUMN IF NOT EXISTS "notes"     TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── 3. Remove unique constraint para permitir múltiplos produtos ─────────────
-- O nome da constraint varia; usamos IF EXISTS para segurança
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OpportunityProduct_opportunityId_productId_key'
  ) THEN
    ALTER TABLE "OpportunityProduct"
      DROP CONSTRAINT "OpportunityProduct_opportunityId_productId_key";
  END IF;
END $$;

-- ─── 4. Index em OpportunityProduct por opportunityId ────────────────────────
CREATE INDEX IF NOT EXISTS "OpportunityProduct_opportunityId_idx"
  ON "OpportunityProduct" ("opportunityId");

-- ─── 5. Cascade delete: ao deletar Opportunity, remove produtos vinculados ────
-- Verifica se a FK já tem ON DELETE CASCADE antes de recriar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'OpportunityProduct'
      AND rc.delete_rule != 'CASCADE'
  ) THEN
    -- Recria a FK com CASCADE (drop + add)
    ALTER TABLE "OpportunityProduct"
      DROP CONSTRAINT IF EXISTS "OpportunityProduct_opportunityId_fkey";
    ALTER TABLE "OpportunityProduct"
      ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey"
      FOREIGN KEY ("opportunityId")
      REFERENCES "Opportunity"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
