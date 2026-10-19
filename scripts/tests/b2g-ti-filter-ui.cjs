'use strict';
// API calls are mocked; this check never updates CRM records.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const user = { id: 'qa-ti-master', name: 'QA TI', role: 'MASTER', accessB2G: true, accessB2B: true, email: 'qa@localhost.invalid' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const deadline = new Date(Date.now() + 3 * 86400000).toISOString();
const makeNotice = (id, titulo, extras = {}) => ({ id, titulo, orgao: 'Órgão QA', fonte: 'PNCP', sourceId: 'pncp', uf: 'PR', municipio: 'Curitiba', modalidade: 'Pregão', status: 'Publicado', dataPublicacao: today, dataEncerramento: deadline, valor: 10000, ...extras });
const initial = [
  makeNotice('notebook', 'Aquisição de notebooks Dell 16 GB'),
  makeNotice('hsm', 'Aquisição de HSM para proteção de chaves'),
  makeNotice('medical', 'Aquisição de monitor multiparamétrico hospitalar'),
  makeNotice('generic', 'Manutenção predial e compra de tintas'),
  makeNotice('agency', 'Aquisição de cadeiras', { orgao: 'Secretaria de Tecnologia da Informação' })
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let page;
  const errors = [], queries = [];
  try {
    page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(user => {
      localStorage.setItem('token', 'ui-fixture-only');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('crm-theme', 'dark');
      localStorage.setItem('pipeline_active_sources_v2', JSON.stringify(['pncp']));
    }, user);
    await page.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      // Vite serves the shared classifier through /@fs/.../apps/api/lib/.
      if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
      assert.equal(req.method(), 'GET', 'This screen must not write CRM records');
      let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { user };
      else if (url.pathname.endsWith('/settings')) data = {};
      else if (url.pathname.endsWith('/workers')) data = { workers: [{ id: 'pncp', status: 'fallback', totalResults: 12, returnedResults: 2, fallback: 'Compras.gov.br', warnings: ['Diagnóstico completo: fonte principal indisponível; consulta oficial alternativa concluída.'] }] };
      else if (url.pathname.endsWith('/b2g-search/search')) {
        const query = Object.fromEntries(url.searchParams);
        queries.push(query);
        if (query.filtroProdutosAtivo === 'false' && !query.objeto) {
          data = { data: [], total: 0, info: 'Digite um produto de TI para buscar editais ou ative a descoberta automática em Configurações.' };
        } else {
          const rows = query.objeto.toLowerCase() === 'zabbix' ? [makeNotice('zabbix', 'Implantação de software Zabbix')] : query.objeto.toLowerCase() === 'pão' ? [makeNotice('food', 'Aquisição de pão')] : initial;
          data = { data: rows, total: rows.length };
        }
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto((process.argv[2] || 'http://127.0.0.1:5314') + '/b2g-buscar-editais');
    await page.getByRole('heading', { name: initial[0].titulo, exact: true }).waitFor();
    assert.ok(await page.getByRole('heading', { name: initial[1].titulo, exact: true }).isVisible());
    assert.equal(await page.getByRole('heading', { name: /monitor multiparamétrico|Manutenção predial|Aquisição de cadeiras/ }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Filtro Automático de Produtos de TI', exact: true }).count(), 0);
    assert.equal(queries.at(-1).filtroProdutosAtivo, 'true');
    assert.equal(queries.at(-1).somenteTI, 'true');
    const product = page.getByRole('textbox', { name: 'Produto de TI', exact: true });
    await product.fill('Zabbix');
    await product.press('Enter');
    await page.getByRole('heading', { name: 'Implantação de software Zabbix', exact: true }).waitFor();
    assert.equal(queries.at(-1).objeto, 'Zabbix', 'Search must reach the API for a product absent from the initial results');
    assert.ok(!JSON.parse(queries.at(-1).produtosInteresse).includes('zabbix'));
    await page.screenshot({ path: '/tmp/b2g-ti-product-search.png' });
    await product.fill('pão');
    await page.getByRole('button', { name: 'Buscar editais', exact: true }).click();
    await page.getByRole('heading', { name: 'Nenhum edital encontrado', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Aquisição de pão', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Configurar produtos', exact: true }).click();
    await page.getByRole('heading', { name: 'Filtro Automático de Produtos de TI', exact: true }).waitFor();
    const sourceRow = page.getByRole('row').filter({ hasText: 'PNCP Oficial' });
    await sourceRow.getByText('Fonte alternativa', { exact: true }).waitFor();
    assert.ok(await sourceRow.getByText('12 coletados antes dos filtros', { exact: true }).isVisible());
    await sourceRow.getByText('Ver diagnóstico · Compras.gov.br', { exact: true }).click();
    assert.ok(await sourceRow.getByText('Diagnóstico completo: fonte principal indisponível; consulta oficial alternativa concluída.', { exact: true }).isVisible());
    const automatic = page.getByRole('checkbox', { name: 'Descoberta automática de produtos de TI', exact: true });
    assert.ok(await automatic.isChecked());
    await page.getByRole('button', { name: 'Remover notebook', exact: true }).click();
    await page.getByRole('textbox', { name: 'Adicionar produto de interesse', exact: true }).fill('Zabbix');
    await page.getByRole('button', { name: 'Adicionar produto', exact: true }).click();
    await page.getByRole('button', { name: 'Remover Zabbix', exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/b2g-ti-product-settings.png' });
    await page.getByRole('button', { name: /Buscar Editais Busca avançada/ }).click();
    await page.getByRole('heading', { name: initial[0].titulo, exact: true }).waitFor();
    assert.equal(queries.at(-1).fontes, 'pncp', 'Opening settings must preserve paused sources');
    assert.ok(!JSON.parse(queries.at(-1).produtosInteresse).includes('notebook'));
    assert.ok(JSON.parse(queries.at(-1).produtosInteresse).includes('zabbix'));
    await page.getByRole('button', { name: 'Configurar produtos', exact: true }).click();
    await automatic.uncheck();
    await page.getByRole('button', { name: /Buscar Editais Busca avançada/ }).click();
    await page.getByText('Digite um produto de TI para buscar editais ou ative a descoberta automática em Configurações.', { exact: true }).waitFor();
    await product.fill('notebook Dell');
    await product.press('Enter');
    await page.getByRole('heading', { name: initial[0].titulo, exact: true }).waitFor();
    assert.equal(queries.at(-1).filtroProdutosAtivo, 'false');
    assert.equal(await page.getByRole('heading', { name: initial[1].titulo, exact: true }).count(), 0);
    await page.reload();
    await page.getByRole('button', { name: 'Configurar produtos', exact: true }).click();
    await automatic.waitFor();
    assert.equal(await automatic.isChecked(), false, 'Explicit manual mode must survive reload');
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    assert.ok(await automatic.isChecked());
    assert.ok(await page.getByRole('button', { name: 'Remover notebook', exact: true }).isVisible());
    assert.deepEqual(errors, []);
    console.log('TI UI passed: settings location, enabled default, IT-only results, unlisted product search, interest persistence, manual mode, source preservation and no writes.');
  } catch (error) {
    console.error(JSON.stringify({ errors, queries: queries.slice(-3), body: (await page.locator('body').innerText()).slice(0, 2500) }));
    await page.screenshot({ path: '/tmp/b2g-ti-ui-failure.png' });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
