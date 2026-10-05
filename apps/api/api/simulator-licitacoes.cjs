/**
 * API de Licitações do Módulo Simulador
 * Sincroniza e persiste dados mock/PNCP para evitar perda em reinicializações
 *
 * Rotas:
 *   GET  /api/simulator/licitacoes        — lista licitações persistidas
 *   POST /api/simulator/licitacoes/sync   — sincroniza mock com banco
 *   GET  /api/simulator/licitacoes/stats  — estatísticas do repositório
 *   DELETE /api/simulator/licitacoes/:id  — remove licitação específica
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { prisma } = require('../lib/prisma.cjs');
const { requireRole } = require('../lib/auth.cjs');
const { REPOSITORY_LICITACOES } = require('./editaisRepository.cjs');

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

const crypto = require('crypto');

/**
 * Normaliza dados para o formato do banco
 */
const normalizeLicitacaoForDb = (item, fonte = 'mock') => {
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
};

/**
 * GET /api/simulator/licitacoes
 * Lista licitações persistidas com filtros opcionais
 */
router.get('/', async (req, res) => {
  try {
    const { fonte, uf, cidade, modalidade, is_ativo, limit = 100, offset = 0 } = req.query;

    const where = {};
    if (fonte) where.fonte_dados = fonte;
    if (uf) where.uf = uf.toUpperCase();
    if (cidade) where.cidade = { contains: cidade, mode: 'insensitive' };
    if (modalidade) where.modalidade = { contains: modalidade, mode: 'insensitive' };
    if (is_ativo !== undefined) where.is_ativo = is_ativo === 'true';

    const [rows, total] = await Promise.all([
      prisma.simulatorLicitacao.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.simulatorLicitacao.count({ where })
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (err) {
    console.error('❌ simulator-licitacoes GET:', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar licitações' });
  }
});

/**
 * GET /api/simulator/licitacoes/stats
 * Estatísticas do repositório de licitações
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      total,
      countPorFonte,
      countPorUf,
      countPorModalidade,
      ultimoSync
    ] = await Promise.all([
      prisma.simulatorLicitacao.count({ where: { is_ativo: true } }),
      prisma.simulatorLicitacao.groupBy({
        by: ['fonte_dados'],
        where: { is_ativo: true },
        _count: true
      }),
      prisma.simulatorLicitacao.groupBy({
        by: ['uf'],
        where: { is_ativo: true },
        _count: true,
        orderBy: { _count: { uf: 'desc' } },
        take: 10
      }),
      prisma.simulatorLicitacao.groupBy({
        by: ['modalidade'],
        where: { is_ativo: true },
        _count: true,
        orderBy: { _count: { modalidade: 'desc' } },
        take: 5
      }),
      prisma.simulatorLicitacao.findFirst({
        orderBy: { last_synced_at: 'desc' },
        select: { last_synced_at: true }
      })
    ]);

    return res.json({
      success: true,
      stats: {
        total_licitacoes: total,
        por_fonte: countPorFonte.reduce((acc, curr) => ({ ...acc, [curr.fonte_dados]: curr._count }), {}),
        top_ufs: countPorUf.map(u => ({ uf: u.uf, count: u._count })),
        top_modalidades: countPorModalidade.map(m => ({ modalidade: m.modalidade, count: m._count })),
        ultimo_sync: ultimoSync?.last_synced_at
      }
    });
  } catch (err) {
    console.error('❌ simulator-licitacoes/stats GET:', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * POST /api/simulator/licitacoes/sync
 * Sincroniza dados mock com o banco (idempotente)
 */
router.post('/sync', requireRole(['MASTER', 'ADMIN']), async (req, res) => {
  const startTime = Date.now();
  let synced = 0;
  let updated = 0;
  let errors = [];

  try {
    // Combinar mockLicitacoes e REPOSITORY_LICITACOES
    const dynamicRepo = typeof REPOSITORY_LICITACOES !== 'undefined' ? REPOSITORY_LICITACOES : [];
    const allLicitacoes = [...mockLicitacoes, ...dynamicRepo];

    console.log(`[simulator-licitacoes/sync] Iniciando sync de ${allLicitacoes.length} licitações...`);

    for (const item of allLicitacoes) {
      try {
        const data = normalizeLicitacaoForDb(item, 'mock');

        // Verificar se já existe
        const existing = await prisma.simulatorLicitacao.findFirst({
          where: { OR: [
            { codigo: data.codigo },
            { numero_controle_pncp: data.numero_controle_pncp }
          ]}
        });

        if (existing) {
          // Update se hash diferente
          if (existing.hash_verificacao !== data.hash_verificacao) {
            await prisma.simulatorLicitacao.update({
              where: { id: existing.id },
              data: { ...data, updated_at: new Date() }
            });
            updated++;
          }
        } else {
          // Insert
          await prisma.simulatorLicitacao.create({
            data: { ...data, created_at: new Date(), updated_at: new Date() }
          });
          synced++;
        }
      } catch (itemErr) {
        errors.push({ codigo: item.id, error: itemErr.message });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[simulator-licitacoes/sync] Sync concluído: ${synced} novas, ${updated} atualizadas, ${errors.length} erros em ${duration}ms`);

    return res.json({
      success: true,
      summary: {
        synced,
        updated,
        errors: errors.length,
        duration_ms: duration
      }
    });
  } catch (err) {
    console.error('❌ simulator-licitacoes/sync POST:', err);
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar', detail: err.message });
  }
});

/**
 * POST /api/simulator/licitacoes/single
 * Adiciona uma única licitação manualmente
 */
router.post('/single', requireRole(['MASTER', 'ADMIN']), async (req, res) => {
  try {
    const data = normalizeLicitacaoForDb(req.body, 'manual');
    data.fonte_dados = 'manual';

    const existing = await prisma.simulatorLicitacao.findFirst({
      where: { OR: [
        { codigo: data.codigo },
        { numero_controle_pncp: data.numero_controle_pncp }
      ]}
    });

    let result;
    if (existing) {
      result = await prisma.simulatorLicitacao.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date() }
      });
    } else {
      result = await prisma.simulatorLicitacao.create({
        data: { ...data, created_at: new Date(), updated_at: new Date() }
      });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ simulator-licitacoes/single POST:', err);
    return res.status(500).json({ success: false, error: 'Erro ao salvar licitação' });
  }
});

/**
 * DELETE /api/simulator/licitacoes/:id
 * Remove ou desativa uma licitação
 */
router.delete('/:id', requireRole(['MASTER', 'ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    if (hard === 'true') {
      await prisma.simulatorLicitacao.delete({ where: { id } });
    } else {
      await prisma.simulatorLicitacao.update({
        where: { id },
        data: { is_ativo: false, updated_at: new Date() }
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ simulator-licitacoes DELETE:', err);
    return res.status(500).json({ success: false, error: 'Erro ao remover licitação' });
  }
});

/**
 * GET /api/simulator/licitacoes/fallback
 * Endpoint para ser usado como fallback no b2g-licitacoes.cjs
 */
router.get('/fallback', async (req, res) => {
  try {
    const now = new Date();
    const nowMs = now.getTime();

    const rows = await prisma.simulatorLicitacao.findMany({
      where: {
        is_ativo: true,
        OR: [
          { data_encerramento: null },
          { data_encerramento_proposta: null },
          {
            AND: [
              { data_encerramento: { lte: now } },
              { data_encerramento_proposta: { not: null } }
            ]
          }
        ]
      },
      orderBy: { created_at: 'desc' }
    });

    // Filtrar vigentes no app layer (datas podem variar)
    const vigentes = rows.filter(item => {
      const dt = item.data_encerramento_proposta || item.data_encerramento;
      return !dt || new Date(dt).getTime() >= nowMs;
    });

    return res.json({
      success: true,
      source: 'simulator_db',
      data: vigentes,
      total: vigentes.length
    });
  } catch (err) {
    console.error('❌ simulator-licitacoes/fallback GET:', err);
    return res.status(500).json({ success: false, error: 'Erro no fallback' });
  }
});

module.exports = router;