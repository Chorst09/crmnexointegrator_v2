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
  const ctx = { require: name => name === 'express' ? { Router: () => router } : name === 'jsonwebtoken' ? {} : require(name),
    module: { exports: {} }, process: { env: { JWT_SECRET:'test-only', B2G_SOURCE_TIMEOUT_MS:'1000' } },
    URL, AbortSignal, AbortController, global: { fetch: fetchImpl }, setTimeout, clearTimeout, console };
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
