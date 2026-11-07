import assert from 'node:assert/strict';
import test from 'node:test';
import { getPncpIdentifiers, normalizeArquivo, getInitialArquivos, getArquivoDownloadEndpoint, getDownloadFilename } from './pncp-documents.ts';

const lic = { id: '00394429000100-1-002577/2026' };
const base = 'https://pncp.gov.br/pncp-api/v1/orgaos/00394429000100/compras/2026/2577/arquivos';

test('resolve o edital da busca mesmo sem orgaoEntidade ou sequencialCompra', () => {
  assert.deepEqual(getPncpIdentifiers(lic), { cnpj: '00394429000100', ano: 2026, seq: 2577 });
  assert.deepEqual(getPncpIdentifiers({ id: 'pncp-prop-' + lic.id }), getPncpIdentifiers(lic));
  assert.deepEqual(getPncpIdentifiers({ id: 'externo', link: 'https://pncp.gov.br/app/editais/00394429000100/2026/2577' }), getPncpIdentifiers(lic));
});

test('não inventa sequencial PNCP a partir do número do processo ou data', () => {
  assert.equal(getPncpIdentifiers({ id: 'comprasnet-2577', cnpjOrgao: '00394429000100', ano: 2026 }), null);
});

test('mantém o sequencial real do documento, mesmo fora da ordem da lista', () => {
  const doc = normalizeArquivo({ titulo: 'EDITAL ASS.pdf', url: `${base}/5` }, 0)!;
  assert.equal(doc.sequencialDocumento, 5);
  assert.equal(getArquivoDownloadEndpoint(lic, doc), '/api/b2g-licitacoes/arquivos/00394429000100/2026/2577/download/5');
});

test('preserva documentos existentes e exclui links de acompanhamento e resumos gerados', () => {
  const source = 'https://compras.gov.br/processo/2577';
  const docs = getInitialArquivos({
    ...lic, link: source, documentos: [
      { titulo: 'Edital Completo', url: source },
      { titulo: 'EDITAL ASS.pdf', url: `${base}/5` },
      { titulo: 'Resumo.pdf', url: 'https://nexos.example/api/b2g-licitacoes/documento-gerado/00394429000100/2026/2577' }
    ], pdfUrl: `${base}/5`
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].titulo, 'EDITAL ASS.pdf');
});

test('arquivo externo não recebe um sequencial fictício nem extensão PDF', () => {
  const doc = normalizeArquivo({ titulo: 'Anexos.zip', url: 'https://orgao.gov.br/anexos.zip?token=publico' })!;
  assert.equal(doc.sequencialDocumento, undefined);
  const endpoint = new URL(getArquivoDownloadEndpoint(lic, doc), 'https://nexos.example');
  assert.equal(endpoint.pathname, '/api/b2g-licitacoes/proxy-download');
  assert.equal(endpoint.searchParams.get('filename'), 'Anexos.zip');
});

test('preserva nomes e extensões enviados pelo servidor', () => {
  assert.equal(getDownloadFilename("attachment; filename=anexo.xlsx; filename*=UTF-8''Planilha%20Or%C3%A7ament%C3%A1ria.xlsx", 'anexo'), 'Planilha Orçamentária.xlsx');
  assert.equal(getDownloadFilename('attachment; filename="EDITAL+ASS.pdf"', 'edital'), 'EDITAL ASS.pdf');
  assert.equal(getDownloadFilename(null, 'Anexos.zip'), 'Anexos.zip');
});
