/**
 * Compras.gov.br Proxy - Backend
 * 
 * Utiliza PNCP (pncp.gov.br) como fonte de dados.
 * Usa o modulo novo de Dados Abertos como fallback quando o PNCP oscila.
 *
 * Parâmetros: tipo=licitacao|dispensas|contratacoes14133|arp|pregoes (padrão: licitacao)
 * Retorna: { data, total, erro }
 */

const express = require('express');
const router = express.Router();

const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1';
const DADOS_ABERTOS_CONTRATACOES_URL = 'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133';

const diasAtras = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

const hoje = () => new Date().toISOString().slice(0, 10);

const toPNCPDate = (dateStr) => {
  if (!dateStr) return null;
  return String(dateStr).replace(/-/g, '').slice(0, 8);
};

const toISODate = (dateStr) => {
  if (!dateStr) return null;
  const compact = String(dateStr).replace(/-/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
};

const clamp = (n, min, max) => Math.max(min, Math.min(Number(n) || min, max));

const fetchWithRetry = async (url, options = {}, { timeoutMs = 12000, retries = 0 } = {}) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
};

const PNCP_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)'
};

const pncpCache = new Map();
const PNCP_CACHE_TTL_MS = 5 * 60 * 1000;
const PNCP_STALE_TTL_MS = 30 * 60 * 1000;
const PNCP_CIRCUIT_OPEN_MS = 2 * 60 * 1000;
let pncpCircuitOpenUntil = 0;

const isPNCPRateLimitText = (text) => /limite de requisi[cç][oõ]es|support id|requisi[cç][oõ]es excedido/i.test(String(text || ''));
const isPNCPTransientError = (message = '') => /aborted|abort|timeout|time.?out|limitou|indispon[ií]vel|HTTP 429|HTTP 503|HTTP 504|resposta inv[aá]lida/i.test(String(message || ''));
const isPNCPCircuitOpen = () => Date.now() < pncpCircuitOpenUntil;
const openPNCPCircuit = () => {
  pncpCircuitOpenUntil = Math.max(pncpCircuitOpenUntil, Date.now() + PNCP_CIRCUIT_OPEN_MS);
};

const readCache = (key, maxAgeMs = PNCP_CACHE_TTL_MS) => {
  const cached = pncpCache.get(key);
  if (!cached || Date.now() - cached.createdAt > maxAgeMs) return null;
  return cached.data;
};

const writeCache = (key, data) => {
  pncpCache.set(key, { createdAt: Date.now(), data });
  if (pncpCache.size > 80) pncpCache.delete(pncpCache.keys().next().value);
};

const fetchPNCPItems = async (url, label) => {
  const key = url.toString();
  const cached = readCache(key);
  if (cached) return { data: cached, erro: null };

  if (isPNCPCircuitOpen()) {
    const stale = readCache(key, PNCP_STALE_TTL_MS);
    if (stale) return { data: stale, erro: null };
    return { data: [], erro: `${label}: PNCP temporariamente indisponivel; usando fallback oficial` };
  }

  try {
    const response = await fetchWithRetry(key, { headers: PNCP_HEADERS }, { timeoutMs: 8000, retries: 0 });
    if (response.status === 429) {
      openPNCPCircuit();
      return { data: [], erro: `${label}: PNCP limitou requisições` };
    }
    if (response.status === 503 || response.status === 504) {
      openPNCPCircuit();
      return { data: [], erro: `${label}: PNCP indisponível no momento` };
    }
    if (!response.ok) return { data: [], erro: `${label}: HTTP ${response.status}` };

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      if (isPNCPRateLimitText(text)) openPNCPCircuit();
      return {
        data: [],
        erro: isPNCPRateLimitText(text)
          ? `${label}: PNCP limitou requisições`
          : `${label}: PNCP retornou resposta inválida`
      };
    }

    const payload = await response.json().catch(() => null);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    writeCache(key, data);
    return { data, erro: null };
  } catch (error) {
    if (isPNCPTransientError(error.message)) openPNCPCircuit();
    const stale = readCache(key, PNCP_STALE_TTL_MS);
    if (stale) return { data: stale, erro: null };
    return { data: [], erro: `${label}: ${error.message || 'falha na consulta'}` };
  }
};

// Modalidades PNCP compatíveis com cada tipo de busca
const MODALIDADES = {
  licitacao: [6],
  dispensas: [7],
  contratacoes14133: [6],
  arp: [6],
  pregoes: [6]
};

const DADOS_ABERTOS_MODALIDADES = {
  licitacao: [5, 6],
  dispensas: [6],
  contratacoes14133: [5, 6],
  arp: [5],
  pregoes: [5]
};

const toDadosAbertosDate = (value, fallback) => toISODate(value || fallback) || toISODate(fallback);

const matchObjeto = (texto, objeto) => {
  if (!objeto || String(objeto).trim().length < 2) return true;
  const hay = String(texto || '').toLowerCase();
  return String(objeto).toLowerCase().split(/\s+/).filter(t => t.length > 2).some(t => hay.includes(t));
};

const normalizeDadosAbertosToPNCP = (item) => ({
  numeroControlePNCP: item.numeroControlePNCP || '',
  orgaoEntidade: {
    cnpj: item.orgaoEntidadeCnpj || '',
    razaoSocial: item.orgaoEntidadeRazaoSocial || ''
  },
  unidadeOrgao: {
    ufSigla: item.unidadeOrgaoUfSigla || '',
    municipioNome: item.unidadeOrgaoMunicipioNome || '',
    nomeUnidade: item.unidadeOrgaoNomeUnidade || ''
  },
  anoCompra: item.anoCompraPncp || '',
  sequencialCompra: item.sequencialCompraPncp || '',
  numeroCompra: item.numeroCompra || '',
  modalidadeNome: item.modalidadeNome || '',
  valorTotalEstimado: item.valorTotalEstimado,
  dataPublicacaoPncp: item.dataPublicacaoPncp || null,
  dataAberturaProposta: item.dataAberturaPropostaPncp || null,
  dataEncerramentoProposta: item.dataEncerramentoPropostaPncp || null,
  objetoCompra: item.objetoCompra || '',
  informacaoComplementar: item.informacaoComplementar || '',
  srp: Boolean(item.srp),
  linkSistemaOrigem: item.idCompra
    ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${item.idCompra}`
    : null,
  situacaoCompraNome: item.situacaoCompraNomePncp || 'Divulgada no PNCP',
  codigoSituacaoCompra: item.situacaoCompraIdPncp
});

const fetchDadosAbertosContratacoes = async ({ tipo, qs, dataInicio, dataFim, page, size }) => {
  const fallbackInicio = !dataInicio && !dataFim ? diasAtras(365) : diasAtras(30);
  const dataI = toDadosAbertosDate(dataInicio, fallbackInicio);
  const dataF = toDadosAbertosDate(dataFim, hoje());
  const modalidades = DADOS_ABERTOS_MODALIDADES[tipo] || DADOS_ABERTOS_MODALIDADES.licitacao;
  const requestSize = tipo === 'arp' ? Math.min(Math.max(size * 5, 50), 500) : size;
  const MAX_PAGES = tipo === 'arp' ? 3 : 1;
  const PAGE_SIZE = Math.min(requestSize, 500);
  const data = [];
  const erros = [];

  for (const codigoModalidade of modalidades) {
    if (data.length >= size) break;

    for (let pg = page; pg < page + MAX_PAGES && data.length < size; pg++) {
      const url = new URL(DADOS_ABERTOS_CONTRATACOES_URL);
      url.searchParams.set('pagina', String(pg));
      url.searchParams.set('tamanhoPagina', String(Math.max(10, PAGE_SIZE)));
      url.searchParams.set('dataPublicacaoPncpInicial', dataI);
      url.searchParams.set('dataPublicacaoPncpFinal', dataF);
      url.searchParams.set('codigoModalidade', String(codigoModalidade));
      if (qs.uf) url.searchParams.set('unidadeOrgaoUfSigla', qs.uf);

      const key = url.toString();
      const cached = readCache(key);
      if (cached) {
        const filtered = cached.filter(item => !qs.objeto || matchObjeto(`${item.objetoCompra || ''} ${item.informacaoComplementar || ''}`, qs.objeto));
        data.push(...filtered);
        break;
      }

      try {
        const response = await fetchWithRetry(key, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'NexosCRM/2.0'
          }
        }, { timeoutMs: 20000, retries: 0 });

        if (!response.ok) {
          if (pg === page) {
            const text = String(await response.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 120);
            erros.push(`Dados Abertos modalidade ${codigoModalidade}: HTTP ${response.status}${text ? ` - ${text}` : ''}`);
          }
          break;
        }

        const payload = await response.json().catch(() => null);
        const rows = Array.isArray(payload?.resultado)
          ? payload.resultado
            .filter(item => tipo !== 'arp' || item.srp === true)
            .map(normalizeDadosAbertosToPNCP)
            .filter(item => !qs.objeto || matchObjeto(`${item.objetoCompra || ''} ${item.informacaoComplementar || ''}`, qs.objeto))
          : [];

        if (rows.length > 0) writeCache(key, rows);
        data.push(...rows);
        if (payload?.resultado?.length < PAGE_SIZE) break;
      } catch (err) {
        if (pg === page) {
          erros.push(`Dados Abertos modalidade ${codigoModalidade}: ${err.message || 'falha na consulta'}`);
        }
        break;
      }
    }
  }

  return { data: data.slice(0, size), erros };
};

router.get('/', async (req, res) => {
  const qs = req.query;
  const tipo = qs.tipo || 'licitacao';
  const modalidades = MODALIDADES[tipo] || MODALIDADES.licitacao;
  const objeto = String(qs.objeto || '').trim();

  try {
    const dataInicioParam = String(qs.dataInicio || '').trim();
    const dataFimParam = String(qs.dataFim || '').trim();
    const dataInicio = dataInicioParam || diasAtras(30);
    const dataFim = dataFimParam || hoje();
    const dataI = toPNCPDate(dataInicio);
    const dataF = toPNCPDate(dataFim);
    const size = clamp(qs.tamanhoPagina, 10, 50);
    const page = clamp(qs.pagina, 1, 500);

    const allResults = [];
    const erros = [];
    const consultas = tipo === 'arp' ? modalidades : [null, ...modalidades];
    const seen = new Set();
    const pncpRequestSize = tipo === 'arp' ? 50 : size;

    for (const mod of consultas) {
      const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
      url.searchParams.set('dataInicial', dataI);
      url.searchParams.set('dataFinal', dataF);
      url.searchParams.set('pagina', Math.max(10, page));
      url.searchParams.set('tamanhoPagina', pncpRequestSize);
      if (mod) url.searchParams.set('codigoModalidadeContratacao', mod);
      if (qs.uf) url.searchParams.set('uf', qs.uf);

      const label = mod ? `Modalidade ${mod}` : 'PNCP geral';
      const item = await fetchPNCPItems(url, label);
      if (item.erro) erros.push(item.erro);

      for (const row of item.data || []) {
        if (tipo === 'arp' && row.srp !== true) continue;
        if (objeto && !matchObjeto(`${row.objetoCompra || ''} ${row.informacaoComplementar || ''}`, objeto)) continue;
        const key = row.numeroControlePNCP || `${row.anoCompra}-${row.numeroCompra}-${row.orgaoEntidade?.cnpj}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allResults.push(row);
        if (allResults.length >= size) break;
      }

      if (allResults.length >= size) break;
    }

    if (allResults.length === 0) {
      const fallback = await fetchDadosAbertosContratacoes({
        tipo,
        qs,
        dataInicio: dataInicioParam,
        dataFim: dataFimParam,
        page,
        size
      });
      if (fallback.erros.length > 0) erros.push(...fallback.erros);

      for (const row of fallback.data || []) {
        const key = row.numeroControlePNCP || `${row.anoCompra}-${row.numeroCompra}-${row.orgaoEntidade?.cnpj}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allResults.push(row);
        if (allResults.length >= size) break;
      }
    }

    return res.json({
      data: allResults,
      total: allResults.length,
      erro: allResults.length === 0 && erros.length > 0 ? erros.slice(0, 2).join('; ') : undefined
    });
  } catch (error) {
    return res.json({ data: [], total: 0, erro: error.message || 'Falha ao buscar no PNCP' });
  }
});

module.exports = router;
