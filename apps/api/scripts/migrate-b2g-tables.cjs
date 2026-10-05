/**
 * Migration Script: Garante que todas as tabelas B2G e SIMULADOR existam no banco
 *
 * Uso:
 *   node scripts/migrate-b2g-tables.cjs        # dry-run
 *   node scripts/migrate-b2g-tables.cjs --apply  # executa
 */

'use strict';

const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../lib/load-env.cjs');

const prisma = new PrismaClient();

const sql = `
  -- ============================================
  -- Tabelas B2G: LICITAÇÕES
  -- ============================================

  -- Tabela: gerenciadas_licitacao
  CREATE TABLE IF NOT EXISTS "gerenciadas_licitacao" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255),
    "tenant_company_id" VARCHAR(255),
    "numero_controle_pncp" VARCHAR(255),
    "numero_compra" VARCHAR(255),
    "orgao" VARCHAR(500),
    "uf" VARCHAR(10),
    "cidade" VARCHAR(255),
    "modalidade" VARCHAR(255),
    "objeto_resumo" TEXT,
    "data_abertura" TIMESTAMP,
    "data_encerramento" TIMESTAMP,
    "valor_estimado" DECIMAL(15,4),
    "situacao" VARCHAR(255),
    "link_sistema_origem" VARCHAR(1000),
    "status_fase" VARCHAR(255) DEFAULT 'Análise',
    "payload_completo" JSONB,
    "notas" TEXT,
    "added_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS "idx_gerenciadas_user" ON "gerenciadas_licitacao"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_gerenciadas_tenant" ON "gerenciadas_licitacao"("tenant_company_id");
  CREATE INDEX IF NOT EXISTS "idx_gerenciadas_pncp" ON "gerenciadas_licitacao"("numero_controle_pncp");
  CREATE INDEX IF NOT EXISTS "idx_gerenciadas_fase" ON "gerenciadas_licitacao"("status_fase");

  -- Tabela: alertas_licitacao
  CREATE TABLE IF NOT EXISTS "alertas_licitacao" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255),
    "tenant_company_id" VARCHAR(255),
    "termo" VARCHAR(255) NOT NULL,
    "uf" VARCHAR(10),
    "modalidade" VARCHAR(100),
    "data_abertura_inicio" TIMESTAMP,
    "min_valor" DECIMAL(15,4) DEFAULT 0,
    "ativo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS "idx_alertas_user" ON "alertas_licitacao"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_alertas_tenant" ON "alertas_licitacao"("tenant_company_id");
  CREATE INDEX IF NOT EXISTS "idx_alertas_ativo" ON "alertas_licitacao"("ativo");

  -- Tabela: editais_analisados
  CREATE TABLE IF NOT EXISTS "editais_analisados" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "numero_controle_pncp" VARCHAR(255) NOT NULL,
    "orgao" VARCHAR(500),
    "objeto" TEXT,
    "valor_estimado" DECIMAL(15,4),
    "data_abertura" TIMESTAMP,
    "analysis_data" JSONB,
    "user_id" VARCHAR(255),
    "tenant_company_id" VARCHAR(255),
    "convertido_oportunidade" BOOLEAN DEFAULT false,
    "oportunidade_id" UUID,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "idx_editais_analisados_unique" ON "editais_analisados"("numero_controle_pncp", "user_id");
  CREATE INDEX IF NOT EXISTS "idx_editais_user" ON "editais_analisados"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_editais_tenant" ON "editais_analisados"("tenant_company_id");

  -- ============================================
  -- Tabelas SIMULADOR
  -- ============================================

  -- Tabela: simulator_licitacao (já pode existir, garantir estrutura)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'simulator_licitacao') THEN
      CREATE TABLE "simulator_licitacao" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" VARCHAR(255) NOT NULL UNIQUE,
        "orgao" VARCHAR(500),
        "orgao_nome" VARCHAR(500),
        "uf" VARCHAR(2),
        "cidade" VARCHAR(300),
        "modalidade" VARCHAR(200),
        "modalidade_nome" VARCHAR(200),
        "objeto_resumo" TEXT,
        "objeto_compra" TEXT,
        "data_abertura" TIMESTAMP,
        "data_encerramento" TIMESTAMP,
        "data_encerramento_proposta" TIMESTAMP,
        "data_hora_abertura_sessao" TIMESTAMP,
        "data_publicacao_pncp" DATE,
        "data_atualizacao" TIMESTAMP,
        "valor_estimado" DECIMAL(15,4) DEFAULT 0,
        "valor_total_estimado" DECIMAL(15,4) DEFAULT 0,
        "numero_controle_pncp" VARCHAR(255),
        "numero_compra" VARCHAR(100),
        "ano_compra" INTEGER,
        "sequencial_compra" INTEGER,
        "processo" VARCHAR(100),
        "situacao" VARCHAR(200),
        "situacao_compra_nome" VARCHAR(200),
        "orgao_entidade" JSONB,
        "unidade_orgao" JSONB,
        "itens" JSONB DEFAULT '[]',
        "fonte_dados" VARCHAR(50) DEFAULT 'mock',
        "link_sistema_origem" VARCHAR(1000),
        "link_processo_eletronico" VARCHAR(1000),
        "version" INTEGER DEFAULT 1,
        "hash_verificacao" VARCHAR(64),
        "last_synced_at" TIMESTAMP,
        "is_ativo" BOOLEAN DEFAULT true,
        "is_mock" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );
    END IF;
  END $$;

  -- Criar índices para simulator_licitacao se não existirem
  CREATE INDEX IF NOT EXISTS "idx_simlic_codigo" ON "simulator_licitacao"("codigo");
  CREATE INDEX IF NOT EXISTS "idx_simlic_pncp" ON "simulator_licitacao"("numero_controle_pncp");
  CREATE INDEX IF NOT EXISTS "idx_simlic_fonte" ON "simulator_licitacao"("fonte_dados");
  CREATE INDEX IF NOT EXISTS "idx_simlic_ativo" ON "simulator_licitacao"("is_ativo");
  CREATE INDEX IF NOT EXISTS "idx_simlic_ano" ON "simulator_licitacao"("ano_compra");
  CREATE INDEX IF NOT EXISTS "idx_simlic_uf" ON "simulator_licitacao"("uf", "cidade");
  CREATE INDEX IF NOT EXISTS "idx_simlic_modalidade" ON "simulator_licitacao"("modalidade");
  CREATE INDEX IF NOT EXISTS "idx_simlic_datas" ON "simulator_licitacao"("data_abertura", "data_encerramento");

  -- Tabela: simulator_proposal (já deve existir, garantir índices)
  CREATE INDEX IF NOT EXISTS "idx_simprop_base" ON "simulator_proposal"("base_id");
  CREATE INDEX IF NOT EXISTS "idx_simprop_type" ON "simulator_proposal"("type");
  CREATE INDEX IF NOT EXISTS "idx_simprop_status" ON "simulator_proposal"("status");
  CREATE INDEX IF NOT EXISTS "idx_simprop_created_by" ON "simulator_proposal"("created_by");
`;

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;

  console.log('='.repeat(70));
  console.log('  MIGRATION: Tabelas B2G e SIMULADOR');
  console.log('='.repeat(70));
  console.log(`Modo: ${dryRun ? 'DRY-RUN (apenas visualização)' : 'APLICAÇÃO REAL'}`);
  console.log('');

  try {
    if (dryRun) {
      console.log('SQL que seria executado:');
      console.log('-'.repeat(70));
      console.log(sql.substring(0, 2000) + '...');
      console.log('-'.repeat(70));
      console.log('');
      console.log('ℹ️  Para aplicar, execute com --apply');
    } else {
      console.log('Executando migration das tabelas B2G e SIMULADOR...');
      
      // Executar comando por comando
      const commands = sql.split(';').filter(c => c.trim().length > 10);
      
      for (const cmd of commands) {
        try {
          await prisma.$queryRawUnsafe(cmd);
        } catch (e) {
          // IGNORAR erros de "index already exists" ou "already exists"
          if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
            console.warn('Aviso:', e.message.substring(0, 100));
          }
        }
      }

      console.log('✅ Migration executada com sucesso!');
    }

    // Verificar tabelas existentes
    console.log('');
    console.log('Status atual das tabelas:');

    const tables = [
      'gerenciadas_licitacao',
      'alertas_licitacao',
      'editais_analisados',
      'simulator_licitacao',
      'simulator_proposal',
      'licitacoes_pncp'
    ];

    for (const table of tables) {
      try {
        const [result] = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table}" LIMIT 1`
        );
        const count = parseInt(result?.count || 0);
        console.log(`  ✓ ${table}: ${count} registros`);
      } catch (e) {
        console.log(`  ✗ ${table}: NÃO EXISTE`);
      }
    }

  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();