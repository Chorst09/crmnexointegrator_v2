'use strict';
// All API calls are mocked; no real CRM records are read or changed.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [], writes = [];
    const user = { id: 'paste-qa', name: 'QA', role: 'MASTER', accessB2B: true };
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(user => {
      localStorage.setItem('token', 'mock-only');
      localStorage.setItem('user', JSON.stringify(user));
    }, user);
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (request.method() !== 'GET') writes.push(request.method());
      const path = new URL(request.url()).pathname;
      const data = path.endsWith('/auth/me') ? { user }
        : path.endsWith('/users') ? [user] : [];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(`${process.argv[2] || 'http://127.0.0.1:5312'}/oportunidades?newOpportunity=1`);
    const heading = page.getByRole('heading', { name: 'Nova Oportunidade', exact: true });
    await heading.waitFor();
    const title = page.locator('form input').first();
    await title.fill('Rascunho ');
    await title.press('End');
    await page.evaluate(() => navigator.clipboard.writeText('copiado com acentuação'));
    await title.press('ControlOrMeta+v');
    await page.waitForFunction(() => document.querySelector('form input')?.value.includes('acentuação'));
    const expected = await title.inputValue();
    const otherTab = await context.newPage();
    await otherTab.bringToFront();
    await page.bringToFront();
    // A return click outside the form used to close it and discard all fields.
    await page.locator('div.fixed.inset-0').last().click({ position: { x: 2, y: 2 } });
    assert.equal(await heading.isVisible(), true);
    assert.equal(await title.inputValue(), expected);
    assert.equal(new URL(page.url()).pathname, '/oportunidades');
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await heading.count(), 0);
    console.log('Cadastro B2B preservado após colagem real, troca de aba e clique externo; Cancelar continua funcionando.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
