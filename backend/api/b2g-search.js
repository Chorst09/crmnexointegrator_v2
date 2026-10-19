/**
 * B2G Search API - Busca de Editais e Licitações
 * Agrega múltiplas fontes públicas gratuitas
 *
 * Fontes (10 workers):
 * 1.  pncp               — Portal Nacional de Contratações Públicas (API oficial)
 * 2.  comprasnet         — Portal de Compras do Governo Federal (SIASG legado)
 * 3.  dou               — Imprensa Nacional (DOU Seção 3)
 * 4.  curitiba-ecompras  — e-Compras Curitiba (Playwright/HTTP scraper)
 * 5.  transparencia-curitiba — Portal de Transparência de Curitiba
 * 6.  transparencia-federal  — Portal da Transparência Federal
 * 7.  contratacoes-14133 — Contratações Lei 14.133 (PNCP dados abertos)
 * 8.  atas-srp           — Atas de Registro de Preços (PNCP dados abertos)
 * 9.  pregoes-siasg      — Pregões SIASG / compras.gov.br
 * 10. comprasgov-disputas — Compras.gov.br Disputas em andamento
 */

const express = require('express');
const router = express.Router();
const { createTIProductMatcher } = require('../../apps/api/lib/tiProductFilter.cjs');
const jwt = require('jsonwebtoken');

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

// ─── Buscar Documentos/PDFs do PNCP ──────────────────────────────────────────

// A busca traz metadados; os anexos completos são consultados ao abrir o edital.
// Páginas do processo não são arquivos e não devem ser rotuladas como edital completo.
function extrairDocumentosDosDetalhes(item) {
  const documentos = [];
  const seen = new Set();
  const addFile = (url, titulo, tipo) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || !/\.(?:pdf|zip|docx?|xlsx?|odt|ods|rar)(?:[?#]|$)/i.test(url) || seen.has(url)) return;
    seen.add(url);
    documentos.push({ titulo, url, tipo });
  };
  addFile(item.linkEdital, 'Edital', 'Edital');
  addFile(item.linkSistemaOrigem, 'Documento do sistema de origem', 'Documento');
  addFile(item.linkProcessoEletronico, 'Documento do processo eletrônico', 'Documento');
  const pdfLinks = String(item.informacaoComplementar || '').match(/https?:\/\/[^\s"<>]+\.pdf(?:\?[^\s"<>]*)?/gi) || [];
  pdfLinks.forEach((url, idx) => addFile(url, `Anexo ${idx + 1}`, 'Anexo'));
  return documentos;
}

/**
 * Extrai link de PDF do edital a partir dos dados do PNCP
 * Prioriza: linkEdital > linkSistemaOrigem com .pdf
 */
function extrairPdfUrlPNCP(item) {
  if (item.linkEdital && /\.pdf/i.test(item.linkEdital)) {
    return item.linkEdital;
  }
  if (item.linkSistemaOrigem && /\.pdf/i.test(item.linkSistemaOrigem)) {
    return item.linkSistemaOrigem;
  }
  return null;
}

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

  const normalize = async (items, label) => {
    const filtered = items.filter(item => 
      matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto)
    );
    
    const results = filtered.map(item => {
      // LOG: Verificar estrutura do item antes de extrair
      console.log('[DEBUG normalize buscarPNCPPublicacao] Item:', {
        numeroControlePNCP: item.numeroControlePNCP,
        linkSistemaOrigem: item.linkSistemaOrigem ? 'PRESENTE' : 'AUSENTE',
        linkProcessoEletronico: item.linkProcessoEletronico ? 'PRESENTE' : 'AUSENTE',
        informacaoComplementar: item.informacaoComplementar ? 'PRESENTE' : 'AUSENTE',
        todasChaves: Object.keys(item).slice(0, 15).join(', ')
      });
      
      // Extrair documentos diretamente dos dados disponíveis
      const documentos = extrairDocumentosDosDetalhes(item);
      console.log('[DEBUG normalize buscarPNCPPublicacao] Docs extraídos:', documentos.length);
      
      return {
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
        situacaoCodigo: item.codigoSituacaoCompra,
        documentos: documentos,
        pdfUrl: extrairPdfUrlPNCP(item)
      };
    });
    
    return results;
  };

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
    return await normalize(items, label);
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

      // LOG: Verificar estrutura do item antes de extrair
      console.log('[DEBUG buscarPNCPProposta] Item recebido:', {
        numeroControlePNCP: item.numeroControlePNCP,
        linkSistemaOrigem: item.linkSistemaOrigem ? 'PRESENTE' : 'AUSENTE',
        linkProcessoEletronico: item.linkProcessoEletronico ? 'PRESENTE' : 'AUSENTE',
        informacaoComplementar: item.informacaoComplementar ? 'PRESENTE (length: ' + item.informacaoComplementar.length + ')' : 'AUSENTE',
        todasChaves: Object.keys(item).join(', ')
      });

      // Extrair documentos diretamente dos dados disponíveis
      const documentos = extrairDocumentosDosDetalhes(item);
      console.log('[DEBUG buscarPNCPProposta] Documentos extraídos:', documentos.length);

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
        situacaoCodigo: item.codigoSituacaoCompra,
        documentos: documentos,
        pdfUrl: extrairPdfUrlPNCP(item)
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

  // Extrair documentos diretamente dos dados disponíveis
  const documentos = extrairDocumentosDosDetalhes(item);

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
    situacaoCodigo: item.situacaoCompraIdPncp,
    documentos: documentos,
    pdfUrl: extrairPdfUrlPNCP(item)
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

async function buscarPNCPAgregado({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim, incluirPropostas = true, apenasVigentes = false }) {
  const resultados = [];
  const errors = [];
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  // Quando apenasVigentes=true, prioriza o endpoint /proposta que filtra por
  // dataEncerramentoProposta >= hoje — garante apenas editais com prazo futuro.
  if (apenasVigentes || incluirPropostas) {
    // Usa janela de 60 dias para capturar editais publicados há mais tempo mas ainda vigentes
    const dataInicioPropostas = dataInicio || diasAtras(60);
    const propostas = await buscarPNCPProposta({ objeto, uf, pagina, tamanhoPagina: limit, dataInicio: dataInicioPropostas, dataFim });
    resultados.push(...(propostas.resultados || []));
    errors.push(...(propostas.errors || []));
  }

  // Complementa com publicações recentes se ainda não atingiu o limite
  if (resultados.length < limit) {
    const publicacoes = await buscarPNCPPublicacao({ objeto, uf, pagina, tamanhoPagina: limit - resultados.length, dataInicio, dataFim });
    // Adiciona apenas os que não foram já incluídos
    const existingIds = new Set(resultados.map(r => r.numeroControlePNCP || r.id));
    for (const item of (publicacoes.resultados || [])) {
      if (!existingIds.has(item.numeroControlePNCP || item.id)) {
        resultados.push(item);
      }
    }
    errors.push(...(publicacoes.errors || []));
  }

  // Se ainda vazio, tenta dados abertos como último recurso
  if (resultados.length === 0) {
    const dadosAbertos = await buscarPNCPDadosAbertos({ objeto, uf, pagina, tamanhoPagina: limit, dataInicio, dataFim });
    resultados.push(...(dadosAbertos.resultados || []));
    errors.push(...(dadosAbertos.errors || []));
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

// Catálogo completo dos 10 workers disponíveis.
// Usado tanto pelo endpoint /workers quanto pelo /search para normalizar IDs.
const WORKER_CATALOG = [
  { id: 'pncp',                  nome: 'PNCP Oficial',               tipo: 'API',      logo: '🏛️',  descricao: 'Portal Nacional de Contratações Públicas — modalidades oficiais' },
  { id: 'comprasnet',            nome: 'ComprasNet / Compras.gov.br', tipo: 'API',      logo: '🇧🇷',  descricao: 'Portal de Compras do Governo Federal (SIASG legado)' },
  { id: 'transparencia-federal', nome: 'Transparência Federal',       tipo: 'API',      logo: '🔎',  descricao: 'Portal da Transparência Federal — contratos e licitações' },
  { id: 'dou',                   nome: 'Imprensa Nacional (DOU)',     tipo: 'RSS/API',  logo: '📰',  descricao: 'Avisos, editais e contratações da Seção 3 do Diário Oficial da União' },
  { id: 'curitiba-ecompras',     nome: 'e-Compras Curitiba',         tipo: 'Scraper',  logo: '🏙️',  descricao: 'Portal de Compras Eletrônicas do Município de Curitiba' },
  { id: 'transparencia-curitiba',nome: 'Transparência Curitiba',     tipo: 'Scraper',  logo: '🏢',  descricao: 'Portal de Transparência da Prefeitura de Curitiba' },
  { id: 'contratacoes-14133',    nome: 'Contratações Lei 14.133',    tipo: 'API',      logo: '⚖️',  descricao: 'Contratações diretas e dispensas eletrônicas via PNCP (Lei 14.133/2021)' },
  { id: 'atas-srp',              nome: 'Atas de Registro de Preços', tipo: 'API',      logo: '📋',  descricao: 'Atas SRP publicadas no PNCP — modalidade 9 (Pregão SRP)' },
  { id: 'pregoes-siasg',         nome: 'Pregões SIASG',              tipo: 'API',      logo: '🔧',  descricao: 'Pregões eletrônicos publicados no SIASG / compras.gov.br' },
  { id: 'comprasgov-disputas',   nome: 'Compras.gov Disputas',       tipo: 'API',      logo: '⚡',  descricao: 'Compras.gov.br — licitações com disputa aberta ou em andamento' },
];

// ─── Worker: Contratações Lei 14.133 (dispensas eletrônicas + diretas) ─────────

async function buscarContratacoes14133({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  // Modalidades PNCP para contratações diretas: 8 = Dispensa eletrônica, 9 = Inexigibilidade, 13 = Compra direta
  const MODALIDADES_DIRETAS = [8, 13];
  const resultados = [];
  const errors = [];
  const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(30);
  const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  for (const mod of MODALIDADES_DIRETAS) {
    if (resultados.length >= limit) break;
    try {
      const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
      url.searchParams.set('dataInicial', dataI);
      url.searchParams.set('dataFinal', dataF);
      url.searchParams.set('pagina', String(Math.max(1, Number(pagina))));
      url.searchParams.set('tamanhoPagina', String(Math.min(50, limit)));
      url.searchParams.set('codigoModalidadeContratacao', String(mod));
      if (uf) url.searchParams.set('uf', uf.toUpperCase());

      const items = await fetchPNCPItems(url.toString(), `Contratações 14.133 mod ${mod}`, { timeoutMs: 9000 });
      for (const item of items) {
        if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto)) continue;
        resultados.push({
          id: item.numeroControlePNCP || `14133-${mod}-${item.anoCompra}-${item.sequencialCompra}`,
          fonte: 'Contratações Lei 14.133',
          fonteLogo: '⚖️',
          titulo: item.objetoCompra || 'Sem descrição',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
          cnpjOrgao: item.orgaoEntidade?.cnpj || '',
          modalidade: item.modalidadeNome || 'Contratação Direta',
          uf: item.unidadeOrgao?.ufSigla || uf || '',
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: formatCurrency(item.valorTotalEstimado),
          dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
          dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
          dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
          numero: item.numeroCompra || '',
          ano: item.anoCompra || '',
          numeroControlePNCP: item.numeroControlePNCP || '',
          link: item.linkSistemaOrigem || pncpLink(item.orgaoEntidade?.cnpj, item.anoCompra, item.sequencialCompra),
          status: item.situacaoCompraNome || 'Publicado',
        });
        if (resultados.length >= limit) break;
      }
    } catch (err) {
      errors.push(`Contratações 14.133 modalidade ${mod}: ${err.message}`);
    }
  }
  return { resultados, errors };
}

// ─── Worker: Atas de Registro de Preços (modalidade 9 — SRP) ─────────────────

async function buscarAtasSRP({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  const resultados = [];
  const errors = [];
  const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(60);
  const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  try {
    // Modalidade 9 = Pregão Eletrônico SRP
    const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
    url.searchParams.set('dataInicial', dataI);
    url.searchParams.set('dataFinal', dataF);
    url.searchParams.set('pagina', String(Math.max(1, Number(pagina))));
    url.searchParams.set('tamanhoPagina', String(Math.min(50, limit)));
    url.searchParams.set('codigoModalidadeContratacao', '6'); // Pregão Eletrônico
    url.searchParams.set('srp', 'true'); // Filtro SRP quando suportado
    if (uf) url.searchParams.set('uf', uf.toUpperCase());

    const items = await fetchPNCPItems(url.toString(), 'Atas SRP', { timeoutMs: 9000 });
    for (const item of items) {
      // Filtra apenas SRP
      if (!item.srp && !String(item.objetoCompra || '').toLowerCase().includes('registro')) {
        // tenta mesmo assim se bater por objeto
        if (!matchObjeto(String(item.objetoCompra || ''), objeto)) continue;
      }
      if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto)) continue;

      resultados.push({
        id: `srp-${item.numeroControlePNCP || `${item.anoCompra}-${item.sequencialCompra}`}`,
        fonte: 'Atas de Registro de Preços',
        fonteLogo: '📋',
        titulo: `[SRP] ${item.objetoCompra || 'Sem descrição'}`,
        orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
        cnpjOrgao: item.orgaoEntidade?.cnpj || '',
        modalidade: item.modalidadeNome || 'Pregão SRP',
        uf: item.unidadeOrgao?.ufSigla || uf || '',
        municipio: item.unidadeOrgao?.municipioNome || '',
        valor: formatCurrency(item.valorTotalEstimado),
        dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
        dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
        dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
        numero: item.numeroCompra || '',
        ano: item.anoCompra || '',
        numeroControlePNCP: item.numeroControlePNCP || '',
        link: item.linkSistemaOrigem || pncpLink(item.orgaoEntidade?.cnpj, item.anoCompra, item.sequencialCompra),
        status: item.situacaoCompraNome || 'Publicado',
        isSRP: true,
      });
      if (resultados.length >= limit) break;
    }
  } catch (err) {
    errors.push(`Atas SRP: ${err.message}`);
  }
  return { resultados, errors };
}

// ─── Worker: Pregões SIASG (compras.gov.br — dados abertos) ──────────────────

async function buscarPregoesSIASG({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  // Reutiliza ComprasNet legado mas normaliza como fonte SIASG
  const resultados = [];
  const errors = [];

  try {
    const url = new URL('https://dadosabertos.compras.gov.br/modulo-legado/1_consultarLicitacao');
    url.searchParams.set('data_publicacao_inicial', toISODate(dataInicio || diasAtras(30)) || toISODate(diasAtras(30)));
    url.searchParams.set('data_publicacao_final', toISODate(dataFim || hoje()) || toISODate(hoje()));
    url.searchParams.set('pagina', String(Math.max(1, Math.min(Number(pagina) || 1, 500))));
    url.searchParams.set('tamanhoPagina', String(Math.max(10, Math.min(Number(tamanhoPagina) || 20, 500))));
    url.searchParams.set('modalidade', '5'); // Pregão = modalidade 5 no SIASG

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'NexosCRM/2.0' },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      errors.push(`Pregões SIASG: HTTP ${res.status}`);
    } else {
      const data = await safeJson(res);
      const items = Array.isArray(data?.resultado) ? data.resultado : [];
      const limit = clampNumber(tamanhoPagina, 10, 50, 20);

      for (const item of items) {
        const itemUf = extractUfFromAddress(item.endereco_entrega_edital) || uf || '';
        if (uf && itemUf !== uf.toUpperCase()) continue;
        if (!matchObjeto(`${item.objeto} ${item.informacoes_gerais}`, objeto)) continue;

        resultados.push({
          id: `siasg-${item.id_compra || item.identificador || Math.random()}`,
          fonte: 'Pregões SIASG',
          fonteLogo: '🔧',
          titulo: item.objeto || 'Sem descrição',
          orgao: item.nome_orgao || `UASG ${item.uasg || ''}`.trim(),
          cnpjOrgao: '',
          modalidade: item.nome_modalidade || 'Pregão Eletrônico',
          uf: itemUf,
          municipio: extractMunicipioFromAddress(item.endereco_entrega_edital),
          valor: formatCurrency(item.valor_estimado_total || item.valor_homologado_total),
          dataPublicacao: item.data_publicacao || null,
          dataAbertura: toISODate(item.data_abertura_proposta) || item.data_abertura_proposta || null,
          dataEncerramento: null,
          numero: String(item.numero_aviso || item.id_compra || ''),
          ano: String(item.id_compra || '').slice(-4),
          link: item.linkSistemaOrigem || 'https://www.gov.br/compras/pt-br',
          status: item.situacao_aviso || 'Publicado'
        });
        if (resultados.length >= limit) break;
      }
    }
  } catch (err) {
    errors.push(`Pregões SIASG: ${err.message}`);
  }
  return { resultados, errors };
}

// ─── Worker: Compras.gov.br Disputas em andamento ────────────────────────────

async function buscarComprasGovDisputas({ objeto, uf, pagina = 1, tamanhoPagina = 20, dataInicio, dataFim }) {
  // Usa endpoint de contratações em proposta (andamento) do PNCP
  const resultados = [];
  const errors = [];
  const dataI = dataInicio ? String(dataInicio).replaceAll('-', '') : diasAtras(7);
  const dataF = dataFim ? String(dataFim).replaceAll('-', '') : hoje();
  const limit = clampNumber(tamanhoPagina, 10, 50, 20);

  try {
    const url = new URL(`${PNCP_BASE}/contratacoes/proposta`);
    url.searchParams.set('dataInicial', dataI);
    url.searchParams.set('dataFinal', dataF);
    url.searchParams.set('pagina', String(Math.max(1, Number(pagina))));
    url.searchParams.set('tamanhoPagina', String(Math.min(50, limit)));
    if (uf) url.searchParams.set('uf', uf.toUpperCase());

    const items = await fetchPNCPItems(url.toString(), 'Compras.gov Disputas', { timeoutMs: 9000 });
    for (const item of items) {
      if (!matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto)) continue;
      resultados.push({
        id: `disputa-${item.numeroControlePNCP || `${item.anoCompra}-${item.sequencialCompra}`}`,
        fonte: 'Compras.gov Disputas',
        fonteLogo: '⚡',
        titulo: item.objetoCompra || 'Sem descrição',
        orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
        cnpjOrgao: item.orgaoEntidade?.cnpj || '',
        modalidade: item.modalidadeNome || 'Pregão em Disputa',
        uf: item.unidadeOrgao?.ufSigla || uf || '',
        municipio: item.unidadeOrgao?.municipioNome || '',
        valor: formatCurrency(item.valorTotalEstimado),
        dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
        dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
        dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
        numero: item.numeroCompra || '',
        ano: item.anoCompra || '',
        numeroControlePNCP: item.numeroControlePNCP || '',
        link: item.linkSistemaOrigem || pncpLink(item.orgaoEntidade?.cnpj, item.anoCompra, item.sequencialCompra),
        status: 'Em disputa',
      });
      if (resultados.length >= limit) break;
    }
  } catch (err) {
    errors.push(`Compras.gov Disputas: ${err.message}`);
  }
  return { resultados, errors };
}

// ─── Rastreamento de status dos workers em memória ───────────────────────────

const workerStatus = new Map();

const setWorkerStatus = (id, updates) => {
  const prev = workerStatus.get(id) || { id, status: 'idle', lastRunAt: null, lastError: null, totalResults: 0 };
  workerStatus.set(id, { ...prev, ...updates, updatedAt: new Date().toISOString() });
};

const wrapWorker = async (id, fn, ...args) => {
  console.log(`[B2G Worker] 🔄 Iniciando busca: ${id}`);
  setWorkerStatus(id, { status: 'running' });
  try {
    const result = await fn(...args);
    console.log(`[B2G Worker] ✅ ${id}: ${(result.resultados || []).length} resultados, ${(result.errors || []).length} erros`);
    
    setWorkerStatus(id, {
      status: result.errors?.length ? 'partial' : 'ok',
      lastRunAt: new Date().toISOString(),
      lastError: result.errors?.[0] || null,
      totalResults: (result.resultados || []).length,
    });
    return result;
  } catch (err) {
    console.error(`[B2G Worker] ❌ ERRO em ${id}:`, err.message);
    console.error(`[B2G Worker] Stack trace:`, err.stack?.substring(0, 500));
    
    setWorkerStatus(id, { status: 'error', lastRunAt: new Date().toISOString(), lastError: err.message, totalResults: 0 });
    return { resultados: [], errors: [`${id}: ${err.message}`] };
  }
};

// ─── GET /api/b2g-search/workers ─────────────────────────────────────────────

router.get('/workers', auth, (req, res) => {
  const catalog = WORKER_CATALOG.map(w => ({
    ...w,
    ...(workerStatus.get(w.id) || { status: 'idle', lastRunAt: null, lastError: null, totalResults: 0 }),
  }));
  res.json({ workers: catalog, timestamp: new Date().toISOString() });
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
    fontes = '',
    ordem = 'data_desc',
    incluirPropostas = 'true',
    apenasVigentes = 'false',
    cidade = '',
    codigoOrgao = '',
    termos = '',
    dataReferencia = '',
    // Filtro automático de produtos de TI
    filtrarProdutosTI = 'false',
    keywordsTI = ''
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

  try {
    const promises = [];
    const params = { objeto, uf, cidade, pagina: Number(pagina), tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim };

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
      promises.push(wrapWorker('dou', buscarDOU, { objeto, termos, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim }));
    }

    if (fontesAtivas.has('transparencia-curitiba')) {
      promises.push(wrapWorker('transparencia-curitiba', buscarTransparenciaCuritiba, { objeto, uf, cidade, tamanhoPagina: Number(tamanhoPagina), dataInicio, dataFim }));
    }

    if (fontesAtivas.has('transparencia-federal')) {
      promises.push(wrapWorker('transparencia-federal', buscarPortalTransparenciaFederal, { objeto, uf, dataInicio, dataFim, tamanhoPagina: Number(tamanhoPagina), codigoOrgao }));
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

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        todosResultados.push(...(r.value.resultados || []));
        todosErros.push(...(r.value.errors || []));
      } else {
        todosErros.push(r.reason?.message || 'Erro desconhecido');
      }
    }

    const deduplicados = deduplicar(todosResultados);
    const matchesTI = createTIProductMatcher(keywordsTI);
    const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const referenceTime = dataReferencia && dataReferencia !== localToday ? (parseDateTime(dataReferencia)?.getTime() || Date.now()) : Date.now();
    const normalizeLocation = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const diagnosticoFiltros = { coletados: todosResultados.length, unicos: deduplicados.length, exibidos: 0, produtosTI: { ativo: filtrarProdutosTI === 'true' }, excluidos: {} };
    const filtrados = deduplicados.filter(item => {
      let motivo;
      if (uf && String(item.uf || '').toUpperCase() !== String(uf).toUpperCase()) motivo = item.uf ? 'uf' : 'semUf';
      else if (cidade && !normalizeLocation(item.municipio || item.cidade).includes(normalizeLocation(cidade))) motivo = (item.municipio || item.cidade) ? 'cidade' : 'semCidade';
      else if (!isWithinDateRange(item.dataPublicacao, dataInicio, dataFim)) motivo = 'periodo';
      else if (apenasVigentes === 'true' && !isEditalVigente(item, referenceTime)) motivo = 'encerrados';
      else if (filtrarProdutosTI === 'true' && !matchesTI(item)) motivo = 'produtosTI';
      if (motivo) diagnosticoFiltros.excluidos[motivo] = (diagnosticoFiltros.excluidos[motivo] || 0) + 1;
      return !motivo;
    });
    diagnosticoFiltros.exibidos = filtrados.length;

    const ordenados = ordenar(filtrados, ordem);

    // Estatísticas por fonte
    const porFonte = {};
    for (const item of filtrados) {
      porFonte[item.fonte] = (porFonte[item.fonte] || 0) + 1;
    }

    // LOG: Verificar se documentos estão nos resultados
    const amostra = ordenados.slice(0, 2);
    console.log('[SEARCH RESPONSE] Amostra de resultados:', amostra.map(item => ({
      id: item.id,
      fonte: item.fonte,
      titulo: item.titulo?.substring(0, 50),
      temDocumentos: !!item.documentos,
      qtdDocumentos: item.documentos?.length || 0,
      documentos: item.documentos
    })));

    res.json({
      data: ordenados,
      total: ordenados.length,
      pagina: Number(pagina),
      fontes: porFonte,
      diagnosticoFiltros,
      erros: todosErros.length > 0 ? todosErros : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[b2g-search] Erro geral:', err);
    res.status(500).json({ error: 'Erro ao buscar licitações', data: [], total: 0 });
  }
});

module.exports = router;
