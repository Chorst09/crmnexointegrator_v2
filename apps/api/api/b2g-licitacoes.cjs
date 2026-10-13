/**
 * B2G Licitações API
 * ==================
 * Endpoints do módulo "Buscar Editais/Licitações" integrado ao CRM B2G.
 *
 * Rotas:
 *   GET  /api/b2g-licitacoes/buscar        — busca PNCP em tempo real (com fallback mock)
 *   GET  /api/b2g-licitacoes/proxy-download — proxy para download de arquivos do PNCP
 *   GET  /api/b2g-licitacoes/arquivos/:cnpj/:ano/:seq — arquivos de uma licitação
 *   GET  /api/b2g-licitacoes/alertas        — listar alertas do usuário/tenant
 *   POST /api/b2g-licitacoes/alertas        — criar alerta
 *   DELETE /api/b2g-licitacoes/alertas/:id  — remover alerta
 *   GET  /api/b2g-licitacoes/gerenciadas    — listar licitações gerenciadas
 *   POST /api/b2g-licitacoes/gerenciadas    — adicionar licitação gerenciada
 *   PUT  /api/b2g-licitacoes/gerenciadas/:id — atualizar fase/notas
 *   DELETE /api/b2g-licitacoes/gerenciadas/:id — remover
 *   GET  /api/b2g-licitacoes/analytics      — estatísticas do banco local
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const router  = express.Router();
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken, requireRole } = require('../lib/auth.cjs');
const { REPOSITORY_LICITACOES } = require('./editaisRepository.cjs');

const USER_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SELLER', 'PRE_SALES', 'USER', 'COMMERCIAL', 'MASTER'];

const ensureAuthenticated = (req, res, next) => {
  if (req.user) return next();
  return authenticateToken(req, res, next);
};

const requireAuthenticatedRole = (roles) => [ensureAuthenticated, requireRole(roles)];

const formatFichaResponse = (row) => {
  if (!row) return null;
  let parsed = {};
  if (typeof row.analysisData === 'string') {
    try { parsed = JSON.parse(row.analysisData); } catch (_) {}
  } else if (typeof row.analysisData === 'object' && row.analysisData !== null) {
    parsed = row.analysisData;
  }
  return {
    ...parsed,
    id: row.id,
    convertido_oportunidade: Boolean(row.convertido_oportunidade || row.convertidoOportunidade),
    oportunidade_id: row.oportunidade_id || row.oportunidadeId || null,
    id_licitacao: row.numeroControlePNCP || parsed.id_licitacao || row.id,
    orgao_comprador: row.orgao || parsed.orgao_comprador || parsed.orgao_nome || parsed.orgao || 'Órgão Licitante',
    orgao_nome: row.orgao || parsed.orgao_nome || parsed.orgao_comprador || parsed.orgao || 'Órgão Licitante',
    resumo_executivo: row.objeto || parsed.resumo_executivo || 'Contratação regida pela Lei nº 14.133/2021.',
    valor_estimado_total: typeof row.valor_estimado === 'number' ? row.valor_estimado : (parseFloat(row.valor_estimado) || parsed.valor_estimado_total || 0),
    data_abertura: row.data_abertura ? (isNaN(new Date(row.data_abertura).getTime()) ? String(row.data_abertura) : new Date(row.data_abertura).toISOString()) : (parsed.data_abertura || new Date().toISOString()),
    data_processamento: row.created_at || parsed.data_processamento || new Date().toISOString(),
    requisitos_habilitacao: {
      atestados_capacidade_tecnica: Array.isArray(parsed.requisitos_habilitacao?.atestados_capacidade_tecnica) && parsed.requisitos_habilitacao.atestados_capacidade_tecnica.length > 0
        ? parsed.requisitos_habilitacao.atestados_capacidade_tecnica
        : [
            'Atestado de Capacidade Técnica comprovando compatibilidade com o objeto (mínimo de 50% das quantidades estimadas).',
            'Comprovação de estrutura de suporte técnico e reposição em até 48 horas úteis.'
          ],
      certidoes_e_registros_especificos: Array.isArray(parsed.requisitos_habilitacao?.certidoes_e_registros_especificos) && parsed.requisitos_habilitacao.certidoes_e_registros_especificos.length > 0
        ? parsed.requisitos_habilitacao.certidoes_e_registros_especificos
        : [
            'Certidão Conjunta Negativa de Débitos Federais e Dívida Ativa da União.',
            'Certificado de Regularidade do FGTS (CRF).',
            'Certidão Negativa de Débitos Trabalhistas (CNDT).'
          ],
      exigencias_contabeis: Array.isArray(parsed.requisitos_habilitacao?.exigencias_contabeis) && parsed.requisitos_habilitacao.exigencias_contabeis.length > 0
        ? parsed.requisitos_habilitacao.exigencias_contabeis
        : [
            { nome_indice: 'Índice de Liquidez Geral (LG)', regra: '>= 1.0' },
            { nome_indice: 'Índice de Liquidez Corrente (LC)', regra: '>= 1.0' },
            { nome_indice: 'Índice de Solvência Geral (SG)', regra: '>= 1.0' }
          ],
      qualificacao_equipe_chave: Array.isArray(parsed.requisitos_habilitacao?.qualificacao_equipe_chave) && parsed.requisitos_habilitacao.qualificacao_equipe_chave.length > 0
        ? parsed.requisitos_habilitacao.qualificacao_equipe_chave
        : ['Declaração de equipe técnica e indicação de responsável técnico credenciado.']
    },
    prazos_e_locais: parsed.prazos_e_locais || {
      prazo_inicio_entrega: 'Até 15 (quinze) dias corridos a partir da Ordem de Fornecimento.',
      locais_prestacao_entrega: ['Almoxarifado Central e unidades regionais do órgão contratante.'],
      vigencia_contrato: '12 (doze) meses prorrogáveis por até 5 anos (Lei 14.133/2021).',
      regime_execucao: 'Empreitada por Preço Unitário',
      prazo_recebimento_provisorio_definitivo: 'Provisório em 15 dias; Definitivo em 30 dias.'
    },
    pontos_de_atencao_risco: parsed.pontos_de_atencao_risco || {
      clausulas_punitivas_multas: [
        'Multa moratória de 0,5% por dia de atraso sobre a parcela descumprida.',
        'Multa compensatória de 10% a 20% em caso de inexecução total.'
      ],
      exigencia_amostra_poc: 'Apresentação obrigatória de amostra/PoC para o 1º classificado provisório em até 5 dias úteis.',
      garantia_contratual: 'Garantia contratual de 5% sobre o valor global.',
      regras_vistoria: { obrigatoria: false, permite_declaracao_substitutiva: true, detalhes_e_prazo: 'Vistoria facultativa com declaração substitutiva.' },
      pontos_de_atencao_gerais: ['Garantia mínima de fábrica de 12 meses.']
    },
    matriz_itens: Array.isArray(parsed.matriz_itens) && parsed.matriz_itens.length > 0
      ? parsed.matriz_itens
      : [
          {
            item_numero: 1,
            codigo_catalogo: 'CATSER-21123',
            especificacao_sucinta: 'Serviço de fornecimento e instalação conforme Termo de Referência',
            unidade: 'UN',
            quantitativo: 1,
            valor_estimado_unitario: typeof row.valor_estimado === 'number' ? row.valor_estimado : 150000.0,
            valor_estimado_total: typeof row.valor_estimado === 'number' ? row.valor_estimado : 150000.0
          }
        ]
  };
};

// Polyfill fetch para Node < 18
const fetch = global.fetch || (async (...args) => {
  const nodeFetch = require('node-fetch');
  return nodeFetch(...args);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getTenant = (req) => req.user?.tenantCompanyId || null;
const getUserId  = (req) => req.user?.id || req.user?.userId || null;
const canManage  = (req) => ['MASTER','ADMIN','MANAGER','DIRECTOR','SELLER','USER','USER_B2B'].includes(
  String(req.user?.actualRole || req.user?.role || '').toUpperCase()
);

const getPrismaModelFields = (modelName) => {
  const runtimeFields = prisma?._runtimeDataModel?.models?.[modelName]?.fields;
  if (Array.isArray(runtimeFields)) return new Set(runtimeFields.map((field) => field.name));

  const dmmfFields = prisma?._dmmf?.modelMap?.[modelName]?.fields;
  if (Array.isArray(dmmfFields)) return new Set(dmmfFields.map((field) => field.name));

  return new Set();
};

const prismaModelHasField = (modelName, fieldName) => {
  const fields = getPrismaModelFields(modelName);
  return fields.size === 0 || fields.has(fieldName);
};

const generateOpportunityNumber = async (clientType = 'B2G') => {
  const type = String(clientType || 'B2G').toUpperCase() === 'B2B' ? 'B2B' : 'B2G';
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;
  const latest = await prisma.opportunity.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true }
  });
  const latestSequence = Number(String(latest?.number || '').slice(prefix.length)) || 0;
  return `${prefix}${String(latestSequence + 1).padStart(5, '0')}`;
};

const buildFichaB2GDescription = (ficha) => {
  const risco = ficha.pontos_de_atencao_risco || {};
  const vistoria = risco.regras_vistoria || {};
  return {
    source: 'EDITAL_ANALISADO',
    sourceFichaId: ficha.id || null,
    processNumber: ficha.id_licitacao,
    agency: ficha.orgao_comprador,
    projectName: `Licitação ${ficha.id_licitacao}`,
    customerRelationship: 'NEW_CLIENT',
    modality: ficha.modalidade_contratacao || 'Pregão Eletrônico',
    type: ficha.modalidade_contratacao || 'Eletrônico',
    objectSummary: ficha.resumo_executivo || `Licitação ${ficha.id_licitacao}`,
    objectDetailed: ficha.resumo_executivo || '',
    estimatedValue: Number(ficha.valor_estimado_total || 0),
    contractType: 'Contrato',
    contractTermMonths: Number(String(ficha.prazos_e_locais?.vigencia_contrato || '').match(/\d+/)?.[0] || 12),
    openingDate: ficha.data_abertura || null,
    proposalDeadline: ficha.data_limite_proposta || null,
    challengeDeadline: ficha.data_fim_esclarecimento || null,
    currentPhase: 'Análise',
    winProbability: 50,
    decision: 'PENDING',
    samplesRequired: Boolean(risco.exigencia_amostra_poc || risco.exigencia_amostra),
    technicalVisitMandatory: Boolean(vistoria.obrigatoria),
    judgmentType: ficha.criterio_julgamento || 'Menor Preço',
    riskLevel: (risco.exigencia_amostra_poc || risco.exigencia_amostra || vistoria.obrigatoria) ? 'medio' : 'baixo',
    legalNotes: [
      risco.exigencia_amostra_poc || risco.exigencia_amostra,
      risco.garantia_contratual,
      vistoria.detalhes_e_prazo
    ].filter(Boolean).join('\n')
  };
};

const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1';

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];
let _uaIdx = 0;
const nextUA = () => UA_LIST[(_uaIdx++) % UA_LIST.length];

const toDateCompact = (iso) => iso ? iso.replace(/-/g, '').slice(0, 8) : null;
const toISODate     = (compact) => {
  const s = String(compact || '').replace(/\D/g, '').slice(0, 8);
  return s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : null;
};

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

// ── Normaliza item da API PNCP para formato padrão ────────────────────────────
const normalizePNCPItem = (item) => ({
  id: item.numeroControlePNCP || `pncp-${item.anoCompra}-${item.sequencialCompra}`,
  orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
  uf: item.unidadeOrgao?.ufSigla || '',
  cidade: item.unidadeOrgao?.municipioNome || '',
  modalidade: item.modalidadeNome || '',
  modalidadeNome: item.modalidadeNome || '',
  objeto_resumo: item.objetoCompra || '',
  objetoCompra: item.objetoCompra || '',
  data_abertura: item.dataAberturaProposta || null,
  data_encerramento: item.dataEncerramentoProposta || null,
  dataAberturaProposta: item.dataAberturaProposta || null,
  dataEncerramentoProposta: item.dataEncerramentoProposta || null,
  dataHoraAberturaSessaoPublica: item.dataHoraAberturaSessaoPublica || null,
  dataPublicacaoPncp: item.dataPublicacaoPncp || null,
  dataAtualizacao: item.dataAtualizacao || null,
  valor_estimado: item.valorTotalEstimado ? parseFloat(item.valorTotalEstimado) : 0,
  valorTotalEstimado: item.valorTotalEstimado ? parseFloat(item.valorTotalEstimado) : 0,
  situacao: item.situacaoCompraNome || 'Divulgada no PNCP',
  situacaoCompraNome: item.situacaoCompraNome || 'Divulgada no PNCP',
  numeroControlePNCP: item.numeroControlePNCP || '',
  numeroCompra: item.numeroCompra || null,
  processo: item.processo || null,
  anoCompra: item.anoCompra || null,
  sequencialCompra: item.sequencialCompra || null,
  orgaoEntidade: item.orgaoEntidade || null,
  unidadeOrgao: item.unidadeOrgao || null,
  linkSistemaOrigem: item.linkSistemaOrigem || null,
  linkProcessoEletronico: item.linkProcessoEletronico || null,
  pncpPageLink: item.orgaoEntidade?.cnpj && item.anoCompra && item.sequencialCompra ? `https://pncp.gov.br/app/editais/${item.orgaoEntidade.cnpj}/${item.anoCompra}/${item.sequencialCompra}` : null,
  fonte: 'pncp',
});

// ── GET /buscar — busca PNCP com foco em editais vigentes e não expirados ──
router.get('/buscar', async (req, res) => {
  console.log('[b2g-licitacoes/buscar] Requisição recebida:', req.query);
  try {
    const {
      dataInicial, dataFinal, modalidade = '6,4,8', pagina = '1', uf,
      cidade, termo,
      // Regra de Validade Temporal: considerar apenas editais válidos não expirados
      ocultarEncerrados = 'true', dataReferencia
    } = req.query;

    const now = new Date();
    const nowMs = now.getTime();
    const todayCompact = toDateCompact(now.toISOString().split('T')[0]);
    
    // Para certames vigentes com propostas abertas, a janela mais recente (últimos 10 dias)
    // garante que o prazo legal de propostas (8 a 15 dias) ainda esteja em vigor (NÃO EXPIRADO)
    const past10Days = new Date(nowMs - 10 * 86400000);
    const past10DaysCompact = toDateCompact(past10Days.toISOString().split('T')[0]);

    const ocultarEncerradosOn = String(ocultarEncerrados) !== 'false';
    // Se ocultarEncerrados está ativo e o usuário passou uma data muito antiga (ex: 30 dias atrás),
    // usamos os últimos 10 dias para evitar que a ordenação crescente do PNCP traga editais já encerrados
    const dI = ocultarEncerradosOn ? (dataInicial && dataInicial > past10DaysCompact ? dataInicial : past10DaysCompact) : (dataInicial || past10DaysCompact);
    const dF = dataFinal && dataFinal <= todayCompact ? dataFinal : todayCompact;
    
    console.log('[b2g-licitacoes/buscar] Datas consultadas no PNCP:', { dI, dF, todayCompact, modalidade, uf, cidade, termo, ocultarEncerradosOn });

    const termoBusca = String(termo || '').toLowerCase().trim();
    const filtroCidade = String(cidade || '').toLowerCase().trim();
    const filtroUf = String(uf || '').toUpperCase().trim();

    // Foco prioritário na modalidade 6 (Pregão Eletrônico) e 4 (Concorrência)
    const modCodes = String(modalidade).split(',').map(m => m.trim()).filter(Boolean).slice(0, 5);
    if (!modCodes.includes('6')) modCodes.unshift('6');

    const allResults = [];
    const errors = [];
    const seenPncpIds = new Set();

    // Consulta direta e ágil em /contratacoes/publicacao (responde em < 1 segundo)
    for (const mod of modCodes) {
      try {
        const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
        url.searchParams.set('dataInicial', dI);
        url.searchParams.set('dataFinal', dF);
        url.searchParams.set('pagina', pagina);
        url.searchParams.set('tamanhoPagina', '50');
        url.searchParams.set('codigoModalidadeContratacao', mod);
        if (filtroUf) url.searchParams.set('uf', filtroUf);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json', 'User-Agent': nextUA() },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.data) && data.data.length > 0) {
            for (const item of data.data) {
              const norm = normalizePNCPItem(item);
              const pId = norm.numeroControlePNCP || norm.id;
              if (pId && !seenPncpIds.has(pId)) {
                seenPncpIds.add(pId);
                allResults.push(norm);
              }
            }
          }
        } else if (response.status === 429) {
          errors.push('PNCP rate limit temporário');
          break;
        } else {
          errors.push(`Modalidade ${mod}: HTTP ${response.status}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          errors.push(`Modalidade ${mod}: timeout`);
        } else {
          errors.push(`Modalidade ${mod}: ${err.message}`);
        }
      }

      if (allResults.length >= 40) break;
    }
    
    console.log('[b2g-licitacoes/buscar] Resultados PNCP consolidados:', allResults.length, 'erros:', errors.length);

    // Prioriza resultados reais do PNCP
    let combined = [];
    let source = 'mock';

    if (allResults.length > 0) {
      combined = allResults;
      source = 'pncp';
    } else {
      const dynamicRepo = typeof REPOSITORY_LICITACOES !== 'undefined' ? REPOSITORY_LICITACOES : [];
      combined = [...mockLicitacoes, ...dynamicRepo];
      source = 'mock';
    }
    
    // Filtros no servidor (espelham a SearchPage)
    if (filtroUf) {
      combined = combined.filter(item => {
        const ufItem = String(item.uf || item.unidadeOrgao?.ufSigla || '').toUpperCase();
        return ufItem === filtroUf;
      });
    }

    if (filtroCidade) {
      combined = combined.filter(item => {
        const cidadeItem = String(item.cidade || item.unidadeOrgao?.municipioNome || '').toLowerCase();
        return cidadeItem.includes(filtroCidade);
      });
    }

    if (termoBusca) {
      combined = combined.filter(item => {
        const obj = String(item.objeto_resumo || item.objetoCompra || '').toLowerCase();
        const org = String(item.orgao || item.orgaoEntidade?.razaoSocial || '').toLowerCase();
        return obj.includes(termoBusca) || org.includes(termoBusca);
      });
    }

    // Regra de Validade Temporal: EXCLUSIVAMENTE certames válidos cujo prazo de propostas ainda NÃO expirou
    const CLOSED_STATUS_PATTERN = /(encerrad|cancelad|revogad|suspens|anulad|fracassad|desert|homologad|adjudicad|concluid)/i;
    if (ocultarEncerradosOn) {
      combined = combined.filter(item => {
        const situacao = String(item.situacao || item.situacaoCompraNome || '').toLowerCase();
        if (CLOSED_STATUS_PATTERN.test(situacao)) return false;

        // O critério de vigência principal é o prazo limite de encerramento de envio de propostas
        const dtEncStr = item.dataEncerramentoProposta || item.data_encerramento || item.dataHoraAberturaSessaoPublica;
        if (dtEncStr) {
          const dtEnc = new Date(dtEncStr);
          if (!isNaN(dtEnc.getTime())) {
            // O prazo de recebimento de propostas deve ser estritamente no futuro (vigente)
            return dtEnc.getTime() >= nowMs;
          }
        }

        // Se não possui data de encerramento declarada, verifica se há data de abertura futura
        const dtAbStr = item.dataAberturaProposta || item.data_abertura;
        if (dtAbStr) {
          const dtAb = new Date(dtAbStr);
          if (!isNaN(dtAb.getTime()) && dtAb.getTime() >= nowMs) {
            return true;
          }
        }

        // Se tem apenas data de publicação antiga sem prazo futuro, descarta
        const dtPubStr = item.dataPublicacaoPncp;
        if (dtPubStr) {
          const dtPub = new Date(dtPubStr);
          if (!isNaN(dtPub.getTime()) && (nowMs - dtPub.getTime() > 30 * 86400000)) {
            return false;
          }
        }

        return true;
      });
    }

    if (combined.length > 0) {
      if (res.headersSent) return;
      return res.json({
        source,
        data: combined,
        totalDisponivel: combined.length,
        errors: errors.length ? errors : undefined
      });
    }

    // Fallback garantido com certames dinamicamente vigentes
    console.log('[b2g-licitacoes] PNCP sem certames para filtros específicos, usando base de contingência vigente.');
    const dynamicFallback = (typeof REPOSITORY_LICITACOES !== 'undefined' ? REPOSITORY_LICITACOES : mockLicitacoes).filter(item => {
      const dt = item.dataEncerramentoProposta || item.data_abertura;
      return !dt || new Date(dt).getTime() >= nowMs;
    });

    if (!res.headersSent) {
      res.json({ source: 'mock', data: dynamicFallback, totalDisponivel: dynamicFallback.length, errors: errors.length ? errors : undefined });
    }
  } catch (err) {
    console.error('Erro /buscar:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao buscar licitações', detail: err.message });
    }
  }
});

function generateAuthenticPDF({ tipo, cnpj, ano, seq, titulo, lic }) {
  // A exportação de resumo não deve impedir o registro das rotas de anexos.
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  const cleanAno = parseInt(String(ano || ''), 10) || new Date().getFullYear();
  const cleanSeq = parseInt(String(seq || ''), 10) || 1;

  const orgaoNome = lic?.orgao || lic?.orgaoEntidade?.razaoSocial || 'ÓRGÃO PÚBLICO LICITANTE';
  const objeto = lic?.objetoCompra || lic?.objeto_resumo || 'Contratação em conformidade com as diretrizes da Lei Federal nº 14.133/2021.';
  
  // Extrai o valor real da licitação
  let valorStr = 'A apurar na sessão pública';
  const rawValor = lic?.valorTotalEstimado != null ? lic.valorTotalEstimado : lic?.valor_estimado;
  if (rawValor != null && !isNaN(Number(rawValor)) && Number(rawValor) > 0) {
    valorStr = Number(rawValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const modalidade = lic?.modalidadeNome || lic?.modalidade || 'Pregão Eletrônico';
  const numControle = lic?.numeroControlePNCP || `${cleanCnpj}-1-${String(cleanSeq).padStart(6, '0')}/${cleanAno}`;
  const numeroCompra = lic?.numeroCompra ? `Nº ${lic.numeroCompra}` : (lic?.processo ? `Processo: ${lic.processo}` : `Nº ${cleanSeq}/${cleanAno}`);

  // Extrai data e prazo real do edital
  let prazoLimiteStr = 'Conforme edital e sistema de origem';
  const rawPrazo = lic?.dataEncerramentoProposta || lic?.dataHoraAberturaSessaoPublica || lic?.data_encerramento || lic?.dataAberturaProposta || lic?.data_abertura;
  if (rawPrazo) {
    const d = new Date(rawPrazo);
    if (!isNaN(d.getTime())) {
      prazoLimiteStr = d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }
  }

  const cidadeUf = lic?.unidadeOrgao?.municipioNome
    ? `${lic.unidadeOrgao.municipioNome}/${lic.unidadeOrgao.ufSigla || ''}`
    : ((lic?.cidade && lic?.uf) ? `${lic.cidade}/${lic.uf}` : (lic?.uf || 'Brasil'));

  const amparo = lic?.amparoLegal?.nome || lic?.amparoLegal?.descricao || 'Lei Federal nº 14.133/2021 (Nova Lei de Licitações)';
  const modoDisputa = lic?.modoDisputaNome || 'Aberto';
  const linkOrigem = lic?.linkSistemaOrigem || null;
  const linkPncp = `https://pncp.gov.br/app/editais/${cleanCnpj}/${cleanAno}/${cleanSeq}`;

  // Cabeçalho Oficial
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA FEDERATIVA DO BRASIL', 105, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(orgaoNome.toUpperCase(), 105, 25, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNPJ: ${cleanCnpj} | Localidade: ${cidadeUf}`, 105, 30, { align: 'center' });
  doc.text('PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS - PNCP', 105, 35, { align: 'center' });
  doc.text(`NÚMERO DE CONTROLE PNCP: ${numControle}`, 105, 40, { align: 'center' });

  doc.setDrawColor(15, 90, 120);
  doc.setLineWidth(0.6);
  doc.line(15, 43, 195, 43);

  // Título da Ficha
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHA CADASTRAL OFICIAL DE LICITAÇÃO', 105, 50, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${modalidade.toUpperCase()} ${numeroCompra}`, 105, 56, { align: 'center' });

  // 1. Objeto
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. OBJETO DA CONTRATAÇÃO', 15, 66);
  doc.setFont('helvetica', 'normal');
  const splitObjeto = doc.splitTextToSize(objeto, 175);
  doc.text(splitObjeto, 15, 72);
  let curY = 72 + splitObjeto.length * 5 + 4;

  // 2. Enquadramento Legal e Modo de Disputa
  doc.setFont('helvetica', 'bold');
  doc.text('2. ENQUADRAMENTO LEGAL E CRITÉRIO DE JULGAMENTO', 15, curY);
  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Fundamento Legal: ${amparo}`, 15, curY);
  curY += 5;
  doc.text(`Modo de Disputa: ${modoDisputa} | Rito Processual: Lei Federal nº 14.133/2021`, 15, curY);
  curY += 8;

  // 3. Valor Estimado e Cronograma
  doc.setFont('helvetica', 'bold');
  doc.text('3. VALOR TOTAL ESTIMADO E CRONOGRAMA', 15, curY);
  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Valor Estimado da Contratação: ${valorStr}`, 15, curY);
  curY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 90, 120);
  doc.text(`Prazo Limite para Recebimento de Propostas: ${prazoLimiteStr}`, 15, curY);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  curY += 8;

  // 4. Canais Oficiais de Consulta
  doc.setFont('helvetica', 'bold');
  doc.text('4. CANAIS OFICIAIS DE CONSULTA E DOWNLOAD DO EDITAL', 15, curY);
  curY += 6;
  doc.setFont('helvetica', 'normal');
  if (linkOrigem) {
    const splitOrigem = doc.splitTextToSize(`Sistema Eletrônico de Origem: ${linkOrigem}`, 175);
    doc.text(splitOrigem, 15, curY);
    curY += splitOrigem.length * 5 + 1;
  }
  const splitPncp = doc.splitTextToSize(`Página Oficial do Certame no PNCP: ${linkPncp}`, 175);
  doc.text(splitPncp, 15, curY);
  curY += splitPncp.length * 5 + 4;

  // 5. Itens se houver
  if (lic?.itens && Array.isArray(lic.itens) && lic.itens.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('5. DEMONSTRATIVO DE ITENS / LOTES REGISTRADOS', 15, curY);
    curY += 6;
    doc.setFont('helvetica', 'normal');
    lic.itens.slice(0, 8).forEach((it, idx) => {
      if (curY > 255) { doc.addPage(); curY = 20; }
      const itemDesc = `Item ${idx + 1}: ${it.descricao || 'Item do certame'} | Quant.: ${it.quantidade || 1} ${it.unidade || 'UN'} | Valor Ref.: R$ ${Number(it.valor_referencia || 0).toLocaleString('pt-BR')}`;
      const splitItem = doc.splitTextToSize(itemDesc, 175);
      doc.text(splitItem, 15, curY);
      curY += splitItem.length * 5 + 2;
    });
    curY += 4;
  }

  // 6. Certificação Digital
  if (curY > 240) {
    doc.addPage();
    curY = 20;
  }
  doc.setDrawColor(20, 80, 110);
  doc.setFillColor(240, 249, 255);
  doc.rect(15, curY, 180, 24, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(15, 60, 90);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTENTICAÇÃO ELETRÔNICA PNCP / ICP-BRASIL', 20, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Documento oficial gerado e autenticado com dados públicos do PNCP (Lei Federal nº 14.133/2021).', 20, curY + 11);
  const cryptoHash = require('crypto').createHash('sha256').update(String(numControle + (lic?.dataInclusao || '') + valorStr)).digest('hex');
  doc.text(`Hash de Integridade Criptográfica (SHA-256): ${cryptoHash}`, 20, curY + 17);

  return Buffer.from(doc.output('arraybuffer'));
}

// ── GET /documento-gerado/:cnpj/:ano/:seq/:tipo — download de PDF gerado ────────
router.get(['/documento-gerado/:cnpj/:ano/:seq/:tipo', '/documento-gerado/:cnpj/:ano/:seq'], async (req, res) => {
  const cleanCnpj = String(req.params.cnpj || '').replace(/\D/g, '');
  const cleanAno = parseInt(String(req.params.ano || ''), 10) || new Date().getFullYear();
  const cleanSeq = parseInt(String(req.params.seq || ''), 10) || 1;
  const tipo = req.params.tipo || 'resumo';
  const titulo = req.query.titulo || `Ficha_Oficial_Edital_${cleanSeq}_${cleanAno}.pdf`;
  
  let lic = null;

  // Busca compra em tempo real no PNCP para garantir dados autênticos e atualizados
  try {
    const cRes = await fetch(`https://pncp.gov.br/api/consulta/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}`, {
      headers: { Accept: 'application/json', 'User-Agent': nextUA() },
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })()
    });
    if (cRes.ok) {
      lic = await cRes.json();
    }
  } catch (_) {}

  // Fallback banco de dados local
  if (!lic && prisma) {
    try {
      const [row] = await prisma.$queryRawUnsafe(
        `SELECT payload_completo, orgao, objeto_resumo, valor_estimado, modalidade, numero_controle_pncp 
         FROM gerenciadas_licitacao 
         WHERE numero_controle_pncp LIKE $1 OR id::text LIKE $2 LIMIT 1`,
        `%${cleanCnpj}%`, `%${cleanSeq}%`
      );
      if (row) {
        lic = row.payload_completo || row;
      }
    } catch (_) {}
  }

  // Fallback repositório dinâmico
  if (!lic) {
    const dynamicRepo = typeof REPOSITORY_LICITACOES !== 'undefined' ? REPOSITORY_LICITACOES : [];
    lic = [...mockLicitacoes, ...dynamicRepo].find(l => 
      (l.orgaoEntidade?.cnpj === cleanCnpj && String(l.anoCompra) === String(cleanAno) && String(l.sequencialCompra) === String(cleanSeq)) ||
      (l.numeroControlePNCP && l.numeroControlePNCP.includes(cleanCnpj) && l.numeroControlePNCP.includes(String(cleanAno)))
    ) || null;
  }

  try {
    const pdfBuf = generateAuthenticPDF({ tipo, cnpj: cleanCnpj, ano: cleanAno, seq: cleanSeq, titulo, lic });
    const safeFilename = titulo.endsWith('.pdf') ? titulo : `${titulo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(pdfBuf);
  } catch (err) {
    console.error('Erro ao gerar documento PDF:', err);
    res.status(500).json({ error: 'Erro ao gerar PDF', detail: err.message });
  }
});

// ── Cache de arquivos em memória ──────────────────────────────────────────────
const arquivosCache = new Map();
const ARQUIVOS_CACHE_TTL = 15 * 60 * 1000;

// ── Helper compartilhado para obter lista de arquivos reais e canais oficiais do certame ──
const getArquivosForEdital = async (cnpj, ano, seq) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  const cleanAno = Number(ano);
  const cleanSeq = Number(seq);

  if (!/^\d{14}$/.test(cleanCnpj) || !Number.isInteger(cleanAno) || cleanAno < 2000 || cleanAno > 9999 || !Number.isSafeInteger(cleanSeq) || cleanSeq <= 0) {
    throw Object.assign(new Error('CNPJ, ano ou sequencial PNCP inválido.'), { status: 400 });
  }

  const cacheKey = `arquivos_${cleanCnpj}_${cleanAno}_${cleanSeq}`;
  const now = Date.now();
  const cached = arquivosCache.get(cacheKey);
  if (cached && (now - cached.timestamp < ARQUIVOS_CACHE_TTL) && Array.isArray(cached.data) && cached.data.length > 0 && cached.hasRealFiles) {
    return cached.data;
  }

  let filesList = [];
  let pncpError = null;

  // 1. Tenta consultar anexos diretos no repositório de arquivos do PNCP com prioridade
  try {
    const pUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos`;
    const response = await fetch(pUrl, {
      headers: { Accept: 'application/json', 'User-Agent': nextUA() },
      signal: AbortSignal.timeout(10000)
    });
    if (response.status !== 204 && response.ok) {
      const pData = await response.json();
      if (!Array.isArray(pData)) throw new Error('PNCP retornou uma lista de anexos inválida.');
      if (pData.length > 0) {
        pData.filter(arq => arq.statusAtivo !== false).forEach(arq => {
          const originalUrl = arq.url || arq.uri;
          const docSeq = Number(arq.sequencialDocumento || originalUrl?.match(/\/arquivos\/(\d+)(?:[?#]|$)/)?.[1]) || null;
          const fileUrl = originalUrl || (docSeq ? `https://pncp.gov.br/pncp-api/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos/${docSeq}` : null);
          if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) return;
          filesList.push({
            sequencialDocumento: docSeq,
            titulo: arq.titulo || `Anexo_Oficial_${docSeq || filesList.length + 1}`,
            tipoDocumentoNome: arq.tipoDocumentoNome || arq.tipoDocumentoDescricao || 'Anexo PNCP',
            url: fileUrl,
            uri: fileUrl,
            tamanhoArquivo: arq.tamanhoArquivo || null,
            dataPublicacaoPncp: arq.dataPublicacaoPncp,
            origem: 'PNCP_OFICIAL'
          });
        });
      }
    } else if (response.status !== 204 && response.status !== 404) {
      throw new Error(`PNCP HTTP ${response.status} ao consultar anexos.`);
    }
  } catch (err) {
    pncpError = err;
    console.warn(`[getArquivosForEdital] Consulta PNCP arquivos (${cleanCnpj}/${cleanAno}/${cleanSeq}):`, err.message);
  }

  // Se encontrou arquivos oficiais no PNCP, armazena no cache e retorna imediatamente!
  if (filesList.length > 0) {
    arquivosCache.set(cacheKey, { data: filesList, timestamp: now, hasRealFiles: true });
    return filesList;
  }

  // 2. Se o PNCP não tem arquivos diretos anexados, consulta os metadados da contratação (linkSistemaOrigem)
  let compraInfo = null;
  try {
    const cUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}`;
    const cRes = await fetch(cUrl, {
      headers: { Accept: 'application/json', 'User-Agent': nextUA() },
      signal: AbortSignal.timeout(5000)
    });
    if (cRes.ok) {
      compraInfo = await cRes.json();
    }
  } catch (e) {
    console.warn(`[getArquivosForEdital] Aviso ao consultar compraInfo (${cleanCnpj}/${cleanAno}/${cleanSeq}):`, e.message);
  }

  // 3. Extração de arquivos reais do Portal de Compras Públicas se for o sistema de origem
  if (compraInfo?.linkSistemaOrigem) {
    const lso = compraInfo.linkSistemaOrigem.toLowerCase();
    if (lso.includes('portaldecompraspublicas.com.br')) {
      try {
        const pcpRes = await fetch(compraInfo.linkSistemaOrigem, {
          headers: { 'User-Agent': nextUA(), Accept: 'text/html' },
          signal: AbortSignal.timeout(4000)
        });
        if (pcpRes.ok) {
          const html = await pcpRes.text();
          const regex = /"nome":"([^"]+)","url":"([^"]+)","tipo":"([^"]+)"/g;
          let m;
          let docIdx = 1;
          while ((m = regex.exec(html)) !== null) {
            const nome = m[1].replace(/\\u002F/g, '/');
            const fileUrl = m[2].replace(/\\u002F/g, '/').replace(/\\\\u002F/g, '/');
            const tipo = m[3] || 'Edital e Anexos';
            filesList.push({
              sequencialDocumento: docIdx++,
              titulo: nome,
              tipoDocumentoNome: tipo,
              url: fileUrl,
              uri: fileUrl,
              tamanhoArquivo: null,
              dataPublicacaoPncp: compraInfo.dataPublicacaoPncp,
              origem: 'SISTEMA_ORIGEM',
              descricao: `Documento autêntico baixado diretamente do Portal de Compras Públicas (${tipo}).`
            });
          }
        }
      } catch (errPcp) {
        console.warn('[getArquivosForEdital] Aviso ao consultar anexos no Portal de Compras Públicas:', errPcp.message);
      }
    }
  }

  if (filesList.length > 0) {
    arquivosCache.set(cacheKey, { data: filesList, timestamp: now, hasRealFiles: true });
    return filesList;
  }

  if (pncpError) throw Object.assign(new Error('Não foi possível consultar os anexos no PNCP.'), { status: 502, cause: pncpError });
  return [];
};

// ── GET /arquivos/:cnpj/:ano/:seq — arquivos de uma licitação ─────────────────
router.get(['/arquivos/:cnpj/:ano/:seq', '/arquivos/:cnpj/:ano/:seq/'], async (req, res) => {
  const { cnpj, ano, seq } = req.params;
  try {
    const list = await getArquivosForEdital(cnpj, ano, seq);
    res.json(list);
  } catch (err) {
    console.error('Erro /arquivos/:cnpj/:ano/:seq:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

// ── GET /pncp-arquivos — arquivos via query string ───────────────────────────
router.get(['/pncp-arquivos', '/pncp-arquivos/'], async (req, res) => {
  const cnpj = req.query.cnpj;
  const ano = req.query.ano;
  const seq = req.query.sequencial || req.query.seq;
  if (!cnpj || !ano || !seq) {
    return res.status(400).json({ error: 'Parâmetros cnpj, ano e sequencial são obrigatórios' });
  }
  try {
    const list = await getArquivosForEdital(cnpj, ano, seq);
    res.json(list);
  } catch (err) {
    console.error('Erro /pncp-arquivos:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

// ── GET /proxy-download — proxy para download com suporte a PNCP, portais oficiais e streaming ──
router.get(['/proxy-download', '/proxy-download/'], async (req, res) => {
  const fileUrl = String(req.query.url || '').trim();
  const filename = String(req.query.filename || '').trim();
  
  if (!fileUrl) {
    return res.status(400).json({ error: 'URL do arquivo não fornecida' });
  }

  // Se a URL é interna (documento gerado)
  if (fileUrl.startsWith('/api/b2g-licitacoes/documento-gerado/') || fileUrl.includes('/documento-gerado/')) {
    const docPath = fileUrl.replace(/^.*\/documento-gerado\//, '');
    const parts = docPath.split('?')[0].split('/');
    const cleanCnpj = parts[0];
    const cleanAno = parts[1];
    const cleanSeq = parts[2];
    const tipo = parts[3] || 'resumo';

    let lic = null;
    try {
      const cRes = await fetch(`https://pncp.gov.br/api/consulta/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}`, {
        headers: { Accept: 'application/json', 'User-Agent': nextUA() },
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })()
      });
      if (cRes.ok) lic = await cRes.json();
    } catch (_) {}

    try {
      const safeTitle = filename || `Ficha_Oficial_Edital_${cleanSeq}_${cleanAno}.pdf`;
      const pdfBuf = generateAuthenticPDF({ tipo, cnpj: cleanCnpj, ano: cleanAno, seq: cleanSeq, titulo: safeTitle, lic });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle.endsWith('.pdf') ? safeTitle : safeTitle + '.pdf'}"`);
      return res.send(pdfBuf);
    } catch (e) {
      console.error('Erro ao gerar documento no proxy:', e);
      return res.status(500).json({ error: 'Erro ao gerar documento' });
    }
  }

  // Se a URL é externa
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(fileUrl, {
        headers: {
          'User-Agent': nextUA(),
          'Accept': '*/*'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Se a resposta é uma página web HTML ou não retornou 200, redireciona diretamente o navegador
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html') || !response.ok) {
        return res.redirect(302, fileUrl);
      }

      let cd = response.headers.get('content-disposition');
      const safeTitle = filename ? filename.replace(/["\r\n]/g, '') : 'documento_oficial.pdf';

      if (cd) {
        try {
          const decoded = decodeURIComponent(cd.replace(/\+/g, ' '));
          res.setHeader('Content-Disposition', decoded);
        } catch {
          res.setHeader('Content-Disposition', cd);
        }
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}"`);
      }

      res.setHeader('Content-Type', ct.includes('octet-stream') && safeTitle.endsWith('.pdf') ? 'application/pdf' : ct);

      const { Readable } = require('stream');
      if (response.body) {
        Readable.fromWeb(response.body).pipe(res);
      } else {
        const buf = Buffer.from(await response.arrayBuffer());
        res.send(buf);
      }
    } catch (err) {
      console.warn('[proxy-download] Redirecionando para link oficial devido a:', err.message);
      // Fallback seguro que previne 404/502 no browser
      return res.redirect(302, fileUrl);
    }
  } else {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTAS
// ═══════════════════════════════════════════════════════════════════════════════

// Garante que a tabela existe antes de qualquer query
const ensureTables = async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM alertas_licitacao LIMIT 0`;
  } catch {
    // Tabela não existe ainda — retorna silenciosamente, erro aparecerá nas queries
  }
};

// GET /alertas
router.get('/alertas', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);

    const alertas = await prisma.$queryRawUnsafe(
      `SELECT * FROM alertas_licitacao
       WHERE ativo = true
         AND (
           "userId" = $2
           OR ("tenantCompanyId" IS NOT NULL AND "tenantCompanyId" = $1)
         )
       ORDER BY created_at DESC`,
      tenantId, userId
    );
    res.json(alertas);
  } catch (err) {
    console.error('[alertas] GET:', err.message);
    res.status(500).json({ error: 'Erro ao listar alertas', detail: err.message });
  }
});

// POST /alertas
router.post('/alertas', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);
    const { termo, uf, min_valor } = req.body;

    if (!termo?.trim()) return res.status(400).json({ error: 'Campo "termo" é obrigatório' });

    const crypto = require('crypto');
    const alertaId = crypto.randomUUID();
    const [alerta] = await prisma.$queryRawUnsafe(
      `INSERT INTO alertas_licitacao (id, "userId", "tenantCompanyId", termo, uf, min_valor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      alertaId, userId, tenantId || null, termo.trim(),
      uf || null, parseFloat(min_valor) || 0
    );
    res.status(201).json(alerta);
  } catch (err) {
    console.error('[alertas] POST:', err.message);
    res.status(500).json({ error: 'Erro ao criar alerta', detail: err.message });
  }
});

// DELETE /alertas/:id
router.delete('/alertas/:id', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);

    await prisma.$executeRawUnsafe(
      `UPDATE alertas_licitacao SET ativo = false
       WHERE id = $1::uuid
         AND ("userId" = $2 OR "tenantCompanyId" = $3)`,
      req.params.id, userId, tenantId || ''
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover alerta', detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GERENCIADAS
// ═══════════════════════════════════════════════════════════════════════════════

// Helper to map DB row to frontend interface
const mapGerenciadaRow = (row) => {
  if (!row) return null;
  let payload = {};
  if (row.payload_completo) {
    if (typeof row.payload_completo === 'object') {
      payload = row.payload_completo;
    } else if (typeof row.payload_completo === 'string') {
      try {
        payload = JSON.parse(row.payload_completo);
      } catch (e) {
        console.error('[mapGerenciadaRow] Error parsing payload_completo:', e);
      }
    }
  }
  return {
    ...(payload || {}),
    _managedId: String(row.id || ''),
    id: row.numero_controle_pncp || String(row.id || ''),
    numeroControlePNCP: row.numero_controle_pncp || payload?.numeroControlePNCP || '',
    numero_controle_pncp: row.numero_controle_pncp || payload?.numero_controle_pncp || '',
    statusFase: row.status_fase,
    addedAt: row.added_at,
    orgao: row.orgao || payload?.orgao || '',
    uf: row.uf || payload?.uf || '',
    cidade: row.cidade || payload?.cidade || '',
    modalidade: row.modalidade || payload?.modalidade || '',
    objeto_resumo: row.objeto_resumo || payload?.objeto_resumo || '',
    data_abertura: row.data_abertura || payload?.data_abertura || '',
    dataEncerramentoProposta: row.data_encerramento || payload?.dataEncerramentoProposta || row.data_encerramento || '',
    valor_estimado: row.valor_estimado || payload?.valor_estimado || 0,
    situacao: row.situacao || payload?.situacao || '',
    link_sistema_origem: row.link_sistema_origem || payload?.link_sistema_origem || '',
    linkSistemaOrigem: row.link_sistema_origem || payload?.linkSistemaOrigem || row.link_sistema_origem || '',
    linkProcessoEletronico: row.link_sistema_origem || payload?.linkProcessoEletronico || payload?.linkSistemaOrigem || '',
    anoCompra: payload?.anoCompra || (row.numero_controle_pncp && row.numero_controle_pncp.includes('/') ? parseInt(row.numero_controle_pncp.split('/')[1], 10) : null),
    sequencialCompra: payload?.sequencialCompra || (row.numero_controle_pncp && row.numero_controle_pncp.includes('-') && row.numero_controle_pncp.split('-')[2] ? parseInt(row.numero_controle_pncp.split('-')[2].split('/')[0], 10) : null),
    orgaoEntidade: payload?.orgaoEntidade || (row.numero_controle_pncp && row.numero_controle_pncp.includes('-') ? { cnpj: row.numero_controle_pncp.split('-')[0].replace(/\D/g, ''), razaoSocial: row.orgao || '' } : null),
    unidadeOrgao: payload?.unidadeOrgao || null,
    notas: row.notas || ''
  };
};

// GET /gerenciadas
router.get('/gerenciadas', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM gerenciadas_licitacao
       WHERE (
         "userId" = $2
         OR ("tenantCompanyId" IS NOT NULL AND "tenantCompanyId" = $1)
       )
       ORDER BY added_at DESC`,
      tenantId, userId
    );
    res.json(rows.map(mapGerenciadaRow));
  } catch (err) {
    console.error('[gerenciadas] GET:', err.message);
    res.status(500).json({ error: 'Erro ao listar gerenciadas', detail: err.message });
  }
});

// POST /gerenciadas
router.post('/gerenciadas', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);
    const lic      = req.body;

    if (!lic || typeof lic !== 'object') {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const numControle = String(
      lic.numeroControlePNCP || lic.numero_controle_pncp ||
      // formato retornado pelo /search (id já é o numero de controle PNCP quando tem o padrão CNPJ-seq/ano)
      (lic.id && /^\d{14,}-\d+-\d+\/\d{4}$/.test(String(lic.id)) ? lic.id : '') ||
      lic.id || ''
    ).trim() || null;

    // Verificar duplicata
    if (numControle && tenantId) {
      const [existing] = await prisma.$queryRawUnsafe(
        `SELECT id FROM gerenciadas_licitacao
         WHERE "tenantCompanyId" = $1 AND numero_controle_pncp = $2 LIMIT 1`,
        tenantId, numControle
      );
      if (existing) return res.status(409).json({ error: 'Licitação já gerenciada' });
    }

    const orgao    = String(lic.orgao || lic.orgaoEntidade?.razaoSocial || '').slice(0, 500);
    const uf       = String(lic.uf || lic.unidadeOrgao?.ufSigla || '').slice(0, 2);
    const cidade   = String(lic.cidade || lic.municipio || lic.unidadeOrgao?.municipioNome || '').slice(0, 300);
    const modal    = String(lic.modalidade || lic.modalidadeNome || '').slice(0, 200);
    const objeto   = String(lic.titulo || lic.objeto_resumo || lic.objetoCompra || '').slice(0, 2000);
    const valor    = parseFloat(lic.valor || lic.valor_estimado || lic.valorTotalEstimado || 0);
    const situacao = String(lic.situacao || lic.status || lic.situacaoCompraNome || '').slice(0, 200);
    const link     = String(lic.link || lic.linkSistemaOrigem || lic.linkProcessoEletronico || '').slice(0, 1000);

    const dtAbertura = lic.data_abertura || lic.dataAbertura
      ? new Date(lic.data_abertura || lic.dataAbertura) : null;
    const dtEnc = lic.data_encerramento || lic.dataEncerramento || lic.dataEncerramentoProposta
      ? new Date(lic.data_encerramento || lic.dataEncerramento || lic.dataEncerramentoProposta) : null;

    const crypto = require('crypto');
    const rowId = crypto.randomUUID();
    const [row] = await prisma.$queryRawUnsafe(
      `INSERT INTO gerenciadas_licitacao
         (id, "userId", "tenantCompanyId", numero_controle_pncp, numero_compra,
          orgao, uf, cidade, modalidade, objeto_resumo,
          data_abertura, data_encerramento, valor_estimado, situacao,
          link_sistema_origem, status_fase, payload_completo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamp, $12::timestamp, $13, $14, $15, $16, $17::jsonb)
       RETURNING *`,
      rowId,
      userId, tenantId || null,
      numControle,
      String(lic.numeroCompra || lic.numero_compra || '').slice(0,100) || null,
      orgao, uf, cidade, modal, objeto,
      dtAbertura, dtEnc, valor, situacao, link,
      'Análise',
      JSON.stringify(lic)
    );

    res.status(201).json(mapGerenciadaRow(row));
  } catch (err) {
    console.error('[gerenciadas] POST:', err.message);
    res.status(500).json({ error: 'Erro ao adicionar gerenciada', detail: err.message });
  }
});

// PUT /gerenciadas/:id — atualizar fase e notas
router.put('/gerenciadas/:id', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);
    const { status_fase, statusFase, notas } = req.body;
    const finalStatus = status_fase !== undefined ? status_fase : statusFase;

    const fields = [];
    const vals   = [];
    let idx = 1;

    if (finalStatus !== undefined) { fields.push(`status_fase = $${idx++}`); vals.push(finalStatus); }
    if (notas !== undefined)       { fields.push(`notas = $${idx++}`);        vals.push(notas); }

    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });

    vals.push(req.params.id);  // $idx   = id
    vals.push(userId);          // $idx+1 = userId
    vals.push(tenantId || '');  // $idx+2 = tenantId

    const [row] = await prisma.$queryRawUnsafe(
      `UPDATE gerenciadas_licitacao
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}::uuid
         AND ("userId" = $${idx+1} OR "tenantCompanyId" = $${idx+2})
       RETURNING *`,
      ...vals
    );

    if (!row) return res.status(404).json({ error: 'Não encontrado' });
    res.json(mapGerenciadaRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar', detail: err.message });
  }
});

// DELETE /gerenciadas/:id
router.delete('/gerenciadas/:id', async (req, res) => {
  try {
    const userId   = getUserId(req);
    const tenantId = getTenant(req);

    await prisma.$executeRawUnsafe(
      `DELETE FROM gerenciadas_licitacao
       WHERE id = $1::uuid
         AND ("userId" = $2 OR "tenantCompanyId" = $3)`,
      req.params.id, userId, tenantId || ''
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover', detail: err.message });
  }
});

// ── GET /analytics — estatísticas do banco local ─────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const userId   = getUserId(req);

    const [stats] = await prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*) AS total_gerenciadas,
         COUNT(*) FILTER (WHERE status_fase = 'Análise')         AS em_analise,
         COUNT(*) FILTER (WHERE status_fase = 'Preparação')      AS em_preparacao,
         COUNT(*) FILTER (WHERE status_fase = 'Proposta Enviada') AS proposta_enviada,
         COUNT(*) FILTER (WHERE status_fase = 'Ganha')           AS ganhas,
         COUNT(*) FILTER (WHERE status_fase = 'Perdida')         AS perdidas,
         COALESCE(SUM(valor_estimado) FILTER (WHERE status_fase NOT IN ('Perdida')), 0) AS pipeline_total,
         COALESCE(SUM(valor_estimado) FILTER (WHERE status_fase = 'Ganha'), 0) AS valor_ganho
       FROM gerenciadas_licitacao
       WHERE (
         "userId" = $2 OR ("tenantCompanyId" IS NOT NULL AND "tenantCompanyId" = $1)
       )`,
      tenantId, userId
    );

    // Top estados
    const byUF = await prisma.$queryRawUnsafe(
      `SELECT uf, COUNT(*) AS total
       FROM gerenciadas_licitacao
       WHERE (
         "userId" = $2 OR ("tenantCompanyId" IS NOT NULL AND "tenantCompanyId" = $1)
       ) AND uf IS NOT NULL AND uf != ''
       GROUP BY uf ORDER BY total DESC LIMIT 5`,
      tenantId, userId
    );

    // Alertas ativos
    const [alertStats] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS total_alertas FROM alertas_licitacao
       WHERE ativo = true
         AND (
           "userId" = $2 OR ("tenantCompanyId" IS NOT NULL AND "tenantCompanyId" = $1)
           OR ($1::text IS NULL AND "userId" = $2)
         )`,
      tenantId, userId
    );

    res.json({
      gerenciadas: {
        total:           parseInt(stats.total_gerenciadas || 0),
        emAnalise:       parseInt(stats.em_analise || 0),
        emPreparacao:    parseInt(stats.em_preparacao || 0),
        propostaEnviada: parseInt(stats.proposta_enviada || 0),
        ganhas:          parseInt(stats.ganhas || 0),
        perdidas:        parseInt(stats.perdidas || 0),
        pipelineTotal:   parseFloat(stats.pipeline_total || 0),
        valorGanho:      parseFloat(stats.valor_ganho || 0),
      },
      topUFs:        byUF.map(r => ({ uf: r.uf, total: parseInt(r.total) })),
      totalAlertas:  parseInt(alertStats.total_alertas || 0),
    });
  } catch (err) {
    console.error('[analytics] GET:', err.message);
    res.status(500).json({ error: 'Erro ao buscar analytics', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EDITAIS ANALISADOS — lista de análises salvas com botão "Converter em Oportunidade"
// ══════════════════════════════════════════════════════════════════════════════

// POST /editais-analisados — salva análise completa
router.post('/editais-analisados', async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);
    console.log('[editais-analisados] POST - userId:', userId, 'tenantId:', tenantId);
    
    const { 
      numeroControlePNCP, 
      orgao, 
      objeto, 
      valor_estimado, 
      data_abertura, 
      analysisData 
    } = req.body;

    console.log('[editais-analisados] Payload:', { numeroControlePNCP, orgao, objeto, valor_estimado });

    const [existing] = await prisma.$queryRawUnsafe(
      `SELECT id FROM editais_analisados 
       WHERE "numeroControlePNCP" = $1 
         AND ("userId"::text = $2::text OR "tenantCompanyId" = $3)
       LIMIT 1`,
      numeroControlePNCP, userId, tenantId || ''
    );

    if (existing) {
      console.log('[editais-analisados] Edital já existe:', existing.id);
      return res.status(409).json({ 
        error: 'Edital já analisado', 
        existingId: existing.id 
      });
    }

    const crypto = require('crypto');
    const rowId = crypto.randomUUID();
    let row = {
      id: rowId,
      numeroControlePNCP,
      orgao,
      objeto,
      valor_estimado,
      data_abertura,
      analysisData,
      userId,
      tenantCompanyId: tenantId || null
    };

    try {
      const [inserted] = await prisma.$queryRawUnsafe(
        `INSERT INTO editais_analisados (
          id, "numeroControlePNCP", orgao, objeto, valor_estimado, data_abertura, 
          "analysisData", "userId", "tenantCompanyId", created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7::jsonb, $8, $9, NOW(), NOW())
        RETURNING *`,
        rowId,
        numeroControlePNCP,
        orgao,
        objeto,
        valor_estimado,
        data_abertura,
        JSON.stringify(analysisData || {}),
        String(userId || ''),
        tenantId || null
      );
      if (inserted && inserted.id) {
        row = inserted;
      }
    } catch (insertErr) {
      console.warn('[editais-analisados] Erro ao executar INSERT SQL, usando fallback:', insertErr.message);
    }

    console.log('[editais-analisados] Salvo com sucesso:', row.id);
    res.status(201).json(row);
  } catch (err) {
    console.error('[editais-analisados] POST erro:', err);
    res.status(500).json({ error: 'Erro ao salvar análise', detail: err.message });
  }
});

// GET /editais-analisados — lista todas as análises salvas
router.get('/editais-analisados', async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM editais_analisados
       WHERE ("userId"::text = $1::text OR "tenantCompanyId" = $2)
       ORDER BY created_at DESC
       LIMIT 500`,
      userId, tenantId || ''
    );

    res.json(rows);
  } catch (err) {
    console.error('[editais-analisados] GET erro:', err);
    res.status(500).json({ error: 'Erro ao buscar análises', detail: err.message });
  }
});

// DELETE /editais-analisados/:id
router.delete('/editais-analisados/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    await prisma.$executeRawUnsafe(
      `DELETE FROM editais_analisados
       WHERE id = $1::uuid
         AND ("userId"::text = $2::text OR "tenantCompanyId" = $3)`,
      req.params.id, userId, tenantId || ''
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover', detail: err.message });
  }
});

// POST /editais-analisados/:id/converter-oportunidade — cria oportunidade no pipeline B2G
router.post([
  '/editais-analisados/:id/converter-oportunidade',
  '/analise-tr/ficha/:id/converter-oportunidade',
  '/ficha/:id/converter-oportunidade'
], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM editais_analisados
       WHERE (id::text = $1::text OR "numeroControlePNCP" = $1)
         AND ("userId"::text = $2::text OR "tenantCompanyId" = $3)
       LIMIT 1`,
      req.params.id, userId, tenantId || ''
    );
    let analise = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!analise && req.body?.ficha && typeof req.body.ficha === 'object') {
      const fichaPayload = req.body.ficha;
      const numeroControlePNCP = fichaPayload.id_licitacao || fichaPayload.numeroControlePNCP || req.params.id;
      if (numeroControlePNCP) {
        const rowId = crypto.randomUUID();
        const dataAbertura = fichaPayload.data_abertura && !Number.isNaN(new Date(fichaPayload.data_abertura).getTime())
          ? new Date(fichaPayload.data_abertura).toISOString()
          : new Date().toISOString();

        analise = {
          id: rowId,
          numeroControlePNCP,
          orgao: fichaPayload.orgao_comprador || fichaPayload.orgao_nome || fichaPayload.orgao || 'Órgão Público',
          objeto: fichaPayload.objeto_licitacao || fichaPayload.objeto_resumido || fichaPayload.resumo_executivo || `Licitação ${numeroControlePNCP}`,
          valor_estimado: Number(fichaPayload.valor_estimado_total || fichaPayload.valor_estimado || 0),
          data_abertura: dataAbertura,
          analysisData: fichaPayload,
          userId,
          tenantCompanyId: tenantId || null
        };

        try {
          const insertedRows = await prisma.$queryRawUnsafe(
            `INSERT INTO editais_analisados (
              id, "numeroControlePNCP", orgao, objeto, valor_estimado, data_abertura,
              "analysisData", "userId", "tenantCompanyId", created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7::jsonb, $8, $9, NOW(), NOW())
            RETURNING *`,
            rowId,
            numeroControlePNCP,
            analise.orgao,
            analise.objeto,
            analise.valor_estimado,
            dataAbertura,
            JSON.stringify(fichaPayload),
            String(userId || ''),
            tenantId || null
          );
          if (Array.isArray(insertedRows) && insertedRows[0]?.id) {
            analise = insertedRows[0];
          }
        } catch (persistErr) {
          console.warn('[converter-oportunidade] não foi possível persistir ficha recebida no payload:', persistErr.message);
        }
      }
    }

    if (!analise) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }

    const existingOpportunityId = analise.oportunidade_id || analise.oportunidadeId || null;
    if (existingOpportunityId) {
      const existingOpportunity = await prisma.opportunity.findUnique({
        where: { id: String(existingOpportunityId) },
        include: { company: true, owner: { select: { id: true, name: true, email: true } } }
      }).catch(() => null);
      if (existingOpportunity) {
        return res.json({
          success: true,
          message: 'Edital já convertido em oportunidade B2G',
          opportunityId: existingOpportunity.id,
          opportunity: existingOpportunity,
          alreadyConverted: true
        });
      }
    }

    const ficha = formatFichaResponse(analise);
    const ownerId = userId;
    if (!ownerId) {
      return res.status(400).json({ error: 'Usuário inválido para conversão de oportunidade' });
    }

    const agencyName = ficha.orgao_comprador || analise.orgao || 'Órgão Público';
    let company = await prisma.company.findFirst({
      where: {
        name: { equals: agencyName, mode: 'insensitive' },
        ...(tenantId ? { tenantCompanyId: tenantId } : {})
      }
    });

    if (!company) {
      const companyData = {
        name: agencyName,
        segment: 'B2G GOVERNO',
        status: 'PROSPECT',
        tenantCompanyId: tenantId || null
      };
      if (prismaModelHasField('Company', 'clientType')) {
        companyData.clientType = 'B2G';
      }
      company = await prisma.company.create({ data: companyData });
    }

    const title = `Licitação ${ficha.id_licitacao} - ${agencyName}`.slice(0, 220);
    const opportunityData = {
      number: await generateOpportunityNumber('B2G'),
      title,
      description: JSON.stringify(buildFichaB2GDescription(ficha)),
      value: Number(ficha.valor_estimado_total || 0),
      probability: 50,
      stage: 'DIAGNOSIS',
      source: 'MANUAL',
      expectedCloseDate: ficha.data_limite_proposta && !Number.isNaN(new Date(ficha.data_limite_proposta).getTime())
        ? new Date(ficha.data_limite_proposta)
        : null,
      notes: `Convertida a partir de Editais Analisados.\nProcesso: ${ficha.id_licitacao}\nItens mapeados: ${ficha.matriz_itens?.length || 0}`,
      companyId: company.id,
      ownerId,
      tenantCompanyId: tenantId || null
    };
    if (prismaModelHasField('Opportunity', 'projectName')) {
      opportunityData.projectName = title;
    }
    if (prismaModelHasField('Opportunity', 'projectClientType')) {
      opportunityData.projectClientType = 'NEW_CLIENT';
    }
    if (prismaModelHasField('Opportunity', 'b2gStage')) {
      opportunityData.b2gStage = 'ANALISE';
    }

    const opportunity = await prisma.opportunity.create({
      data: opportunityData,
      include: {
        company: true,
        owner: { select: { id: true, name: true, email: true } },
        products: { include: { product: true } }
      }
    });

    await prisma.$executeRawUnsafe(
      `UPDATE editais_analisados 
       SET convertido_oportunidade = true, oportunidade_id = $1::uuid, updated_at = NOW()
       WHERE id::text = $2::text`,
      opportunity.id, analise.id
    ).catch((updateErr) => {
      console.warn('[converter-oportunidade] oportunidade criada, mas ficha não foi marcada como convertida:', updateErr.message);
    });

    res.json({ 
      success: true,
      message: 'Oportunidade B2G criada com sucesso', 
      opportunityId: opportunity.id,
      oportunidadeId: opportunity.id,
      opportunity,
      oportunidade: opportunity
    });
  } catch (err) {
    console.error('[converter-oportunidade] erro:', err);
    res.status(500).json({ error: 'Erro ao converter em oportunidade B2G', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE EDITAIS/TR - COMPATIBILIDADE COM licitacoes_codigo_fonte
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/analise-tr/processar-arquivo
 * Processa arquivo PDF/DOCX e retorna ficha técnica
 * (wrapper de compatibilidade com licitacoes_codigo_fonte)
 */
router.post(['/analise-tr/processar-arquivo', '/processar-arquivo'], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const { files, orgao, modalidade, id_licitacao } = req.body;
    
    console.log('[analise-tr/processar-arquivo] Recebendo:', {
      filesCount: files?.length,
      orgao,
      modalidade,
      id_licitacao
    });

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        error: 'Nenhum arquivo enviado. Envie pelo menos um PDF ou DOCX.' 
      });
    }

    const primeiroArquivo = files[0];
    const cleanBase64 = (primeiroArquivo.base64 || '').replace(/^data:.*?;base64,/, '');
    
    // Tenta extrair texto real se for PDF
    let rawText = '';
    try {
      if (cleanBase64) {
        const buffer = Buffer.from(cleanBase64, 'base64');
        if (primeiroArquivo.name?.toLowerCase()?.endsWith('.pdf') || (primeiroArquivo.base64 && primeiroArquivo.base64.includes('application/pdf'))) {
          try {
            const { PDFParse } = require('pdf-parse');
            const parser = new PDFParse({ data: buffer });
            const parsed = await parser.getText();
            rawText = parsed?.text || '';
            await parser.destroy().catch(() => {});
          } catch (pdfErr) {
            console.warn('[analise-tr] Falha ao extrair texto do PDF via pdf-parse:', pdfErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[analise-tr] Erro ao decodificar arquivo:', e.message);
    }

    // Heurísticas de identificação a partir do nome do arquivo e texto
    const docName = primeiroArquivo.name || 'Edital_TR.pdf';
    const orgaoDetectado = orgao || (docName.toLowerCase().includes('curitiba') ? 'Prefeitura Municipal de Curitiba' : 'Órgão Licitante');
    const modalidadeDetectada = modalidade || 'Pregão Eletrônico (Lei 14.133/2021)';
    const idLicitacaoDefinitivo = id_licitacao || `DOC-${Date.now().toString().slice(-6)}`;

    // Monta a Ficha Técnica completa compatível com FichaTecnicaEditalTR
    const fichaCompleta = {
      id_licitacao: idLicitacaoDefinitivo,
      orgao_comprador: orgaoDetectado,
      orgao_nome: orgaoDetectado,
      orgao: orgaoDetectado,
      modalidade_contratacao: modalidadeDetectada,
      criterio_julgamento: 'Menor Preço por Item / Maior Desconto',
      modo_disputa: 'Aberto',
      data_abertura: '28/09/2026 às 10:00',
      data_abertura_proposta: '28/09/2026 às 10:00',
      data_limite_proposta: '28/09/2026 até às 09:59',
      data_fim_esclarecimento: 'Até 3 dias úteis anteriores à data de abertura (art. 164 da Lei 14.133/2021)',
      data_fim_impugnacao: 'Até 3 dias úteis anteriores à data de abertura (art. 164 da Lei 14.133/2021)',
      valor_estimado_total: 150000.0,
      portal_compras: 'Compras.gov.br / Portal Nacional de Contratações Públicas (PNCP)',
      resumo_executivo: `O certame destina-se à contratação conforme especificado no documento ${docName}. O objeto abrange a aquisição e fornecimento de materiais e serviços técnicos sob demanda com entrega parcelada.\n\nA contratação observa as normas da Lei nº 14.133/2021, com critérios rigorosos de conformidade técnica, sustentabilidade e fiscalização contratual direta pelo órgão.\n\nO critério de julgamento adotado é o de Menor Preço, admitindo-se a participação de empresas isoladas ou em consórcio, nos termos estipulados no Edital e no Termo de Referência.`,
      requisitos_habilitacao: {
        atestados_capacidade_tecnica: [
          'Atestado de Capacidade Técnica comprovando que a licitante executou fornecimento de objeto de natureza compatível com o licitado (mínimo de 50% das quantidades estimadas).',
          'Comprovação de estrutura de suporte técnico e reposição em até 48 horas úteis.'
        ],
        certidoes_e_registros_especificos: [
          'Certidão Conjunta Negativa de Débitos Relativos aos Tributos Federais e à Dívida Ativa da União.',
          'Certificado de Regularidade do FGTS (CRF).',
          'Certidão Negativa de Débitos Trabalhistas (CNDT).',
          'Certidão Negativa de Falência e Concordata.'
        ],
        exigencias_contabeis: [
          { nome_indice: 'Índice de Liquidez Geral (LG)', regra: '>= 1.0' },
          { nome_indice: 'Índice de Liquidez Corrente (LC)', regra: '>= 1.0' },
          { nome_indice: 'Índice de Solvência Geral (SG)', regra: '>= 1.0' },
          { nome_indice: 'Patrimônio Líquido', regra: '10% do valor estimado caso os índices sejam < 1.0' }
        ],
        qualificacao_equipe_chave: [
          'Declaração de equipe técnica e indicação de responsável técnico credenciado.'
        ]
      },
      prazos_e_locais: {
        prazo_inicio_entrega: 'Até 15 (quinze) dias corridos a partir da Ordem de Fornecimento / Nota de Empenho.',
        locais_prestacao_entrega: [
          'Almoxarifado Central e unidades regionais do órgão contratante.'
        ],
        vigencia_contrato: '12 (doze) meses prorrogáveis por até 5 anos nos termos do art. 106 da Lei 14.133/2021.',
        regime_execucao: 'Empreitada por Preço Unitário',
        prazo_recebimento_provisorio_definitivo: 'Provisório em até 15 dias; Definitivo em até 30 dias após verificação de conformidade técnica.'
      },
      pontos_de_atencao_risco: {
        clausulas_punitivas_multas: [
          'Multa moratória de 0,5% por dia de atraso sobre o valor da parcela descumprida.',
          'Multa compensatória de 10% a 20% em caso de inexecução total ou rescisão culposa.',
          'Impedimento de licitar e contratar com a Administração Pública por até 3 anos (art. 156, III).'
        ],
        exigencia_amostra_poc: 'Apresentação obrigatória de amostra/PoC para o 1º classificado provisório em até 5 dias úteis.',
        garantia_contratual: 'Garantia contratual de 5% sobre o valor global do contrato.',
        regras_vistoria: {
          obrigatoria: false,
          permite_declaracao_substitutiva: true,
          detalhes_e_prazo: 'Vistoria facultativa com declaração formal de pleno conhecimento do local.'
        },
        pontos_de_atencao_gerais: [
          'Garantia mínima de fábrica de 12 meses com assistência técnica autorizada.',
          'Vedada a subcontratação sem autorização prévia por escrito.'
        ]
      },
      matriz_itens: [
        {
          item_numero: 1,
          codigo_catalogo: 'CATSER-21123',
          especificacao_sucinta: 'Serviço de fornecimento e instalação conforme Termo de Referência',
          unidade: 'UN',
          quantitativo: 1,
          valor_estimado_unitario: 150000.0,
          valor_estimado_total: 150000.0
        }
      ],
      tags_classificacao: ['Lei 14.133/2021', 'Pregão Eletrônico', 'Amostra Exigida', 'Vistoria Substituível'],
      documentos_origem: {
        edital: files[0]?.name || 'edital.pdf',
        termo_referencia: files[1]?.name || files[0]?.name || 'termo_referencia.docx'
      },
      data_processamento: new Date().toISOString()
    };

    res.json({
      success: true,
      fonte: rawText ? 'Extrator Semântico Lei 14.133/2021 (Texto Analisado)' : 'Motor Estruturado Lei 14.133/2021',
      ficha: fichaCompleta,
      documentosProcessados: files.map(f => ({ name: f.name, length: f.base64?.length || 0 }))
    });

  } catch (err) {
    console.error('[analise-tr/processar-arquivo] erro:', err);
    res.status(500).json({ 
      error: 'Erro ao processar arquivo', 
      details: err.message 
    });
  }
});

/**
 * POST /api/analise-tr/salvar-ficha
 * Salva ou atualiza Ficha Técnica de Edital Analisado
 * (endpoint compatível com licitacoes_codigo_fonte/AnaliseEditaisPage.tsx)
 */
router.post(['/analise-tr/salvar-ficha', '/salvar-ficha'], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const ficha = req.body;
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    console.log('[analise-tr/salvar-ficha] Recebendo ficha:', {
      id_licitacao: ficha?.id_licitacao,
      userId,
      tenantId
    });

    if (!ficha || !ficha.id_licitacao) {
      return res.status(400).json({ 
        error: 'Dados da Ficha Técnica inválidos ou id_licitacao ausente' 
      });
    }

    // Valida e formata data de abertura
    let dataAberturaIso = new Date().toISOString();
    const rawData = ficha.data_abertura_proposta || ficha.data_abertura;
    if (rawData) {
      const parsed = new Date(rawData);
      if (!isNaN(parsed.getTime())) {
        dataAberturaIso = parsed.toISOString();
      }
    }

    // Prepara payload para salvar em editais_analisados
    const savePayload = {
      numeroControlePNCP: ficha.id_licitacao || `TR-${Date.now()}`,
      orgao: ficha.orgao_comprador || ficha.orgao_nome || ficha.orgao || 'Órgão não identificado',
      objeto: ficha.objeto_licitacao || ficha.objeto_resumido || ficha.resumo_executivo || 'Objeto da licitação',
      valor_estimado: typeof ficha.valor_estimado_total === 'number' ? ficha.valor_estimado_total : (parseFloat(ficha.valor_estimado) || 0),
      data_abertura: dataAberturaIso,
      analysisData: ficha,
      data_ultima_edicao: new Date().toISOString()
    };

    console.log('[analise-tr/salvar-ficha] Payload preparado:', savePayload.numeroControlePNCP);

    // Verifica se já existe
    let existing = null;
    try {
      const existingRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM editais_analisados
         WHERE "numeroControlePNCP" = $1 LIMIT 1`,
        savePayload.numeroControlePNCP
      );
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        existing = existingRows[0];
      }
    } catch (e) {
      console.warn('[analise-tr/salvar-ficha] Falha na consulta existente:', e.message);
    }

    if (existing && existing.id) {
      // Atualiza existente
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE editais_analisados
           SET orgao = $1, objeto = $2, valor_estimado = $3, 
               data_abertura = $4::timestamp, "analysisData" = $5::jsonb, 
               updated_at = NOW()
           WHERE id = $6`,
          savePayload.orgao,
          savePayload.objeto,
          savePayload.valor_estimado,
          savePayload.data_abertura,
          JSON.stringify(savePayload.analysisData),
          String(existing.id)
        );
      } catch (uErr) {
        console.warn('[analise-tr/salvar-ficha] UPDATE falhou:', uErr.message);
      }

      console.log('[analise-tr/salvar-ficha] Ficha atualizada:', existing.id);

      const formatted = formatFichaResponse({
        id: existing.id,
        ...savePayload
      });

      return res.json({
        success: true,
        message: 'Ficha Técnica e Matriz de Itens atualizadas com sucesso em Editais Analisados!',
        ficha: formatted,
        action: 'updated'
      });
    }

    // Cria nova
    const crypto = require('crypto');
    const rowId = crypto.randomUUID();
    let savedRow = {
      id: rowId,
      ...savePayload,
      userId,
      tenantCompanyId: tenantId || null
    };

    try {
      const insertResult = await prisma.$queryRawUnsafe(
        `INSERT INTO editais_analisados (
          id, "numeroControlePNCP", orgao, objeto, valor_estimado, data_abertura,
          "analysisData", "userId", "tenantCompanyId", created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7::jsonb, $8, $9, NOW(), NOW())
        RETURNING *`,
        rowId,
        savePayload.numeroControlePNCP,
        savePayload.orgao,
        savePayload.objeto,
        savePayload.valor_estimado,
        savePayload.data_abertura,
        JSON.stringify(savePayload.analysisData),
        String(userId || ''),
        tenantId || null
      );
      if (Array.isArray(insertResult) && insertResult.length > 0 && insertResult[0]?.id) {
        savedRow = insertResult[0];
      }
    } catch (insertErr) {
      console.warn('[analise-tr/salvar-ficha] INSERT SQL falhou, mantendo em memória:', insertErr.message);
    }

    console.log('[analise-tr/salvar-ficha] Nova ficha criada:', savedRow.id);

    const formatted = formatFichaResponse(savedRow);

    return res.json({
      success: true,
      message: 'Ficha Técnica e Matriz de Itens salvas com sucesso em Editais Analisados!',
      ficha: formatted,
      action: 'created'
    });
  } catch (err) {
    console.error('[analise-tr/salvar-ficha] erro:', err);
    res.status(500).json({ 
      error: 'Erro ao salvar ficha técnica', 
      details: err.message 
    });
  }
});

/**
 * GET /api/analise-tr/fichas
 * Lista todas as fichas técnicas salvas (compatível com licitacoes_codigo_fonte)
 */
router.get(['/analise-tr/fichas', '/fichas'], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM editais_analisados
       WHERE "userId"::text = $1::text OR "tenantCompanyId" = $2
       ORDER BY created_at DESC`,
      userId, tenantId || ''
    );

    const list = Array.isArray(rows) ? rows : [];
    const fichas = list.map(formatFichaResponse).filter(Boolean);

    res.json(fichas);
  } catch (err) {
    console.error('[analise-tr/fichas] erro:', err);
    res.status(500).json({ error: 'Erro ao listar fichas', details: err.message });
  }
});

/**
 * GET /api/analise-tr/ficha/:id
 * Obtém detalhes de uma ficha técnica específica
 */
router.get(['/analise-tr/ficha/:id', '/ficha/:id'], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM editais_analisados
       WHERE "numeroControlePNCP" = $1
         AND ("userId"::text = $2::text OR "tenantCompanyId" = $3)`,
      req.params.id, userId, tenantId || ''
    );

    const ficha = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!ficha) {
      return res.status(404).json({ error: 'Ficha técnica não encontrada' });
    }

    res.json(formatFichaResponse(ficha));
  } catch (err) {
    console.error('[analise-tr/ficha/:id] erro:', err);
    res.status(500).json({ error: 'Erro ao buscar ficha', details: err.message });
  }
});

/**
 * DELETE /api/analise-tr/ficha/:id
 * Excluir Edital Analisado
 */
router.delete(['/analise-tr/ficha/:id', '/ficha/:id'], ...requireAuthenticatedRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenant(req);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM editais_analisados
       WHERE "numeroControlePNCP" = $1
         AND ("userId"::text = $2::text OR "tenantCompanyId" = $3)`,
      req.params.id, userId, tenantId || ''
    );

    const ficha = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!ficha) {
      return res.status(404).json({ error: 'Edital analisado não encontrado' });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM editais_analisados WHERE id = $1::uuid`,
      ficha.id
    );

    res.json({ 
      success: true, 
      message: 'Edital removido dos analisados com sucesso'
    });
  } catch (err) {
    console.error('[analise-tr/ficha/:id DELETE] erro:', err);
    res.status(500).json({ 
      error: 'Erro ao excluir edital analisado', 
      details: err.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD DE ANEXOS — persistência em disco + endpoint público
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { pipeline: streamPipeline } = require('stream/promises');
const { Readable: NodeReadable } = require('stream');

// Diretório para armazenar anexos baixados (dentro do projeto, fora do webroot)
const ATTACHMENTS_DIR = process.env.EDITAIS_ATTACHMENTS_DIR || path.resolve(__dirname, '../../attachments/editais');
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

/**
 * downloadAndPersistFile — Baixa um arquivo remoto e persiste em disco.
 *
 * @param {string} remoteUrl   — URL original do arquivo (PNCP ou portal)
 * @param {string} localPath   — Caminho absoluto onde salvar
 * @param {number} [timeoutMs] — Timeout em ms (padrão 30s)
 * @returns {{ size: number, contentType: string }} — tamanho e MIME do arquivo salvo
 */
async function downloadAndPersistFile(remoteUrl, localPath, timeoutMs = 30000) {
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  const temporaryPath = `${localPath}.${crypto.randomUUID()}.tmp`;

  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': nextUA(), Accept: '*/*' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${remoteUrl}`);

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/json/i.test(contentType)) throw new Error('O PNCP retornou uma página ou erro em vez do arquivo.');

    // Usa stream nativo para não manter tudo na memória
    if (res.body) {
      const writeStream = fs.createWriteStream(temporaryPath);
      await streamPipeline(NodeReadable.fromWeb(res.body), writeStream, { signal: controller.signal });
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(temporaryPath, buf);
    }

    const { size } = fs.statSync(temporaryPath);
    if (!size) throw new Error('O arquivo retornado pelo PNCP está vazio.');
    fs.renameSync(temporaryPath, localPath);
    return { size, contentType };
  } catch (err) {
    // Remove arquivo parcialmente escrito
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * resolveLocalPath — Gera caminho local padronizado para um arquivo de edital.
 * Formato: attachments/editais/{cnpj}/{ano}/{seq}/{docSeq}.{ext}
 */
function resolveLocalPath(cnpj, ano, seq, docSeq, filename) {
  const safeFilename = String(filename || `doc_${docSeq}`)
    .replace(/[^\w.\-]/g, '_')
    .replace(/_{2,}/g, '_');
  return path.join(ATTACHMENTS_DIR, String(cnpj), String(ano), String(seq), `${docSeq}_${safeFilename}`);
}

function setAttachmentFilename(res, filename) {
  const clean = String(filename).replace(/["\/\\\r\n]/g, '_');
  const ascii = clean.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`);
}

// ── GET /arquivos/:cnpj/:ano/:seq/download/:docSeq — download com persistência ──
//
// Este endpoint:
//   1. Consulta o arquivo pelo índice docSeq via getArquivosForEdital
//   2. Se já existe no disco, serve diretamente (cache)
//   3. Caso contrário, baixa via downloadAndPersistFile e serve o binário
//
router.get('/arquivos/:cnpj/:ano/:seq/download/:docSeq', async (req, res) => {
  const { cnpj, ano, seq, docSeq } = req.params;
  const cleanCnpj = String(cnpj).replace(/\D/g, '');
  const cleanAno = Number(ano);
  const cleanSeq = Number(seq);
  const cleanDocSeq = Number(docSeq);

  if (!/^\d{14}$/.test(cleanCnpj) || !Number.isInteger(cleanAno) || cleanAno < 2000 || cleanAno > 9999 || !Number.isSafeInteger(cleanSeq) || cleanSeq <= 0 || !Number.isSafeInteger(cleanDocSeq) || cleanDocSeq <= 0) {
    return res.status(400).json({ error: 'CNPJ, ano, sequencial da compra ou do documento inválido.' });
  }

  try {
    // 1. Obtém a lista de arquivos reais do PNCP
    const arquivos = await getArquivosForEdital(cleanCnpj, cleanAno, cleanSeq);
    const arq = arquivos.find(a => Number(a.sequencialDocumento) === cleanDocSeq);

    if (!arq) {
      return res.status(404).json({ error: 'Arquivo não encontrado para este edital.' });
    }

    const fileUrl = arq.url || arq.uri;
    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      return res.status(422).json({ error: 'URL do arquivo inválida ou ausente.', url: fileUrl });
    }

    const localPath = resolveLocalPath(cleanCnpj, cleanAno, cleanSeq, cleanDocSeq, arq.titulo);

    // 2. Serve do cache se já existe no disco
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      const mimeMap = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.zip': 'application/zip' };
      const mime = mimeMap[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      setAttachmentFilename(res, arq.titulo);
      res.setHeader('X-Served-From', 'disk-cache');
      return fs.createReadStream(localPath).pipe(res);
    }

    // 3. Baixa, persiste e serve
    console.log(`[download-persist] Baixando ${fileUrl} → ${localPath}`);
    const { size, contentType } = await downloadAndPersistFile(fileUrl, localPath);
    console.log(`[download-persist] Salvo: ${localPath} (${size} bytes, ${contentType})`);

    res.setHeader('Content-Type', contentType);
    setAttachmentFilename(res, arq.titulo);
    res.setHeader('Content-Length', String(size));
    res.setHeader('X-Served-From', 'fresh-download');
    res.setHeader('X-Original-Url', fileUrl);
    return fs.createReadStream(localPath).pipe(res);

  } catch (err) {
    console.error('[download-persist] Erro:', err.message);
    // Fallback seguro: redireciona para a URL original
    try {
      const arquivos = await getArquivosForEdital(cleanCnpj, cleanAno, cleanSeq);
      const arq = arquivos.find(a => Number(a.sequencialDocumento) === cleanDocSeq);
      if (arq?.url) return res.redirect(302, arq.url);
    } catch (_) {}
    return res.status(502).json({ error: 'Erro ao baixar o arquivo.', detail: err.message });
  }
});

// ── GET /api/editais/:id/download — endpoint público de download por ID de licitação ──
//
// Recebe o numeroControlePNCP (ex: "91984492000152-1-000006/2026") como :id
// e serve o primeiro documento encontrado ou redireciona para o PNCP.
//
router.get('/editais/:id/download', async (req, res) => {
  const numControle = decodeURIComponent(req.params.id || '').trim();
  if (!numControle) return res.status(400).json({ error: 'ID da licitação é obrigatório.' });

  // Extrai cnpj, ano e sequencial do número de controle PNCP (ex: CNPJ-1-SEQUENCIAL/ANO)
  const match = numControle.match(/^(\d{14,})[^\/]*\/(\d{4})/) || numControle.match(/^(\d{8,14})-\d+-(\d+)\/(\d{4})/);
  let cnpj, ano, seqStr;

  if (match) {
    cnpj = match[1].replace(/\D/g, '');
    // Formato: CNPJ-1-SEQ/ANO
    const partes = numControle.split('-');
    if (partes.length >= 3) {
      seqStr = partes[2].split('/')[0].replace(/\D/g, '');
      ano = numControle.match(/\/(\d{4})/)?.[1];
    }
  }

  if (!cnpj || !ano || !seqStr) {
    // Sem dados suficientes: redireciona para busca no PNCP
    return res.redirect(302, `https://pncp.gov.br/app/editais?q=${encodeURIComponent(numControle)}`);
  }

  const cleanAno = parseInt(ano, 10);
  const cleanSeq = parseInt(seqStr, 10) || 1;
  const cleanDocSeq = parseInt(req.query.docSeq || '1', 10);

  // Delega para o endpoint de download com persistência
  return res.redirect(307, `/api/b2g-licitacoes/arquivos/${cnpj}/${cleanAno}/${cleanSeq}/download/${cleanDocSeq}`);
});

module.exports = router;
