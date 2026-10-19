const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filter = import('../../apps/api/lib/itNoticeFilter.mjs');

test('qualifies IT families beyond configured products, including items and accented descriptions', async () => {
  const { isITNotice } = await filter;
  for (const titulo of [
    'Aquisição de computadores e notebooks', 'Contratação de Microsoft 365',
    'Serviços de segurança da informação e pentest', 'Aquisição de HSM para proteção de chaves',
    'Licenciamento de Kubernetes para aplicações', 'Aquisição de servidor Dell R750',
    'Aquisição de switch de rede de 24 portas', 'Locação de impressoras',
    'Aquisição de monitor LED 27 polegadas', 'Serviços de consultoria em TI',
    'Contratação de links dedicados e SD-WAN', 'Instalação de cabeamento estruturado',
    'Aquisição de rack 19 polegadas', 'Serviços de virtualização e hiperconvergência',
    'Aquisição de servidores com fonte de alimentação redundante'
  ]) assert.equal(isITNotice({ titulo }), true, titulo);
  assert.equal(isITNotice({ titulo: 'Aquisição de equipamentos', itens: [{ descricao: 'Notebook 16 GB RAM' }] }), true);
});

test('rejects generic words, substring matches, medical equipment and contracting-agency names', async () => {
  const { isITNotice } = await filter;
  for (const titulo of [
    'Aquisição de tinta e materiais de limpeza', 'Manutenção predial', 'Desenvolvimento de projeto urbanístico',
    'Suporte técnico para aparelhos de ar condicionado', 'Licença ambiental e consultoria',
    'Fornecimento de redes de proteção', 'Pagamento de benefícios dos servidores públicos',
    'Aquisição de monitor multiparamétrico hospitalar', 'Aquisição de scanner intraoral odontológico',
    'Aquisição de fibra óptica para equipamento cirúrgico laser', 'Compra de container para resíduos',
    'Aquisição de automóvel com computador de bordo', 'Móveis multifuncionais',
    'Serviços de monitor escolar', 'Assistência aos servidores municipais',
    'Projetos de tecnologia para cultivo agrícola', 'Aquisição de alimento. Veja https://software.gov.br/licitacoes'
  ]) assert.equal(isITNotice({ titulo }), false, titulo);
  assert.equal(isITNotice({ titulo: 'Aquisição de cadeiras', orgao: 'Secretaria de Tecnologia da Informação', orgaoEntidade: { razaoSocial: 'Departamento de TI' } }), false);
  assert.equal(isITNotice({ titulo: 'Aquisição de computadores para hospital' }), true);
});

test('product search requires every meaningful term and supports aliases, plurals and accents', async () => {
  const { matchesProductQuery } = await filter;
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de notebooks Dell de 16 GB' }, 'notebook dell'), true);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de laptops Dell' }, 'notebook'), true);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de switch 24 portas' }, 'switch de 24 portas'), true);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de switch 8 portas' }, 'switch 24 portas'), false);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de switch 24 portas' }, 'switch 8 portas'), false);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de notebooks Lenovo' }, 'notebook Dell'), false);
  assert.equal(matchesProductQuery({ titulo: 'Licenciamento de antivírus' }, 'antivirus'), true);
  assert.equal(matchesProductQuery({ titulo: 'Licenças Office365 E3' }, 'Microsoft 365'), true);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de tintas' }, 'TI'), false);
  assert.equal(matchesProductQuery({ titulo: 'Aquisição de cadeiras', orgao: 'Departamento de Notebooks' }, 'notebook'), false);
  assert.equal(matchesProductQuery({ titulo: 'Contratação de serviços', itens: [{ descricao: 'Software Zabbix' }] }, 'Zabbix'), true);
});

test('interest products never qualify a non-IT notice or turn into a restrictive allowlist', async () => {
  const { getInterestMatches, sanitizeInterestProducts, isITNotice } = await filter;
  assert.deepEqual(getInterestMatches({ titulo: 'Aquisição de pão e leite' }, ['pão']), []);
  assert.equal(isITNotice({ titulo: 'Implantação de SIEM' }), true);
  assert.deepEqual(getInterestMatches({ titulo: 'Implantação de SIEM' }, ['notebook']), []);
  assert.deepEqual(sanitizeInterestProducts(['Notébook', 'notebook', ' ', null]), ['Notébook']);
  assert.deepEqual(sanitizeInterestProducts([]), []);
});

function harness(file) {
  const routes = new Map();
  const router = { get: (url, ...handlers) => routes.set(url, handlers.at(-1)) };
  const ctx = { require: name => name === 'express' ? { Router: () => router } : name === 'jsonwebtoken' ? {} : name === '../lib/b2gLocation.cjs' ? require('../../apps/api/lib/b2gLocation.cjs') : name === '../lib/douNotice.cjs' ? require('../../apps/api/lib/douNotice.cjs') : require(name),
    module: { exports: {} }, process: { env: { JWT_SECRET: 'test-only', B2G_SOURCE_TIMEOUT_MS: '1000' } },
    URL, URLSearchParams, AbortSignal, AbortController, global: { fetch: () => { throw Error('No upstream access in this test'); } }, setTimeout, clearTimeout, console, itNoticeFilterPromise: filter };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.resolve(file), 'utf8') + '\nloadITNoticeFilter=async()=>{itNoticeFilter=await itNoticeFilterPromise;return itNoticeFilter;};globalThis.setNotices=notices=>{buscarPNCPAgregado=async()=>({resultados:notices,errors:[]});};', ctx);
  return { ctx, handler: routes.get('/search') };
}
async function invoke(handler, query) {
  let body;
  await handler({ query }, { json: value => { body = JSON.parse(JSON.stringify(value)); }, status: () => ({ json: value => { body = value; } }) });
  return body;
}

for (const file of ['apps/api/api/b2g-search.cjs', 'backend/api/b2g-search.js']) {
  test(`${file}: default discovery and manual search always exclude non-IT`, async () => {
    const { ctx, handler } = harness(file);
    ctx.setNotices([
      { id: 'notebook', titulo: 'Aquisição de notebooks Dell', fonte: 'PNCP' },
      { id: 'unlisted', titulo: 'Implantação de software Zabbix', fonte: 'PNCP' },
      { id: 'non-it', titulo: 'Aquisição de pão', fonte: 'PNCP' },
      { id: 'medical', titulo: 'Aquisição de monitor multiparamétrico', fonte: 'PNCP' }
    ]);
    let body = await invoke(handler, { fontes: 'pncp', produtosInteresse: '["notebook","pão"]' });
    assert.deepEqual(body.data.map(row => row.id).sort(), ['notebook', 'unlisted']);
    assert.equal(body.diagnosticoFiltros.excluidos.foraTI, 2);
    body = await invoke(handler, { fontes: 'pncp', produtosInteresse: '[]', objeto: 'Zabbix' });
    assert.deepEqual(body.data.map(row => row.id), ['unlisted']);
    body = await invoke(handler, { fontes: 'pncp', somenteTI: 'false', filtroProdutosAtivo: 'false', objeto: 'pão', produtosInteresse: '["pão"]' });
    assert.equal(body.total, 0);
    body = await invoke(handler, { fontes: 'pncp', filtroProdutosAtivo: 'false', objeto: 'notebook Dell' });
    assert.deepEqual(body.data.map(row => row.id), ['notebook']);
    assert.deepEqual(body.data[0].classificacaoTI.produtosInteresse, []);
    body = await invoke(handler, { fontes: 'pncp', filtroProdutosAtivo: 'false' });
    assert.equal(body.total, 0);
    assert.ok(body.info.includes('Digite um produto de TI'));
  });
}
