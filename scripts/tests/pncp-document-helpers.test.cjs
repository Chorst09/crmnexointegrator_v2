const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const helper = require('esbuild').build({
  entryPoints: [path.resolve(__dirname, '../../apps/web/src/pages/licitacoes_components/pncp-documents.ts')],
  bundle: true, write: false, format: 'esm', platform: 'node'
}).then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`));

test('PNCP identifiers use the official control number and never guess a purchase sequence', async () => {
  const { getPncpIdentifiers } = await helper;
  assert.deepEqual(getPncpIdentifiers({ numeroControlePNCP: '60747318000162-1-000836/2026' }), { cnpj: '60747318000162', ano: '2026', seq: '836' });
  assert.equal(getPncpIdentifiers({ cnpj: '60747318000162', ano: 2026, processo: '836' }), null);
});

test('document catalog retains real attachments and cache links without synthetic documents', async () => {
  const { getInitialArquivos, normalizeArquivo } = await helper;
  const cacheUrl = '/api/b2g-licitacoes/documentos/cache/file-token';
  assert.equal(normalizeArquivo({ url: cacheUrl }).url, cacheUrl);
  assert.equal(normalizeArquivo({ url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeArquivo({ url: '/api/b2g-licitacoes/documento-gerado/60747318000162/2026/836' }), null);
  const files = getInitialArquivos({ documentos: [{ url: 'https://portal.gov.br/Edital.pdf', titulo: 'Edital original' }], pdfUrl: 'https://portal.gov.br/Edital.pdf' });
  assert.equal(files.length, 1);
  assert.equal(files[0].titulo, 'Edital original');
});

test('downloads use official document IDs, direct cache links and the existing origin proxy', async () => {
  const { getArquivoDownloadEndpoint, normalizeArquivo } = await helper;
  const licitacao = { numeroControlePNCP: '60747318000162-1-000836/2026' };
  const official = normalizeArquivo({ url: 'https://pncp.gov.br/pncp-api/v1/orgaos/60747318000162/compras/2026/836/arquivos/2', titulo: 'Edital.pdf' });
  assert.equal(getArquivoDownloadEndpoint(licitacao, official), '/api/b2g-licitacoes/arquivos/60747318000162/2026/836/download/2');
  const cache = normalizeArquivo({ url: '/api/b2g-licitacoes/documentos/cache/file-token' });
  assert.equal(getArquivoDownloadEndpoint(licitacao, cache), cache.url);
  const origin = normalizeArquivo({ url: 'https://portal.gov.br/Edital.pdf', titulo: 'Edital.pdf', sequencialDocumento: 99, origem: 'SISTEMA_ORIGEM' });
  const endpoint = new URL(getArquivoDownloadEndpoint(licitacao, origin), 'https://crm.invalid');
  assert.equal(endpoint.pathname, '/api/b2g-licitacoes/proxy-download');
  assert.equal(endpoint.searchParams.get('url'), origin.url);
});

test('download names preserve official Unicode names and remove path separators', async () => {
  const { getDownloadFilename } = await helper;
  assert.equal(getDownloadFilename("attachment; filename*=UTF-8''Retifica%C3%A7%C3%A3o.pdf", 'Documento'), 'Retificação.pdf');
  assert.equal(getDownloadFilename('attachment; filename="Edital.pdf"', 'Documento'), 'Edital.pdf');
  assert.equal(getDownloadFilename(null, '../../arquivo.pdf'), '_.._arquivo.pdf');
});
