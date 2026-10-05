/**
 * Auto-Sync do Módulo Simulador
 * Sincroniza dados mock com o banco de dados na inicialização do servidor
 *
 * Este módulo garante que os dados do Simulador nunca se percam,
 * mesmo após reinicializações ou deploys.
 */

'use strict';

const { prisma } = require('./prisma.cjs');
const crypto = require('crypto');

// Mock dados
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

function getRepositoryLicitacoes() {
  try {
    const { getDynamicRepositoryLicitacoes } = require('../api/editaisRepository.cjs');
    return getDynamicRepositoryLicitacoes();
  } catch (err) {
    return [];
  }
}

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

async function syncSimulatorLicitacoes(options = {}) {
  const { quiet = false, force = false } = options;
  const startTime = Date.now();

  try {
    // Obter dados
    const dynamicRepo = getRepositoryLicitacoes();
    const allLicitacoes = [...mockLicitacoes, ...dynamicRepo];

    if (!quiet) {
      console.log(`[simulator-sync] Iniciando sincronização de ${allLicitacoes.length} licitações...`);
    }

    let synced = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of allLicitacoes) {
      try {
        const data = normalizeLicitacaoForDb(item, 'mock');

        // Verificar se já existe
        const existing = await prisma.simulatorLicitacao.findFirst({
          where: {
            OR: [
              { codigo: data.codigo },
              ...(data.numero_controle_pncp ? [{ numero_controle_pncp: data.numero_controle_pncp }] : [])
            ]
          }
        });

        if (!existing) {
          await prisma.simulatorLicitacao.create({
            data: { ...data, created_at: new Date(), updated_at: new Date() }
          });
          synced++;
        } else if (force || existing.hash_verificacao !== data.hash_verificacao) {
          await prisma.simulatorLicitacao.update({
            where: { id: existing.id },
            data: { ...data, updated_at: new Date() }
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (itemErr) {
        console.warn(`[simulator-sync] Erro ao sincronizar ${item.id}:`, itemErr.message);
      }
    }

    const duration = Date.now() - startTime;

    if (!quiet) {
      console.log(`[simulator-sync] Concluído em ${duration}ms: ${sync} novas, ${updated} atualizadas, ${skipped} ignoradas`);
    }

    return { synced, updated, skipped, duration };
  } catch (err) {
    console.error('[simulator-sync] Erro na sincronização:', err.message);
    throw err;
  }
}

// Executar sync automaticamente quando importado (apenas em produção ou via flag)
const shouldAutoSync = process.env.NODE_ENV === 'production' || process.env.SIMULATOR_AUTO_SYNC === 'true';

if (shouldAutoSync && process.argv[1]?.includes('server')) {
  // Delay para garantir que o banco está pronto
  setTimeout(async () => {
    try {
      await syncSimulatorLicitacoes();
    } catch (err) {
      console.error('[simulator-sync] Auto-sync falhou:', err.message);
    }
  }, 2000);
}

module.exports = {
  syncSimulatorLicitacoes,
  normalizeLicitacaoForDb
};