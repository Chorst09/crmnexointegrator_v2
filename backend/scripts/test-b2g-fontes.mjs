#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'node:crypto';

const baseURL = (process.env.B2G_TEST_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const timeoutMs = Number(process.env.B2G_TEST_TIMEOUT_MS || 45000);

const base64url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const signJwt = (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    userId: process.env.B2G_TEST_USER_ID || 'smoke-test',
    email: process.env.B2G_TEST_EMAIL || 'smoke-test@nexos.local',
    role: 'ADMIN',
    iat: now,
    exp: now + 60 * 10,
    ...payload
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

const authToken = process.env.B2G_TEST_JWT || (
  process.env.JWT_SECRET ? signJwt({}, process.env.JWT_SECRET) : ''
);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const requestJson = async (path, { auth = false, expectedStatus = 200 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json' };
  if (auth) {
    if (!authToken) throw new Error('JWT ausente. Defina JWT_SECRET ou B2G_TEST_JWT.');
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${baseURL}${path}`, {
      headers,
      signal: controller.signal
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (res.status !== expectedStatus) {
      throw new Error(`HTTP ${res.status}; esperado ${expectedStatus}; ${body?.erro || body?.error || text.slice(0, 160)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
};

const getList = (body) => Array.isArray(body?.data)
  ? body.data
  : Array.isArray(body?.resultados)
    ? body.resultados
    : [];

const requireResults = (body, label) => {
  const data = getList(body);
  if (data.length === 0) {
    const detail = body?.erro || body?.error || (Array.isArray(body?.erros) ? body.erros.join('; ') : '');
    throw new Error(`${label} retornou sem dados${detail ? `: ${detail}` : ''}`);
  }
  return data;
};

const tests = [
  {
    label: 'PNCP Oficial',
    path: '/api/b2g-search/search?fontes=pncp&tamanhoPagina=10&incluirPropostas=false',
    auth: true,
    validate: body => `${requireResults(body, 'PNCP Oficial').length} resultados`
  },
  {
    label: 'Imprensa Nacional (DOU)',
    path: '/api/b2g-search/search?fontes=dou&termos=computador,desktop,notebook&dataInicio=2025-05-01&dataFim=2025-05-31&tamanhoPagina=10',
    auth: true,
    validate: body => {
      const data = requireResults(body, 'Imprensa Nacional (DOU)');
      const invalid = data.find(item => item.fonte !== 'Imprensa Nacional (DOU)' || !item.link?.includes('in.gov.br/web/dou/-/'));
      if (invalid) throw new Error('DOU retornou item sem fonte ou link oficial');
      const unrelated = data.find(item => !/computador|desktop|notebook/i.test(`${item.titulo || ''} ${item.resumo || ''}`));
      if (unrelated) throw new Error('DOU retornou item fora das palavras-chave TI informadas');
      return `${data.length} resultados oficiais`;
    }
  },
  {
    label: 'ComprasNet',
    path: '/api/comprasnet-proxy?tipo=licitacao&tamanhoPagina=10',
    validate: body => `${requireResults(body, 'ComprasNet').length} resultados`
  },
  {
    label: 'Dispensas',
    path: '/api/comprasnet-proxy?tipo=dispensas&tamanhoPagina=10',
    validate: body => {
      const data = requireResults(body, 'Dispensas');
      const valid = data.some(item => /dispensa/i.test(`${item.modalidadeNome || item.modalidade || ''} ${item.objetoCompra || ''}`));
      if (!valid) throw new Error('Dispensas respondeu dados sem indício de dispensa');
      return `${data.length} resultados`;
    }
  },
  {
    label: 'Contratacoes Lei 14.133',
    path: '/api/comprasnet-proxy?tipo=contratacoes14133&tamanhoPagina=10',
    validate: body => `${requireResults(body, 'Contratacoes Lei 14.133').length} resultados`
  },
  {
    label: 'Atas de Registro de Preco',
    path: '/api/comprasnet-proxy?tipo=arp&tamanhoPagina=10',
    validate: body => {
      const data = requireResults(body, 'Atas de Registro de Preco');
      const invalid = data.find(item => item.srp !== true);
      if (invalid) throw new Error('ARP retornou item sem srp=true');
      return `${data.length} resultados SRP`;
    }
  },
  {
    label: 'Pregoes',
    path: '/api/comprasnet-proxy?tipo=pregoes&tamanhoPagina=10',
    validate: body => {
      const data = requireResults(body, 'Pregoes');
      const valid = data.some(item => /preg[aã]o|6/i.test(`${item.modalidadeNome || item.modalidade || item.codigoModalidadeCompra || ''}`));
      if (!valid) throw new Error('Pregoes respondeu dados sem indício de pregão');
      return `${data.length} resultados`;
    }
  },
  {
    label: 'Transparencia Curitiba',
    path: '/api/b2g-search/search?fontes=transparencia-curitiba&uf=PR&cidade=Curitiba&tamanhoPagina=10',
    auth: true,
    validate: body => `${requireResults(body, 'Transparencia Curitiba').length} resultados`
  },
  {
    label: 'e-Compras Curitiba',
    path: '/api/b2g-search/search?fontes=curitiba-ecompras&uf=PR&cidade=Curitiba&tamanhoPagina=10',
    auth: true,
    validate: body => `${requireResults(body, 'e-Compras Curitiba').length} resultados`
  },
  {
    label: 'Portal Transparencia Federal',
    path: '/api/b2g-search/search?fontes=transparencia-federal&tamanhoPagina=10',
    auth: true,
    validate: body => `${requireResults(body, 'Portal Transparencia Federal').length} resultados`
  },
  {
    label: 'ComprasNet agregado',
    path: '/api/b2g-search/search?fontes=comprasnet&tamanhoPagina=10',
    auth: true,
    validate: body => `${requireResults(body, 'ComprasNet agregado').length} resultados`
  },
  {
    label: 'BLL check',
    path: '/api/bll-proxy?portal=bll&action=check-credentials',
    validate: body => {
      if (!body?.status?.bll) throw new Error('Status BLL ausente');
      return body.status.bll.configured ? 'credenciais configuradas' : 'sem credenciais configuradas';
    }
  },
  {
    label: 'BNC removido',
    path: '/api/bll-proxy?portal=bnc&action=login',
    expectedStatus: 400,
    validate: body => {
      if (body?.autenticado !== false) throw new Error('BNC deveria retornar autenticado=false');
      return 'bloqueado corretamente';
    }
  },
  {
    label: 'ConLicitacao removido',
    path: '/api/bll-proxy?portal=conlicitacao',
    expectedStatus: 400,
    validate: body => {
      if (body?.autenticado !== false) throw new Error('ConLicitacao deveria retornar autenticado=false');
      return 'bloqueado corretamente';
    }
  }
];

const failures = [];

console.log(`B2G smoke test: ${baseURL}`);

for (const test of tests) {
  const startedAt = Date.now();
  try {
    const body = await requestJson(test.path, {
      auth: test.auth,
      expectedStatus: test.expectedStatus || 200
    });
    const detail = test.validate ? test.validate(body) : 'ok';
    console.log(`OK  ${test.label} - ${detail} (${Date.now() - startedAt}ms)`);
  } catch (error) {
    failures.push({ label: test.label, error: error.message || String(error) });
    console.error(`ERR ${test.label} - ${error.message || error}`);
  }
  await wait(250);
}

if (failures.length > 0) {
  console.error(`\nFalhas: ${failures.length}/${tests.length}`);
  for (const failure of failures) console.error(`- ${failure.label}: ${failure.error}`);
  process.exit(1);
}

console.log(`\nTodas as fontes validadas: ${tests.length}/${tests.length}`);
