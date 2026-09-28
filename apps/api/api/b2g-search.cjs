/**
 * B2G Search API - Busca de Editais e Licitações
 * Agrega múltiplas fontes públicas gratuitas
 *
 * Fontes:
 * 1. PNCP - Portal Nacional de Contratações Públicas (API oficial)
 * 2. ComprasNet - Portal de Compras do Governo Federal
 * 3. Imprensa Nacional (DOU) - avisos, editais e contratações da Seção 3
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();

// Middleware de autenticação simples
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hoje = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');

const diasAtras = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10).replaceAll('-', '');
};

const toISODate = (yyyymmdd) => {
  if (!yyyymmdd || String(yyyymmdd).length < 8) return null;
  const s = String(yyyymmdd).replaceAll('-', '');
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

const formatCurrency = (value) => {
  if (!value || isNaN(Number(value))) return null;
  return Number(value);
};

const safeJson = async (res) => {
  try { return await res.json(); } catch { return null; }
};

// fetch com timeout + retry para erros transitórios de rede/5xx.
async function fetchWithRetry(url, options = {}, { timeoutMs = 45000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs)
      });
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

const PNCP_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)'
};

const PNCP_CACHE_TTL_MS = 5 * 60 * 1000;
const PNCP_STALE_TTL_MS = 30 * 60 * 1000;
const PNCP_CIRCUIT_OPEN_MS = 2 * 60 * 1000;
const pncpCache = new Map();
let pncpCircuitOpenUntil = 0;

const clampNumber = (value, min, max, fallback = min) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
};

const isPNCPRateLimitText = (text) => /limite de requisi[cç][oõ]es|support id|requisi[cç][oõ]es excedido/i.test(String(text || ''));
const isPNCPTransientError = (message = '') => /aborted|abort|timeout|time.?out|limitou|indispon[ií]vel|HTTP 429|HTTP 503|HTTP 504|n[aã]o JSON/i.test(String(message || ''));
const isPNCPCircuitOpen = () => Date.now() < pncpCircuitOpenUntil;
const openPNCPCircuit = () => {
  pncpCircuitOpenUntil = Math.max(pncpCircuitOpenUntil, Date.now() + PNCP_CIRCUIT_OPEN_MS);
};

const getPNCPCache = (key, maxAgeMs) => {
  const cached = pncpCache.get(key);
  if (!cached || Date.now() - cached.createdAt > maxAgeMs) return null;
  return cached.data;
};

const setPNCPCache = (key, data) => {
  pncpCache.set(key, { createdAt: Date.now(), data });
  if (pncpCache.size > 120) {
    const oldest = pncpCache.keys().next().value;
    pncpCache.delete(oldest);
  }
};

async function fetchPNCPItems(url, label, { timeoutMs = 9000 } = {}) {
  const cacheKey = url.toString();
  const fresh = getPNCPCache(cacheKey, PNCP_CACHE_TTL_MS);
  if (fresh) return fresh;

  if (isPNCPCircuitOpen()) {
    const stale = getPNCPCache(cacheKey, PNCP_STALE_TTL_MS);
    if (stale) return stale;
    throw new Error(`${label}: PNCP temporariamente indisponivel; usando fallback oficial.`);
  }

  try {
    const res = await fetchWithRetry(cacheKey, {
      headers: PNCP_HEADERS
    }, { timeoutMs, retries: 0 });

    if (res.status === 429) {
      throw new Error('PNCP limitou requisições. Aguarde alguns instantes e tente novamente.');
    }
    if (res.status === 503 || res.status === 504) {
      throw new Error('PNCP indisponível no momento.');
    }
    if (!res.ok) {
      throw new Error(`PNCP HTTP ${res.status}.`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      if (isPNCPRateLimitText(text)) {
        throw new Error('PNCP limitou requisições. Aguarde alguns instantes e tente novamente.');
      }
      throw new Error('PNCP retornou uma resposta não JSON.');
    }

    const data = await safeJson(res);
    const items = Array.isArray(data?.data) ? data.data : [];
    setPNCPCache(cacheKey, items);
    return items;
  } catch (err) {
    if (isPNCPTransientError(err.message)) openPNCPCircuit();
    const stale = getPNCPCache(cacheKey, PNCP_STALE_TTL_MS);
    if (stale) return stale;
    throw new Error(`${label}: ${err.message || 'falha na consulta'}`);
  }
}

const matchObjeto = (texto, objeto) => {
  if (!objeto || objeto.trim().length < 2) return true;
  const haystack = String(texto || '').toLowerCase();
  const termos = objeto.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return termos.length === 0 || termos.some(t => haystack.includes(t));
};

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const cleanHtmlText = (value = '') => decodeHtmlEntities(String(value)
  .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
  .replace(/<img\b[^>]*\btitle=["']([^"']*)["'][^>]*>/gi, ' $1 ')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const normalizeDateText = (value) => {
  if (!value) return null;
  const text = cleanHtmlText(value);
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = match;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
};

const isWithinDateRange = (dateValue, dataInicio, dataFim) => {
  if (!dateValue) return true;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return true;
  if (dataInicio) {
    const startTs = new Date(`${String(dataInicio).slice(0, 10)}T00:00:00`).getTime();
    if (Number.isFinite(startTs) && ts < startTs) return false;
  }
  if (dataFim) {
    const endTs = new Date(`${String(dataFim).slice(0, 10)}T23:59:59`).getTime();
    if (Number.isFinite(endTs) && ts > endTs) return false;
  }
  return true;
};

const CLOSED_STATUS_PATTERN = /(encerrad|cancelad|revogad|suspens|anulad|fracassad|desert|homologad|adjudicad)/i;

const parseDateTime = (value, endOfDay = false) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (brMatch) {
    const iso = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T${brMatch[4] || (endOfDay ? '23' : '00')}:${brMatch[5] || (endOfDay ? '59' : '00')}:${brMatch[6] || (endOfDay ? '59' : '00')}`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text.length === 10) {
    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
};

const isEditalVigente = (item) => {
  if (!item) return false;

  // 1. Se tem status explicitamente encerrado, rejeitar
  const status = String(item?.status || '').trim().toLowerCase();
  if (CLOSED_STATUS_PATTERN.test(status)) return false;

  // 2. Se tem data de encerramento, ela decide
  const encerramento = parseDateTime(item?.dataEncerramento || item?.dataPrazo || item?.prazo, true);
  if (encerramento) return encerramento.getTime() >= Date.now();

  // 3. Se tem data de abertura futura, é vigente
  const abertura = parseDateTime(item?.dataAbertura || item?.dataAberturaProposta, false);
  if (abertura && abertura.getTime() >= Date.now()) return true;

  // 4. Se tem data de publicação muito antiga (mais de 1 ano), rejeitar
  const publicacao = parseDateTime(item?.dataPublicacao, false);
  if (publicacao) {
    const UM_ANO = 365 * 24 * 60 * 60 * 1000;
    if (publicacao.getTime() < Date.now() - UM_ANO) return false;
  }

  // 5. Se chegou aqui, considerar vigente (padrão permissivo)
  return true;
};

// ─── PNCP - Publicações ───────────────────────────────────────────────────────

const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1';
const DADOS_ABERTOS_CONTRATACOES_URL = 'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133';
const PORTAL_TRANSPARENCIA_API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const TRANSPARENCIA_CURITIBA_URL = 'https://www.transparencia.curitiba.pr.gov.br/sgp/licitacoes.aspx';
const DOU_SEARCH_URL = 'https://www.in.gov.br/consulta/-/buscar/dou';

const DADOS_ABERTOS_PNCP_MODALIDADES = {
  licitacao: [5, 6],
  pregoes: [5],
  dispensas: [6],
  contratacoes14133: [5, 6],
  pncp: [5, 6]
};

const toBRDate = (value) => {
  if (!value) return '';
  const clean = String(value).slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const compact = String(value).replaceAll('-', '').slice(0, 8);
  if (/^\d{8}$/.test(compact)) return `${compact.slice(6, 8)}/${compact.slice(4, 6)}/${compact.slice(0, 4)}`;
  return String(value);
};

const parseBRMoney = (value) => {
  const raw = cleanHtmlText(value).replace(/[^\d,.-]/g, '');
  if (!raw) return null;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const firstText = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const candidate = typeof value === 'object'
      ? value.nome || value.descricao || value.razaoSocial || value.codigo || ''
      : value;
    const text = cleanHtmlText(candidate || '');
    if (text) return text;
  }
  return '';
};

const sourceId = (...parts) => parts
  .map((part) => cleanHtmlText(part || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  .filter(Boolean)
  .join('-')
  .slice(0, 180);

const splitSearchTerms = (value) => String(value || '')
  .split(/[\n,]+/)
  .map((term) => term.trim())
  .filter((term) => term.length >= 3)
  .filter((term, index, terms) => terms.findIndex((other) => other.toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')) === index);

const extractDouDeadline = (content, publicationDate) => {
  const publicationTs = parseDateTime(publicationDate)?.getTime();
  const dates = [...String(content || '').matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)]
    .map((match) => parseDateTime(match[1], true))
    .filter(Boolean)
    .filter((date) => !publicationTs || (date.getTime() >= publicationTs && date.getTime() <= publicationTs + (370 * 24 * 60 * 60 * 1000)));
  return dates[0]?.toISOString() || null;
};

// A busca do DOU retorna os resultados dentro de um script JSON da página oficial.
async function buscarDOU({ objeto, termos = '', dataInicio, dataFim, tamanhoPagina = 20 }) {
  const resultados = [];
  const errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 100, 20);
  const start = dataInicio || diasAtras(30);
  const end = dataFim || hoje();
  const terms = splitSearchTerms(termos);
  if (objeto?.trim()) terms.unshift(objeto.trim());
  const queries = [...new Set(terms.length ? terms : ['licitação'])].slice(0, 12);

  for (const query of queries) {
    if (resultados.length >= limit) break;
    try {
      const url = new URL(DOU_SEARCH_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('s', 'do3');
      url.searchParams.set('exactDate', 'personalizado');
      url.searchParams.set('sortType', '0');
      url.searchParams.set('delta', String(Math.min(100, Math.max(20, limit))));
      url.searchParams.set('publishFrom', toBRDate(start).replaceAll('/', '-'));
      url.searchParams.set('publishTo', toBRDate(end).replaceAll('/', '-'));

      const res = await fetchWithRetry(url.toString(), {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)'
        }
      }, { timeoutMs: 18000, retries: 1 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const jsonText = html.match(/<script[^>]+id=["'][^"']*BuscaDouPortlet_params["'][^>]*>\s*({[\s\S]*?})\s*<\/script>/i)?.[1];
      const items = jsonText ? JSON.parse(jsonText).jsonArray : [];
      if (!Array.isArray(items)) throw new Error('resposta sem resultados estruturados');

      for (const item of items) {
        const title = cleanHtmlText(item.title || 'Publicação no DOU');
        const content = cleanHtmlText(item.content || '');
        const publicationDate = normalizeDateText(item.pubDate) || item.pubDate || null;
        if (!matchObjeto(`${title} ${content}`, query)) continue;
        if (!isWithinDateRange(publicationDate, dataInicio, dataFim)) continue;

        resultados.push({
          id: `dou-${item.classPK || sourceId(item.urlTitle, title, item.pubDate)}`,
          fonte: 'Imprensa Nacional (DOU)',
          fonteLogo: '📰',
          titulo: title,
          orgao: Array.isArray(item.hierarchyList) ? item.hierarchyList.join(' / ') : cleanHtmlText(item.hierarchyStr || ''),
          modalidade: cleanHtmlText(item.artType || 'Publicação DOU'),
          uf: '',
          municipio: '',
          valor: null,
          dataPublicacao: publicationDate,
          dataAbertura: null,
          dataEncerramento: extractDouDeadline(content, publicationDate),
          numero: title.match(/\bN[ºo.]?\s*([\d./-]+)/i)?.[1] || '',
          ano: String(item.pubDate || '').match(/\b(20\d{2})\b/)?.[1] || '',
          link: item.urlTitle ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}` : DOU_SEARCH_URL,
          status: 'Publicado no DOU',
          resumo: content
        });
        if (resultados.length >= limit) break;
      }
    } catch (err) {
      errors.push(`Imprensa Nacional (DOU): ${err.message || 'falha na consulta'}`);
    }
  }

  return { resultados: deduplicar(resultados), errors };
}

async function buscarPNCPPublicacao({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [];
  const errors = [];
  const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(30);
  const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  const page = clampNumber(pagina, 10, 500, 10);
  const startedAt = Date.now();

  const normalize = (items, label) => items
    .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto))
    .map(item => ({
      id: item.numeroControlePNCP || `pncp-${item.anoCompra}-${item.numeroCompra}-${item.orgaoEntidade?.cnpj}`,
      fonte: 'PNCP',
      fonteLogo: '🏛️',
      titulo: item.objetoCompra || 'Sem descrição',
      orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
      cnpjOrgao: item.orgaoEntidade?.cnpj || '',
      modalidade: item.modalidadeNome || label || '',
      uf: item.unidadeOrgao?.ufSigla || uf || '',
      municipio: item.unidadeOrgao?.municipioNome || '',
      valor: formatCurrency(item.valorTotalEstimado),
      dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
      dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
      dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
      numero: item.numeroCompra || '',
      ano: item.anoCompra || '',
      numeroControlePNCP: item.numeroControlePNCP || '',
      link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
      status: item.situacaoCompraNome || 'Publicado',
      situacaoCodigo: item.codigoSituacaoCompra
    }));

  const fetchPublicacao = async ({ modCode = '' } = {}) => {
    const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
    url.searchParams.set('dataInicial', dataI);
    url.searchParams.set('dataFinal', dataF);
    url.searchParams.set('pagina', page);
    url.searchParams.set('tamanhoPagina', limit);
    if (modCode) url.searchParams.set('codigoModalidadeContratacao', modCode);
    if (uf) url.searchParams.set('uf', uf);

    const label = modCode ? `PNCP modalidade ${modCode}` : 'PNCP publicações';
    const items = await fetchPNCPItems(url, label, { timeoutMs: 8000 });
    return normalize(items, label);
  };

  const consultas = objeto?.trim() || uf
    ? [6, 8, 9, 4, 5].map(modCode => ({ modCode }))
    : DADOS_ABERTOS_PNCP_MODALIDADES.pncp.map(modCode => ({ modCode }));

  for (const consulta of consultas) {
    if (resultados.length >= limit || Date.now() - startedAt > 17000) break;
    try {
      resultados.push(...await fetchPublicacao(consulta));
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { resultados, errors };
}

// ─── PNCP - Propostas (em andamento) ─────────────────────────────────────────

async function buscarPNCPProposta({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [];
  const errors = [];

  try {
    const url = new URL(`${PNCP_BASE}/contratacoes/proposta`);
    url.searchParams.set('dataInicial', dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(60));
    url.searchParams.set('dataFinal', dataFim ? String(dataFim).replaceAll('-', '') : hoje());
    url.searchParams.set('pagina', pagina);
    url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(tamanhoPagina), 50)));
    if (uf) url.searchParams.set('uf', uf);

    const items = await fetchPNCPItems(url, 'PNCP propostas', { timeoutMs: 8000 });

    for (const item of items) {
      if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto)) continue;

      resultados.push({
        id: `pncp-prop-${item.numeroControlePNCP || item.anoCompra + item.numeroCompra + item.orgaoEntidade?.cnpj}`,
        fonte: 'PNCP',
        fonteLogo: '🏛️',
        titulo: item.objetoCompra || 'Sem descrição',
        orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
        cnpjOrgao: item.orgaoEntidade?.cnpj || '',
        modalidade: item.modalidadeNome || '',
        uf: item.unidadeOrgao?.ufSigla || uf || '',
        municipio: item.unidadeOrgao?.municipioNome || '',
        valor: formatCurrency(item.valorTotalEstimado),
        dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
        dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
        dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
        numero: item.numeroCompra || '',
        ano: item.anoCompra || '',
        numeroControlePNCP: item.numeroControlePNCP || '',
        link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
        status: 'Em proposta',
        situacaoCodigo: item.codigoSituacaoCompra
      });
    }
  } catch (err) {
    errors.push(`PNCP Proposta: ${err.message}`);
  }

  return { resultados, errors };
}

const toDadosAbertosDate = (value, fallbackCompact) => (
  toISODate(value || fallbackCompact) || toISODate(fallbackCompact)
);

const pncpLink = (cnpj, ano, sequencial) => {
  if (!cnpj || !ano || !sequencial) return 'https://pncp.gov.br/app/editais';
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
};

const normalizeDadosAbertosPNCP = (item, { objeto, uf }) => {
  if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidadeRazaoSocial} ${item.unidadeOrgaoNomeUnidade}`, objeto)) {
    return null;
  }

  const itemUf = item.unidadeOrgaoUfSigla || uf || '';
  if (uf && itemUf !== uf) return null;

  return {
    id: item.numeroControlePNCP || `pncp-da-${item.idCompra || item.anoCompraPncp || ''}-${item.numeroCompra || ''}`,
    fonte: 'PNCP',
    fonteLogo: '🏛️',
    titulo: item.objetoCompra || 'Sem descrição',
    orgao: item.orgaoEntidadeRazaoSocial || item.unidadeOrgaoNomeUnidade || '',
    cnpjOrgao: item.orgaoEntidadeCnpj || '',
    modalidade: item.modalidadeNome || '',
    uf: itemUf,
    municipio: item.unidadeOrgaoMunicipioNome || '',
    valor: formatCurrency(item.valorTotalEstimado),
    dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp || null,
    dataAbertura: toISODate(item.dataAberturaPropostaPncp) || item.dataAberturaPropostaPncp || null,
    dataEncerramento: toISODate(item.dataEncerramentoPropostaPncp) || item.dataEncerramentoPropostaPncp || null,
    numero: item.numeroCompra || '',
    ano: item.anoCompraPncp || '',
    numeroControlePNCP: item.numeroControlePNCP || '',
    link: pncpLink(item.orgaoEntidadeCnpj, item.anoCompraPncp, item.sequencialCompraPncp),
    status: item.situacaoCompraNomePncp || 'Divulgada no PNCP',
    situacaoCodigo: item.situacaoCompraIdPncp
  };
};

async function buscarPNCPDadosAbertos({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, modalidades = DADOS_ABERTOS_PNCP_MODALIDADES.pncp }) {
  const resultados = [];
  const errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  const PAGE_SIZE = Math.min(limit * 10, 500);
  const MAX_PAGES = 3;
  const fallbackInicio = !dataInicio && !dataFim ? diasAtras(365) : diasAtras(30);
  const dataI = toDadosAbertosDate(dataInicio, fallbackInicio);
  const dataF = toDadosAbertosDate(dataFim, hoje());

  for (const codigoModalidade of modalidades) {
    if (resultados.length >= limit) break;

    for (let page = 1; page <= MAX_PAGES && resultados.length < limit; page++) {
      try {
        const url = new URL(DADOS_ABERTOS_CONTRATACOES_URL);
        url.searchParams.set('pagina', String(page));
        url.searchParams.set('tamanhoPagina', String(PAGE_SIZE));
        url.searchParams.set('dataPublicacaoPncpInicial', dataI);
        url.searchParams.set('dataPublicacaoPncpFinal', dataF);
        url.searchParams.set('codigoModalidade', String(codigoModalidade));
        if (uf) url.searchParams.set('unidadeOrgaoUfSigla', uf);

        const res = await fetchWithRetry(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'NexosCRM/2.0'
          }
        }, { timeoutMs: 20000, retries: 0 });

        if (!res.ok) {
          if (page === 1) {
            const text = cleanHtmlText(await res.text().catch(() => '')).slice(0, 120);
            errors.push(`PNCP Dados Abertos modalidade ${codigoModalidade}: HTTP ${res.status}${text ? ` - ${text}` : ''}`);
          }
          break;
        }

        const payload = await safeJson(res);
        const items = Array.isArray(payload?.resultado) ? payload.resultado : [];
        if (items.length === 0) break;

        for (const item of items) {
          const normalized = normalizeDadosAbertosPNCP(item, { objeto, uf });
          if (normalized) resultados.push(normalized);
          if (resultados.length >= limit) break;
        }
      } catch (err) {
        if (page === 1) errors.push(`PNCP Dados Abertos modalidade ${codigoModalidade}: ${err.message || 'falha na consulta'}`);
        break;
      }
    }
  }

  return { resultados, errors };
}

async function buscarPNCPAgregado({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, incluirPropostas = true }) {
  const publicacoes = await buscarPNCPPublicacao({ objeto, uf, pagina, tamanhoPagina, dataInicio, dataFim });
  const resultados = [...(publicacoes.resultados || [])];
  const errors = [...(publicacoes.errors || [])];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  if (resultados.length === 0) {
    const dadosAbertos = await buscarPNCPDadosAbertos({ objeto, uf, pagina, tamanhoPagina: limit, dataInicio, dataFim });
    resultados.push(...(dadosAbertos.resultados || []));
    errors.push(...(dadosAbertos.errors || []));
  }

  if (incluirPropostas && resultados.length === 0 && errors.length === 0) {
    const propostas = await buscarPNCPProposta({ objeto, uf, pagina, tamanhoPagina: limit - resultados.length, dataInicio, dataFim });
    resultados.push(...(propostas.resultados || []));
    errors.push(...(propostas.errors || []));
  }

  return { resultados, errors };
}

// ─── ComprasNet (dadosabertos.compras.gov.br) ─────────────────────────────────

const UFS_BR = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]);

const extractUfFromAddress = (address) => {
  const match = String(address || '').match(/\/\s*([A-Z]{2})\s*$/);
  return match && UFS_BR.has(match[1]) ? match[1] : '';
};

const extractMunicipioFromAddress = (address) => {
  const match = String(address || '').match(/([^\/]+?)\/\s*[A-Z]{2}\s*$/);
  if (!match) return '';
  const parts = match[1].trim().split(/\s*-\s*/);
  return parts[parts.length - 1].trim();
};

async function buscarComprasNet({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [];
  const errors = [];

  try {
    const url = new URL('https://dadosabertos.compras.gov.br/modulo-legado/1_consultarLicitacao');
    url.searchParams.set('data_publicacao_inicial', toISODate(dataInicio || diasAtras(30)) || toISODate(diasAtras(30)));
    url.searchParams.set('data_publicacao_final', toISODate(dataFim || hoje()) || toISODate(hoje()));
    url.searchParams.set('pagina', String(Math.max(1, Math.min(Number(pagina) || 1, 500))));
    url.searchParams.set('tamanhoPagina', String(Math.max(10, Math.min(Number(tamanhoPagina) || 20, 500))));

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'NexosCRM/2.0' },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      errors.push(`ComprasNet legado: HTTP ${res.status}`);
    } else {
      const data = await safeJson(res);
      const items = Array.isArray(data?.resultado) ? data.resultado : [];

      for (const item of items) {
        const itemUf = extractUfFromAddress(item.endereco_entrega_edital) || uf || '';
        if (uf && itemUf !== uf) continue;
        if (!matchObjeto(`${item.objeto} ${item.informacoes_gerais}`, objeto)) continue;

        resultados.push({
          id: `comprasnet-${item.id_compra || item.identificador || Math.random()}`,
          fonte: 'ComprasNet',
          fonteLogo: '🇧🇷',
          titulo: item.objeto || 'Sem descrição',
          orgao: item.nome_orgao || `UASG ${item.uasg || ''}`.trim(),
          cnpjOrgao: '',
          modalidade: item.nome_modalidade || '',
          uf: itemUf,
          municipio: extractMunicipioFromAddress(item.endereco_entrega_edital),
          valor: formatCurrency(item.valor_estimado_total || item.valor_homologado_total),
          dataPublicacao: item.data_publicacao || null,
          dataAbertura: toISODate(item.data_abertura_proposta) || item.data_abertura_proposta || null,
          dataEncerramento: null,
          numero: String(item.numero_aviso || ''),
          ano: String(item.id_compra || '').slice(-4),
          link: item.linkSistemaOrigem || `https://www.gov.br/compras/pt-br/acesso-a-informacao/consulta-licitacoes`,
          status: item.situacao_aviso || 'Publicado'
        });
      }
    }
  } catch (err) {
    errors.push(`ComprasNet legado: ${err.message}`);
  }

  if (resultados.length === 0) {
    const fallback = await buscarPNCPDadosAbertos({
      objeto,
      uf,
      pagina,
      tamanhoPagina,
      dataInicio,
      dataFim,
      modalidades: DADOS_ABERTOS_PNCP_MODALIDADES.licitacao
    });

    resultados.push(...(fallback.resultados || []).map(item => ({
      ...item,
      fonte: 'ComprasNet',
      fonteLogo: '🇧🇷'
    })));

    if (fallback.errors?.length) {
      errors.push(...fallback.errors);
    }
  }

  return { resultados, errors };
}

// ─── e-Compras Curitiba ──────────────────────────────────────────────────────

const CURITIBA_ECOMPRAS_URL = 'https://e-compras.curitiba.pr.gov.br/';

const getCuritibaSection = (html, startLabel, endLabels = []) => {
  const start = html.indexOf(startLabel);
  if (start < 0) return '';
  const nextIndexes = endLabels
    .map((label) => html.indexOf(label, start + startLabel.length))
    .filter((index) => index > start);
  const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : html.length;
  return html.slice(start, end);
};

const extractTableRows = (html) => String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

const extractTableCells = (rowHtml) => {
  const cells = String(rowHtml || '').match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) || [];
  return cells.map((cell) => cleanHtmlText(cell));
};

const extractRowHref = (rowHtml) => {
  const match = String(rowHtml || '').match(/\bhref\s*=\s*["']([^"']+)["']/i);
  if (!match) return CURITIBA_ECOMPRAS_URL;
  const href = decodeHtmlEntities(match[1]).trim();
  if (!href || /^javascript:/i.test(href) || href === '#') return CURITIBA_ECOMPRAS_URL;
  try {
    return new URL(href, CURITIBA_ECOMPRAS_URL).toString();
  } catch {
    return CURITIBA_ECOMPRAS_URL;
  }
};

const resolveCuritibaModalidade = (identificacao) => {
  const code = String(identificacao || '').trim().match(/^([A-Z]{2,4})\b/)?.[1] || '';
  const map = {
    PE: 'Pregão Eletrônico',
    DE: 'Dispensa Eletrônica',
    CE: 'Concorrência Eletrônica',
    LE: 'Leilão Eletrônico'
  };
  return map[code] || code || 'Processo Licitatório';
};

const resolveCuritibaOrgao = (identificacao) => {
  const match = String(identificacao || '').trim().match(/^[A-Z]{2,4}\s+\d+\/\d{4}\s+(.+)$/);
  return match?.[1]?.trim() ? `Prefeitura Municipal de Curitiba - ${match[1].trim()}` : 'Prefeitura Municipal de Curitiba';
};

const resolveCuritibaNumero = (identificacao) => (
  String(identificacao || '').match(/\b\d+\/\d{4}\b/)?.[0] || ''
);

const normalizeCuritibaBid = ({ cells, rowHtml, sectionType }) => {
  if (!Array.isArray(cells) || cells.length < 3) return null;

  const isSession = sectionType === 'sessao';
  const identificacao = cells[0];
  if (!/\b[A-Z]{2,4}\s+\d+\/\d{4}\b/.test(identificacao)) return null;

  const titulo = isSession ? cells[1] : cells[2];
  const dateText = isSession ? cells[2] : cells[1];
  const parsedDate = normalizeDateText(dateText);
  const numero = resolveCuritibaNumero(identificacao);
  const statusMap = {
    novos: 'Publicado',
    recebimento: 'Recebendo propostas',
    sessao: 'Em sessão'
  };

  return {
    id: `curitiba-ecompras-${identificacao.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    fonte: 'e-Compras Curitiba',
    fonteLogo: '🏙️',
    titulo: titulo || 'Sem descrição',
    orgao: resolveCuritibaOrgao(identificacao),
    cnpjOrgao: '',
    modalidade: resolveCuritibaModalidade(identificacao),
    uf: 'PR',
    municipio: 'Curitiba',
    valor: null,
    dataPublicacao: sectionType === 'novos' ? parsedDate : null,
    dataAbertura: sectionType === 'novos' ? parsedDate : null,
    dataEncerramento: sectionType === 'recebimento' || isSession ? parsedDate : null,
    numero,
    ano: numero.split('/')[1] || '',
    numeroControlePNCP: '',
    link: extractRowHref(rowHtml),
    status: statusMap[sectionType] || 'Publicado'
  };
};

const parseCuritibaSection = (sectionHtml, sectionType) => extractTableRows(sectionHtml)
  .map((rowHtml) => normalizeCuritibaBid({
    cells: extractTableCells(rowHtml),
    rowHtml,
    sectionType
  }))
  .filter(Boolean);

const parseCuritibaRowsByPosition = (html) => {
  const source = String(html || '');
  const mainStart = source.indexOf('Este é o Portal de Compras Eletrônicas');
  const safeStart = mainStart >= 0 ? mainStart : 0;
  const recebimentoIndex = source.indexOf('Processos Licitatórios em Recebimento de Propostas', safeStart);
  const sessaoIndex = source.indexOf('Processos Licitatórios em Sessão', recebimentoIndex > -1 ? recebimentoIndex : safeStart);
  const ultimasNoticiasIndex = source.indexOf('Últimas Notícias', sessaoIndex > -1 ? sessaoIndex : safeStart);

  return Array.from(source.matchAll(/<tr\b[\s\S]*?<\/tr>/gi))
    .map((match) => {
      const index = match.index || 0;
      if (index < safeStart) return null;
      if (ultimasNoticiasIndex > -1 && index > ultimasNoticiasIndex) return null;

      const sectionType =
        recebimentoIndex > -1 && index >= recebimentoIndex
          ? (sessaoIndex > -1 && index >= sessaoIndex ? 'sessao' : 'recebimento')
          : 'novos';

      return normalizeCuritibaBid({
        cells: extractTableCells(match[0]),
        rowHtml: match[0],
        sectionType
      });
    })
    .filter(Boolean);
};

async function buscarCuritibaECompras({ objeto, uf, cidade, tamanhoPagina = 20, dataInicio, dataFim }) {
  const limit = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 100));
  const diagnostics = [];

  if (uf && String(uf).trim().toUpperCase() !== 'PR') {
    return { resultados: [], errors: [] };
  }
  if (cidade && !String(cidade).toLowerCase().includes('curitiba')) {
    return { resultados: [], errors: [] };
  }

  try {
    const res = await fetchWithRetry(CURITIBA_ECOMPRAS_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)'
      }
    }, { timeoutMs: 8000, retries: 0 });

    if (res.ok) {
      const html = await res.text();
      if (/Access Denied|edgesuite|akamai/i.test(html)) {
        diagnostics.push('Portal e-Compras bloqueou acesso programático.');
      } else {
        const data = deduplicar(parseCuritibaRowsByPosition(html))
          .filter(item => matchObjeto(`${item.titulo} ${item.orgao} ${item.modalidade} ${item.numero}`, objeto))
          .filter(item => isWithinDateRange(item.dataPublicacao || item.dataAbertura || item.dataEncerramento, dataInicio, dataFim))
          .slice(0, limit);

        if (data.length > 0) {
          return { resultados: data, errors: [] };
        }
      }
    } else {
      diagnostics.push(`Portal e-Compras HTTP ${res.status}.`);
    }
  } catch (err) {
    diagnostics.push(`Portal e-Compras indisponível: ${err.message}`);
  }

  const transparencia = await buscarTransparenciaCuritiba({
    objeto,
    uf: 'PR',
    cidade: 'Curitiba',
    dataInicio,
    dataFim,
    tamanhoPagina: limit
  });

  if (transparencia.resultados?.length > 0) {
    return {
      resultados: transparencia.resultados.slice(0, limit).map(item => ({
        ...item,
        fonte: 'e-Compras Curitiba',
        fonteLogo: '🏙️'
      })),
      errors: []
    };
  }

  const fallback = await buscarPNCPCuritibaFallback({ objeto, dataInicio, dataFim, tamanhoPagina: limit });
  if (fallback.resultados?.length > 0) {
    return {
      resultados: fallback.resultados.slice(0, limit).map(item => ({
        ...item,
        fonte: 'e-Compras Curitiba',
        fonteLogo: '🏙️'
      })),
      errors: []
    };
  }

  return {
    resultados: [],
    errors: [
      ...diagnostics,
      ...(transparencia.errors || []),
      ...(fallback.errors || [])
    ].slice(0, 3)
  };
}

// ─── e-Compras Curitiba - Fallback via PNCP ──────────────────────────────────
// Quando o portal de Curitiba bloqueia acesso programático (Akamai 403),
// busca no PNCP as publicações cujo órgão esteja no município de Curitiba/PR.
async function buscarPNCPCuritibaFallback({ objeto, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const resultados = [];
  const errors = [];
  try {
    const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(45);
    const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
    const limit = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 100));
    const requestSize = Math.max(50, limit);
    const maxPages = 3;

    for (const modCode of DADOS_ABERTOS_PNCP_MODALIDADES.licitacao) {
      if (resultados.length >= limit) break;
      for (let pagina = 1; pagina <= maxPages && resultados.length < limit; pagina += 1) {
        try {
          const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
          url.searchParams.set('dataInicial', dataI);
          url.searchParams.set('dataFinal', dataF);
          url.searchParams.set('uf', 'PR');
          url.searchParams.set('codigoModalidadeContratacao', modCode);
          url.searchParams.set('pagina', Math.max(10, pagina));
          url.searchParams.set('tamanhoPagina', requestSize);

          const items = await fetchPNCPItems(url, `e-Compras Curitiba PNCP pagina ${pagina} (modalidade ${modCode})`, { timeoutMs: 8000 });

          for (const item of items) {
            const cidade = String(item.unidadeOrgao?.municipioNome || '').toLowerCase();
            if (cidade && !cidade.includes('curitiba')) continue;
            if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto)) continue;

            resultados.push({
              id: item.numeroControlePNCP || `pncp-curitiba-${item.anoCompra}-${item.numeroCompra}-${item.orgaoEntidade?.cnpj}`,
              fonte: 'e-Compras Curitiba (PNCP)',
              fonteLogo: '🏙️',
              titulo: item.objetoCompra || 'Sem descrição',
              orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
              cnpjOrgao: item.orgaoEntidade?.cnpj || '',
              modalidade: item.modalidadeNome || '',
              uf: 'PR',
              municipio: item.unidadeOrgao?.municipioNome || 'Curitiba',
              valor: formatCurrency(item.valorTotalEstimado),
              dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
              dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
              dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
              numero: item.numeroCompra || '',
              ano: item.anoCompra || '',
              link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
              status: item.situacaoCompraNome || 'Publicado'
            });

            if (resultados.length >= limit) break;
          }
        } catch (err) {
          errors.push(`e-Compras Curitiba (PNCP página ${pagina}, modalidade ${modCode}): ${err.message}`);
          break;
        }
      }
    }
  } catch (err) {
    errors.push(`e-Compras Curitiba (PNCP): ${err.message}`);
  }
  return { resultados, errors };
}

// ─── Transparência Curitiba - Licitações e contratações ──────────────────────

async function buscarTransparenciaCuritiba({ objeto, uf, cidade, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const resultados = [];
  const errors = [];

  if (uf && String(uf).toUpperCase() !== 'PR') return { resultados, errors };
  if (cidade && !String(cidade).toLowerCase().includes('curitiba')) return { resultados, errors };

  try {
    const res = await fetchWithRetry(TRANSPARENCIA_CURITIBA_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'NexosCRM/2.0'
      }
    }, { timeoutMs: 12000, retries: 0 });

    if (!res.ok) {
      return { resultados, errors: [`Transparência Curitiba: HTTP ${res.status}`] };
    }

    const html = await res.text();
    const table = html.match(/<table[^>]*id=["']cphMasterPrincipal_gdvLicitacao["'][\s\S]*?<\/table>/i)?.[0] || '';
    const rowRegex = /<tr\b[^>]*class=["'][^"']*grid_(?:Row|AlternatingRow)[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [...table.matchAll(rowRegex)];
    const limit = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 100));

    for (const [, rowHtml] of rows) {
      const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanHtmlText(cell[1]));
      if (cells.length < 9) continue;

      const [numero, modalidade, orgao, titulo, valorText, local, dataPublicacaoText, protocolo, status] = cells;
      const dataPublicacao = normalizeDateText(dataPublicacaoText);

      if (!matchObjeto(`${titulo} ${orgao} ${modalidade} ${protocolo}`, objeto)) continue;
      if (!isWithinDateRange(dataPublicacao, dataInicio, dataFim)) continue;

      resultados.push({
        id: `transparencia-curitiba-${sourceId(numero, protocolo, orgao)}`,
        fonte: 'Transparência Curitiba',
        fonteLogo: '🏙️',
        titulo: titulo || 'Licitação sem descrição',
        orgao,
        modalidade,
        uf: 'PR',
        municipio: 'Curitiba',
        valor: parseBRMoney(valorText),
        dataPublicacao,
        dataAbertura: null,
        dataEncerramento: null,
        numero,
        ano: String(numero).match(/\b(20\d{2})\b/)?.[1] || '',
        protocolo,
        link: TRANSPARENCIA_CURITIBA_URL,
        status,
        local
      });

      if (resultados.length >= limit) break;
    }

    return { resultados, errors };
  } catch (err) {
    errors.push(`Transparência Curitiba: ${err.message}`);
  }

  if (resultados.length === 0) {
    try {
      const daResult = await buscarPNCPDadosAbertos({
        objeto,
        uf: 'PR',
        dataInicio,
        dataFim,
        tamanhoPagina: Math.max(10, Math.min(Number(tamanhoPagina) || 20, 50)),
        modalidades: DADOS_ABERTOS_PNCP_MODALIDADES.pncp
      });
      for (const item of daResult.resultados || []) {
        const municipio = String(item.municipio || '').toLowerCase();
        if (municipio && !municipio.includes('curitiba')) continue;
        resultados.push({
          ...item,
          fonte: 'Transparência Curitiba',
          fonteLogo: '🏙️',
          id: `tc-${item.id}`
        });
        if (resultados.length >= Math.max(10, Math.min(Number(tamanhoPagina) || 20, 50))) break;
      }
      errors.push(...(daResult.errors || []));
    } catch (_) {}
  }

  return { resultados, errors };
}

// ─── Portal da Transparência Federal - API oficial da CGU ────────────────────

async function buscarPortalTransparenciaFederalFallback({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const resultados = [];
  const errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  const PAGE_SIZE = 500;
  const MAX_PAGES = 3;
  const fallbackInicio = !dataInicio && !dataFim ? diasAtras(365) : diasAtras(30);
  const dataI = toDadosAbertosDate(dataInicio, fallbackInicio);
  const dataF = toDadosAbertosDate(dataFim, hoje());

  for (const codigoModalidade of DADOS_ABERTOS_PNCP_MODALIDADES.licitacao) {
    if (resultados.length >= limit) break;

    for (let page = 1; page <= MAX_PAGES && resultados.length < limit; page++) {
      try {
        const url = new URL(DADOS_ABERTOS_CONTRATACOES_URL);
        url.searchParams.set('pagina', String(page));
        url.searchParams.set('tamanhoPagina', String(PAGE_SIZE));
        url.searchParams.set('dataPublicacaoPncpInicial', dataI);
        url.searchParams.set('dataPublicacaoPncpFinal', dataF);
        url.searchParams.set('codigoModalidade', String(codigoModalidade));
        if (uf) url.searchParams.set('unidadeOrgaoUfSigla', uf);

        const res = await fetchWithRetry(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'NexosCRM/2.0'
          }
        }, { timeoutMs: 20000, retries: 0 });

        if (!res.ok) {
          if (page === 1) errors.push(`Portal Transparência Federal fallback: HTTP ${res.status}`);
          break;
        }

        const payload = await safeJson(res);
        const items = Array.isArray(payload?.resultado) ? payload.resultado : [];
        if (items.length === 0) break;

        for (const item of items) {
          if (item.orgaoEntidadeEsferaId !== 'F') continue;
          if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidadeRazaoSocial} ${item.unidadeOrgaoNomeUnidade}`, objeto)) continue;

          resultados.push({
            id: item.numeroControlePNCP || `transparencia-federal-${item.idCompra || item.anoCompraPncp || ''}-${item.numeroCompra || ''}`,
            fonte: 'Portal Transparência Federal',
            fonteLogo: '🔎',
            titulo: item.objetoCompra || 'Licitação federal',
            orgao: item.orgaoEntidadeRazaoSocial || item.unidadeOrgaoNomeUnidade || '',
            cnpjOrgao: item.orgaoEntidadeCnpj || '',
            modalidade: item.modalidadeNome || '',
            uf: item.unidadeOrgaoUfSigla || uf || '',
            municipio: item.unidadeOrgaoMunicipioNome || '',
            valor: formatCurrency(item.valorTotalEstimado),
            dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp || null,
            dataAbertura: toISODate(item.dataAberturaPropostaPncp) || item.dataAberturaPropostaPncp || null,
            dataEncerramento: toISODate(item.dataEncerramentoPropostaPncp) || item.dataEncerramentoPropostaPncp || null,
            numero: item.numeroCompra || '',
            ano: item.anoCompraPncp || '',
            numeroControlePNCP: item.numeroControlePNCP || '',
            link: pncpLink(item.orgaoEntidadeCnpj, item.anoCompraPncp, item.sequencialCompraPncp),
            status: item.situacaoCompraNomePncp || 'Divulgada no PNCP'
          });

          if (resultados.length >= limit) break;
        }
      } catch (err) {
        if (page === 1) errors.push(`Portal Transparência Federal fallback: ${err.message || 'falha na consulta'}`);
        break;
      }
    }
  }

  return { resultados, errors };
}

async function buscarPortalTransparenciaFederal({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20, codigoOrgao = '' }) {
  const resultados = [];
  const token = String(process.env.PORTAL_TRANSPARENCIA_TOKEN || process.env.PORTAL_TRANSPARENCIA_API_KEY || '').trim();
  const orgao = String(codigoOrgao || process.env.PORTAL_TRANSPARENCIA_CODIGO_ORGAO || '').trim();

  if (!token) {
    return buscarPortalTransparenciaFederalFallback({ objeto, uf, dataInicio, dataFim, tamanhoPagina });
  }

  if (!orgao) {
    return {
      resultados,
      errors: ['Portal Transparência Federal: informe codigoOrgao ou configure PORTAL_TRANSPARENCIA_CODIGO_ORGAO.']
    };
  }

  try {
    const url = new URL(`${PORTAL_TRANSPARENCIA_API_BASE}/licitacoes`);
    url.searchParams.set('codigoOrgao', orgao);
    url.searchParams.set('pagina', '1');
    url.searchParams.set('dataInicial', toBRDate(dataInicio || diasAtras(30)));
    url.searchParams.set('dataFinal', toBRDate(dataFim || hoje()));

    const res = await fetchWithRetry(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NexosCRM/2.0',
        'chave-api-dados': token
      }
    }, { timeoutMs: 12000, retries: 0 });

    if (!res.ok) {
      return { resultados, errors: [`Portal Transparência Federal: HTTP ${res.status}`] };
    }

    const data = await safeJson(res);
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

    for (const item of items.slice(0, Math.max(10, Math.min(Number(tamanhoPagina) || 20, 100)))) {
      const titulo = firstText(item.objeto, item.descricaoObjeto, item.objetoLicitacao, item.descricao, item.resumo);
      const orgaoNome = firstText(
        item.orgao?.nome,
        item.orgaoVinculado?.nome,
        item.unidadeGestora?.nome,
        item.unidadeGestora,
        item.nomeOrgao
      );
      const modalidade = firstText(item.modalidadeLicitacao?.descricao, item.modalidade?.descricao, item.modalidade);
      const dataAbertura = firstText(item.dataAbertura, item.dataResultadoCompra, item.dataPublicacao);

      if (!matchObjeto(`${titulo} ${orgaoNome} ${modalidade}`, objeto)) continue;

      resultados.push({
        id: `transparencia-federal-${item.id || sourceId(item.numero, item.numeroLicitacao, orgaoNome, titulo)}`,
        fonte: 'Portal Transparência Federal',
        fonteLogo: '🔎',
        titulo: titulo || 'Licitação federal',
        orgao: orgaoNome,
        modalidade,
        uf: '',
        municipio: '',
        valor: formatCurrency(item.valor || item.valorLicitacao || item.valorTotal || item.valorEstimado),
        dataPublicacao: normalizeDateText(dataAbertura) || dataAbertura || null,
        dataAbertura: normalizeDateText(dataAbertura) || dataAbertura || null,
        dataEncerramento: null,
        numero: firstText(item.numero, item.numeroLicitacao),
        ano: firstText(item.ano, item.anoLicitacao),
        link: 'https://portaldatransparencia.gov.br/licitacoes/consulta',
        status: firstText(item.situacaoCompra, item.situacao, item.status)
      });
    }

    return { resultados, errors: [] };
  } catch (err) {
    return { resultados, errors: [`Portal Transparência Federal: ${err.message}`] };
  }
}

// ─── Deduplicação ─────────────────────────────────────────────────────────────

function deduplicar(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = String(item.id || `${item.titulo?.slice(0, 40)}-${item.orgao?.slice(0, 20)}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Ordenação ────────────────────────────────────────────────────────────────

function ordenar(items, ordem = 'data_desc') {
  return [...items].sort((a, b) => {
    switch (ordem) {
      case 'data_desc':
        return new Date(b.dataPublicacao || 0) - new Date(a.dataPublicacao || 0);
      case 'data_asc':
        return new Date(a.dataPublicacao || 0) - new Date(b.dataPublicacao || 0);
      case 'valor_desc':
        return (b.valor || 0) - (a.valor || 0);
      case 'valor_asc':
        return (a.valor || 0) - (b.valor || 0);
      case 'abertura_asc':
        return new Date(a.dataAbertura || '9999') - new Date(b.dataAbertura || '9999');
      default:
        return 0;
    }
  });
}

// ─── GET /api/b2g-search/fontes ───────────────────────────────────────────────

router.get('/fontes', auth, (req, res) => {
  res.json({
    fontes: [
      {
        id: 'pncp',
        nome: 'PNCP',
        descricao: 'Portal Nacional de Contratações Públicas',
        logo: '🏛️',
        tipo: 'federal',
        status: 'ativo',
        url: 'https://pncp.gov.br'
      },
      {
        id: 'comprasnet',
        nome: 'ComprasNet',
        descricao: 'Portal de Compras do Governo Federal (SIASG)',
        logo: '🇧🇷',
        tipo: 'federal',
        status: 'ativo',
        url: 'https://comprasnet.gov.br'
      },
      {
        id: 'dou',
        nome: 'Imprensa Nacional (DOU)',
        descricao: 'Avisos, editais e contratações da Seção 3 do Diário Oficial da União',
        logo: '📰',
        tipo: 'federal',
        status: 'ativo',
        url: 'https://www.in.gov.br'
      },
      {
        id: 'curitiba-ecompras',
        nome: 'e-Compras Curitiba',
        descricao: 'Portal de Compras Eletrônicas do Município de Curitiba',
        logo: '🏙️',
        tipo: 'municipal',
        status: 'ativo',
        url: CURITIBA_ECOMPRAS_URL
      }
    ]
  });
});

// ─── GET /api/b2g-search/curitiba-ecompras ───────────────────────────────────

// 🧪 TESTE TEMPORÁRIO - sem auth
router.get('/curitiba-ecompras-test', async (req, res) => {
  try {
    const { objeto = 'notebook', tamanhoPagina = 5 } = req.query;
    console.log('[TEST] Iniciando teste e-Compras Curitiba...');
    
    const result = await buscarCuritibaECompras({
      objeto,
      uf: '',
      cidade: '',
      tamanhoPagina: Number(tamanhoPagina),
      dataInicio: '',
      dataFim: ''
    });
    
    const data = deduplicar(result.resultados || []);
    console.log('[TEST] Resultado:', { resultados: data.length, errors: result.errors?.length || 0 });
    
    return res.status(200).json({
      test: true,
      data,
      total: data.length,
      fonte: 'e-Compras Curitiba (TEST)',
      erros: result.errors,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[TEST] Erro:', err);
    return res.status(500).json({ test: true, error: err.message, stack: err.stack });
  }
});

router.get('/curitiba-ecompras', auth, async (req, res) => {
  try {
    const {
      objeto = '',
      uf = '',
      cidade = '',
      tamanhoPagina = 20,
      dataInicio = '',
      dataFim = ''
    } = req.query;

    console.log('[e-Compras Curitiba] Iniciando busca:', { objeto, uf, cidade, tamanhoPagina });
    const result = await buscarCuritibaECompras({
      objeto,
      uf,
      cidade,
      tamanhoPagina: Number(tamanhoPagina),
      dataInicio,
      dataFim
    });
    const data = deduplicar(result.resultados || []);
    console.log('[e-Compras Curitiba] Resultado:', { 
      resultados: data.length, 
      errors: result.errors?.length || 0,
      erros: result.errors 
    });
    
    // ✅ Sempre retornar 200 se função retornou (sucesso, mesmo sem resultados)
    // ❌ 502 apenas se exceção não tratada
    return res.status(200).json({
      data,
      total: data.length,
      fonte: 'e-Compras Curitiba',
      erros: result.errors?.length ? result.errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[b2g-search] Erro e-Compras Curitiba:', err);
    return res.status(500).json({ error: 'Erro ao buscar no e-Compras Curitiba', data: [], total: 0 });
  }
});

// ─── GET /api/b2g-search/search ───────────────────────────────────────────────

router.get('/search', auth, async (req, res) => {
  const {
    objeto = '',
    uf = '',
    pagina = 1,
    tamanhoPagina = 20,
    dataInicio = '',
    dataFim = '',
    fontes = 'pncp,comprasnet',
    ordem = 'data_desc',
    incluirPropostas = 'true',
    apenasVigentes = 'false',
    cidade = '',
    codigoOrgao = '',
    termos = ''
  } = req.query;

  const fontesAtivas = String(fontes).toLowerCase().split(',').map(f => f.trim());

  try {
    const promises = [];

    if (fontesAtivas.includes('pncp')) {
      promises.push(
        buscarPNCPAgregado({
          objeto,
          uf,
          pagina: Number(pagina),
          tamanhoPagina: Number(tamanhoPagina),
          dataInicio,
          dataFim,
          incluirPropostas: incluirPropostas === 'true'
        })
          .catch(err => ({ resultados: [], errors: [`PNCP: ${err.message}`] }))
      );
    }

    if (fontesAtivas.includes('comprasnet')) {
      promises.push(
        buscarComprasNet({ objeto, uf, pagina: Number(pagina), tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim })
          .catch(err => ({ resultados: [], errors: [`ComprasNet: ${err.message}`] }))
      );
    }

    if (fontesAtivas.includes('dou')) {
      promises.push(
        buscarDOU({ objeto, termos, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim })
          .catch(err => ({ resultados: [], errors: [`Imprensa Nacional (DOU): ${err.message}`] }))
      );
    }

    if (fontesAtivas.includes('transparencia-curitiba')) {
      promises.push(
        buscarTransparenciaCuritiba({ objeto, uf, cidade, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim })
          .catch(err => ({ resultados: [], errors: [`Transparência Curitiba: ${err.message}`] }))
      );
    }

    if (fontesAtivas.includes('transparencia-federal')) {
      promises.push(
        buscarPortalTransparenciaFederal({ objeto, uf, dataInicio, dataFim, tamanhoPagina: Number(tamanhoPagina), codigoOrgao })
          .catch(err => ({ resultados: [], errors: [`Portal Transparência Federal: ${err.message}`] }))
      );
    }

    if (fontesAtivas.includes('curitiba-ecompras') || fontesAtivas.includes('curitiba') || fontesAtivas.includes('ecompras')) {
      promises.push(
        buscarCuritibaECompras({ objeto, uf, cidade, pagina: Number(pagina), tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim })
          .catch(err => ({ resultados: [], errors: [`e-Compras Curitiba: ${err.message}`] }))
      );
    }

    const settled = await Promise.allSettled(promises);

    const todosResultados = [];
    const todosErros = [];

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        todosResultados.push(...(r.value.resultados || []));
        todosErros.push(...(r.value.errors || []));
      } else {
        todosErros.push(r.reason?.message || 'Erro desconhecido');
      }
    }

    const deduplicados = deduplicar(todosResultados);
    const filtrados = apenasVigentes === 'true'
      ? deduplicados.filter(isEditalVigente)
      : deduplicados;
    const ordenados = ordenar(filtrados, ordem);

    // Estatísticas por fonte
    const porFonte = {};
    for (const item of filtrados) {
      porFonte[item.fonte] = (porFonte[item.fonte] || 0) + 1;
    }

    res.json({
      data: ordenados,
      total: ordenados.length,
      pagina: Number(pagina),
      fontes: porFonte,
      erros: todosErros.length > 0 ? todosErros : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[b2g-search] Erro geral:', err);
    res.status(500).json({ error: 'Erro ao buscar licitações', data: [], total: 0 });
  }
});

module.exports = router;
