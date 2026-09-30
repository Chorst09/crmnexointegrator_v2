-- Migration: Add nomeCliente and modalidade to PreSalesRequest
-- Date: 2026-06-25
-- Description: Adds client name and modality (sale, rental, service) fields to budget registration

-- Add nomeCliente column (nullable string for client name)
ALTER TABLE "PreSalesRequest" 
ADD COLUMN IF NOT EXISTS "nomeCliente" TEXT;

-- Add modalidade column (nullable string: VENDA, LOCACAO, or SERVICO)
ALTER TABLE "PreSalesRequest" 
ADD COLUMN IF NOT EXISTS "modalidade" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "PreSalesRequest"."nomeCliente" IS 'Nome do cliente para o orçamento';
COMMENT ON COLUMN "PreSalesRequest"."modalidade" IS 'Modalidade do orçamento: VENDA, LOCACAO ou SERVICO';
