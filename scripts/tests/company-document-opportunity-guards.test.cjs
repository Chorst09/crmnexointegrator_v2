const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const scope = require('../../backend/lib/tenantScope.cjs');

for (const base of ['backend', 'apps/api']) {
  function setup(contractsOnly = false) {
    let transactions = 0;
    const prisma = {
      opportunity: { findUnique: async () => ({ id: 'opp', ownerId: 'seller', companyId: 'client', tenantCompanyId: 'double', stage: 'WON', company: { clientType: 'B2B' } }) },
      companyDocument: { count: async () => contractsOnly ? 0 : 1, findFirst: async () => contractsOnly ? null : ({ companyId: 'client' }) },
      contract: { findFirst: async () => ({ companyId: 'client' }) },
      $transaction: async () => { transactions++; throw new Error('Unexpected transaction'); }
    };
    const source = fs.readFileSync(`${base}/api/opportunities.js`, 'utf8')
      .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\n/gm, '')
      .replace('export default async function handler', 'return async function handler');
    const bindings = { prisma, getTenantCompanyId: scope.getTenantCompanyId, isTenantRecordVisible: scope.isTenantRecordVisible };
    const handler = new Function(...Object.keys(bindings), source)(...Object.values(bindings));
    return { handler, transactions: () => transactions };
  }
  test(`${base}: documento impede exclusão da oportunidade vinculada`, async () => {
    const { handler, transactions } = setup();
    const response = await handler({ method: 'DELETE', query: { id: 'opp' }, user: { role: 'MASTER' }, json: async () => ({}) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /documentos vinculados/);
    assert.equal(transactions(), 0);
  });
  test(`${base}: cópia de contrato preserva a empresa de origem após remover o anexo original`, async () => {
    const { handler, transactions } = setup(true);
    const response = await handler({ method: 'PUT', query: { id: 'opp' }, user: { role: 'MASTER' }, json: async () => ({ companyId: 'another-company' }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /contratos vinculados/);
    assert.equal(transactions(), 0);
  });
  test(`${base}: documento impede transferência da oportunidade para outra empresa`, async () => {
    const { handler, transactions } = setup();
    const response = await handler({ method: 'PUT', query: { id: 'opp' }, user: { role: 'MASTER' }, json: async () => ({ companyId: 'another-company' }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /documentos vinculados/);
    assert.equal(transactions(), 0);
  });
}
