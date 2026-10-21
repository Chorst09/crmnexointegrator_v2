'use strict';
// All API requests are intercepted; this check never reads or changes live CRM records.
// Usage: node scripts/tests/b2b-dashboard-ui.cjs http://127.0.0.1:5312
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const user = { id: 'qa-master', name: 'QA local', role: 'MASTER', accessB2B: true, email: 'qa@localhost.invalid' };
const owners = [{ id: 'qa-owner-1', name: 'Silvana QA' }, { id: 'qa-owner-2', name: 'Carlos QA' }, { id: 'qa-owner-3', name: 'Ana QA' }];
const now = new Date();
const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(now));
const future = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
const rows = Array.from({ length: 362 }, (_, index) => ({
  id: `qa-opp-${index}`, title: `Oportunidade QA ${index + 1}`, stage: index < 14 ? 'LOST' : index < 26 ? 'NEGOTIATION' : 'LEAD',
  ownerId: owners[index % 3].id, owner: owners[index % 3], company: { id: `qa-company-${index}`, name: `Empresa QA ${index}` },
  value: (index + 1) * 100, probability: index < 14 ? 0 : index < 26 ? 70 : 15,
  leadEntryDate: `${year}-03-01`, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  expectedCloseDate: index >= 14 && index < 26 ? future : null,
  actualCloseDate: index < 14 ? `${year}-04-01` : null,
  projectTower: ['Conectividade', 'Servidores', 'Segurança'][index % 3], projectClientType: index % 10 ? 'NEW_CLIENT' : 'BASE_CLIENT',
  leadSourceDetail: ['SDR', 'Gerente de Contas', 'Pré-Vendas'][index % 3]
}));

(async () => {
  const { buildB2BDashboardAnalytics } = await import('../../apps/api/lib/b2bDashboardAnalytics.js');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    const errors = [], queries = [];
    let unavailable = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(user => {
      localStorage.setItem('token', 'ui-fixture-only');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('crm-theme', 'dark');
    }, user);
    await page.route('**/api/**', async route => {
      assert.equal(route.request().method(), 'GET', 'Dashboard must not mutate records');
      const url = new URL(route.request().url());
      let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { user };
      else if (url.pathname.endsWith('/users')) data = owners;
      else if (url.pathname.endsWith('/settings')) data = {};
      else if (url.pathname.endsWith('/dashboard')) {
        queries.push(Object.fromEntries(url.searchParams));
        if (unavailable) { await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); return; }
        const ownerId = url.searchParams.get('ownerId');
        const temperature = url.searchParams.get('temperature');
        const filtered = rows.filter(row => (!ownerId || row.ownerId === ownerId) && (!temperature || (temperature === '0' ? row.probability === 0 : row.probability > Number(temperature) - 25 && row.probability <= Number(temperature))));
        data = { ...buildB2BDashboardAnalytics(filtered, { now, period: url.searchParams.get('period') }), opportunities: filtered };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto((process.argv[2] || 'http://127.0.0.1:5312') + '/dashboard-b2b');
    await page.getByRole('heading', { name: 'Carteira por Gerente', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 14);
    const table = page.locator('.pipeline-model__table-panel');
    assert.equal(await table.locator('tbody tr').count(), 3);
    assert.equal(await table.locator('tbody tr').evaluateAll(rows => rows.reduce((sum, row) => sum + Number(row.cells[1].textContent), 0)), 348);
    assert.ok(await page.getByText('362 entradas e 0 vendas ganhas no período', { exact: true }).isVisible());
    assert.ok(!(await page.getByText('Sem dados para o periodo selecionado').count()));
    assert.ok(!(await page.getByText('Meta 85%').count()));
    const revenueRegion = page.getByRole('region', { name: 'Receitas recorrentes e pontuais' });
    assert.equal(await revenueRegion.getByText('Receita mensal ativa (MRR)', { exact: true }).count(), 1);
    assert.equal(await revenueRegion.getByText('Evolução das Receitas', { exact: true }).count(), 1);
    assert.equal(await revenueRegion.getByText('Composição da Receita', { exact: true }).count(), 1);
    await revenueRegion.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/b2b-dashboard-revenue.png' });
    await page.waitForTimeout(900); // Chart.js entrance animation.
    await page.screenshot({ path: '/tmp/b2b-dashboard-desktop.png' });
    await page.locator('.pipeline-model__bottom-grid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/b2b-dashboard-insights.png' });
    await page.getByRole('region', { name: 'Análises da carteira em aberto' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/b2b-dashboard-analysis.png' });
    await page.getByLabel('Período', { exact: true }).selectOption('30d');
    await page.getByText('0 entradas e 0 vendas ganhas no período', { exact: true }).waitFor();
    assert.equal(await table.locator('tbody tr').evaluateAll(rows => rows.reduce((sum, row) => sum + Number(row.cells[1].textContent), 0)), 348);
    await page.getByLabel('Gerente', { exact: true }).selectOption('qa-owner-2');
    await page.waitForFunction(() => document.querySelectorAll('.pipeline-model__table-panel tbody tr').length === 1);
    assert.ok(queries.at(-1).ownerId === 'qa-owner-2');
    await page.getByLabel('Temperatura', { exact: true }).selectOption('0');
    await page.getByText('Nenhuma oportunidade em aberto nos filtros selecionados.', { exact: true }).first().waitFor();
    assert.ok(queries.at(-1).temperature === '0');
    await page.getByLabel('Limpar filtros').click();
    await page.waitForFunction(() => document.querySelectorAll('.pipeline-model__table-panel tbody tr').length === 3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 1);
    await page.locator('.pipeline-model__toolbar').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/b2b-dashboard-mobile.png' });
    const dimensions = await page.locator('.pipeline-model').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
    unavailable = true;
    await page.getByLabel('Atualizar dados', { exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar' }).waitFor();
    assert.equal(await table.locator('tbody tr').count(), 3, 'Last successful portfolio must be preserved');
    unavailable = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar' }).waitFor({ state: 'hidden' });
    await page.screenshot({ path: '/tmp/b2b-dashboard-mobile-full.png', fullPage: true });
    unavailable = true;
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar' }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0, 'A failed first request must not look like an empty portfolio');
    assert.deepEqual(errors, []);
    console.log('B2B UI passed: 362 records without wins, 14 charts, filters, zero history, mobile layout, API failure/retry and no writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
