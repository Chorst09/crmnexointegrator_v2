'use strict';
// Usage: node scripts/tests/opportunity-edit-ui.cjs http://127.0.0.1:5312
// All API requests are intercepted: this check never updates real CRM records.
const { chromium } = require(process.cwd() + '/node_modules/playwright');
const assert = require('node:assert/strict');

const user = { id: 'qa-master', name: 'QA local', role: 'MASTER', accessB2B: true, email: 'qa@localhost.invalid' };
const owner = { id: 'qa-owner', name: 'Silvana QA', role: 'USER_B2B', accessB2B: true };
const company = { id: 'qa-company', name: 'Empresa QA Veículos Elétricos', clientType: 'B2B' };
const opportunity = {
  id: 'qa-opportunity', title: 'E martCar - Servidores QA', number: 'B2B-2026-00364',
  projectName: 'Servidores', negotiationType: 'Nova Venda', projectClientType: 'NEW_CLIENT',
  projectType: 'SINGLE', value: 36, probability: 15, stage: 'LEAD',
  companyId: company.id, company, ownerId: owner.id, owner,
  expectedCloseDate: '2026-05-24T12:00:00Z', createdAt: '2026-04-01T12:00:00Z', products: []
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(user => {
      localStorage.setItem('token', 'ui-fixture-only');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('crm-theme', 'dark');
    }, user);
    await page.route('**/api/**', async route => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      let data = [];
      if (req.method() !== 'GET') {
        assert.ok(path.includes('/opportunities/qa-opportunity'));
        const body = req.postDataJSON();
        writes.push({ method: req.method(), body });
        Object.assign(opportunity, body);
        data = opportunity;
      } else if (path.endsWith('/auth/me')) data = { user };
      else if (path.endsWith('/opportunities')) data = [opportunity];
      else if (path.endsWith('/companies')) data = [company];
      else if (path.endsWith('/users')) data = [user, owner];
      else if (path.endsWith('/settings')) data = {};
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });

    await page.goto((process.argv[2] || 'http://127.0.0.1:5312') + '/oportunidades');
    await page.getByRole('button', { name: 'Kanban', exact: true }).click();
    await page.locator('button[title="Editar"]').first().click();
    if (process.env.EXPECT_EDIT_FAILURE === '1') {
      await page.waitForTimeout(500);
      assert.ok(errors.some(error => error.includes('normalizeText is not defined')), JSON.stringify(errors));
      console.log('Falha reproduzida no Kanban: ' + errors.join('; '));
      return;
    }

    await page.getByRole('heading', { name: 'Editar Oportunidade', exact: true }).waitFor();
    for (const obsoleteLabel of ['Meses de Contrato', 'Valor Mensal (R$)', 'Taxa de Instalação (R$)', 'Valor (R$)']) {
      assert.equal(await page.locator('form label').filter({ hasText: new RegExp('^' + obsoleteLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).count(), 0);
    }
    const titleInput = page.locator('form input').first();
    assert.equal(await titleInput.inputValue(), opportunity.title);
    assert.equal(writes.length, 0);
    await titleInput.fill('Oportunidade QA atualizada');
    await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('h3')).some(element => element.textContent === 'Editar Oportunidade'));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body.title, 'Oportunidade QA atualizada');
    assert.equal(writes[0].body.negotiationType, 'Cliente Novo');
    assert.equal(writes[0].body.companyId, company.id);
    assert.equal(writes[0].body.ownerId, owner.id);
    assert.equal(writes[0].body.value, 36);

    await page.getByRole('button', { name: 'Lista', exact: true }).click();
    await page.locator('button[title="Editar"]').first().click();
    await page.getByRole('heading', { name: 'Editar Oportunidade', exact: true }).waitFor();
    assert.equal(await page.locator('form input').first().inputValue(), 'Oportunidade QA atualizada');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.locator('button[title="Editar"]').first().click();
    const type = page.getByLabel('Tipo de Receita');
    assert.equal(await page.getByLabel('Valor total dos produtos (R$)').inputValue(), '36');
    await page.getByLabel('Valor do setup (R$)').fill('250');
    await type.selectOption('MENSAL');
    await page.getByLabel('Valor mensal (R$)').fill('150.50');
    await page.getByLabel('Período do contrato (meses)').selectOption('24');
    assert.equal(await page.getByLabel('Valor total do contrato (R$)').inputValue(), '3612');
    assert.equal(await page.getByLabel('Valor total dos produtos (R$)').count(), 0);
    await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
    await page.waitForFunction(() => !document.getElementById('b2b-monthly'));
    assert.equal(writes[1].body.value, 3612);
    assert.equal(writes[1].body.monthlyValue, 150.5);
    assert.equal(writes[1].body.contractMonths, 24);
    assert.equal(writes[1].body.projectMonths, 24);
    await page.locator('button[title="Editar"]').first().click();
    assert.equal(await page.getByLabel('Valor mensal (R$)').inputValue(), '150.5');
    await type.selectOption('PONTUAL');
    await page.getByLabel('Valor total dos produtos (R$)').fill('1800');
    await page.getByLabel('Valor do setup (R$)').fill('250');
    assert.equal(await page.getByLabel('Período do contrato (meses)').count(), 0);
    await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
    await page.waitForFunction(() => !document.getElementById('b2b-products'));
    assert.equal(writes[2].body.value, 1800);
    assert.equal(Number(writes[2].body.installationFee), 250);
    assert.equal(writes[2].body.monthlyValue, null);
    assert.equal(writes[2].body.contractMonths, null);
    assert.equal(writes[2].body.projectMonths, null);
    assert.deepEqual(errors, []);
    console.log('Edição validada: formulário abre no Kanban e na lista, salva os dados pela API simulada e preserva empresa, responsável e valor.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
