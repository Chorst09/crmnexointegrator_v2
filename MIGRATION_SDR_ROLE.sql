-- ============================================
-- Migration: Adicionar role SDR
-- Descrição: Permite que SDRs vejam todas as oportunidades
-- Data: 2026-11-11
-- ============================================

-- 1. Adicionar valor SDR ao enum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SDR';

-- 2. Atualizar Josiele Rodrigues para role SDR
UPDATE "User" 
SET role = 'SDR'
WHERE email = 'josiele.rodrigues@doubletelecom.com.br';

-- 3. Verificar a atualização
SELECT id, name, email, role, "accessB2B", "accessB2G"
FROM "User"
WHERE email = 'josiele.rodrigues@doubletelecom.com.br';

-- ============================================
-- INSTRUÇÕES PARA APLICAR:
-- ============================================
-- No servidor, execute:
-- docker exec -i nexoscrm-postgres psql -U nexoscrm -d <database_name> < MIGRATION_SDR_ROLE.sql
-- 
-- Onde <database_name> é o nome do banco (provavelmente nexoscrm ou postgres)
-- ============================================
