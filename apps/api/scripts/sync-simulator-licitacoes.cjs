/**
 * Script de Migração: Sincroniza dados mock do Simulador para o banco de dados
 *
 * Uso:
 *   node scripts/sync-simulator-licitacoes.cjs          # dry-run (apenas mostra o que faria)
 *   node scripts/sync-simulator-licitacoes.cjs --apply  # executa a sincronização
 */

'use strict';

const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// O load-env.cjs carrega automaticamente ao ser importado
require('../lib/load-env.cjs');

const prisma = new PrismaClient();

// Mock dados replicados do editaisRepository.cjs
const mockLicitacoes = [
  {
    id: 'mock-1', orgao: 'Prefeitura de Curitiba', uf: 'PR', cidade: 'Curitiba',
    modalidade: 'Pregão Eletrônico', objeto_resumo: 'Aquisição de notebooks para a rede municipal de ensino.',
    data_abertura: new Date(Date.now() + 5 * 86400000).toISOString(),
    data_encerramento: new Date(Date.now() + 10 * 86400000).toISOString(),
    valor_estimado: 150000, situacao: 'Divulgada no PNCP',
    anoCompra: 2026, sequencialCompra: 6,
    numeroControlePNCP: '91984492000152-1-000006/2026',
    orgaoEntidade: { cnpj: '91984492000152', razaoSocial: 'Prefeitura de Curitiba' },
    unidadeOrgao: { ufSigla: 'PR', municipioNome: 'Curitiba' },
    linkSistemaOrigem: 'https://pncp.gov.br',
    itens: [{ descricao: 'Notebook i5 8GB 256SSD', quantidade: 50, unidade: 'UN', valor_referencia: 3000 }]
  },
  {
    id: 'mock-2', orgao: 'Tribunal de Justiça SP', uf: 'SP', cidade: 'São Paulo',
    modalidade: 'Concorrência', objeto_resumo: 'Modernização do datacenter com servidores e storage.',
    data_abertura: new Date(Date.now() + 8 * 86400000).toISOString(),
    data_encerramento: new Date(Date.now() + 15 * 86400000).toISOString(),
    valor_estimado: 2500000, situacao: 'Divulgada no PNCP',
    numeroControlePNCP: '03501308000167-1-000002/2026',
    orgaoEntidade: { cnpj: '03501308000167', razaoSocial: 'Tribunal de Justiça SP' },
    unidadeOrgao: { ufSigla: 'SP', municipioNome: 'São Paulo' },
    linkSistemaOrigem: 'https://pncp.gov.br',
    itens: [{ descricao: 'Servidor Rack 2U', quantidade: 10, unidade: 'UN', valor_referencia: 250000 }]
  },
  {
    id: 'mock-3', orgao: 'Secretaria de Saúde PR', uf: 'PR', cidade: 'Curitiba',
    modalidade: 'Pregão Eletrônico', objeto_resumo: 'Contratação de serviços de suporte técnico e service desk para toda a secretaria.',
    data_abertura: new Date(Date.now() + 3 * 86400000).toISOString(),
    data_encerramento: new Date(Date.now() + 7 * 86400000).toISOString(),
    valor_estimado: 480000, situacao: 'Divulgada no PNCP',
    numeroControlePNCP: '76416965000174-1-000012/2026',
    orgaoEntidade: { cnpj: '76416965000174', razaoSocial: 'Secretaria de Saúde PR' },
    unidadeOrgao: { ufSigla: 'PR', municipioNome: 'Curitiba' },
    linkSistemaOrigem: 'https://pncp.gov.br',
    itens: [{ descricao: 'Suporte TI mensal', quantidade: 12, unidade: 'MÊS', valor_referencia: 40000 }]
  }
];

// Função para obter REPOSITORY_LICITACOES dinamicamente
function getRepositoryLicitacoes() {
  try {
    const { getDynamicRepositoryLicitacoes } = require('../api/editaisRepository.cjs');
    return getDynamicRepositoryLicitacoes();
  } catch (err) {
    console.warn('⚠️ Não foi possível carregar editaisRepository.cjs:', err.message);
    return [];
  }
}

const crypto = require('crypto');

function normalizeLicitacaoForDb(item, fonte = 'mock') {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(item))
    .digest('hex');

  return {
    codigo: item.id || `sim-${Date.now()}`,
    orgao: item.orgao || item.orgaoEntidade?.razaoSocial || null,
    orgao_nome: item.orgao || item.orgaoEntidade?.razaoSocial || null,
    uf: item.uf || item.unidadeOrgao?.ufSigla || null,
    cidade: item.cidade || item.unidadeOrgao?.municipioNome || null,
    modalidade: item.modalidade || item.modalidadeNome || null,
    modalidade_nome: item.modalidadeNome || item.modalidade || null,
    objeto_resumo: item.objeto_resumo || item.objetoCompra || null,
    objeto_compra: item.objetoCompra || item.objeto_resumo || null,
    data_abertura: item.data_abertura || item.dataAberturaProposta ? new Date(item.data_abertura || item.dataAberturaProposta) : null,
    data_encerramento: item.data_encerramento || item.dataEncerramentoProposta ? new Date(item.data_encerramento || item.dataEncerramentoProposta) : null,
    data_encerramento_proposta: item.dataEncerramentoProposta || item.data_encerramento ? new Date(item.dataEncerramentoProposta || item.data_encerramento) : null,
    data_hora_abertura_sessao: item.dataHoraAberturaSessaoPublica ? new Date(item.dataHoraAberturaSessaoPublica) : null,
    data_publicacao_pncp: item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : null,
    data_atualizacao: item.dataAtualizacao ? new Date(item.dataAtualizacao) : null,
    valor_estimado: item.valor_estimado || item.valorTotalEstimado || 0,
    valor_total_estimado: item.valorTotalEstimado || item.valor_estimado || 0,
    numero_controle_pncp: item.numeroControlePNCP || null,
    numero_compra: item.numeroCompra || null,
    ano_compra: item.anoCompra || null,
    sequencial_compra: item.sequencialCompra || null,
    processo: item.processo || null,
    situacao: item.situacao || item.situacaoCompraNome || null,
    situacao_compra_nome: item.situacaoCompraNome || item.situacao || null,
    orgao_entidade: item.orgaoEntidade || null,
    unidade_orgao: item.unidadeOrgao || null,
    itens: Array.isArray(item.itens) ? item.itens : [],
    fonte_dados: fonte,
    link_sistema_origem: item.linkSistemaOrigem || null,
    link_processo_eletronico: item.linkProcessoEletronico || null,
    hash_verificacao: hash,
    last_synced_at: new Date(),
    is_mock: fonte === 'mock',
    is_ativo: true
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;

  console.log('='.repeat(60));
  console.log('  SYNC SIMULADOR LICITAÇÕES -> BANCO DE DADOS');
  console.log('='.repeat(60));
  console.log(`Modo: ${dryRun ? 'DRY-RUN (apenas visualização)' : 'APLICAÇÃO REAL'}`);
  console.log('');

  try {
    // Obter todos os dados
    const dynamicRepo = getRepositoryLicitacoes();
    const allLicitacoes = [...mockLicitacoes, ...dynamicRepo];
    console.log(`Total de licitações para sincronizar: ${allLicitacoes.length}`);
    console.log(`  - mockLicitacoes: ${mockLicitacoes.length}`);
    console.log(`  - REPOSITORY_LICITACOES: ${dynamicRepo.length}`);
    console.log('');

    // Mostrar status atual (usando raw query)
    const [countResult] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "simulator_licitacao" WHERE "is_ativo" = true`);
    const currentCount = parseInt(countResult?.count || 0);
    console.log(`Licitações já persistidas: ${currentCount}`);
    console.log('');

    // Processar cada licitação
    let synced = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const item of allLicitacoes) {
      try {
        const data = normalizeLicitacaoForDb(item, 'mock');

        // Verificar se já existe (usando raw query)
        const [existing] = await prisma.$queryRawUnsafe(
          `SELECT id, "hash_verificacao" FROM "simulator_licitacao" 
           WHERE "codigo" = $1 OR ("numero_controle_pncp" IS NOT NULL AND "numero_controle_pncp" = $2) LIMIT 1`,
          data.codigo, data.numero_controle_pncp
        );

        // Serialize JSON para string para passar no parametro
        const orgaoEntidadeStr = data.orgao_entidade ? JSON.stringify(data.orgao_entidade) : null;
        const unidadeOrgaoStr = data.unidade_orgao ? JSON.stringify(data.unidade_orgao) : null;
        const itensStr = JSON.stringify(data.itens);

        if (dryRun) {
          if (!existing) {
            console.log(`  [+] ${data.codigo} — ${data.orgao} (${data.uf})`);
            synced++;
          } else if (existing.hash_verificacao !== data.hash_verificacao) {
            console.log(`  [~] ${data.codigo} — ${data.orgao} (UPDATE necessário)`);
            updated++;
          } else {
            console.log(`  [=] ${data.codigo} — ${data.orgao} (já sincronizado)`);
            skipped++;
          }
        } else {
          if (!existing) {
            // Insert com cast para JSONB
            await prisma.$queryRawUnsafe(
              `INSERT INTO "simulator_licitacao" (
                codigo, orgao, orgao_nome, uf, cidade, modalidade, modalidade_nome,
                objeto_resumo, objeto_compra, data_abertura, data_encerramento,
                data_encerramento_proposta, data_hora_abertura_sessao, data_publicacao_pncp,
                data_atualizacao, valor_estimado, valor_total_estimado, numero_controle_pncp,
                numero_compra, ano_compra, sequencial_compra, processo, situacao, situacao_compra_nome,
                orgao_entidade, unidade_orgao, itens, fonte_dados, link_sistema_origem,
                link_processo_eletronico, hash_verificacao, last_synced_at, is_mock, is_ativo,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24, $25::jsonb, $26::jsonb, $27::jsonb, $28, $29, $30, $31, $32, $33, $34,
                NOW(), NOW()
              )`,
              data.codigo, data.orgao, data.orgao_nome, data.uf, data.cidade, data.modalidade, data.modalidade_nome,
              data.objeto_resumo, data.objeto_compra, data.data_abertura, data.data_encerramento,
              data.data_encerramento_proposta, data.data_hora_abertura_sessao, data.data_publicacao_pncp,
              data.data_atualizacao, data.valor_estimado, data.valor_total_estimado, data.numero_controle_pncp,
              data.numero_compra, data.ano_compra, data.sequencial_compra, data.processo, data.situacao, data.situacao_compra_nome,
              orgaoEntidadeStr, unidadeOrgaoStr, itensStr,
              data.fonte_dados, data.link_sistema_origem, data.link_processo_eletronico, data.hash_verificacao,
              data.last_synced_at, data.is_mock, data.is_ativo
            );
            synced++;
          } else if (existing.hash_verificacao !== data.hash_verificacao) {
            // Update com cast para JSONB
            await prisma.$queryRawUnsafe(
              `UPDATE "simulator_licitacao" SET
                orgao = $2, orgao_nome = $3, uf = $4, cidade = $5, modalidade = $6, modalidade_nome = $7,
                objeto_resumo = $8, objeto_compra = $9, data_abertura = $10, data_encerramento = $11,
                data_encerramento_proposta = $12, data_hora_abertura_sessao = $13, data_publicacao_pncp = $14,
                data_atualizacao = $15, valor_estimado = $16, valor_total_estimado = $17, numero_controle_pncp = $18,
                numero_compra = $19, ano_compra = $20, sequencial_compra = $21, processo = $22, situacao = $23,
                situacao_compra_nome = $24, orgao_entidade = $25::jsonb, unidade_orgao = $26::jsonb, itens = $27::jsonb, fonte_dados = $28,
                link_sistema_origem = $29, link_processo_eletronico = $30, hash_verificacao = $31, last_synced_at = $32,
                is_mock = $33, updated_at = NOW()
              WHERE id = $1`,
              existing.id, data.orgao, data.orgao_nome, data.uf, data.cidade, data.modalidade, data.modalidade_nome,
              data.objeto_resumo, data.objeto_compra, data.data_abertura, data.data_encerramento,
              data.data_encerramento_proposta, data.data_hora_abertura_sessao, data.data_publicacao_pncp,
              data.data_atualizacao, data.valor_estimado, data.valor_total_estimado, data.numero_controle_pncp,
              data.numero_compra, data.ano_compra, data.sequencial_compra, data.processo, data.situacao, data.situacao_compra_nome,
              orgaoEntidadeStr, unidadeOrgaoStr, itensStr,
              data.fonte_dados, data.link_sistema_origem, data.link_processo_eletronico, data.hash_verificacao,
              data.last_synced_at, data.is_mock
            );
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (itemErr) {
        errors.push({ codigo: item.id, error: itemErr.message });
      }
    }

    console.log('');
    console.log('-'.repeat(60));
    console.log('RESUMO:');
    console.log(`  Novas:     ${synced}`);
    console.log(`  Atualizadas: ${updated}`);
    console.log(`  Ignoradas: ${skipped}`);
    console.log(`  Erros:     ${errors.length}`);
    console.log('-'.repeat(60));

    if (errors.length > 0) {
      console.log('');
      console.log('Erros detalhados (primeiros 5):');
      errors.slice(0, 5).forEach(e => console.log(`  - ${e.codigo}: ${e.error}`));
    }

    if (dryRun) {
      console.log('');
      console.log('ℹ️  Para aplicar as alterações, execute com --apply:');
      console.log('   node scripts/sync-simulator-licitacoes.cjs --apply');
    } else {
      console.log('');
      console.log('✅ Sincronização concluída com sucesso!');
    }

  } catch (err) {
    console.error('❌ Erro durante sincronização:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();