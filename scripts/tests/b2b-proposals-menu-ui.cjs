'use strict';
// Mocked API: validates sidebar visibility and route access without real CRM data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    for (const role of ['USER', 'SELLER', 'USER_B2B']) {
      for (const accessB2B of [true, false]) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage();
        const errors = [];
        const user = { id: 'qa-proposals', name: 'QA', role, accessB2B, accessB2G: false, accessSimulador: false };
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(user => {
          localStorage.setItem('token', 'mock-only');
          localStorage.setItem('user', JSON.stringify(user));
        }, user);
        await page.route('**/api/**', async route => {
          const path = new URL(route.request().url()).pathname;
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify(path.endsWith('/auth/me') ? { user } : []) });
        });
        await page.goto(`${process.argv[2] || 'http://127.0.0.1:5312'}/propostas`);
        const link = page.locator('a[href="/propostas"]');
        if (accessB2B) {
          await page.getByRole('heading', { name: 'Propostas e Cotações', exact: true }).waitFor();
          await link.waitFor();
          assert.equal(await link.getAttribute('href'), '/propostas');
          assert.equal(await page.locator('a[href="/simuladores"]').count(), 0);
          await link.click();
          await page.getByRole('heading', { name: 'Lista de Propostas', exact: true }).waitFor();
        } else {
          await page.getByRole('heading', { name: 'Acesso negado', exact: true }).waitFor();
          assert.equal(await link.count(), 0);
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
    console.log('Propostas visível e acessível para USER, SELLER e USER_B2B com B2B ativo, independente do Simulador; B2B desativado continua bloqueado.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
