/**
 * Migration Script: Cria/atualiza as tabelas do Simulador no banco
 *
 * Uso:
 *   node scripts/migrate-simulator-tables.cjs        # dry-run
 *   node scripts/migrate-simulator-tables.cjs --apply  # executa
 */

'use strict';

const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// O load-env.cjs carrega automaticamente ao ser importado
require('../lib/load-env.cjs');

const prisma = new PrismaClient();

const sql = `
  -- Tabela: simulator_licitacao
  CREATE TABLE IF NOT EXISTS "simulator_licitacao" (
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

  -- Índices para simulator_licitacao
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_codigo" ON "simulator_licitacao"("codigo");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_pncp" ON "simulator_licitacao"("numero_controle_pncp");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_fonte" ON "simulator_licitacao"("fonte_dados");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_ativo" ON "simulator_licitacao"("is_ativo");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_ano" ON "simulator_licitacao"("ano_compra");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_uf" ON "simulator_licitacao"("uf", "cidade");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_modalidade" ON "simulator_licitacao"("modalidade");
  CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_datas" ON "simulator_licitacao"("data_abertura", "data_encerramento");

  -- Tabela: simulator_proposal (já existe, mas garantindo estrutura)
  CREATE TABLE IF NOT EXISTS "simulator_proposal" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "base_id" VARCHAR(255) NOT NULL,
    "version" INTEGER DEFAULT 1,
    "title" VARCHAR(255) NOT NULL,
    "client" VARCHAR(255),
    "type" VARCHAR(50) DEFAULT 'STANDARD',
    "value" DECIMAL(15,4) DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'Rascunho',
    "forecast_temperature" FLOAT,
    "metadata" JSONB DEFAULT '{}',
    "account_manager" TEXT,
    "distributor_id" VARCHAR(255),
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    CONSTRAINT "simulator_proposal_base_version_unique" UNIQUE ("base_id", "version")
  );

  CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_base_id" ON "simulator_proposal"("base_id");
  CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_type" ON "simulator_proposal"("type");
  CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_status" ON "simulator_proposal"("status");
  CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_created_by" ON "simulator_proposal"("created_by");
`;

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;

  console.log('='.repeat(60));
  console.log('  MIGRATION: Tabelas do Módulo Simulador');
  console.log('='.repeat(60));
  console.log(`Modo: ${dryRun ? 'DRY-RUN (apenas visualização)' : 'APLICAÇÃO REAL'}`);
  console.log('');

  try {
    if (dryRun) {
      console.log('SQL que seria executado:');
      console.log('-'.repeat(60));
      console.log('CREATE TABLE IF NOT EXISTS "simulator_licitacao" (...)');
      console.log('CREATE INDEX IF NOT EXISTS ...');
      console.log('CREATE TABLE IF NOT EXISTS "simulator_proposal" (...)');
      console.log('CREATE INDEX IF NOT EXISTS ...');
      console.log('-'.repeat(60));
      console.log('');
      console.log('ℹ️  Para aplicar, execute com --apply');
    } else {
      // Executar migration - comando por comando
      console.log('Criando tabela simulator_licitacao...');
      await prisma.$queryRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "simulator_licitacao" (
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
        )
      `);
      
      console.log('Criando índices para simulator_licitacao...');
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_codigo" ON "simulator_licitacao"("codigo")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_pncp" ON "simulator_licitacao"("numero_controle_pncp")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_fonte" ON "simulator_licitacao"("fonte_dados")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_ativo" ON "simulator_licitacao"("is_ativo")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_ano" ON "simulator_licitacao"("ano_compra")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_uf" ON "simulator_licitacao"("uf", "cidade")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_modalidade" ON "simulator_licitacao"("modalidade")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_licitacao_datas" ON "simulator_licitacao"("data_abertura", "data_encerramento")`);

      console.log('Criando tabela simulator_proposal...');
      await prisma.$queryRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "simulator_proposal" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "base_id" VARCHAR(255) NOT NULL,
          "version" INTEGER DEFAULT 1,
          "title" VARCHAR(255) NOT NULL,
          "client" VARCHAR(255),
          "type" VARCHAR(50) DEFAULT 'STANDARD',
          "value" DECIMAL(15,4) DEFAULT 0,
          "status" VARCHAR(50) DEFAULT 'Rascunho',
          "forecast_temperature" FLOAT,
          "metadata" JSONB DEFAULT '{}',
          "account_manager" TEXT,
          "distributor_id" VARCHAR(255),
          "created_by" VARCHAR(255),
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW(),
          CONSTRAINT "simulator_proposal_base_version_unique" UNIQUE ("base_id", "version")
        )
      `);

      console.log('Criando índices para simulator_proposal...');
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_base_id" ON "simulator_proposal"("base_id")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_type" ON "simulator_proposal"("type")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_status" ON "simulator_proposal"("status")`);
      await prisma.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_simulator_proposal_created_by" ON "simulator_proposal"("created_by")`);

      console.log('');
      console.log('✅ Tabelas criadas/atualizadas com sucesso!');
      console.log('');
      console.log('Tabelas:');
      console.log('  - simulator_licitacao');
      console.log('  - simulator_proposal');
    }

    // Verificar tabelas existentes
    console.log('');
    console.log('Status atual das tabelas:');

    try {
      const [licitacoesCount] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "simulator_licitacao"`);
      console.log(`  - simulator_licitacao: ${licitacoesCount?.count || 0} registros`);
    } catch (e) {
      console.log('  - simulator_licitacao: não existe ainda');
    }

    try {
      const [proposalsCount] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "simulator_proposal"`);
      console.log(`  - simulator_proposal: ${proposalsCount?.count || 0} registros`);
    } catch (e) {
      console.log('  - simulator_proposal: não existe ainda');
    }

  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();