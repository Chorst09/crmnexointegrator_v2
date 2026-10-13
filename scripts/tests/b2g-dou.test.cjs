'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDouEnricher, douReferences } = require('../../apps/api/lib/douNotice.cjs');
const { createDocumentResolver } = require('../../apps/api/lib/editalDocuments.cjs');
const notice = { id: 'dou-738027599', fonte: 'Imprensa Nacional (DOU)', dataPublicacao: '2026-10-13T00:00:00-03:00', valor: null,
  link: 'https://www.in.gov.br/web/dou/-/aviso-de-licitacao-738027597', resumo: 'Pregão Eletrônico nº 65/2026. UASG: 389461. Objeto: Microsoft Office365.' };
// O número do edital é diferente do sequencial PNCP, para detectar associações erradas.
const compra = { numeroControlePNCP: '60975075000110-1-000123/2026', numeroCompra: '65', anoCompra: 2026, sequencialCompra: 123,
  modalidadeId: 6, valorTotalEstimado: 2982984.84, orcamentoSigilosoCodigo: 1,
  orgaoEntidade: { cnpj: '60975075000110' }, unidadeOrgao: { codigoUnidade: '389461', ufSigla: 'SP', municipioNome: 'São Paulo' },
  linkSistemaOrigem: 'https://portal.gov.br/processo/65', dataEncerramentoProposta: '2026-10-27T09:00:00' };
function officialFetch(items = [compra]) {
  const requested = [];
  const fetchImpl = async value => {
    const url = new URL(value); requested.push(url);
    if (url.pathname.includes('1.1_consultarContratacoes')) return new Response(JSON.stringify({ resultado: [] }));
    if (url.pathname.includes('1_consultarUasg')) return new Response(JSON.stringify({ resultado: [{ codigoUasg: '389461', cnpjCpfOrgao: '60975075000110' }] }));
    if (url.pathname.includes('/contratacoes/publicacao')) return new Response(JSON.stringify({ data: items, totalPaginas: 1 }));
    if (url.pathname.includes('/api/consulta/v1/orgaos/')) return new Response(JSON.stringify(compra));
    if (url.hostname === 'www.in.gov.br') return new Response(`<div class="texto-dou">${notice.resumo}</div>`);
    if (url.hostname === 'portal.gov.br') return new Response('<a href="/edital.pdf">Edital</a>');
    return new Response('', { status: 404 });
  };
  return { requested, fetchImpl };
}
test('DOU recovers official value and PNCP sequence through UASG, number and year when the open-data index is stale', async () => {
  const { fetchImpl, requested } = officialFetch();
  const enrich = createDouEnricher({ fetchImpl });
  const result = await enrich(notice);
  assert.equal(result.dados.valor, 2982984.84);
  assert.equal(result.dados.sequencialCompra, 123);
  assert.equal(result.dados.numeroControlePNCP, compra.numeroControlePNCP);
  assert.equal(result.dados.uf, 'SP');
  assert.equal(requested.find(url => url.pathname.includes('1_consultarUasg')).searchParams.get('statusUasg'), 'true');
  assert.equal(requested.find(url => url.pathname.includes('/contratacoes/publicacao')).searchParams.get('cnpj'), '60975075000110');
  const before = requested.length;
  await enrich(notice); assert.equal(requested.length, before);
});
test('DOU never adopts amounts from a different UASG, purchase number, year or modality', async () => {
  const wrong = [{ ...compra, numeroCompra: '66' }, { ...compra, anoCompra: 2025 }, { ...compra, modalidadeId: 8 },
    { ...compra, unidadeOrgao: { codigoUnidade: '999999' } }];
  const result = await createDouEnricher(officialFetch(wrong))(notice);
  assert.equal(result.dados.numeroControlePNCP, undefined);
  assert.equal(result.dados.valor, undefined);
});
test('ambiguous PNCP matches and confidential budgets never become an estimated amount', async () => {
  const ambiguous = await createDouEnricher(officialFetch([compra, { ...compra, numeroControlePNCP: '60975075000110-1-000124/2026' }]))(notice);
  assert.equal(ambiguous.dados.valor, undefined);
  assert.match(ambiguous.diagnosticos[0].mensagem, /Mais de uma compra/);
  const secret = await createDouEnricher(officialFetch([{ ...compra, orcamentoSigilosoCodigo: 2 }]))(notice);
  assert.equal(secret.dados.valor, null);
  assert.equal(secret.dados.orcamentoSigiloso, true);
  assert.equal(secret.dados.numeroControlePNCP, compra.numeroControlePNCP);
});
test('an official Compras.gov URL and the six-digit UASG heading retain the exact purchase identity', () => {
  const linked = douReferences({ ...notice, resumo: 'Modalidade: Pregão 24/2026. https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=16020405000242026' });
  assert.equal(linked.uasg, '160204'); assert.equal(linked.idCompra, '16020405000242026');
  const numbered = douReferences({ ...notice, resumo: 'PREGÃO ELETRÔNICO Nº 910847 - 48/2026' });
  assert.equal(numbered.uasg, '910847'); assert.equal(numbered.numero, '48'); assert.equal(numbered.idCompra, '91084705000482026');
});
test('a public DOU notice without purchase identity retains its portal reference without guessing a price', async () => {
  const result = await createDouEnricher({ fetchImpl: async () => { throw Error('Unexpected request'); } })({ ...notice, resumo: 'Licitação nº 7004675748. Acesse www.petronect.com.br.' });
  assert.equal(result.dados.valor, undefined);
  assert.equal(result.dados.origens[0].url, 'https://www.petronect.com.br/');
});
test('older saved DOU notices recover the purchase and real official attachments from the full publication', async () => {
  const { fetchImpl } = officialFetch(); const calls = [];
  const resolve = createDocumentResolver({ fetchImpl, lookup: async () => [{ address: '203.0.113.1' }],
    getPncpFiles: async (cnpj, ano, seq) => { calls.push({ cnpj, ano, seq }); return [{ titulo: 'Edital original.pdf', url: 'https://pncp.gov.br/edital.pdf', sequencialDocumento: 1, origem: 'PNCP_OFICIAL' }]; } });
  const result = await resolve({ ...notice, resumo: '' });
  assert.deepEqual(calls, [{ cnpj: '60975075000110', ano: '2026', seq: '123' }]);
  assert.ok(result.documentos.some(doc => doc.titulo === 'Edital original.pdf'));
  assert.equal(result.dadosComplementares.valor, 2982984.84);
  assert.equal(result.dadosComplementares.linkSistemaOrigem, compra.linkSistemaOrigem);
});
test('a temporary DOU outage does not prevent correlation from the saved full notice text', async () => {
  const fixture = officialFetch();
  const result = await createDocumentResolver({ fetchImpl: async url => new URL(url).hostname === 'www.in.gov.br' ? new Response('', { status: 503 }) : fixture.fetchImpl(url),
    lookup: async () => [{ address: '203.0.113.1' }], getPncpFiles: async () => [{ titulo: 'Edital.pdf', url: 'https://pncp.gov.br/edital.pdf' }] })(notice);
  assert.equal(result.dadosComplementares.valor, 2982984.84);
  assert.ok(result.documentos.some(doc => doc.titulo === 'Edital.pdf'));
});
