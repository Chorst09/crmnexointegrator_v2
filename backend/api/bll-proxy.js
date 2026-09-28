const crypto = require('crypto');
const express = require('express');

const router = express.Router();

const BLL_BASE = 'https://bll.org.br';
const CONLICITACAO_API_BASE = 'https://consultaonline.conlicitacao.com.br';
const CONLICITACAO_APP_BASE = 'https://consulteonline.conlicitacao.com.br';
const SUPPORTED_PORTALS = new Set(['bll']);

let bllToken = null;
let bllTokenExpiry = 0;
const conlicitacaoSessions = new Map();

const STATES = [
  ['AC', 1], ['AL', 2], ['AM', 3], ['AP', 4], ['BA', 5], ['CE', 6], ['DF', 7],
  ['ES', 8], ['GO', 9], ['MA', 10], ['MG', 11], ['MS', 12], ['MT', 13],
  ['PA', 14], ['PB', 15], ['PE', 16], ['PI', 17], ['PR', 18], ['RJ', 19],
  ['RN', 20], ['RO', 21], ['RR', 22], ['RS', 23], ['SC', 24], ['SE', 25],
  ['SP', 26], ['TO', 27]
];
const STATE_ID_BY_UF = Object.fromEntries(STATES);

const MODALITIES = [
  ['audiencia publica', 1], ['compra eletronica', 2], ['coleta de precos', 3],
  ['concorrencia', 4], ['convite shopping', 5], ['convite', 6],
  ['dispensa de licitacao', 7], ['leilao', 8], ['sem modalidade', 9],
  ['pregao eletronico', 10], ['pregao presencial', 11],
  ['regime diferenciado de contratacao', 12], ['tomada de preco', 13]
];

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getHeader = (headers, name) => headers[name] || headers[name.toLowerCase()] || '';

const getCredentials = (portal, headers = {}) => {
  const upper = String(portal || '').toUpperCase();
  return {
    email: getHeader(headers, `x-${portal}-email`) || process.env[`${upper}_EMAIL`] || '',
    password: getHeader(headers, `x-${portal}-password`) || process.env[`${upper}_PASSWORD`] || ''
  };
};

const truthy = (value) => ['1', 'true', 'sim', 'yes', 'on'].includes(String(value || '').toLowerCase());

const appendArray = (params, key, values = []) => {
  values.filter((value) => value !== null && value !== undefined && value !== '').forEach((value) => {
    params.append(`${key}[]`, String(value));
  });
};

const parseSetCookie = (headers) => {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

const mergeCookies = (current, setCookies = []) => {
  const jar = new Map();
  String(current || '').split(';').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) jar.set(part.slice(0, idx), part.slice(idx + 1));
  });

  setCookies.forEach((cookie) => {
    const first = String(cookie || '').split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  });

  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
};

const sessionKey = ({ email, password }) =>
  crypto.createHash('sha256').update(`${email}:${password}`).digest('hex');

const conlicitacaoHeaders = (cookie = '') => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Cache: 'no-cache',
  frontend: 'true',
  Origin: CONLICITACAO_APP_BASE,
  Referer: `${CONLICITACAO_APP_BASE}/`,
  'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)',
  ...(cookie ? { Cookie: cookie } : {})
});

const logConlicitacao = (message, details = {}) => {
  console.log('[conlicitacao]', message, details);
};

async function validateConlicitacaoSession(cookie) {
  if (!cookie) return false;

  const params = new URLSearchParams({ page: '1', per_page: '1' });
  const url = new URL('/biddings.json', CONLICITACAO_API_BASE);
  for (const [key, value] of params.entries()) url.searchParams.append(key, value);

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'manual',
    headers: conlicitacaoHeaders(cookie)
  });

  logConlicitacao('validacao de sessao', {
    status: response.status,
    location: response.headers.get('location') || ''
  });

  return response.ok && response.status < 300;
}

async function loginBLL(headers = {}) {
  if (bllToken && Date.now() < bllTokenExpiry) return bllToken;

  const { email, password } = getCredentials('bll', headers);
  if (!email || !password) return null;

  const attempts = [
    {
      url: `${BLL_BASE}/api/auth/login`,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password })
    },
    {
      url: `${BLL_BASE}/fornecedor/login`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ email, password }).toString()
    }
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: 'POST',
        headers: { ...attempt.headers, 'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)' },
        body: attempt.body
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const token = data?.token || data?.access_token;
      if (token) {
        bllToken = token;
        bllTokenExpiry = Date.now() + 30 * 60 * 1000;
        return token;
      }
    } catch {
      // Tenta o próximo endpoint conhecido.
    }
  }

  return null;
}

async function loginConlicitacao(headers = {}, { force = false } = {}) {
  const credentials = getCredentials('conlicitacao', headers);
  if (!credentials.email || !credentials.password) {
    logConlicitacao('credenciais ausentes', {
      hasEmail: Boolean(credentials.email),
      hasPassword: Boolean(credentials.password)
    });
    return null;
  }

  const key = sessionKey(credentials);
  const cached = conlicitacaoSessions.get(key);
  if (!force && cached?.cookie && Date.now() < cached.expiresAt) return cached;

  const response = await fetch(`${CONLICITACAO_API_BASE}/users/login.json`, {
    method: 'POST',
    redirect: 'manual',
    headers: conlicitacaoHeaders(),
    body: JSON.stringify({
      login: credentials.email,
      senha: credentials.password,
      refresh: false
    })
  });

  const cookie = mergeCookies('', parseSetCookie(response.headers));
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  const location = response.headers.get('location') || '';

  logConlicitacao('retorno do login', {
    status: response.status,
    contentType,
    location,
    hasCookie: Boolean(cookie)
  });

  const loginLooksAccepted = response.ok || (response.status >= 300 && response.status < 400 && cookie);
  const validSession = loginLooksAccepted && await validateConlicitacaoSession(cookie).catch(() => false);

  if (!validSession) {
    conlicitacaoSessions.delete(key);
    return null;
  }

  const session = {
    cookie,
    profile: data,
    expiresAt: Date.now() + 25 * 60 * 1000
  };
  conlicitacaoSessions.set(key, session);
  return session;
}

async function conlicitacaoFetch(path, { headers = {}, params, retry = true } = {}) {
  let session = await loginConlicitacao(headers);
  if (!session) throw new Error('Credenciais inválidas no ConLicitações');

  const url = new URL(path, CONLICITACAO_API_BASE);
  if (params) {
    for (const [key, value] of params.entries()) url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'manual',
    headers: conlicitacaoHeaders(session.cookie)
  });

  session.cookie = mergeCookies(session.cookie, parseSetCookie(response.headers));
  logConlicitacao('requisicao', {
    path,
    status: response.status,
    location: response.headers.get('location') || ''
  });

  if ((response.status === 401 || response.status === 302) && retry) {
    session = await loginConlicitacao(headers, { force: true });
    if (!session) throw new Error('Sessão expirada no ConLicitações');
    return conlicitacaoFetch(path, { headers, params, retry: false });
  }

  if (!response.ok) {
    throw new Error(`ConLicitações respondeu ${response.status}`);
  }

  return response.json().catch(() => null);
}

async function resolveConlicitacaoCityId({ headers, stateId, cidade }) {
  if (!stateId || !cidade) return null;

  const params = new URLSearchParams();
  params.append('states_ids[]', String(stateId));
  const cities = await conlicitacaoFetch('/cities.json', { headers, params }).catch(() => []);
  const list = Array.isArray(cities) ? cities : Array.isArray(cities?.data) ? cities.data : [];
  const wanted = normalizeText(cidade);
  const match = list.find((city) => {
    const label = normalizeText(city.label || city.nome || city.name);
    return label === wanted || label.includes(wanted);
  });

  return match?.value || match?.id || null;
}

const resolveModalityId = (value) => {
  if (!value) return null;
  if (/^\d+$/.test(String(value))) return Number(value);
  const normalized = normalizeText(value);
  return MODALITIES.find(([name]) => name === normalized || name.includes(normalized))?.[1] || null;
};

const toConlicitacaoDate = (value, endOfDay = false) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) return raw;
  return `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-0300`;
};

const buildConlicitacaoParams = async ({ query, headers }) => {
  const stateId = STATE_ID_BY_UF[String(query.uf || '').toUpperCase()] || null;
  const cityId = await resolveConlicitacaoCityId({ headers, stateId, cidade: query.cidade });
  const modalityId = resolveModalityId(query.modalidadeId || query.modalidade);

  const params = new URLSearchParams();
  const setIfPresent = (key, value) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  };

  params.set('page', String(Math.max(1, Number(query.pagina) || 1)));
  params.set('per_page', String(Math.max(10, Math.min(Number(query.tamanhoPagina) || 20, 50))));
  setIfPresent('objeto', query.objeto || query.q);
  setIfPresent('id', query.numeroConlicitacao);
  setIfPresent('orgao_uasg', query.codigoOrgao);
  setIfPresent('processo', query.processo);
  setIfPresent('notice_number', query.numeroEdital);
  setIfPresent('nome_orgao', query.orgao);
  setIfPresent('itens', query.itens);
  setIfPresent('observacao', query.observacao);
  setIfPresent('exact_search', truthy(query.exactSearch) ? 'true' : '');
  setIfPresent('vigente_somente', truthy(query.apenasVigentes) ? 'true' : '');
  setIfPresent('tem_edital', truthy(query.comEdital) ? 'true' : '');
  setIfPresent('pregao_tem', truthy(query.comMonitoramentoChat) ? 'true' : '');
  setIfPresent('modified[from]', toConlicitacaoDate(query.dataInicio));
  setIfPresent('modified[to]', toConlicitacaoDate(query.dataFim, true));
  setIfPresent('data_validade[from]', toConlicitacaoDate(query.dataPrazoInicio));
  setIfPresent('data_validade[to]', toConlicitacaoDate(query.dataPrazoFim, true));

  appendArray(params, 'orgao_estado_id', stateId ? [stateId] : []);
  appendArray(params, 'cities_ids', cityId ? [cityId] : []);
  appendArray(params, 'modalities_ids', modalityId ? [modalityId] : []);

  return params;
};

const objectTextKeys = [
  'nome',
  'name',
  'label',
  'descricao',
  'description',
  'sigla',
  'acronym',
  'uf',
  'codigo',
  'id'
];

const toPlainText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toPlainText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    for (const key of objectTextKeys) {
      const text = toPlainText(value[key]);
      if (text) return text;
    }
  }
  return '';
};

const first = (...values) => values.map(toPlainText).find(Boolean) || '';

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  const clean = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeConlicitacaoItem = (item, index) => {
  const state = first(
    item.orgao_estado?.sigla,
    item.orgao_estado?.uf,
    item.estado?.sigla,
    item.estado?.uf,
    item.uf,
    item.state?.acronym,
    item.orgao?.estado?.sigla,
    item.city?.state?.acronym,
    item.orgao_estado,
    item.estado
  );
  const city = first(item.orgao_cidade, item.cidade, item.municipio, item.city?.nome, item.city?.name);
  const sourceUrl = first(item.url_fonte, item.url_portal, item.link, item.source_url, item.portal_url);
  const id = first(item.id, item.bidding_id, item.conlicitacao_id, item.codigo, `conlicitacao-${Date.now()}-${index}`);

  return {
    id: `conlicitacao-${id}`,
    objetoCompra: first(item.objeto, item.object, item.descricao, item.description, item.resumo, item.titulo, 'Sem descrição'),
    orgaoEntidade: {
      razaoSocial: first(item.orgao, item.nome_orgao, item.public_body, item.publicBody, item.orgao_nome, item.entidade, '')
    },
    modalidadeNome: first(item.modalidade, item.modality, item.modalidade_nome, item.modality_name, ''),
    valorTotalEstimado: toNumber(first(item.valor, item.valor_estimado, item.valor_total_estimado, item.estimated_value)),
    dataPublicacao: first(item.modified, item.data_inclusao, item.created_at, item.publication_date, item.data_fonte),
    dataAberturaProposta: first(item.data_abertura, item.opening_date, item.data_sessao, item.session_date),
    dataEncerramentoProposta: first(item.data_validade, item.deadline, item.deadline_date, item.validade),
    unidadeOrgao: {
      ufSigla: state,
      municipioNome: city
    },
    linkSistemaOrigem: sourceUrl || `${CONLICITACAO_APP_BASE}/banco_de_dados`,
    fonte: 'ConLicitação',
    numeroCompra: first(item.edital, item.notice_number, item.numero_edital, item.numero, item.processo, ''),
    status: first(item.situacao, item.status, item.tipo_agrupamento, item.activity, 'Aberto'),
    _raw: item
  };
};

const extractConlicitacaoItems = (payload) => {
  const candidates = [
    payload,
    payload?.data,
    payload?.biddings,
    payload?.licitacoes,
    payload?.items,
    payload?.results,
    payload?.records,
    payload?.data?.data,
    payload?.data?.biddings,
    payload?.data?.licitacoes,
    payload?.data?.items,
    payload?.data?.results,
    payload?.data?.records
  ];

  const list = candidates.find(Array.isArray) || [];
  logConlicitacao('resultado da busca', {
    total: list.length,
    keys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : []
  });
  return list;
};

async function buscarConlicitacao({ query, headers }) {
  const params = await buildConlicitacaoParams({ query, headers });
  const data = await conlicitacaoFetch('/biddings.json', { headers, params });
  const items = extractConlicitacaoItems(data);

  return items.map(normalizeConlicitacaoItem);
}

async function buscarBLL({ objeto = '', uf = '', tamanhoPagina = 20, headers = {} }) {
  const token = await loginBLL(headers);
  const params = new URLSearchParams({
    page: '1',
    per_page: String(Math.max(10, Math.min(Number(tamanhoPagina) || 20, 50))),
    status: 'aberto'
  });
  if (objeto) params.set('q', objeto);
  if (uf) params.set('uf', uf);

  const requestHeaders = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)'
  };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const endpoints = [
    `${BLL_BASE}/api/licitacoes?${params}`,
    `${BLL_BASE}/api/v1/licitacoes?${params}`,
    `${BLL_BASE}/api/processos?${params}`,
    `${BLL_BASE}/licitacoes/busca?${params}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: requestHeaders });
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const items = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.licitacoes) ? data.licitacoes
        : Array.isArray(data?.items) ? data.items
        : [];

      return items.map((item) => ({
        id: item.id || item.codigo || `bll-${Date.now()}-${Math.random()}`,
        objetoCompra: item.objeto || item.descricao || item.titulo || item.title || '',
        orgaoEntidade: { razaoSocial: item.orgao || item.entidade || item.cliente || '' },
        modalidadeNome: item.modalidade || item.tipo || 'Pregão Eletrônico',
        valorTotalEstimado: item.valor || item.valorEstimado || null,
        dataAberturaProposta: item.dataAbertura || item.data_abertura || item.abertura || null,
        dataEncerramentoProposta: item.dataEncerramento || item.data_encerramento || null,
        unidadeOrgao: { ufSigla: item.uf || item.estado || uf || '' },
        linkSistemaOrigem: item.link || item.url || `${BLL_BASE}/licitacao/${item.id || ''}`,
        fonte: 'BLL',
        numeroCompra: item.numero || item.codigo || ''
      }));
    } catch {
      // Tenta o próximo endpoint conhecido.
    }
  }

  return [];
}

router.get('/', async (req, res) => {
  const portal = String(req.query.portal || 'bll').toLowerCase();
  if (!SUPPORTED_PORTALS.has(portal)) {
    return res.status(400).json({
      data: [],
      total: 0,
      portal: portal.toUpperCase(),
      autenticado: false,
      erro: 'Fonte integrada não suportada nesta versão. Use BLL Compras.'
    });
  }

  const credentials = getCredentials(portal, req.headers);
  const configured = Boolean(credentials.email && credentials.password);

  if (req.query.action === 'check-credentials') {
    return res.json({
      status: {
        [portal]: {
          configured,
          source: configured ? 'headers' : 'none'
        }
      }
    });
  }

  if (req.query.action === 'login') {
    let autenticado = false;
    try {
      autenticado = portal === 'bll'
        ? configured && Boolean(await loginBLL(req.headers))
        : portal === 'conlicitacao'
          ? Boolean(await loginConlicitacao(req.headers, { force: true }))
          : configured;
    } catch (error) {
      console.error('[bll-proxy] Erro ao autenticar fonte:', error);
    }

    return res.status(autenticado ? 200 : 401).json({
      portal: portal.toUpperCase(),
      configured,
      autenticado,
      message: autenticado
        ? 'Fonte autenticada/configurada para busca'
        : 'Credenciais ausentes ou inválidas'
    });
  }

  try {
    const data = portal === 'bll'
      ? await buscarBLL({
        objeto: req.query.objeto || req.query.q || '',
        uf: req.query.uf || '',
        tamanhoPagina: req.query.tamanhoPagina || 20,
        headers: req.headers
      })
      : portal === 'conlicitacao'
        ? await buscarConlicitacao({ query: req.query, headers: req.headers })
        : [];

    return res.json({
      data,
      total: data.length,
      portal: portal.toUpperCase(),
      autenticado: configured,
      method: portal === 'conlicitacao' ? 'conlicitacao-api' : portal === 'bll' ? 'api' : 'configured'
    });
  } catch (error) {
    console.error('[bll-proxy] Erro:', error);
    return res.status(502).json({
      data: [],
      total: 0,
      portal: portal.toUpperCase(),
      autenticado: configured,
      erro: error.message || 'Falha ao buscar na fonte integrada'
    });
  }
});

module.exports = router;
