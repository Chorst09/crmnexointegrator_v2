'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocumentResolver, extractDocuments } = require('../../apps/api/lib/editalDocuments.cjs');
const sourcePath = path.resolve(__dirname, '../../apps/api/api/b2g-search.cjs');
const ids = ['pncp','comprasnet','dou','curitiba-ecompras','transparencia-curitiba','transparencia-federal','contratacoes-14133','atas-srp','pregoes-siasg','comprasgov-disputas'];
function searchHarness(fetchImpl = global.fetch) {
  const routes = new Map();
  const router = { get: (url, ...handlers) => routes.set(url, handlers.at(-1)) };
  const ctx = { require: name => name === 'express' ? { Router: () => router } : name === 'jsonwebtoken' ? {} : name === '../lib/douNotice.cjs' ? require('../../apps/api/lib/douNotice.cjs') : require('node:module').createRequire(sourcePath)(name),
    module: { exports: {} }, process: { env: { JWT_SECRET:'test-only', B2G_SOURCE_TIMEOUT_MS:'1000' } },
    URL, URLSearchParams, AbortSignal, AbortController, global: { fetch: fetchImpl }, setTimeout, clearTimeout, console };
  vm.createContext(ctx);
  const inject = `globalThis.inject = functions => { ${['buscarPNCPAgregado','buscarComprasNet','buscarDOU','buscarCuritibaECompras','buscarTransparenciaCuritiba','buscarPortalTransparenciaFederal','buscarContratacoes14133','buscarAtasSRP','buscarPregoesSIASG','buscarComprasGovDisputas'].map((name,i)=>`${name}=functions[${JSON.stringify(ids[i])}];`).join(' ')} };`;
  vm.runInContext(fs.readFileSync(sourcePath,'utf8') + '\n' + inject, ctx);
  return { ctx, routes };
}
async function invoke(handler, query) {
  let body, code=200;
  await handler({query}, { json: data => { body=JSON.parse(JSON.stringify(data));return data; },status: value=>{code=value;return {json:data=>{body=data}};} });
  return {body,code};
}
test('all ten enabled sources execute; duplicate notices retain every provenance',async()=>{
  const {ctx,routes}=searchHarness();const calls=[];
  ctx.inject(Object.fromEntries(ids.map(id=>[id,async()=>{calls.push(id);return {resultados:[{id:'notice-'+id,numeroControlePNCP:'13864377000130-1-001576/2026',fonte:id,titulo:'Mesmo edital',link:'https://'+id+'.gov.br/edital',documentos:[{url:'https://'+id+'.gov.br/document.pdf'}]}],errors:[]};}])));
  const {body}=await invoke(routes.get('/search'),{fontes:ids.join(',')});
  assert.deepEqual(calls.sort(),[...ids].sort());
  assert.equal(body.statusFontes.length,10);
  assert.equal(body.data.length,1);
  assert.equal(body.data[0].origens.length,10);
  assert.equal(body.data[0].documentos.length,10);
  assert.equal(Object.keys(body.fontes).length,10);
});
test('single-source selection and paused sources are respected',async()=>{
  const {ctx,routes}=searchHarness();const calls=[];
  ctx.inject(Object.fromEntries(ids.map(id=>[id,async()=>{calls.push(id);return {resultados:[],errors:[]};}])));
  await invoke(routes.get('/search'),{fontes:'atas-srp'});assert.deepEqual(calls,['atas-srp']);
  const {body}=await invoke(routes.get('/search'),{fontes:'none'});assert.equal(body.total,0);assert.equal(calls.length,1);
});
test('slow source does not block remaining sources beyond the request budget',async()=>{
  const {ctx,routes}=searchHarness();
  ctx.inject(Object.fromEntries(ids.map(id=>[id,id==='pncp'?()=>new Promise(()=>{}):async()=>({resultados:[{id,titulo:id,fonte:id}],errors:[]})])));
  const started=Date.now();const {body}=await invoke(routes.get('/search'),{fontes:ids.join(',')});
  assert.ok(Date.now()-started<1800);
  assert.equal(body.data.length,9);
  assert.equal(body.statusFontes.find(s=>s.id==='pncp').status,'error');
});
test('HTML and embedded JSON documents are recovered without depending on JSON key order',()=>{
  const docs=extractDocuments('<a href="/edital.pdf">Edital original</a><script type="application/json">{"arquivos":[{"tipo":"TR","url":"https://portal.gov.br/TR.pdf","nome":"Termo de Referência"}]}</script>','https://portal.gov.br/processo');
  assert.equal(docs.length,2);assert.equal(docs[0].url,'https://portal.gov.br/edital.pdf');assert.equal(docs[1].titulo,'Termo de Referência');
});
test('origin documents are recovered when PNCP fails, and notices without PNCP also work',async()=>{
  const lookup=async()=>[{address:'203.0.113.1'}];
  const fetchImpl=async url=>String(url).includes('/orgaos/') ? new Response(JSON.stringify({linkSistemaOrigem:'https://portal.gov.br/processo'}),{headers:{'content-type':'application/json'}}) : new Response('<a href="/edital.pdf">Edital original</a>',{headers:{'content-type':'text/html'}});
  const resolve=createDocumentResolver({lookup,fetchImpl,getPncpFiles:async()=>{throw new Error('PNCP indisponível');}});
  let result=await resolve({numeroControlePNCP:'13864377000130-1-001576/2026',link:'https://portal.gov.br/processo'});
  assert.equal(result.documentos.length,1);assert.ok(result.diagnosticos.some(d=>d.fonte==='PNCP'));
  result=await resolve({id:'curitiba-1',link:'https://portal.gov.br/processo'});assert.equal(result.documentos.length,1);
});
test('private addresses and redirects to private addresses are rejected',async()=>{
  let fetches=0;const resolve=createDocumentResolver({lookup:async host=>[{address:host==='portal.gov.br'?'203.0.113.1':'127.0.0.1'}],fetchImpl:async()=>{fetches++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private.pdf'}});},getPncpFiles:async()=>[]});
  const result=await resolve({link:'https://portal.gov.br/processo',documentos:[{url:'http://127.0.0.1/secret.pdf'}]});
  assert.equal(result.documentos.length,0);assert.equal(fetches,1);assert.ok(result.diagnosticos[0].mensagem.includes('não público'));
});

test('canonical catalog contains every executable source', async () => {
  const { routes } = searchHarness();
  const { body } = await invoke(routes.get('/fontes'), {});
  assert.deepEqual(body.fontes.map(s => s.id).sort(), [...ids].sort());
});
test('real ARP adapter retains purchase identifiers and document origin links', async () => {
  let requested;
  const { routes } = searchHarness(async url => {
    requested = new URL(url);
    return new Response(JSON.stringify({ resultado: [{ numeroControlePncpAta: '12345678000199-1-000001/2026-000001', numeroControlePncpCompra: '12345678000199-1-000001/2026', linkAtaPNCP: 'https://pncp.gov.br/app/atas/12345678000199/2026/1/1', linkCompraPNCP: 'https://pncp.gov.br/app/editais/12345678000199/2026/1', objeto: 'Computadores', dataVigenciaFinal: '2099-01-01' }] }), { headers: { 'content-type': 'application/json' } });
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'atas-srp', dataInicio: '2026-10-01', dataFim: '2026-10-12' });
  assert.equal(requested.pathname, '/modulo-arp/1_consultarARP');
  assert.equal(requested.searchParams.get('dataVigenciaInicialMin'), '2026-10-01');
  assert.equal(body.data[0].numeroControlePNCP, '12345678000199-1-000001/2026');
  assert.equal(body.data[0].link, body.data[0].linkAtaPNCP);
});
test('metadata uses public consultation API and recovers extensionless origin PDFs', async () => {
  const requested = [];
  const resolve = createDocumentResolver({ lookup: async () => [{ address: '203.0.113.1' }], getPncpFiles: async () => [], fetchImpl: async url => {
    requested.push(String(url));
    if (String(url).includes('/api/consulta/')) return new Response(JSON.stringify({ linkSistemaOrigem: 'https://portal.gov.br/download/123' }));
    if (String(url).includes('dadosabertos.compras.gov.br')) return new Response(JSON.stringify({ resultado: [] }));
    return new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } });
  }});
  const result = await resolve({ linkCompraPNCP: 'https://pncp.gov.br/app/editais/12345678000199/2026/1' });
  assert.equal(result.documentos.length, 1);
  assert.equal(result.documentos[0].url, 'https://portal.gov.br/download/123');
  assert.equal(requested.filter(url => url.includes('/orgaos/')).length, 1);
  assert.ok(requested.some(url => url.includes('/api/consulta/')));
});
test('legacy file route helper shares origin fallback instead of returning PNCP gateway failures', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../apps/api/api/b2g-licitacoes.cjs'), 'utf8');
  const start = source.indexOf('const arquivosCache = new Map();');
  const end = source.indexOf("router.post('/documentos/resolver'", start);
  const fetchImpl = async url => {
    if (String(url).endsWith('/arquivos')) return new Response('', { status: 503 });
    if (String(url).includes('/orgaos/')) return new Response(JSON.stringify({ linkSistemaOrigem: 'https://portal.gov.br/edital.pdf' }));
    return new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } });
  };
  const ctx = { fetch: fetchImpl, AbortSignal, AbortController, setTimeout, clearTimeout, console: { warn: () => {} }, __dirname: path.resolve(__dirname, '../../apps/api/api'), nextUA: () => 'Test', require: name => name === '../lib/editalDocuments.cjs' ? ({ createDocumentResolver: options => createDocumentResolver({ ...options, fetchImpl, lookup: async () => [{ address: '203.0.113.1' }] }) }) : name === '../lib/editalFileCache.cjs' ? require('../../apps/api/lib/editalFileCache.cjs') : require(name) };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.getFiles = getArquivosForEdital;', ctx);
  const docs = await ctx.getFiles('12345678000199', '2026', '1');
  assert.equal(docs[0].url, 'https://portal.gov.br/edital.pdf');
  await assert.rejects(ctx.getFiles('123', '2026', '1'), error => error.status === 400);
});

test('Compras.gov recovers source independently when every PNCP service fails', async () => {
  const requested = [];
  const resolve = createDocumentResolver({ lookup: async () => [{ address: '203.0.113.1' }], getPncpFiles: async () => { throw Error('PNCP 503'); }, fetchImpl: async url => {
    requested.push(String(url));
    if (String(url).includes('pncp.gov.br')) return new Response('', { status: 503 });
    if (String(url).includes('dadosabertos.compras.gov.br')) return new Response(JSON.stringify({ resultado: [{ numeroControlePNCP: '60747318000162-1-001060/2026', idCompra: '53210105010982026' }] }));
    if (String(url).includes('/comprasnet-web/')) return new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } });
    return new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } });
  }});
  const result = await resolve({ numeroControlePNCP: '60747318000162-1-001060/2026' });
  assert.equal(result.documentos.length, 1);
  assert.equal(result.documentos[0].origem, 'COMPRASGOV');
  assert.ok(result.linksOrigem[0].includes('compra=53210105010982026'));
  assert.ok(requested.some(url => url.includes('tipo=numeroControlePNCPCompra&codigo=')));
});
test('atas request their own attachments, distinct from purchase documents', async () => {
  let reference;
  const resolve = createDocumentResolver({ lookup: async () => [{ address: '203.0.113.1' }], getPncpFiles: async () => [], getAtaFiles: async ata => {
    reference = ata;
    return [{ titulo: 'Ata assinada', url: 'https://portal.gov.br/ata.pdf', origem: 'PNCP_ATA' }];
  }, fetchImpl: async url => new Response(JSON.stringify(String(url).includes('dadosabertos') ? { resultado: [] } : {})) });
  const result = await resolve({ linkAtaPNCP: 'https://pncp.gov.br/app/atas/60747318000162/2026/1060/1', numeroControlePncpAta: '60747318000162-1-001060/2026-000001' });
  assert.deepEqual(reference, { cnpj: '60747318000162', ano: '2026', seq: '1060', ata: '1' });
  assert.equal(result.documentos[0].origem, 'PNCP_ATA');
});
test('captcha with HTTP 204 is diagnosed and never presented as a downloadable file', async () => {
  const resolve = createDocumentResolver({ lookup: async () => [{ address: '203.0.113.1' }], fetchImpl: async url => String(url).includes('/comprasnet-web/') ? new Response('<html>SPA</html>') : new Response(null, { status: 204, headers: { 'message-detail': 'Falha na validação do Captcha' } }) });
  const result = await resolve({ idCompra: '53210105010982026' });
  assert.equal(result.documentos.length, 0);
  assert.ok(result.diagnosticos.some(d => /verificação humana/.test(d.mensagem)));
  assert.equal(result.linksOrigem.length, 1);
});
test('real specialized adapters use Compras.gov modality codes, preserving source provenance', async () => {
  const requested = [];
  const { routes } = searchHarness(async value => {
    const url = new URL(value); requested.push(url);
    const code = url.searchParams.get('codigoModalidade');
    return new Response(JSON.stringify({ resultado: [{ numeroControlePNCP: '12345678000199-1-000001/2026', objetoCompra: 'Computadores', dataEncerramentoPropostaPncp: '2099-01-01', idCompra: '53210105010982026', modalidadeNome: code === '5' ? 'Pregão' : 'Dispensa' }] }));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'contratacoes-14133,comprasgov-disputas' });
  assert.equal(body.statusFontes.length, 2);
  assert.ok(body.statusFontes.every(s => s.totalResults > 0));
  assert.ok(requested.every(url => ['5', '6'].includes(url.searchParams.get('codigoModalidade'))));
  assert.equal(body.data[0].origens.length, 2);
});
test('deduplicating PNCP and ARP keeps ATA references and the independent purchase identifier', async () => {
  const { ctx, routes } = searchHarness();
  ctx.inject(Object.fromEntries(ids.map(id => [id, async () => ({ resultados: ['pncp','atas-srp'].includes(id) ? [{ id: id==='pncp' ? 'notice' : 'arp', numeroControlePNCP: '60747318000162-1-001060/2026', fonte: id, ...(id === 'atas-srp' ? { idCompra: '53210105010982026', numeroControlePncpAta: '60747318000162-1-001060/2026-000001', linkAtaPNCP: 'https://pncp.gov.br/app/atas/60747318000162/2026/1060/1', link: 'https://pncp.gov.br/app/atas/60747318000162/2026/1060/1' } : {}) }] : [], errors: [] })])));
  const { body } = await invoke(routes.get('/search'), { fontes: 'pncp,atas-srp' });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].idCompra, '53210105010982026');
  assert.ok(body.data[0].linkAtaPNCP.endsWith('/1060/1'));
  const { atasFromNotice } = require('../../apps/api/lib/editalDocuments.cjs');
  assert.equal(atasFromNotice(body.data[0])[0].ata, '1');
});

const douHtml = items => `<script id="_BuscaDouPortlet_params">${JSON.stringify({ jsonArray: items })}</script>`;
const htmlResponse = html => new Response(html, { headers: { 'content-type': 'text/html' } });

test('DOU queries Paraná, recovers location and money, and counts only the displayed regional notices', async () => {
  let requested;
  const { routes } = searchHarness(async url => {
    requested = new URL(url);
    return htmlResponse(douHtml([
      { classPK: 'pr', title: 'Aviso de licitação nº 12/2026', pubDate: '10/10/2026', hierarchyList: ['Prefeituras', 'Estado do Paraná', 'Prefeitura Municipal de Curitiba'],
        content: 'Redes para escolas. Abertura da sessão em 20/10/2026 às 09:30. Valor total estimado: R$ 183.896,76.', urlTitle: 'aviso-pr' },
      { classPK: 'sp', title: 'Aviso de licitação', pubDate: '10/10/2026', hierarchyList: ['Estado de São Paulo'], content: 'Licitação para redes.', urlTitle: 'aviso-sp' }
    ]));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', uf: 'PR', dataInicio: '2026-10-06', dataFim: '2026-10-13' });
  assert.ok(requested.searchParams.get('q').includes('Paraná'));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].uf, 'PR');
  assert.equal(body.data[0].valor, 183896.76);
  assert.equal(body.data[0].dataEncerramento, '2026-10-20T12:30:00.000Z');
  assert.equal(body.statusFontes[0].totalResults, 2);
  assert.equal(body.statusFontes[0].returnedResults, 1);
  assert.equal(body.diagnosticoFiltros.excluidos.uf, 1);
});

test('DOU reads the original publication to confirm location missing from the search excerpt', async () => {
  const requested = [];
  const { routes } = searchHarness(async url => {
    requested.push(String(url));
    if (String(url).includes('/buscar/')) return htmlResponse(douHtml([{ classPK: 1, title: 'Aviso de licitação', pubDate: '10/10/2026', content: 'Licitação para equipamentos.', urlTitle: 'notice-1' }]));
    return htmlResponse('<div class="texto-dou"><p>Prefeitura Municipal de Curitiba - PR. Licitação para equipamentos.</p><p>Assinado em 10/10/2026. Abertura da sessão em 25/10/2026 às 10:00. Valor global estimado: R$ 10.500,00.</p></div>');
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', uf: 'PR', cidade: 'Curitiba' });
  assert.equal(requested.length, 2);
  assert.equal(body.data[0].uf, 'PR');
  assert.equal(body.data[0].municipio, 'Curitiba');
  assert.equal(body.data[0].valor, 10500);
  assert.equal(body.data[0].dataEncerramento, '2026-10-25T13:00:00.000Z');
});

test('DOU never assigns the requested UF without evidence or mistakes a signature date for a deadline', async () => {
  const { routes } = searchHarness(async url => String(url).includes('/buscar/')
    ? htmlResponse(douHtml([{ classPK: 1, title: 'Aviso de licitação', pubDate: '10/10/2026', content: 'Licitação. Assinado em 13/10/2026.', urlTitle: 'notice-1' }]))
    : htmlResponse('<div class="texto-dou">Licitação. Assinado em 13/10/2026.</div>'));
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', uf: 'PR' });
  assert.equal(body.data.length, 0);
  assert.equal(body.diagnosticoFiltros.excluidos.semUf, 1);
  const nationwide = await invoke(routes.get('/search'), { fontes: 'dou' });
  assert.equal(nationwide.body.data[0].dataEncerramento, null);
  assert.equal(nationwide.body.data[0].uf, '');
});

const curitibaTable = (rows, state = 'state-1', nextPage = false) => `<input name="__VIEWSTATE" value="${state}"><input name="__EVENTVALIDATION" value="validation"><input name="ctl00$cphMasterPrincipal$txtAnoProcesso" value="2026"><table id="cphMasterPrincipal_gdvLicitacao">${rows.map(cells => `<tr class="grid_Row">${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>${nextPage ? '<a href="javascript:__doPostBack(&#39;ctl00$cphMasterPrincipal$ucPaginadorBaixo$2_pg2&#39;,&#39;&#39;)">2</a>' : ''}`;

test('Curitiba submits publication filters and reads all ten columns, excluding old and completed procedures', async () => {
  const posts = [];
  const old = ['DS 1/2026', 'Dispensa', 'COHAB Curitiba', 'Placa de inauguração', 'R$ 0,00', 'COHAB', '', '08/01/2026', '01-283294/2025', 'Cotação Informada'];
  const current = ['DS 9/2026', 'Dispensa', 'Curitiba', 'Equipamentos', 'R$ 0,00', 'Curitiba', '07/10/2026', '20/10/2026', '01-111111/2026', 'Publicado'];
  const completed = ['PE 10/2026', 'Pregão', 'Curitiba', 'Redes', 'R$ 183.896,76', 'Curitiba', '08/10/2026', '21/10/2026', '01-222222/2026', 'Confirmado Vencedor'];
  const { routes } = searchHarness(async (url, options) => {
    if (options.method !== 'POST') return new Response(curitibaTable([old]), { headers: { 'set-cookie': 'session=abc; Path=/' } });
    posts.push({ fields: new URLSearchParams(options.body), cookie: options.headers.Cookie });
    return htmlResponse(curitibaTable([old, current, completed]));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'transparencia-curitiba', uf: 'PR', dataInicio: '2026-10-06', dataFim: '2026-10-13', apenasVigentes: 'true' });
  assert.equal(posts[0].fields.get('ctl00$cphMasterPrincipal$txtDataInicial'), '06/10/2026');
  assert.equal(posts[0].fields.get('ctl00$cphMasterPrincipal$txtDataFinal'), '13/10/2026');
  assert.equal(posts[0].fields.get('ctl00$cphMasterPrincipal$txtAnoProcesso'), '');
  assert.equal(posts[0].cookie, 'session=abc');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].numero, 'DS 9/2026');
  assert.equal(body.data[0].status, 'Publicado');
  assert.equal(body.data[0].protocolo, '01-111111/2026');
  assert.equal(body.data[0].dataSessao, '2026-10-20');
  assert.equal(body.data[0].valor, null);
  assert.equal(body.diagnosticoFiltros.excluidos.encerrados, 1);
});

test('Curitiba pagination preserves refreshed WebForms state and the original filters', async () => {
  const row = number => [`PE ${number}/2026`, 'Pregão', 'Curitiba', 'Computadores', 'R$ 1.234,56', 'Curitiba', '07/10/2026', '20/10/2026', `01-${number}/2026`, 'Publicado'];
  const posts = [];
  const { routes } = searchHarness(async (url, options) => {
    if (options.method !== 'POST') return htmlResponse(curitibaTable([], 'initial'));
    const fields = new URLSearchParams(options.body); posts.push(fields);
    return htmlResponse(posts.length === 1 ? curitibaTable([row(1)], 'refreshed', true) : curitibaTable([row(2)]));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'transparencia-curitiba', dataInicio: '2026-10-06', dataFim: '2026-10-13' });
  assert.equal(body.data.length, 2);
  assert.equal(body.data[1].valor, 1234.56);
  assert.equal(posts[1].get('__VIEWSTATE'), 'refreshed');
  assert.ok(posts[1].get('__EVENTTARGET').endsWith('$2_pg2'));
  assert.equal(posts[1].get('ctl00$cphMasterPrincipal$txtDataInicial'), '06/10/2026');
});

test('PNCP keeps previously collected proposal pages when a subsequent request times out', async () => {
  const { routes } = searchHarness(async url => {
    if (String(url).includes('/proposta')) return new Response(JSON.stringify({ data: [{ numeroControlePNCP: '12345678000199-1-000001/2026', objetoCompra: 'Computadores', unidadeOrgao: { ufSigla: 'PR' }, valorTotalEstimado: 'R$ 1.234,56', dataEncerramentoProposta: '2099-01-01' }] }), { headers: { 'content-type': 'application/json' } });
    return new Promise(() => {});
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'pncp', uf: 'PR', apenasVigentes: 'true' });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].valor, 1234.56);
  assert.equal(body.statusFontes[0].status, 'partial');
  assert.equal(body.statusFontes[0].totalResults, 1);
  assert.ok(body.statusFontes[0].durationMs >= 1000);
});

test('ARP recovers UF and municipality from the managing UASG instead of assuming the requested UF', async () => {
  const { routes } = searchHarness(async url => {
    if (String(url).includes('/modulo-uasg/')) return new Response(JSON.stringify({ resultado: [{ codigoUasg: '123456', siglaUf: 'PR', nomeMunicipioIbge: 'Curitiba' }] }));
    return new Response(JSON.stringify({ resultado: [{ numeroControlePncpAta: '12345678000199-1-000001/2026-000001', codigoUnidadeGerenciadora: 123456, objeto: 'Computadores', dataAssinatura: '2026-10-10', dataVigenciaFinal: '2099-01-01', valorTotal: '10.500,00', statusAta: 'Ativa' }] }));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'atas-srp', uf: 'PR', cidade: 'Curitiba', apenasVigentes: 'true' });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].uf, 'PR');
  assert.equal(body.data[0].municipio, 'Curitiba');
  assert.equal(body.data[0].valor, 10500);
});

test('merging sources recovers missing estimated values without discarding provenance', async () => {
  const { ctx, routes } = searchHarness();
  ctx.inject(Object.fromEntries(ids.map(id => [id, async () => ({ resultados: ['pncp', 'comprasnet'].includes(id) ? [{ id, numeroControlePNCP: 'same', valor: id === 'pncp' ? null : 12345.67, uf: 'PR' }] : [], errors: [] })])));
  const { body } = await invoke(routes.get('/search'), { fontes: 'pncp,comprasnet', uf: 'PR' });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].valor, 12345.67);
  assert.equal(body.data[0].origens.length, 2);
});

test('frontend distinguishes unavailable amounts, session deadlines and proposal start dates', async () => {
  const { formatNoticeValue, isNoticeCurrent, compareNoticeValues } = await import('../../apps/web/src/pages/licitacoes_components/noticeData.mjs');
  assert.equal(formatNoticeValue({ valor: null }), 'Não informado');
  assert.equal(formatNoticeValue({ valor: 0 }), 'Não informado');
  assert.match(formatNoticeValue({ valor: '183.896,76' }), /183\.896,76/);
  assert.equal(isNoticeCurrent({ dataAberturaProposta: '2026-10-01' }, '2026-10-13'), true);
  assert.equal(isNoticeCurrent({ dataSessao: '2026-01-08' }, '2026-10-13'), false);
  assert.equal(isNoticeCurrent({ dataEncerramento: '2026-10-13' }, '2026-10-13'), true);
  assert.equal(isNoticeCurrent({ status: 'Confirmado Vencedor' }, '2026-10-13'), false);
  assert.ok(compareNoticeValues({ valor: null }, { valor: 100 }) > 0);
  assert.ok(compareNoticeValues({ valor: null }, { valor: 100 }, true) > 0);
});

test('workers expose the actual on-demand execution mode instead of implying a continuous scheduler', async () => {
  const { routes } = searchHarness();
  const { body } = await invoke(routes.get('/workers'), {});
  assert.equal(body.executionMode, 'on-demand');
  assert.equal(body.statusStorage, 'process-memory');
  assert.ok(body.workers.every(worker => worker.status === 'idle' && worker.lastRunAt === null));
});

test('DOU geographic pagination uses the official cursor and excludes unrelated publications', async () => {
  const requested = [];
  const { routes } = searchHarness(async url => {
    requested.push(new URL(url));
    if (requested.length === 1) return htmlResponse(douHtml([{ classPK: 99, score: 1.5, displayDateSortable: 12345, title: 'Extrato de contrato', pubDate: '10/10/2026', content: 'Paraná: processo de licitação.' }]) + '<script>var request = {currentPage:1,totalPages:2};</script>');
    return htmlResponse(douHtml([{ classPK: 100, title: 'Aviso de licitação', pubDate: '10/10/2026', hierarchyList: ['Estado do Paraná'], content: 'Licitação de equipamentos. Abertura em 20/10/2026 às 10:00. Valor total: R$ 10.000,00.' }]) + '<script>var request = {currentPage:2,totalPages:2};</script>');
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', uf: 'PR' });
  assert.equal(requested[0].searchParams.get('q'), 'Paraná');
  assert.equal(requested[1].searchParams.get('newPage'), '2');
  assert.equal(requested[1].searchParams.get('id'), '99');
  assert.equal(requested[1].searchParams.get('displayDate'), '12345');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 'dou-100');
});

test('Ji-Paraná publications remain in Rondônia when the state is declared in official metadata', async () => {
  const { routes } = searchHarness(async () => htmlResponse(douHtml([{ classPK: 1, title: 'Aviso de licitação', pubDate: '10/10/2026', hierarchyList: ['Prefeituras', 'Estado de Rondônia', 'Prefeitura Municipal de Ji-Paraná'], content: 'Licitação de equipamentos.' }])));
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', uf: 'PR' });
  assert.equal(body.data.length, 0);
  assert.equal(body.diagnosticoFiltros.excluidos.uf, 1);
  assert.equal(body.diagnosticoFiltros.excluidos.semUf, undefined);
});

test('PNCP proposals published outside the chosen period do not exhaust the result limit', async () => {
  const requested = [];
  const { routes } = searchHarness(async url => {
    requested.push(String(url));
    const old = String(url).includes('/proposta');
    return new Response(JSON.stringify({ data: [{ numeroControlePNCP: old ? 'old' : 'fresh', objetoCompra: 'Equipamentos', unidadeOrgao: { ufSigla: 'PR' }, dataPublicacaoPncp: old ? '2026-08-01' : '2026-10-10', dataEncerramentoProposta: '2099-01-01' }] }), { headers: { 'content-type': 'application/json' } });
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'pncp', uf: 'PR', dataInicio: '2026-10-06', dataFim: '2026-10-13', apenasVigentes: 'true' });
  assert.ok(requested.some(url => url.includes('/publicacao')));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].numeroControlePNCP, 'fresh');
});

test('an older overlapping search cannot overwrite worker status from the latest search', async () => {
  const { ctx, routes } = searchHarness();
  ctx.inject(Object.fromEntries(ids.map(id => [id, async params => {
    if (params.objeto === 'older') await new Promise(resolve => setTimeout(resolve, 30));
    return { resultados: Array.from({ length: params.objeto === 'older' ? 1 : 2 }, (_, i) => ({ id: `${params.objeto}-${i}` })), errors: [] };
  }])));
  await Promise.all([invoke(routes.get('/search'), { fontes: 'dou', objeto: 'older' }), invoke(routes.get('/search'), { fontes: 'dou', objeto: 'newer' })]);
  const { body } = await invoke(routes.get('/workers'), {});
  assert.equal(body.workers.find(worker => worker.id === 'dou').totalResults, 2);
});

test('Curitiba supports ASP.NET asynchronous postbacks and updated hidden fields', async () => {
  const row = ['PE 1/2026', 'Pregão', 'Curitiba', 'Computadores', 'R$ 1.234,56', 'Curitiba', '07/10/2026', '20/10/2026', '01-123/2026', 'Publicado'];
  const chunk = (type, id, content) => `${content.length}|${type}|${id}|${content}|`;
  const posts = [];
  const { routes } = searchHarness(async (url, options) => {
    if (options.method !== 'POST') return htmlResponse(curitibaTable([]) + '<input name="ctl00$smaMasterPrincipal" value="">');
    posts.push({ fields: new URLSearchParams(options.body), headers: options.headers });
    const currentRow = posts.length === 1 ? row : ['PE 2/2026', ...row.slice(1)];
    const panel = curitibaTable([currentRow], 'unused', posts.length === 1).replace(/<input\b[^>]*>/g, '');
    return htmlResponse(chunk('updatePanel', 'cphMasterPrincipal_uplGrid', panel) + chunk('hiddenField', '__VIEWSTATE', 'fresh-state') + chunk('hiddenField', '__EVENTVALIDATION', 'fresh-validation'));
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'transparencia-curitiba', uf: 'PR', dataInicio: '2026-10-06', dataFim: '2026-10-13' });
  assert.equal(body.data.length, 2);
  assert.equal(posts[0].fields.get('__ASYNCPOST'), 'true');
  assert.equal(posts[0].fields.get('ctl00$smaMasterPrincipal'), 'ctl00$cphMasterPrincipal$uplGrid|ctl00$cphMasterPrincipal$lnbPesquisar');
  assert.equal(posts[0].headers['X-MicrosoftAjax'], 'Delta=true');
  assert.equal(posts[1].fields.get('__VIEWSTATE'), 'fresh-state');
  assert.equal(posts[1].fields.get('__EVENTVALIDATION'), 'fresh-validation');
  assert.equal(body.data[0].valor, 1234.56);
});

test('DOU search enriches values and purchase references even when PNCP is not selected as a search source', async () => {
  const { routes } = searchHarness(async value => {
    const url = new URL(value);
    if (url.hostname === 'www.in.gov.br' && url.pathname.includes('/consulta/')) return new Response('<script id="BuscaDouPortlet_params">'+JSON.stringify({ jsonArray: [{ classPK: 'dou-real', title: 'AVISO DE LICITAÇÃO', pubDate: '13/10/2026', urlTitle: 'aviso-real', content: 'Pregão Eletrônico nº 65/2026. UASG: 389461. Objeto: Microsoft Office365. Abertura: 27/10/2026 às 09:00.' }] })+'</script>');
    if (url.hostname === 'www.in.gov.br') return new Response('<div class="texto-dou">Pregão Eletrônico nº 65/2026. UASG: 389461. Objeto: Microsoft Office365. Abertura: 27/10/2026 às 09:00.</div>');
    if (url.pathname.includes('1.1_consultarContratacoes')) return new Response(JSON.stringify({ resultado: [] }));
    if (url.pathname.includes('1_consultarUasg')) return new Response(JSON.stringify({ resultado: [{ codigoUasg: '389461', cnpjCpfOrgao: '60975075000110' }] }));
    if (url.pathname.includes('/contratacoes/publicacao')) return new Response(JSON.stringify({ data: [{ numeroControlePNCP: '60975075000110-1-000123/2026', numeroCompra: '65', anoCompra: 2026, modalidadeId: 6, valorTotalEstimado: 2982984.84, orgaoEntidade: { cnpj: '60975075000110' }, unidadeOrgao: { codigoUnidade: '389461', ufSigla: 'SP' } }], totalPaginas: 1 }));
    throw Error('Unexpected request: '+url);
  });
  const { body } = await invoke(routes.get('/search'), { fontes: 'dou', objeto: 'Office365', dataInicio: '2026-10-06', dataFim: '2026-10-13' });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].valor, 2982984.84);
  assert.equal(body.data[0].fonte, 'Imprensa Nacional (DOU)');
  assert.equal(body.data[0].sequencialCompra, 123);
  assert.equal(body.data[0].link, 'https://www.in.gov.br/web/dou/-/aviso-real');
  assert.equal(body.data[0].dataPublicacao, '2026-10-13T00:00:00-03:00');
});
