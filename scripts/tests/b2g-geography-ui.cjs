'use strict';
// Somente leitura: todas as APIs do CRM são simuladas.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const user = { id: 'qa-geography', name: 'QA', role: 'MASTER', accessB2G: true, accessB2B: true, email: 'qa@localhost.invalid' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const makeNotice = (id, municipio, uf) => ({ id, titulo: `Computadores para ${municipio}`, orgao: 'Órgão QA', fonte: 'PNCP', sourceId: 'pncp', uf, municipio, modalidade: 'Pregão', status: 'Publicado', dataPublicacao: today, dataEncerramento: '2099-01-01', valor: 10000 });
const notices = [makeNotice('curitiba', 'Curitiba', 'PR'), makeNotice('londrina', 'Londrina', 'PR'), makeNotice('sp', 'São Paulo', 'SP')];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
  const errors = [], queries = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(user => { localStorage.setItem('token', 'qa-only'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('pipeline_active_sources_v2', JSON.stringify(['pncp'])); }, user);
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.startsWith('/api/')) return route.continue();
      assert.equal(req.method(), 'GET');
      let body = [];
      if (url.pathname.endsWith('/auth/me')) body = { user };
      else if (url.pathname.endsWith('/settings')) body = {};
      else if (url.pathname.endsWith('/b2g-search/search')) {
        const query = Object.fromEntries(url.searchParams); queries.push(query);
        const rows = notices.filter(n => (!query.uf || n.uf === query.uf) && (!query.cidade || n.municipio === query.cidade));
        const adjusted = query.dataFim > today;
        body = { data: rows, total: rows.length, periodoConsulta: { dataInicio: query.dataInicio, dataFim: adjusted ? today : query.dataFim }, avisoPeriodo: adjusted ? 'A data final de publicação foi ajustada para hoje; editais ainda não publicados não entram na consulta.' : undefined,
          statusFontes: [{ id: 'pncp', nome: 'PNCP Oficial', totalResults: rows.length, status: 'fallback', fallback: 'Compras.gov.br', warnings: ['Consulta alternativa oficial concluída.'] }] };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto((process.argv[2] || 'http://127.0.0.1:5317') + '/b2g-buscar-editais');
    await page.getByRole('heading', { name: 'Computadores para São Paulo', exact: true }).waitFor();
    const state = page.getByRole('combobox', { name: 'Estado', exact: true });
    const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
    await state.selectOption('PR');
    await page.waitForResponse(r => r.url().includes('/b2g-search/search') && new URL(r.url()).searchParams.get('uf') === 'PR');
    await page.getByRole('heading', { name: 'Computadores para Londrina', exact: true }).waitFor();
    await city.fill('Curitiba');
    assert.ok(await page.getByRole('heading', { name: 'Computadores para Londrina', exact: true }).isVisible(), 'A draft city must not erase fetched results');
    await city.press('Enter');
    await page.waitForResponse(r => r.url().includes('/b2g-search/search') && new URL(r.url()).searchParams.get('cidade') === 'Curitiba');
    await page.getByRole('heading', { name: 'Computadores para Curitiba', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Computadores para Londrina', exact: true }).count(), 0);
    assert.equal(queries.at(-1).uf, 'PR'); assert.equal(queries.at(-1).cidade, 'Curitiba');
    assert.ok(await page.getByText(/alternativa: Compras.gov.br/).isVisible());
    await page.getByRole('textbox', { name: 'Publicado até', exact: true }).fill('2099-12-19');
    await page.getByRole('button', { name: 'Buscar editais', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'ajustada para hoje' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Publicado até', exact: true }).inputValue(), today);
    await page.screenshot({ path: '/tmp/b2g-geography-curitiba.png' });
    await state.selectOption('SP');
    await page.getByRole('heading', { name: 'Computadores para São Paulo', exact: true }).waitFor();
    assert.equal(await city.inputValue(), '', 'An incompatible city must clear when its state changes');
    assert.equal(queries.at(-1).cidade, ''); assert.equal(queries.at(-1).uf, 'SP');
    assert.deepEqual(errors, []);
    console.log('Geography UI passed: state/city request, Enter, draft preservation, state change, alternative label, publication-date correction and no CRM writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
