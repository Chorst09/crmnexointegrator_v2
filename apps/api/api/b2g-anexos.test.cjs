const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { Writable } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Estes testes exercitam as rotas públicas usadas no backend Docker, sem banco.
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2g-anexos-'));
process.env.EDITAIS_ATTACHMENTS_DIR = temporaryDir;
const originalFetch = global.fetch;
let mockedFetch;
global.fetch = (...args) => mockedFetch(...args);
const router = require('../../../backend/api/b2g-documents.js');
after(() => {
  global.fetch = originalFetch;
  fs.rmSync(temporaryDir, { recursive: true, force: true });
});

async function request(routePath, params, query = {}) {
  const layer = router.stack.find(layer => layer.route && (Array.isArray(layer.route.path) ? layer.route.path.includes(routePath) : layer.route.path === routePath));
  const chunks = [];
  const res = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.jsonBody = value; res.end(JSON.stringify(value)); return res; };
  res.redirect = (code, url) => { res.statusCode = code; res.headers.location = url; res.end(); return res; };
  const finished = new Promise((resolve, reject) => { res.on('finish', resolve); res.on('error', reject); });
  await layer.route.stack[0].handle({ params, query }, res);
  await finished;
  return { status: res.statusCode, headers: res.headers, json: res.jsonBody, body: Buffer.concat(chunks) };
}

const listRoute = '/arquivos/:cnpj/:ano/:seq';
const downloadRoute = '/arquivos/:cnpj/:ano/:seq/download/:docSeq';
const params = seq => ({ cnpj: '00394429000100', ano: '2026', seq: String(seq) });
const file = (seq, docSeq, title = 'Edital.pdf') => ({ sequencialDocumento: docSeq, titulo: title, statusAtivo: true, url: `https://pncp.gov.br/pncp-api/v1/orgaos/00394429000100/compras/2026/${seq}/arquivos/${docSeq}` });

test('lista arquivos ativos e preserva IDs não consecutivos', async () => {
  mockedFetch = async () => Response.json([file(901, 2), file(901, 5), { ...file(901, 3), statusAtivo: false }]);
  const result = await request(listRoute, params(901));
  assert.equal(result.status, 200);
  assert.deepEqual(result.json.map(doc => doc.sequencialDocumento), [2, 5]);
});

test('distingue indisponibilidade do PNCP de lista vazia e permite tentar novamente', async () => {
  mockedFetch = async () => new Response('', { status: 503 });
  assert.equal((await request(listRoute, params(902))).status, 502);
  mockedFetch = async url => url.endsWith('/arquivos') ? Response.json([file(902, 5)]) : Response.json({});
  const retry = await request(listRoute, params(902));
  assert.equal(retry.status, 200);
  assert.equal(retry.json[0].sequencialDocumento, 5);
});

test('lista vazia é um resultado válido', async () => {
  mockedFetch = async url => url.endsWith('/arquivos') ? Response.json([]) : Response.json({});
  const result = await request(listRoute, params(903));
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, []);
});

test('documento ausente retorna 404 sem baixar o primeiro anexo', async () => {
  let calls = 0;
  mockedFetch = async () => { calls++; return Response.json([file(904, 2)]); };
  const result = await request(downloadRoute, { ...params(904), docSeq: '5' });
  assert.equal(result.status, 404);
  assert.equal(calls, 1);
});

test('baixa o documento selecionado, mantém nome ZIP e reutiliza o binário do cache', async () => {
  const bytes = Buffer.from('PK\u0003\u0004arquivo-zip');
  const urls = [];
  mockedFetch = async url => {
    urls.push(url);
    return url.endsWith('/arquivos') ? Response.json([file(905, 2), file(905, 5, 'Anexos.zip')]) : new Response(bytes, { headers: { 'content-type': 'application/zip' } });
  };
  const result = await request(downloadRoute, { ...params(905), docSeq: '5' });
  assert.equal(result.status, 200);
  assert.equal(urls[1], file(905, 5).url);
  assert.deepEqual(result.body, bytes);
  assert.match(result.headers['content-disposition'], /Anexos\.zip/);
  assert.equal(result.headers['x-served-from'], 'fresh-download');
  const cached = await request(downloadRoute, { ...params(905), docSeq: '5' });
  assert.deepEqual(cached.body, bytes);
  assert.equal(cached.headers['x-served-from'], 'disk-cache');
  assert.equal(urls.length, 2);
});

test('não persiste HTML como se fosse edital', async () => {
  mockedFetch = async url => url.endsWith('/arquivos') ? Response.json([file(906, 5)]) : new Response('<html>Erro</html>', { headers: { 'content-type': 'text/html' } });
  const result = await request(downloadRoute, { ...params(906), docSeq: '5' });
  assert.equal(result.status, 302);
  assert.equal(result.headers.location, file(906, 5).url);
  assert.deepEqual(fs.readdirSync(path.join(temporaryDir, '00394429000100/2026/906')), []);
});

test('rejeita IDs inválidos antes de consultar o PNCP', async () => {
  mockedFetch = async () => { throw new Error('Não deve consultar o PNCP'); };
  assert.equal((await request(listRoute, { ...params(907), cnpj: '123' })).status, 400);
  assert.equal((await request(downloadRoute, { ...params(907), docSeq: '0' })).status, 400);
});

test('rota de anexos não carrega Prisma ou gerador PDF', () => {
  assert.equal(Object.keys(require.cache).some(name => /(?:prisma\.cjs|jspdf)/.test(name)), false);
});

test('proxy preserva binário e nome de anexo oficial', async () => {
  const bytes = Buffer.from('PK\u0003\u0004anexos');
  mockedFetch = async () => new Response(bytes, { headers: { 'content-type': 'application/zip' } });
  const result = await request('/proxy-download', {}, { url: 'https://compras.gov.br/anexos.zip', filename: 'Anexos.zip' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, bytes);
  assert.match(result.headers['content-disposition'], /Anexos\.zip/);
});

test('proxy não consulta endereços privados ou domínios que imitam o PNCP', async () => {
  mockedFetch = async () => { throw new Error('Não deve acessar URL não autorizada'); };
  for (const url of ['https://127.0.0.1/arquivo', 'https://pncp.gov.br.evil.example/arquivo', 'http://pncp.gov.br/arquivo']) {
    assert.equal((await request('/proxy-download', {}, { url })).status, 422);
  }
});

test('proxy bloqueia redirecionamentos para fora dos portais oficiais', async () => {
  let calls = 0;
  mockedFetch = async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/arquivo' } }); };
  const result = await request('/proxy-download', {}, { url: 'https://pncp.gov.br/arquivo' });
  assert.equal(result.status, 502);
  assert.equal(calls, 1);
});
