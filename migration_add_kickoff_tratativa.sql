-- Migration: campo "tratativa" nos itens de pauta do módulo Kickoff
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS)

ALTER TABLE "KickoffAgendaItem" ADD COLUMN IF NOT EXISTS "tratativa" TEXT;
