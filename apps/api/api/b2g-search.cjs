/**
 * B2G Search API - Busca de Editais e Licitações
 * Agrega múltiplas fontes públicas gratuitas
 *
 * Fontes (10 workers):
 * 1.  pncp               — Portal Nacional de Contratações Públicas (API oficial)
 * 2.  comprasnet         — Portal de Compras do Governo Federal (SIASG legado)
 * 3.  dou               — Imprensa Nacional (DOU Seção 3)
 * 4.  curitiba-ecompras  — e-Compras Curitiba (HTTP/HTML com fallback PNCP)
 * 5.  transparencia-curitiba — Portal de Transparência de Curitiba
 * 6.  transparencia-federal  — Portal da Transparência Federal
 * 7.  contratacoes-14133 — Contratações Lei 14.133 (PNCP dados abertos)
 * 8.  atas-srp           — Atas de Registro de Preços (PNCP dados abertos)
 * 9.  pregoes-siasg      — Pregões SIASG / compras.gov.br
 * 10. comprasgov-disputas — Compras.gov.br Disputas em andamento
 */

const express = require('express');
const { resolveLocation, matchesLocation } = require('../lib/b2gLocation.cjs');
const router = express.Router();
const jwt = require('jsonwebtoken');
let itNoticeFilter;
async function loadITNoticeFilter() {
  itNoticeFilter ||= await import('../lib/itNoticeFilter.mjs');
  return itNoticeFilter;
}
const { AsyncLocalStorage } = require('node:async_hooks');
const sourceScope = new AsyncLocalStorage();
const upstreamFetch = global.fetch;
const fetch = (url, options = {}) => {
  const signal = sourceScope.getStore()?.signal;
  return upstreamFetch(url, { ...options, ...(signal ? { signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal } : {}) });
};
const { createDouEnricher } = require('../lib/douNotice.cjs');
const enrichDouNotice = createDouEnricher({ fetchImpl: fetch });

const JWT_SECRET = (() => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET precisa estar configurado');
  return secret;
})();

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

const toISODate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
  if (!/^\d{8}$/.test(text)) return null;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
};

const formatCurrency = (value) => {
  if (value == null || typeof value === 'boolean') return null;
  let text = String(value).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
};

// Preserva páginas já obtidas caso uma consulta posterior exceda o prazo do worker.
const recordSourceResults = (items) => {
  const scope = sourceScope.getStore();
  if (!scope || scope.signal.aborted) return;
  for (const item of items) {
    if (item.numeroControlePNCP && item.id) scope.partialResults.delete(String(item.id));
    scope.partialResults.set(String(item.numeroControlePNCP || item.id), item);
  }
};

const safeJson = async (res) => {
  try { return await res.json(); } catch { return null; }
};

// fetch com timeout + retry para erros transitórios de rede/5xx.
async function fetchWithRetry(url, options = {}, { timeoutMs = 45000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    // Mantém o controlador vivo até o prazo, inclusive durante a leitura do corpo.
    // O timer não impede o encerramento de processos de diagnóstico já concluídos.
    const deadline = setTimeout(() => controller.abort(new Error('Tempo limite de requisição ao portal excedido.')), timeoutMs);
    deadline.unref?.();
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        await res.body?.cancel();
        clearTimeout(deadline);
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(deadline);
      lastErr = err;
      if (sourceScope.getStore()?.signal.aborted) throw err;
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

const pncpPending = new Map();
async function fetchPNCPItems(url, label, options) {
  const key = url.toString();
  if (!pncpPending.has(key)) {
    // Vários workers consultam o mesmo endereço. Compartilhar a consulta evita
    // requisições duplicadas e o cancelamento de um worker não afeta os demais.
    const pending = sourceScope.run(undefined, () => loadPNCPItems(url, label, options))
      .finally(() => pncpPending.delete(key));
    pncpPending.set(key, pending);
  }
  return pncpPending.get(key);
}

async function loadPNCPItems(url, label, { timeoutMs = 9000 } = {}) {
  const cacheKey = url.toString();
  const fresh = getPNCPCache(cacheKey, PNCP_CACHE_TTL_MS);
  if (fresh) return fresh;

  if (isPNCPCircuitOpen()) {
    const stale = getPNCPCache(cacheKey, PNCP_STALE_TTL_MS);
    if (stale) return stale;
    throw new Error(`${label}: PNCP limitou temporariamente as consultas; tente novamente em instantes.`);
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
    if (res.status === 204) return [];

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      if (isPNCPRateLimitText(text)) {
        throw new Error('PNCP limitou requisições. Aguarde alguns instantes e tente novamente.');
      }
      throw new Error('PNCP retornou uma resposta não JSON.');
    }

    const data = await safeJson(res);
    if (!Array.isArray(data?.data)) throw new Error('PNCP retornou uma resposta sem lista de contratações.');
    const items = data.data;
    setPNCPCache(cacheKey, items);
    return items;
  } catch (err) {
    // Um timeout isolado não deve bloquear as demais modalidades e fontes.
    if (/limitou|HTTP 429|resposta não JSON/i.test(err.message)) openPNCPCircuit();
    const stale = getPNCPCache(cacheKey, PNCP_STALE_TTL_MS);
    if (stale) return stale;
    throw new Error(`${label}: ${err.message || 'falha na consulta'}`);
  }
}

const matchObjeto = (texto, objeto) => {
  if (itNoticeFilter) {
    return itNoticeFilter.isITNotice(texto) && itNoticeFilter.matchesProductQuery(texto, objeto);
  }
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
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`;
};

const isWithinDateRange = (dateValue, dataInicio, dataFim) => {
  if (!dateValue) return true;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return true;
  if (dataInicio) {
    const startTs = new Date(`${toISODate(dataInicio)?.slice(0, 10)}T00:00:00-03:00`).getTime();
    if (Number.isFinite(startTs) && ts < startTs) return false;
  }
  if (dataFim) {
    const endTs = new Date(`${toISODate(dataFim)?.slice(0, 10)}T23:59:59-03:00`).getTime();
    if (Number.isFinite(endTs) && ts > endTs) return false;
  }
  return true;
};

const CLOSED_STATUS_PATTERN = /(encerrad|cancelad|cancelamento|revogad|revoga[cç][aã]o|suspens|anulad|fracassad|desert|homologad|adjudicad|conclu[ií]d|exclu[ií]d|confirmado vencedor|autoriza[cç][aã]o de fornecimento gerada|aviso de resultado)/i;

const parseDateTime = (value, endOfDay = false) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (brMatch) {
    const iso = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T${brMatch[4] || (endOfDay ? '23' : '00')}:${brMatch[5] || (endOfDay ? '59' : '00')}:${brMatch[6] || (endOfDay ? '59' : '00')}`;
    const date = new Date(`${iso}-03:00`);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text.length === 10) {
    const date = new Date(`${text}T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text) ? `${text}-03:00` : text);
  return Number.isFinite(date.getTime()) ? date : null;
};

const isEditalVigente = (item, referenceTime = Date.now()) => {
  if (!item) return false;

  // 1. Se tem status explicitamente encerrado, rejeitar
  const status = String(item?.status || item?.situacao || item?.situacaoCompraNome || '').trim().toLowerCase();
  if (CLOSED_STATUS_PATTERN.test(status)) return false;

  // 2. Se tem data de encerramento, ela decide
  const encerramento = parseDateTime(item?.dataEncerramento || item?.dataEncerramentoProposta || item?.dataPrazo || item?.prazo, true);
  if (encerramento) return encerramento.getTime() >= referenceTime;

  // A sessão pública pode encerrar a participação. O início do recebimento de
  // propostas, sozinho, não significa que o edital expirou.
  const sessao = parseDateTime(item?.dataSessao || item?.dataHoraAberturaSessaoPublica, true);
  if (sessao) return sessao.getTime() >= referenceTime;

  // 4. Se tem data de publicação muito antiga (mais de 1 ano), rejeitar
  const publicacao = parseDateTime(item?.dataPublicacao, false);
  if (publicacao) {
    const UM_ANO = 365 * 24 * 60 * 60 * 1000;
    if (publicacao.getTime() < referenceTime - UM_ANO) return false;
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

const parseBRMoney = (value) => formatCurrency(cleanHtmlText(value));

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

const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins'
};
const normalizeSearchText = value => cleanHtmlText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const extractDouLocation = (item, text) => {
  const explicitUf = String(item.uf || item.ufSigla || '').toUpperCase();
  const municipio = firstText(item.municipio, item.cidade);
  if (UF_NAMES[explicitUf]) return { uf: explicitUf, municipio };
  const hierarchy = cleanHtmlText(Array.isArray(item.hierarchyList) ? item.hierarchyList.join(' / ') : item.hierarchyStr || '');
  const inferUf = value => {
    const normalized = normalizeSearchText(value);
    const declaredState = Object.entries(UF_NAMES).find(([, name]) => new RegExp(`estado\\s+(?:do|de|da)\\s+${normalizeSearchText(name)}(?=\\s*/|\\s*[-–]|$)`).test(normalized));
    if (declaredState) return declaredState[0];
    const matches = new Set();
    for (const [uf, name] of Object.entries(UF_NAMES)) {
      const nameMatches = uf === 'PA' ? /\bpará\b/i.test(value) || /estado\s+(?:do|de)\s+para\b/.test(normalized) : new RegExp(`\\b${normalizeSearchText(name)}\\b`).test(normalized);
      if (nameMatches
        || new RegExp(`(?:/|[-–]\\s*|\\()${uf}\\b|\\b${uf}\\)`, 'i').test(value)) matches.add(uf);
    }
    // Evita confundir Mato Grosso do Sul com Mato Grosso.
    if (matches.has('MS')) matches.delete('MT');
    return matches.size === 1 ? [...matches][0] : '';
  };
  const uf = inferUf(hierarchy) || inferUf(text);
  const cityMatch = `${hierarchy} ${text}`.match(/(?:prefeitura|munic[ií]pio|c[aâ]mara)(?:\s+municipal)?\s+(?:de|do|da)\s+([^,;.\n/]+?)(?=\s*[-–/(]|\s+(?:aviso|secretaria|estado|preg[aã]o)\b|$)/i);
  return { uf, municipio: municipio || cityMatch?.[1]?.trim() || '' };
};

const extractDouDeadline = (content) => {
  // Datas de publicação, assinatura e contratos não são prazos de participação.
  const text = cleanHtmlText(content);
  const matches = [...text.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
  for (const match of matches) {
    const context = text.slice(Math.max(0, match.index - 140), match.index);
    if (!/(?:abertura|sess[aã]o|recebimento\s+(?:das?\s+)?propostas|entrega\s+(?:das?\s+)?propostas|propostas\s+at[eé])[^.;]*$/i.test(context)) continue;
    if (/(?:a partir de|in[ií]cio d[oa] recebimento)[^.;]*$/i.test(context)) continue;
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const time = after.match(/(?:[aà]s|[aà])\s*(\d{1,2})(?::|h)(\d{2})?/i);
    const date = parseDateTime(`${match[1]}${time ? ` ${time[1].padStart(2, '0')}:${time[2] || '00'}` : ''}`, !time);
    if (date) return date.toISOString();
  }
  return null;
};

const extractDouValue = content => {
  const match = cleanHtmlText(content).match(/valor\s+(?:(?:total|global|estimado|m[aá]ximo|da\s+contrata[cç][aã]o|de\s+refer[eê]ncia)\s*)+[^.;]{0,80}?R\$\s*([\d.]+(?:,\d{2})?)/i);
  return match ? parseBRMoney(match[1]) : null;
};

async function mapWithConcurrency(items, concurrency, fn) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      if (sourceScope.getStore()?.signal.aborted) break;
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }));
  return results.filter(Boolean);
}

// A busca do DOU retorna os resultados dentro de um script JSON da página oficial.
async function buscarDOU({ objeto, termos = '', uf = '', cidade = '', dataInicio, dataFim, tamanhoPagina = 20 }) {
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
      // O portal combina palavras soltas por OR. Consultar a localização primeiro
      // evita que resultados nacionais ocupem toda a primeira página.
      url.searchParams.set('q', cidade || UF_NAMES[String(uf).toUpperCase()] || query);
      url.searchParams.set('s', 'do3');
      url.searchParams.set('exactDate', 'personalizado');
      url.searchParams.set('sortType', '0');
      url.searchParams.set('delta', String(limit <= 20 ? 20 : limit <= 50 ? 50 : 100));
      url.searchParams.set('publishFrom', toBRDate(start).replaceAll('/', '-'));
      url.searchParams.set('publishTo', toBRDate(end).replaceAll('/', '-'));

      for (let page = 1; page <= 4 && resultados.length < limit; page++) {
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
        if (!jsonText) throw new Error('resposta sem resultados estruturados');
        const items = JSON.parse(jsonText).jsonArray;
        if (!Array.isArray(items)) throw new Error('resposta sem resultados estruturados');

        const notices = await mapWithConcurrency(items, 4, async item => {
          const title = cleanHtmlText(item.title || 'Publicação no DOU');
          const content = cleanHtmlText(item.content || '');
          if (!objeto?.trim() && terms.length === 0 && (!/aviso|edital|chamada|chamamento|leil[aã]o/i.test(title)
            || !/licita[cç][aã]o|preg[aã]o|concorr[eê]ncia|dispensa|chamamento p[uú]blico|chamada p[uú]blica|leil[aã]o/i.test(`${title} ${content}`))) return null;
          const publicationDate = normalizeDateText(item.pubDate) || item.pubDate || null;
          if (!isWithinDateRange(publicationDate, dataInicio, dataFim)) return null;
          let fullContent = content;
          let articleHtml = '';
          const link = item.urlTitle ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}` : DOU_SEARCH_URL;
          let location = extractDouLocation(item, `${title} ${content}`);
          if (item.urlTitle && (!uf || !location.uf || location.uf === String(uf).toUpperCase())
            && ((uf && !location.uf) || (cidade && !location.municipio) || !extractDouDeadline(content) || !extractDouValue(content))) {
            try {
              const detail = await fetchWithRetry(link, { headers: { Accept: 'text/html', 'User-Agent': PNCP_HEADERS['User-Agent'] } }, { timeoutMs: 4000, retries: 0 });
              if (!detail.ok) throw new Error(`HTTP ${detail.status}`);
              const detailHtml = await detail.text();
              const article = detailHtml.match(/<(?:div|article)[^>]*class=["'][^"']*texto-dou[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article)>/i)?.[1];
              if (!article) throw new Error('conteúdo da publicação não encontrado');
              articleHtml = article;
              fullContent = cleanHtmlText(article);
              location = extractDouLocation(item, `${title} ${fullContent}`);
            } catch (err) {
              errors.push(`DOU: não foi possível completar os dados de ${item.classPK || title}: ${err.message}`);
            }
          }
          if ((objeto?.trim() || terms.length) && !matchObjeto(`${title} ${fullContent}`, query)) return null;
          const notice = {
            id: `dou-${item.classPK || sourceId(item.urlTitle, title, item.pubDate)}`,
            fonte: 'Imprensa Nacional (DOU)',
            fonteLogo: '📰',
            titulo: fullContent.match(/\bobjeto\s*:\s*([\s\S]+?)(?=\s+(?:total de itens|edital\s*:|entrega das propostas|abertura|valor estimado)|$)/i)?.[1]?.trim() || title,
            tituloPublicacao: title,
            orgao: Array.isArray(item.hierarchyList) ? item.hierarchyList.join(' / ') : cleanHtmlText(item.hierarchyStr || ''),
            modalidade: fullContent.match(/\b(?:preg[aã]o(?:\s+eletr[oô]nico)?|concorr[eê]ncia(?:\s+eletr[oô]nica)?|dispensa(?:\s+eletr[oô]nica)?|leil[aã]o)\b/i)?.[0] || cleanHtmlText(item.artType || 'Publicação DOU'),
            ...location,
            valor: extractDouValue(fullContent),
            dataPublicacao: publicationDate,
            dataAbertura: null,
            dataEncerramento: extractDouDeadline(fullContent),
            numero: `${title} ${fullContent}`.match(/\bN[º°o.]?\s*([\d./-]+)/i)?.[1] || '',
            ano: String(item.pubDate || '').match(/\b(20\d{2})\b/)?.[1] || '',
            link,
            status: CLOSED_STATUS_PATTERN.test(title) || /homologa[cç][aã]o|adjudica[cç][aã]o|resultado de julgamento/i.test(title) ? `Encerrado — ${title}` : 'Publicado no DOU',
            resumo: fullContent
          };
          recordSourceResults([notice]);
          const enrichment = await enrichDouNotice(notice, { article: articleHtml, signal: sourceScope.getStore()?.signal });
          Object.assign(notice, enrichment.dados);
          errors.push(...enrichment.diagnosticos.map(item => `${item.fonte}: ${item.mensagem}`));
          recordSourceResults([notice]);
          return notice;
        });
        resultados.push(...notices.slice(0, limit - resultados.length));
        const totalPages = Number(html.match(/totalPages\s*:\s*(\d+)/)?.[1]) || 1;
        const currentPage = Number(html.match(/currentPage\s*:\s*(\d+)/)?.[1]) || page;
        const last = items.at(-1);
        if (currentPage >= totalPages || !last) break;
        url.searchParams.set('currentPage', String(currentPage));
        url.searchParams.set('newPage', String(currentPage + 1));
        url.searchParams.set('id', String(last.classPK));
        url.searchParams.set('score', String(last.score));
        url.searchParams.set('displayDate', String(last.displayDateSortable));
      }
    } catch (err) {
      errors.push(`Imprensa Nacional (DOU): ${err.message || 'falha na consulta'}`);
    }
  }

  return { resultados: deduplicar(resultados), errors };
}

async function buscarPNCPPublicacao({ objeto, uf, cidade = '', pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, modalidades = [6, 8, 9, 4, 5], codigoMunicipioIbge = '', esfera = '', somenteAbertas = false }) {
  const resultados = [];
  const errors = [];
  const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(30);
  const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  const page = clampNumber(pagina, 1, 500, 1);
  const startedAt = Date.now();

  const normalize = (items, label) => items
    .filter(item => matchesLocation({ uf: item.unidadeOrgao?.ufSigla, municipio: item.unidadeOrgao?.municipioNome }, { uf, cidade }))
    .filter(item => (!somenteAbertas || (item.dataEncerramentoProposta && new Date(item.dataEncerramentoProposta).getTime() >= Date.now())) && (!esfera || item.orgaoEntidade?.esferaId === esfera) && matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
    .map(item => ({
      id: item.numeroControlePNCP || `pncp-${item.anoCompra}-${item.numeroCompra}-${item.orgaoEntidade?.cnpj}`,
      fonte: 'PNCP',
      fonteLogo: '🏛️',
      titulo: item.objetoCompra || 'Sem descrição',
      orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
      cnpjOrgao: item.orgaoEntidade?.cnpj || '',
      esfera: item.orgaoEntidade?.esferaId || '',
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
      anoCompra: item.anoCompra,
      sequencialCompra: item.sequencialCompra,
      linkSistemaOrigem: item.linkSistemaOrigem || '',
      linkProcessoEletronico: item.linkProcessoEletronico || '',
      documentos: item.documentos || item.arquivos || [],
      link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
      status: item.situacaoCompraNome || 'Publicado',
      situacaoCodigo: item.codigoSituacaoCompra
    }));

  const fetchPublicacao = async ({ modCode = '', pageNumber = page } = {}) => {
    const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
    url.searchParams.set('dataInicial', dataI);
    url.searchParams.set('dataFinal', dataF);
    url.searchParams.set('pagina', pageNumber);
    url.searchParams.set('tamanhoPagina', '50');
    if (codigoMunicipioIbge) url.searchParams.set('codigoMunicipioIbge', codigoMunicipioIbge);
    if (modCode) url.searchParams.set('codigoModalidadeContratacao', modCode);
    if (uf) url.searchParams.set('uf', uf);

    const label = modCode ? `PNCP modalidade ${modCode}` : 'PNCP publicações';
    const items = await fetchPNCPItems(url, label, { timeoutMs: 5000 });
    return { items, notices: normalize(items, label) };
  };

  // Cada modalidade avança pelas páginas brutas: o filtro de TI pode excluir
  // toda a primeira página sem que a consulta esteja vazia.
  await mapWithConcurrency(modalidades, 2, async modCode => {
    for (let pageNumber = page; pageNumber < page + 3; pageNumber++) {
      if (resultados.length >= limit || Date.now() - startedAt > 11000) break;
      try {
        const { items, notices } = await fetchPublicacao({ modCode, pageNumber });
        resultados.push(...notices.slice(0, limit - resultados.length));
        recordSourceResults(resultados);
        if (items.length < 50) break;
      } catch (err) { errors.push(err.message); break; }
    }
  });

  return { resultados, errors };
}

// ─── PNCP - Propostas (em andamento) ─────────────────────────────────────────

async function buscarPNCPProposta({ objeto, uf, cidade = '', codigoMunicipioIbge = '', pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [];
  const errors = [];

  try {
    const url = new URL(`${PNCP_BASE}/contratacoes/proposta`);
    // dataFinal limita o encerramento das propostas, não sua publicação.
    // O período de publicação escolhido é aplicado aos registros abaixo.
    const horizonte = new Date(); horizonte.setDate(horizonte.getDate() + 90);
    url.searchParams.set('dataFinal', horizonte.toISOString().slice(0, 10).replaceAll('-', ''));
    url.searchParams.set('pagina', pagina);
    url.searchParams.set('tamanhoPagina', '50');
    if (uf) url.searchParams.set('uf', uf);
    if (codigoMunicipioIbge) url.searchParams.set('codigoMunicipioIbge', codigoMunicipioIbge);

    const items = await fetchPNCPItems(url, 'PNCP propostas', { timeoutMs: 8000 });

    for (const item of items) {
      if (!matchesLocation({ uf: item.unidadeOrgao?.ufSigla, municipio: item.unidadeOrgao?.municipioNome }, { uf, cidade })) continue;
      if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto)) continue;
      if (!isWithinDateRange(item.dataPublicacaoPncp, dataInicio, dataFim)) continue;

      resultados.push({
        id: `pncp-prop-${item.numeroControlePNCP || item.anoCompra + item.numeroCompra + item.orgaoEntidade?.cnpj}`,
        fonte: 'PNCP',
        fonteLogo: '🏛️',
        titulo: item.objetoCompra || 'Sem descrição',
        orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
        cnpjOrgao: item.orgaoEntidade?.cnpj || '',
      esfera: item.orgaoEntidade?.esferaId || '',
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
      anoCompra: item.anoCompra,
      sequencialCompra: item.sequencialCompra,
      linkSistemaOrigem: item.linkSistemaOrigem || '',
      linkProcessoEletronico: item.linkProcessoEletronico || '',
      documentos: item.documentos || item.arquivos || [],
        link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
        status: 'Em proposta',
        situacaoCodigo: item.codigoSituacaoCompra
      });
      if (resultados.length >= clampNumber(tamanhoPagina, 10, 50, 20)) break;
    }
    recordSourceResults(resultados);
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

const normalizeDadosAbertosPNCP = (item, { objeto, uf, cidade = '' }) => {
  if (!matchesLocation({ uf: item.unidadeOrgaoUfSigla, municipio: item.unidadeOrgaoMunicipioNome }, { uf, cidade })) return null;
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
    idCompra: item.idCompra,
    srp: item.srp,
    sequencialCompra: item.sequencialCompraPncp,
    anoCompra: item.anoCompraPncp,
    linkSistemaOrigem: item.linkSistemaOrigem || (item.idCompra ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${item.idCompra}` : ''),
    documentos: item.documentos || item.arquivos || [],
    link: pncpLink(item.orgaoEntidadeCnpj, item.anoCompraPncp, item.sequencialCompraPncp),
    status: item.situacaoCompraNomePncp || 'Divulgada no PNCP',
    situacaoCodigo: item.situacaoCompraIdPncp
  };
};

async function buscarPNCPDadosAbertos({ objeto, uf, cidade = '', pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, modalidades = DADOS_ABERTOS_PNCP_MODALIDADES.pncp, codigoMunicipioIbge = '', esfera = '', permitirFallback = true, somenteAbertas = false }) {
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

    for (let page = Math.max(1, Number(pagina) || 1); page < Math.max(1, Number(pagina) || 1) + MAX_PAGES && resultados.length < limit; page++) {
      try {
        const url = new URL(DADOS_ABERTOS_CONTRATACOES_URL);
        url.searchParams.set('pagina', String(page));
        url.searchParams.set('tamanhoPagina', String(PAGE_SIZE));
        url.searchParams.set('dataPublicacaoPncpInicial', dataI);
        url.searchParams.set('dataPublicacaoPncpFinal', dataF);
        url.searchParams.set('codigoModalidade', String(codigoModalidade));
        if (uf) url.searchParams.set('unidadeOrgaoUfSigla', uf);
        if (codigoMunicipioIbge) url.searchParams.set('unidadeOrgaoCodigoIbge', codigoMunicipioIbge);

        const res = await fetchWithRetry(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'NexosCRM/2.0'
          }
        }, { timeoutMs: 5000, retries: 0 });

        if (!res.ok) {
          const text = cleanHtmlText(await res.text().catch(() => '')).slice(0, 120);
          errors.push(`PNCP Dados Abertos modalidade ${codigoModalidade}: HTTP ${res.status}${text ? ` - ${text}` : ''}`);
          break;
        }

        const payload = await safeJson(res);
        if (!Array.isArray(payload?.resultado)) throw new Error('Resposta inválida da fonte: lista resultado ausente.');
        const items = payload.resultado;
        if (items.length === 0) break;

        for (const item of items) {
          if (esfera && item.orgaoEntidadeEsferaId !== esfera) continue;
          if (somenteAbertas && !(item.dataEncerramentoPropostaPncp && new Date(item.dataEncerramentoPropostaPncp).getTime() >= Date.now())) continue;
          const normalized = normalizeDadosAbertosPNCP(item, { objeto, uf, cidade });
          if (normalized) resultados.push(normalized);
          if (resultados.length >= limit) break;
        }
        recordSourceResults(resultados);
        if (items.length < PAGE_SIZE || (payload.totalPaginas != null && page >= payload.totalPaginas)) break;
      } catch (err) {
        errors.push(`PNCP Dados Abertos modalidade ${codigoModalidade}: ${err.message || 'falha na consulta'}`);
        break;
      }
    }
  }

  if (!resultados.length && permitirFallback) {
    // Compras.gov usa códigos SIASG (5/6); PNCP usa 6/8 para pregão/dispensa.
    const pncpModalidades = [...new Set(modalidades.map(code => ({ 5: 6, 6: 8 })[code]).filter(Boolean))];
    const alternative = await buscarPNCPPublicacao({ objeto, uf, cidade, pagina, tamanhoPagina, dataInicio, dataFim,
      modalidades: pncpModalidades, codigoMunicipioIbge, esfera, somenteAbertas });
    return { ...alternative, fallback: 'PNCP', warnings: [...errors, 'Compras.gov.br sem registros correspondentes; consulta alternativa no PNCP.'] };
  }

  return { resultados, errors };
}

async function buscarPNCPAgregado({ objeto, uf, cidade = '', codigoMunicipioIbge = '', pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, incluirPropostas = true, apenasVigentes = false }) {
  const resultados = [];
  const errors = [];
  const warnings = [];
  let fallback = null;
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  // Quando apenasVigentes=true, prioriza o endpoint /proposta que filtra por
  // dataEncerramentoProposta >= hoje — garante apenas editais com prazo futuro.
  if (apenasVigentes || incluirPropostas) {
    // Usa janela de 60 dias para capturar editais publicados há mais tempo mas ainda vigentes
    const dataInicioPropostas = dataInicio || diasAtras(60);
    const propostas = await buscarPNCPProposta({ objeto, uf, cidade, codigoMunicipioIbge, pagina, tamanhoPagina: limit, dataInicio: dataInicioPropostas, dataFim });
    resultados.push(...(propostas.resultados || []));
    errors.push(...(propostas.errors || []));
  }

  // Complementa com publicações recentes se ainda não atingiu o limite
  if (resultados.length < limit) {
    const publicacoes = await buscarPNCPPublicacao({ objeto, uf, cidade, codigoMunicipioIbge, pagina, tamanhoPagina: limit - resultados.length, dataInicio, dataFim });
    // Adiciona apenas os que não foram já incluídos
    const existingIds = new Set(resultados.map(r => r.numeroControlePNCP || r.id));
    for (const item of (publicacoes.resultados || [])) {
      if (!existingIds.has(item.numeroControlePNCP || item.id)) {
        resultados.push(item);
      }
    }
    if (errors.length && publicacoes.resultados?.length && !publicacoes.errors?.length) {
      warnings.push(...errors.splice(0));
      fallback = 'PNCP publicações';
    }
    errors.push(...(publicacoes.errors || []));
  }

  // Se ainda vazio, tenta dados abertos como último recurso
  if (resultados.length === 0) {
    const dadosAbertos = await buscarPNCPDadosAbertos({ objeto, uf, cidade, codigoMunicipioIbge, pagina, tamanhoPagina: limit, dataInicio, dataFim, permitirFallback: false });
    resultados.push(...(dadosAbertos.resultados || []));
    errors.push(...(dadosAbertos.errors || []));
  }

  return { resultados, errors, warnings, fallback };
}

// Paginação de dados abertos acontece antes dos filtros locais de produto/UF.
async function* dadosAbertosPages(url, label) {
  const first = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
  url.searchParams.set('tamanhoPagina', '500');
  for (let page = first; page < first + 3; page++) {
    url.searchParams.set('pagina', String(page));
    const res = await fetchWithRetry(url.toString(), { headers: PNCP_HEADERS }, { timeoutMs: 5000, retries: 0 });
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    const payload = await safeJson(res);
    if (!Array.isArray(payload?.resultado)) throw new Error(`${label}: lista resultado ausente.`);
    yield payload.resultado;
    if (payload.resultado.length < 500 || (payload.totalPaginas != null && page >= payload.totalPaginas)) break;
  }
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

const uasgLocationCache = new Map();
async function getUasgLocation(code) {
  if (!/^\d{1,10}$/.test(String(code || ''))) return { uf: '', municipio: '' };
  const key = String(Number(code));
  const cached = uasgLocationCache.get(key);
  if (cached && Date.now() - cached.createdAt < 3600000) return cached.location;
  const url = new URL('https://dadosabertos.compras.gov.br/modulo-uasg/1_consultarUasg');
  url.searchParams.set('codigoUasg', String(code));
  url.searchParams.set('statusUasg', 'true');
  const res = await fetchWithRetry(url, { headers: PNCP_HEADERS }, { timeoutMs: 4000, retries: 0 });
  if (!res.ok) throw new Error(`Cadastro UASG HTTP ${res.status}`);
  const data = await safeJson(res);
  if (!Array.isArray(data?.resultado)) throw new Error('Cadastro UASG retornou resposta inválida.');
  const item = data.resultado.find(item => Number(item.codigoUasg) === Number(code));
  const location = { uf: String(item?.siglaUf || '').toUpperCase(), municipio: item?.nomeMunicipioIbge || '' };
  if (location.uf) {
    uasgLocationCache.set(key, { location, createdAt: Date.now() });
    if (uasgLocationCache.size > 500) uasgLocationCache.delete(uasgLocationCache.keys().next().value);
  }
  return location;
}

async function buscarComprasNet({ objeto, uf, cidade = '', codigoMunicipioIbge = '', pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, modalidade = '' }) {
  const resultados = [];
  const errors = [];

  try {
    const url = new URL('https://dadosabertos.compras.gov.br/modulo-legado/1_consultarLicitacao');
    url.searchParams.set('data_publicacao_inicial', toISODate(dataInicio || diasAtras(30)) || toISODate(diasAtras(30)));
    url.searchParams.set('data_publicacao_final', toISODate(dataFim || hoje()) || toISODate(hoje()));
    url.searchParams.set('pagina', String(Math.max(1, Math.min(Number(pagina) || 1, 500))));
    url.searchParams.set('tamanhoPagina', String(Math.max(10, Math.min(Number(tamanhoPagina) || 20, 500))));

    if (modalidade) url.searchParams.set('modalidade', modalidade);
    for await (const items of dadosAbertosPages(url, 'ComprasNet legado')) {
      for (const item of items) {
        if (!matchObjeto(`${item.objeto} ${item.informacoes_gerais}`, objeto)) continue;
        let location = { uf: extractUfFromAddress(item.endereco_entrega_edital), municipio: extractMunicipioFromAddress(item.endereco_entrega_edital) };
        if ((uf && !location.uf) || (cidade && !location.municipio)) {
          try { location = await getUasgLocation(item.uasg); } catch (err) { errors.push(`ComprasNet: ${err.message}`); }
        }
        const itemUf = location.uf;
        if (!matchesLocation(location, { uf, cidade })) continue;
        if (!isWithinDateRange(item.data_publicacao, dataInicio, dataFim)) continue;
        if (!matchObjeto(`${item.objeto} ${item.informacoes_gerais}`, objeto)) continue;

        resultados.push({
          id: `comprasnet-${item.id_compra || item.identificador || Math.random()}`,
          fonte: 'ComprasNet',
          fonteLogo: '🇧🇷',
          titulo: item.objeto || 'Sem descrição',
          orgao: item.nome_orgao || `UASG ${item.uasg || ''}`.trim(),
          cnpjOrgao: '',
          idCompra: item.id_compra,
          codigoUasg: item.uasg,
          documentos: item.documentos || item.arquivos || [],
          linkSistemaOrigem: item.linkSistemaOrigem || (item.id_compra ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${item.id_compra}` : ''),
          modalidade: item.nome_modalidade || '',
          uf: itemUf,
          municipio: location.municipio,
          valor: formatCurrency(item.valor_estimado_total || item.valor_homologado_total),
          dataPublicacao: item.data_publicacao || null,
          dataAbertura: toISODate(item.data_abertura_proposta) || item.data_abertura_proposta || null,
          dataEncerramento: null,
          numero: String(item.numero_aviso || ''),
          ano: String(item.id_compra || '').slice(-4),
          link: item.linkSistemaOrigem || (item.id_compra ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${item.id_compra}` : 'https://www.gov.br/compras/pt-br/acesso-a-informacao/consulta-licitacoes'),
          status: item.situacao_aviso || 'Publicado'
        });
        recordSourceResults(resultados);
        if (resultados.length >= clampNumber(tamanhoPagina, 10, 50, 20)) break;
      }
      if (resultados.length >= clampNumber(tamanhoPagina, 10, 50, 20)) break;
    }
  } catch (err) {
    errors.push(`ComprasNet legado: ${err.message}`);
  }

  if (resultados.length === 0) {
    const fallback = await buscarPNCPDadosAbertos({
      objeto,
      uf,
      cidade,
      codigoMunicipioIbge,
      pagina,
      tamanhoPagina,
      dataInicio,
      dataFim,
      modalidades: modalidade === '5' ? DADOS_ABERTOS_PNCP_MODALIDADES.pregoes : DADOS_ABERTOS_PNCP_MODALIDADES.licitacao
    });

    resultados.push(...(fallback.resultados || []).map(item => ({
      ...item,
      fonte: 'ComprasNet',
      fonteLogo: '🇧🇷'
    })));

    return { ...fallback, resultados, fallback: fallback.fallback || 'Compras.gov.br', warnings: [...errors, ...(fallback.warnings || [])] };
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
        fonte: item.fonte,
        fonteLogo: item.fonteLogo || '🏙️'
      })),
      errors: transparencia.errors || [],
      fallback: transparencia.fallback || 'Transparência Curitiba',
      warnings: [...diagnostics, ...(transparencia.warnings || [])]
    };
  }

  const fallback = await buscarPNCPCuritibaFallback({ objeto, dataInicio, dataFim, tamanhoPagina: limit });
  if (fallback.resultados?.length > 0) {
    return {
      resultados: fallback.resultados.slice(0, limit).map(item => ({
        ...item,
        fonte: item.fonte,
        fonteLogo: item.fonteLogo || '🏙️'
      })),
      errors: fallback.errors || [],
      fallback: 'PNCP', warnings: [...diagnostics, ...(fallback.warnings || [])]
    };
  }

  return {
    resultados: [],
    errors: fallback.errors || [], fallback: 'PNCP',
    warnings: [...diagnostics, ...(transparencia.errors || []), ...(fallback.warnings || [])]
  };
}

// ─── e-Compras Curitiba - Fallback via PNCP ──────────────────────────────────
// Quando o portal de Curitiba bloqueia acesso programático (Akamai 403),
// busca no PNCP as publicações cujo órgão esteja no município de Curitiba/PR.
async function buscarPNCPCuritibaFallback({ objeto, dataInicio, dataFim, tamanhoPagina = 20, fonte = 'e-Compras Curitiba (PNCP)' }) {
  const result = await buscarPNCPPublicacao({ objeto, uf: 'PR', cidade: 'Curitiba', dataInicio, dataFim, tamanhoPagina,
    codigoMunicipioIbge: '4106902', modalidades: [6, 8, 4, 9, 5] });
  return { ...result, resultados: result.resultados.filter(item => normalizeSearchText(item.municipio) === 'curitiba')
    .map(item => ({ ...item, fonte, fonteLogo: '🏙️' })), fallback: 'PNCP' };
}

// ─── Transparência Curitiba - Licitações e contratações ──────────────────────

const curitibaFormFields = (html) => {
  const fields = new URLSearchParams();
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const name = tag.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name || /type=["'](?:checkbox|radio|submit|button)["']/i.test(tag)) continue;
    fields.set(decodeHtmlEntities(name), decodeHtmlEntities(tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] || ''));
  }
  for (const match of html.matchAll(/<select\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi)) {
    const options = [...match[2].matchAll(/<option\b([^>]*)>/gi)];
    const selected = options.find(option => /\bselected\b/i.test(option[1])) || options[0];
    fields.set(decodeHtmlEntities(match[1]), decodeHtmlEntities(selected?.[1].match(/\bvalue=["']([^"']*)["']/i)?.[1] || ''));
  }
  return fields;
};

const parseTransparenciaCuritiba = (html) => {
  const table = html.match(/<table[^>]*id=["']cphMasterPrincipal_gdvLicitacao["'][\s\S]*?<\/table>/i)?.[0];
  if (!table) {
    if (/nenhum registro|n[aã]o (?:foram )?encontrad/i.test(cleanHtmlText(html))) return [];
    throw new Error('Tabela de licitações ausente na resposta do portal.');
  }
  return [...table.matchAll(/<tr\b[^>]*class=["'][^"']*grid_(?:Row|AlternatingRow)[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)].map(([, rowHtml]) => {
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => cleanHtmlText(cell[1]));
    if (cells.length !== 10) throw new Error(`Estrutura da tabela mudou: ${cells.length} colunas, esperadas 10.`);
    const [numero, modalidade, orgao, titulo, valorText, local, publicacaoText, aberturaText, protocolo, status] = cells;
    const abertura = normalizeDateText(aberturaText);
    return {
      id: `transparencia-curitiba-${sourceId(numero, protocolo, orgao)}`,
      fonte: 'Transparência Curitiba', fonteLogo: '🏙️', titulo: titulo || 'Licitação sem descrição',
      orgao, modalidade, uf: 'PR', municipio: 'Curitiba', valor: parseBRMoney(valorText),
      dataPublicacao: normalizeDateText(publicacaoText),
      dataAbertura: abertura,
      dataSessao: abertura && !/\d{2}:\d{2}/.test(aberturaText) ? abertura.slice(0, 10) : abertura,
      dataEncerramento: null, numero, ano: numero.match(/\b(20\d{2})\b/)?.[1] || '',
      protocolo, link: TRANSPARENCIA_CURITIBA_URL, status, local
    };
  });
};

const parseCuritibaAsyncResponse = (body, previousHtml) => {
  if (!/^\d+\|/.test(body)) return body;
  const fields = curitibaFormFields(previousHtml);
  const panels = [];
  let offset = 0;
  while (offset < body.length) {
    const lengthEnd = body.indexOf('|', offset);
    const typeEnd = body.indexOf('|', lengthEnd + 1);
    const idEnd = body.indexOf('|', typeEnd + 1);
    const length = Number(body.slice(offset, lengthEnd));
    if (lengthEnd < 0 || typeEnd < 0 || idEnd < 0 || !Number.isInteger(length) || length < 0 || body[idEnd + 1 + length] !== '|') throw new Error('Resposta assíncrona do portal inválida.');
    const type = body.slice(lengthEnd + 1, typeEnd);
    const id = body.slice(typeEnd + 1, idEnd);
    const content = body.slice(idEnd + 1, idEnd + 1 + length);
    offset = idEnd + length + 2;
    if (type === 'updatePanel') panels.push(content);
    if (type === 'hiddenField') fields.set(id, content);
    if (type === 'error' || type === 'pageRedirect') throw new Error(`Consulta do portal: ${cleanHtmlText(content).slice(0, 180)}`);
  }
  const escapeAttribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return [...fields].map(([name, value]) => `<input name="${escapeAttribute(name)}" value="${escapeAttribute(value)}">`).join('') + panels.join('\n');
};

async function buscarTransparenciaCuritiba({ objeto, uf, cidade, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const resultados = [];
  const errors = [];
  const directDeadline = Date.now() + 9000;

  if (uf && String(uf).toUpperCase() !== 'PR') return { resultados, errors };
  if (cidade && !String(cidade).toLowerCase().includes('curitiba')) return { resultados, errors };

  try {
    const headers = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' };
    const cookies = new Map();
    const readPage = async (fields) => {
      const remainingMs = directDeadline - Date.now();
      if (remainingMs <= 0) throw new Error('Consulta direta excedeu o prazo reservado; consultando a alternativa oficial.');
      const res = await fetchWithRetry(TRANSPARENCIA_CURITIBA_URL, {
        headers: { ...headers, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...(fields?.get('__ASYNCPOST') === 'true' ? { 'X-MicrosoftAjax': 'Delta=true', 'X-Requested-With': 'XMLHttpRequest', Referer: TRANSPARENCIA_CURITIBA_URL } : {}),
          ...(cookies.size ? { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}) },
        ...(fields ? { method: 'POST', body: fields.toString() } : {})
      }, { timeoutMs: Math.min(5000, remainingMs), retries: 0 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const cookie of res.headers.getSetCookie?.() || []) {
        const pair = cookie.split(';')[0]; const index = pair.indexOf('=');
        if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      const body = await res.text();
      return fields ? parseCuritibaAsyncResponse(body, html) : body;
    };
    let html = await readPage();
    const supportsAsync = /PageRequestManager\._initialize/.test(html);
    const postFields = (target) => {
      const fields = curitibaFormFields(html);
      if (!fields.has('__VIEWSTATE') || !fields.has('__EVENTVALIDATION')) throw new Error('Formulário de consulta ausente na resposta do portal.');
      fields.set('__EVENTTARGET', target);
      fields.set('__EVENTARGUMENT', '');
      if (fields.has('ctl00$smaMasterPrincipal') && supportsAsync) {
        fields.set('ctl00$smaMasterPrincipal', `ctl00$cphMasterPrincipal$uplGrid|${target}`);
        fields.set('__ASYNCPOST', 'true');
      }
      fields.set('ctl00$cphMasterPrincipal$txtAnoProcesso', '');
      fields.set('ctl00$cphMasterPrincipal$txtDataInicial', toBRDate(dataInicio || diasAtras(30)));
      fields.set('ctl00$cphMasterPrincipal$txtDataFinal', toBRDate(dataFim || hoje()));
      fields.set('ctl00$cphMasterPrincipal$txtObjeto', objeto || '');
      return fields;
    };
    html = await readPage(postFields('ctl00$cphMasterPrincipal$lnbPesquisar'));
    const limit = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 100));
    for (let page = 1; page <= 3; page++) {
      const rows = parseTransparenciaCuritiba(html)
        .filter(item => matchObjeto(`${item.titulo} ${item.orgao} ${item.modalidade} ${item.protocolo}`, objeto))
        .filter(item => isWithinDateRange(item.dataPublicacao || item.dataSessao, dataInicio, dataFim));
      resultados.push(...rows.slice(0, limit - resultados.length));
      recordSourceResults(resultados);
      if (resultados.length >= limit) break;
      const target = `ctl00$cphMasterPrincipal$ucPaginadorBaixo$${page + 1}_pg${page + 1}`;
      if (page === 3 || !decodeHtmlEntities(html).includes(`__doPostBack('${target}'`)) break;
      html = await readPage(postFields(target));
    }

    return { resultados, errors };
  } catch (err) {
    errors.push(`Transparência Curitiba: ${err.message}`);
  }

  if (resultados.length === 0) {
    const alternative = await buscarPNCPCuritibaFallback({ objeto, dataInicio, dataFim, tamanhoPagina, fonte: 'Transparência Curitiba (PNCP)' });
    return { ...alternative, warnings: errors };
  }

  return { resultados, errors };
}

// ─── Portal da Transparência Federal - API oficial da CGU ────────────────────

async function buscarPortalTransparenciaFederalFallback(params) {
  const result = await buscarPNCPDadosAbertos({ ...params, esfera: 'F' });
  return { ...result, fallback: result.fallback || 'Compras.gov.br', resultados: result.resultados.map(item => ({
    ...item, fonte: `${result.fallback || 'Compras.gov.br'} (alternativa à Transparência Federal)`, fonteLogo: '🔎'
  })) };
}

async function buscarPortalTransparenciaFederal({ objeto, uf, cidade = '', codigoMunicipioIbge = '', dataInicio, dataFim, tamanhoPagina = 20, codigoOrgao = '' }) {
  const resultados = [];
  const token = String(process.env.PORTAL_TRANSPARENCIA_TOKEN || process.env.PORTAL_TRANSPARENCIA_API_KEY || '').trim();
  const orgao = String(codigoOrgao || process.env.PORTAL_TRANSPARENCIA_CODIGO_ORGAO || '').trim();

  if (!token) {
    const fallback = await buscarPortalTransparenciaFederalFallback({ objeto, uf, cidade, codigoMunicipioIbge, dataInicio, dataFim, tamanhoPagina });
    return { ...fallback, warnings: ['Portal da Transparência: chave de API não configurada; consultada a fonte pública alternativa.', ...(fallback.warnings || [])] };
  }

  const alternative = async warning => {
    const result = await buscarPortalTransparenciaFederalFallback({ objeto, uf, cidade, codigoMunicipioIbge, dataInicio, dataFim, tamanhoPagina });
    return { ...result, warnings: [warning, ...(result.warnings || [])] };
  };
  if (uf || cidade) return alternative('Consulta por localização realizada na fonte oficial alternativa.');
  if (!orgao) return alternative('Portal Transparência Federal: órgão não configurado; consultada a fonte pública alternativa.');

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
      return alternative(`Portal Transparência Federal: HTTP ${res.status}; consultada a fonte pública alternativa.`);
    }

    const data = await safeJson(res);
    if (!Array.isArray(data) && !Array.isArray(data?.data)) throw new Error('Resposta inválida: lista de licitações ausente.');
    const items = Array.isArray(data) ? data : data.data;

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
    return alternative(`Portal Transparência Federal: ${err.message}; consultada a fonte pública alternativa.`);
  }
}

// ─── Deduplicação ─────────────────────────────────────────────────────────────

function deduplicar(items) {
  const merged = new Map();
  for (const item of items) {
    const key = String(item.numeroControlePNCP || item.id || `${item.titulo}-${item.orgao}`);
    const previous = merged.get(key);
    if (!previous) { merged.set(key, { ...item, origens: item.origens || [] }); continue; }
    const origins = [...(previous.origens || []), ...(item.origens || [])];
    previous.origens = Array.from(new Map(origins.map(origin => [`${origin.id}:${origin.url}`, origin])).values());
    previous.documentos = [...(previous.documentos || []), ...(item.documentos || [])];
    for (const field of ['idCompra', 'linkAtaPNCP', 'linkCompraPNCP', 'numeroControlePncpAta', 'uf', 'municipio', 'dataEncerramento', 'dataSessao', 'dataPublicacao']) {
      if (!previous[field] && item[field]) previous[field] = item[field];
    }
    if (formatCurrency(previous.valor) == null && formatCurrency(item.valor) != null) previous.valor = formatCurrency(item.valor);
    if (!previous.linkSistemaOrigem && item.linkSistemaOrigem) previous.linkSistemaOrigem = item.linkSistemaOrigem;
    if (!previous.linkProcessoEletronico && item.linkProcessoEletronico) previous.linkProcessoEletronico = item.linkProcessoEletronico;
  }
  return Array.from(merged.values());
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
        if (a.valor == null || b.valor == null) return a.valor == null ? (b.valor == null ? 0 : 1) : -1;
        return b.valor - a.valor;
      case 'valor_asc':
        if (a.valor == null || b.valor == null) return a.valor == null ? (b.valor == null ? 0 : 1) : -1;
        return a.valor - b.valor;
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
    fontes: WORKER_CATALOG.map(worker => ({ ...worker, status: 'disponivel' }))
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

const publicationPeriod = (start = '', end = '') => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const parse = value => {
    if (!value) return '';
    const text = String(value).trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(new Date(`${text}T12:00:00Z`).getTime()) || new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) !== text) {
      throw Object.assign(new Error('Informe datas de publicação válidas.'), { status: 400 });
    }
    return text;
  };
  const dataInicio = parse(start);
  const requestedEnd = parse(end) || today;
  const dataFim = requestedEnd > today ? today : requestedEnd;
  if (dataInicio && dataInicio > dataFim) throw Object.assign(new Error('A data inicial de publicação deve ser anterior ou igual à data final e não pode estar no futuro.'), { status: 400 });
  return { dataInicio, dataFim, avisoPeriodo: requestedEnd > today ? 'A data final de publicação foi ajustada para hoje; editais ainda não publicados não entram na consulta.' : '' };
};

// ─── GET /api/b2g-search/search ───────────────────────────────────────────────

// Catálogo completo dos 10 workers disponíveis.
// Usado tanto pelo endpoint /workers quanto pelo /search para normalizar IDs.
const WORKER_CATALOG = [
  { id: 'pncp',                  nome: 'PNCP Oficial',               tipo: 'API',      logo: '🏛️',  descricao: 'Portal Nacional de Contratações Públicas — modalidades oficiais' },
  { id: 'comprasnet',            nome: 'ComprasNet / Compras.gov.br', tipo: 'API',      logo: '🇧🇷',  descricao: 'Portal de Compras do Governo Federal (SIASG legado)' },
  { id: 'transparencia-federal', nome: 'Transparência Federal',       tipo: 'API',      logo: '🔎',  descricao: 'Portal da Transparência Federal — contratos e licitações' },
  { id: 'dou',                   nome: 'Imprensa Nacional (DOU)',     tipo: 'HTTP/HTML', logo: '📰',  descricao: 'Avisos, editais e contratações da Seção 3 do Diário Oficial da União' },
  { id: 'curitiba-ecompras',     nome: 'e-Compras Curitiba',         tipo: 'Scraper',  logo: '🏙️',  descricao: 'Portal de Compras Eletrônicas do Município de Curitiba' },
  { id: 'transparencia-curitiba',nome: 'Transparência Curitiba',     tipo: 'Scraper',  logo: '🏢',  descricao: 'Portal de Transparência da Prefeitura de Curitiba' },
  { id: 'contratacoes-14133',    nome: 'Contratações Lei 14.133',    tipo: 'API',      logo: '⚖️',  descricao: 'Contratações diretas e dispensas eletrônicas via PNCP (Lei 14.133/2021)' },
  { id: 'atas-srp',              nome: 'Atas de Registro de Preços', tipo: 'API',      logo: '📋',  descricao: 'Atas de Registro de Preços — módulo ARP do Compras.gov.br' },
  { id: 'pregoes-siasg',         nome: 'Pregões SIASG',              tipo: 'API',      logo: '🔧',  descricao: 'Pregões eletrônicos publicados no SIASG / compras.gov.br' },
  { id: 'comprasgov-disputas',   nome: 'Compras.gov Disputas',       tipo: 'API',      logo: '⚡',  descricao: 'Compras.gov.br — licitações com disputa aberta ou em andamento' },
];

// ─── Worker: Contratações Lei 14.133 (dispensas eletrônicas + diretas) ─────────

async function buscarContratacoes14133(params) {
  const result = await buscarPNCPDadosAbertos({ ...params, modalidades: DADOS_ABERTOS_PNCP_MODALIDADES.contratacoes14133 });
  return { ...result, resultados: result.resultados.map(item => ({ ...item, fonte: 'Contratações Lei 14.133', fonteLogo: '⚖️' })) };
}

// ─── Worker: Atas de Registro de Preços (modalidade 9 — SRP) ─────────────────

async function buscarAtasPNCP({ objeto, uf, cidade, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [], errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  for (let page = Math.max(1, Number(pagina) || 1); page < Math.max(1, Number(pagina) || 1) + 3 && resultados.length < limit; page++) {
    const url = new URL(`${PNCP_BASE}/atas/atualizacao`);
    url.searchParams.set('dataInicial', String(dataInicio || diasAtras(60)).replaceAll('-', ''));
    url.searchParams.set('dataFinal', String(dataFim || hoje()).replaceAll('-', ''));
    url.searchParams.set('pagina', String(page)); url.searchParams.set('tamanhoPagina', '100');
    try {
      const items = await fetchPNCPItems(url, 'Atas PNCP', { timeoutMs: 12000 });
      const notices = await mapWithConcurrency(items.filter(item => !item.cancelado && isWithinDateRange(item.dataPublicacaoPncp || item.dataAssinatura, dataInicio, dataFim) && matchObjeto(item.objetoContratacao, objeto)), 4, async item => {
        let compra = {};
        const ref = String(item.numeroControlePNCPCompra || '').match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
        if ((uf || cidade) && ref) {
          try {
            const res = await fetchWithRetry(`${PNCP_BASE}/orgaos/${ref[1]}/compras/${ref[3]}/${Number(ref[2])}`, { headers: PNCP_HEADERS }, { timeoutMs: 3000, retries: 0 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            compra = await safeJson(res) || {};
          } catch (err) { errors.push(`Localização da ata ${item.numeroAtaRegistroPreco}: ${err.message}`); }
        }
        const ata = String(item.numeroControlePNCPAta || '').match(/-(\d+)$/)?.[1];
        const linkCompraPNCP = ref ? pncpLink(ref[1], ref[3], Number(ref[2])) : '';
        const notice = { id: `arp-${item.numeroControlePNCPAta}`, fonte: 'Atas de Registro de Preços (PNCP)', fonteLogo: '📋', isSRP: true,
          numeroControlePNCP: item.numeroControlePNCPCompra, numeroControlePncpAta: item.numeroControlePNCPAta,
          titulo: item.objetoContratacao, orgao: item.nomeOrgao || item.nomeUnidadeOrgao || '', cnpjOrgao: item.cnpjOrgao,
          uf: compra.unidadeOrgao?.ufSigla || '', municipio: compra.unidadeOrgao?.municipioNome || '',
          dataPublicacao: item.dataPublicacaoPncp || item.dataAssinatura || item.vigenciaInicio,
          dataEncerramento: item.vigenciaFim, valor: null, numero: item.numeroAtaRegistroPreco,
          linkCompraPNCP, linkAtaPNCP: ref && ata ? `https://pncp.gov.br/app/atas/${ref[1]}/${ref[3]}/${Number(ref[2])}/${Number(ata)}` : '',
          status: 'Ata de Registro de Preços', documentos: [] };
        notice.link = notice.linkAtaPNCP || linkCompraPNCP;
        if (uf && notice.uf !== uf) return null;
        if (cidade && !normalizeSearchText(notice.municipio).includes(normalizeSearchText(cidade))) return null;
        recordSourceResults([notice]); return notice;
      });
      resultados.push(...notices.filter(Boolean).slice(0, limit - resultados.length));
      if (items.length < 100) break;
    } catch (err) { errors.push(err.message); break; }
  }
  return { resultados, errors, fallback: 'PNCP' };
}

async function buscarAtasSRP({ objeto, uf, cidade, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const url = new URL('https://dadosabertos.compras.gov.br/modulo-arp/1_consultarARP');
  url.searchParams.set('pagina', String(Math.max(1, Number(pagina))));
  url.searchParams.set('tamanhoPagina', String(clampNumber(tamanhoPagina, 10, 500, 40)));
  url.searchParams.set('dataVigenciaInicialMin', toDadosAbertosDate(dataInicio, diasAtras(60)));
  url.searchParams.set('dataVigenciaInicialMax', toDadosAbertosDate(dataFim, hoje()));
  const resultados = [], errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);
  try {
    for await (const items of dadosAbertosPages(url, 'Atas SRP')) {
      const notices = await mapWithConcurrency(items.filter(item => matchObjeto(item.objeto || item.objetoCompra || item.objetoAta, objeto)
        && isWithinDateRange(item.dataAssinatura || item.dataVigenciaInicial, dataInicio, dataFim)), 4, async item => {
        let location = { uf: item.unidadeOrgaoUfSigla || '', municipio: item.unidadeOrgaoMunicipioNome || '' };
        if ((uf && !location.uf) || (cidade && !location.municipio)) {
          try { location = await getUasgLocation(item.codigoUnidadeGerenciadora); }
          catch (err) { errors.push(`Atas SRP: ${err.message}`); }
        }
        // Só atas do recorte solicitado consomem o limite desta fonte.
        if (uf && String(location.uf).toUpperCase() !== String(uf).toUpperCase()) return null;
        if (cidade && !normalizeSearchText(location.municipio).includes(normalizeSearchText(cidade))) return null;
        const notice = {
          ...item, id: `arp-${item.numeroControlePncpAta || item.idAta || item.numeroAtaRegistroPreco || item.id}`,
          fonte: 'Atas de Registro de Preços', fonteLogo: '📋', isSRP: true,
          titulo: item.objeto || item.objetoCompra || item.objetoAta || 'Ata de Registro de Preços',
          orgao: item.nomeUnidadeGerenciadora || item.orgaoEntidadeRazaoSocial || item.nomeOrgao || '',
          ...location,
          numeroControlePNCP: item.numeroControlePNCPCompra || item.numeroControlePncpCompra || '',
          valor: formatCurrency(item.valorTotal || item.valorTotalEstimado),
          dataPublicacao: item.dataAssinatura || item.dataVigenciaInicial,
          dataEncerramento: item.dataVigenciaFinal,
          link: item.linkAtaPNCP || item.linkCompraPNCP || item.linkSistemaOrigem || 'https://www.gov.br/compras/pt-br/atas-de-registro-de-precos',
          status: item.ataExcluido ? 'Ata excluída' : item.statusAta || 'Ata de Registro de Preços'
        };
        recordSourceResults([notice]);
        return notice;
      });
      resultados.push(...notices.filter(Boolean).slice(0, limit - resultados.length));
      if (resultados.length >= limit) break;
    }
  } catch (err) { errors.push(err.message); }
  if (!resultados.length) {
    const alternative = await buscarAtasPNCP({ objeto, uf, cidade, pagina, tamanhoPagina, dataInicio, dataFim });
    return { ...alternative, warnings: [...errors, 'Compras.gov.br sem atas correspondentes; consulta alternativa no PNCP.'] };
  }
  return { resultados, errors };
}

// ─── Worker: Pregões SIASG (compras.gov.br — dados abertos) ──────────────────

async function buscarPregoesSIASG(params) {
  const result = await buscarComprasNet({ ...params, modalidade: '5' });
  return { ...result, resultados: result.resultados.map(item => ({ ...item, fonte: 'Pregões SIASG', fonteLogo: '🔧' })) };
}

// ─── Worker: Compras.gov.br Disputas em andamento ────────────────────────────

async function buscarComprasGovDisputas(params) {
  const result = await buscarPNCPDadosAbertos({ ...params, modalidades: DADOS_ABERTOS_PNCP_MODALIDADES.pregoes, somenteAbertas: true });
  return { ...result, resultados: result.resultados.filter(item => item.dataEncerramento && new Date(item.dataEncerramento).getTime() >= Date.now())
    .map(item => ({ ...item, fonte: 'Compras.gov Disputas', fonteLogo: '⚡' })) };
}

// ─── Rastreamento de status dos workers em memória ───────────────────────────

const workerStatus = new Map();
let workerRunSequence = 0;

const setWorkerStatus = (id, updates) => {
  const prev = workerStatus.get(id) || { id, status: 'idle', lastRunAt: null, lastError: null, totalResults: 0 };
  if (updates.runId && prev.runId > updates.runId) return;
  workerStatus.set(id, { ...prev, ...updates, updatedAt: new Date().toISOString() });
};

const wrapWorker = async (id, fn, ...args) => {
  const controller = new AbortController();
  const scope = { signal: controller.signal, partialResults: new Map() };
  const startedAt = Date.now();
  const runId = ++workerRunSequence;
  const timeoutMs = Math.max(1000, Math.min(Number(process.env.B2G_SOURCE_TIMEOUT_MS) || 22000, 22000));
  let timer;
  setWorkerStatus(id, { status: 'running', runId, lastError: null });
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Tempo limite de consulta desta fonte excedido.')); }, timeoutMs);
    });
    const result = await Promise.race([sourceScope.run(scope, () => fn(...args)), timeout]);
    const resultados = (result.resultados || []).map(item => ({ ...item, sourceId: id,
      origens: [{ id, nome: item.fonte || id, url: item.linkSistemaOrigem || item.link || '' }] }));
    const status = result.errors?.length ? (resultados.length ? 'partial' : 'error') : result.fallback ? 'fallback' : 'ok';
    const snapshot = { id, runId, status, lastRunAt: new Date().toISOString(), lastError: result.errors?.[0] || null, totalResults: resultados.length, fallback: result.fallback || null, warnings: result.warnings || [], durationMs: Date.now() - startedAt };
    setWorkerStatus(id, snapshot);
    return { ...result, resultados, fonteStatus: snapshot };
  } catch (err) {
    const resultados = [...scope.partialResults.values()].map(item => ({ ...item, sourceId: id,
      origens: [{ id, nome: item.fonte || id, url: item.linkSistemaOrigem || item.link || '' }] }));
    const snapshot = { id, runId, status: resultados.length ? 'partial' : 'error', lastRunAt: new Date().toISOString(), lastError: err.message, totalResults: resultados.length, durationMs: Date.now() - startedAt };
    setWorkerStatus(id, snapshot);
    return { resultados, errors: [`${id}: ${err.message}`], fonteStatus: snapshot };
  } finally { clearTimeout(timer); }
};

// ─── GET /api/b2g-search/workers ─────────────────────────────────────────────

router.get('/workers', auth, (req, res) => {
  const catalog = WORKER_CATALOG.map(w => ({
    ...w,
    ...(workerStatus.get(w.id) || { status: 'idle', lastRunAt: null, lastError: null, totalResults: 0 }),
  }));
  res.json({ workers: catalog, executionMode: 'on-demand', statusStorage: 'process-memory', timestamp: new Date().toISOString() });
});

// ─── GET /api/b2g-search/search ───────────────────────────────────────────────

router.get('/search', auth, async (req, res) => {
  const {
    objeto = '',
    filtroProdutosAtivo = 'true',
    produtosInteresse = '',
    uf: requestedUf = '',
    pagina = 1,
    tamanhoPagina = 20,
    dataInicio: requestedStart = '',
    dataFim: requestedEnd = '',
    fontes = '',
    ordem = 'data_desc',
    incluirPropostas = 'true',
    apenasVigentes = 'false',
    cidade: requestedCity = '',
    codigoOrgao = '',
    termos = '',
    dataReferencia = ''
  } = req.query;

  // Fontes explicitamente enviadas. Se string vazia ou "none", retorna sem resultados.
  const fontesRaw = String(fontes).trim().toLowerCase();
  if (!fontesRaw || fontesRaw === 'none') {
    return res.json({
      data: [], total: 0, pagina: Number(pagina), fontes: {},
      info: 'Nenhuma fonte selecionada. Ative ao menos uma fonte para buscar editais.',
      timestamp: new Date().toISOString()
    });
  }

  const fontesAtivas = new Set(fontesRaw.split(',').map(f => f.trim()).filter(Boolean));
  if (filtroProdutosAtivo === 'false' && !String(objeto).trim()) {
    return res.json({ data: [], total: 0, info: 'Digite um produto de TI para buscar editais ou ative a descoberta automática em Configurações.' });
  }


  try {
    const { dataInicio, dataFim, avisoPeriodo } = publicationPeriod(requestedStart, requestedEnd);
    const { uf, cidade, codigoMunicipioIbge } = resolveLocation({ uf: requestedUf, cidade: requestedCity });
    const ti = await loadITNoticeFilter();
    const interestProducts = ti.sanitizeInterestProducts(produtosInteresse);
    const promises = [];
    const params = { objeto, uf, cidade, codigoMunicipioIbge, pagina: Number(pagina), tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim };

    if (fontesAtivas.has('pncp')) {
      promises.push(wrapWorker('pncp', buscarPNCPAgregado, {
        ...params,
        incluirPropostas: incluirPropostas === 'true',
        apenasVigentes: apenasVigentes === 'true'
      }));
    }

    if (fontesAtivas.has('comprasnet')) {
      promises.push(wrapWorker('comprasnet', buscarComprasNet, params));
    }

    if (fontesAtivas.has('dou')) {
      promises.push(wrapWorker('dou', buscarDOU, { objeto, termos, uf, cidade, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim }));
    }

    if (fontesAtivas.has('transparencia-curitiba')) {
      promises.push(wrapWorker('transparencia-curitiba', buscarTransparenciaCuritiba, { objeto, uf, cidade, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim }));
    }

    if (fontesAtivas.has('transparencia-federal')) {
      promises.push(wrapWorker('transparencia-federal', buscarPortalTransparenciaFederal, { ...params, codigoOrgao }));
    }

    if (fontesAtivas.has('curitiba-ecompras') || fontesAtivas.has('curitiba') || fontesAtivas.has('ecompras')) {
      promises.push(wrapWorker('curitiba-ecompras', buscarCuritibaECompras, { objeto, uf, cidade, pagina: Number(pagina), tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim }));
    }

    if (fontesAtivas.has('contratacoes-14133')) {
      promises.push(wrapWorker('contratacoes-14133', buscarContratacoes14133, params));
    }

    if (fontesAtivas.has('atas-srp')) {
      promises.push(wrapWorker('atas-srp', buscarAtasSRP, params));
    }

    if (fontesAtivas.has('pregoes-siasg')) {
      promises.push(wrapWorker('pregoes-siasg', buscarPregoesSIASG, params));
    }

    if (fontesAtivas.has('comprasgov-disputas')) {
      promises.push(wrapWorker('comprasgov-disputas', buscarComprasGovDisputas, params));
    }

    const settled = await Promise.allSettled(promises);

    const todosResultados = [];
    const todosErros = [];
    const statusFontes = [];

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        todosResultados.push(...(r.value.resultados || []));
        todosErros.push(...(r.value.errors || []));
        if (r.value.fonteStatus) statusFontes.push({ ...r.value.fonteStatus, nome: WORKER_CATALOG.find(w => w.id === r.value.fonteStatus.id)?.nome || r.value.fonteStatus.id });
      } else {
        todosErros.push(r.reason?.message || 'Erro desconhecido');
      }
    }

    const deduplicados = deduplicar(todosResultados);
    const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const referenceTime = dataReferencia && dataReferencia !== localToday ? (parseDateTime(dataReferencia)?.getTime() || Date.now()) : Date.now();
    const motivos = new Map();
    const filtrados = deduplicados.filter(item => {
      let motivo;
      if (uf && String(item.uf || '').toUpperCase() !== String(uf).toUpperCase()) motivo = item.uf ? 'uf' : 'semUf';
      else if (cidade && !matchesLocation(item, { cidade })) motivo = (item.municipio || item.cidade) ? 'cidade' : 'semCidade';
      else if (!isWithinDateRange(item.dataPublicacao, dataInicio, dataFim)) motivo = 'periodo';
      else if (apenasVigentes === 'true' && !isEditalVigente(item, referenceTime)) motivo = 'encerrados';
      else if (!ti.isITNotice(item)) motivo = 'foraTI';
      else if (!ti.matchesProductQuery(item, objeto)) motivo = 'produto';
      if (motivo) motivos.set(item, motivo);
      return !motivo;
    });
    const diagnosticoFiltros = { coletados: todosResultados.length, unicos: deduplicados.length, exibidos: filtrados.length, excluidos: {} };
    for (const motivo of motivos.values()) diagnosticoFiltros.excluidos[motivo] = (diagnosticoFiltros.excluidos[motivo] || 0) + 1;
    for (const source of statusFontes) {
      const fromSource = item => item.origens?.some(origin => origin.id === source.id);
      source.returnedResults = filtrados.filter(fromSource).length;
      source.filteredOut = {};
      for (const [item, motivo] of motivos) if (fromSource(item)) source.filteredOut[motivo] = (source.filteredOut[motivo] || 0) + 1;
      setWorkerStatus(source.id, source);
    }
    const ordenados = ordenar(filtrados, ordem);

    // Estatísticas por fonte
    const porFonte = {};
    for (const item of filtrados) {
      for (const fonte of new Set((item.origens?.length ? item.origens : [{ nome: item.fonte }]).map(origin => origin.nome))) {
        porFonte[fonte] = (porFonte[fonte] || 0) + 1;
      }
    }

    res.json({
      data: ordenados.map(item => ({ ...item, classificacaoTI: {
        ...ti.classifyITNotice(item),
        produtosInteresse: filtroProdutosAtivo === 'false' ? [] : ti.getInterestMatches(item, interestProducts)
      } })),
      total: ordenados.length,
      pagina: Number(pagina),
      fontes: porFonte,
      statusFontes,
      diagnosticoFiltros,
      periodoConsulta: { dataInicio, dataFim },
      avisoPeriodo: avisoPeriodo || undefined,
      fontesConsultadas: statusFontes.map(source => source.id),
      erros: todosErros.length > 0 ? todosErros : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message, data: [], total: 0, statusFontes: [] });
    console.error('[b2g-search] Erro geral:', err);
    res.status(500).json({ error: 'Erro ao buscar licitações', data: [], total: 0 });
  }
});

module.exports = router;
