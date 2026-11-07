const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const description = 'Cliente nos procurou solicitando proposta de 1500 veeam para backup de Office 365.';
const row = { id: 'nilton-opportunity', number: 'B2B-2026-00373', title: 'Backup Veeam 365',
  description, source: 'MANUAL', stage: 'DIAGNOSIS', ownerId: 'nilton',
  company: { clientType: 'B2B' } };

async function checkClassification(infer) {
  for (const text of [description, 'Cliente solicitou proposta', 'Solicitação de backup', 'Fornecedor credital']) {
    assert.equal(infer({ ...row, description: text }), 'B2B', text);
  }
  for (const description of ['Licitação pública', 'Edital 12/2026', JSON.stringify({ numeroEdital: '12/2026' })]) {
    assert.equal(infer({ ...row, number: null, description }), 'B2G', description);
  }
  assert.equal(infer({ ...row, b2gStage: 'ANALISE' }), 'B2G');
  assert.equal(infer({ ...row, number: 'B2G-2026-00001' }), 'B2G');
}

for (const file of ['backend/api/opportunities.js', 'apps/api/api/opportunities.js', 'apps/api/opportunities.js']) {
  test(`${file}: solicitation for a B2B proposal is not a public tender`, async () => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const helpers = source.slice(source.indexOf('const normalizeClientType ='), source.indexOf('const canAccessChorstData ='));
    const infer = new Function(`${helpers}\nreturn inferOpportunityClientType;`)();
    await checkClassification(infer);
  });
}

test('frontend keeps the same classification for proposal solicitation and public tenders', async () => {
  const source = fs.readFileSync(path.join(root, 'apps/web/src/utils/businessModel.js'), 'utf8');
  const { inferOpportunityClientType } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await checkClassification(inferOpportunityClientType);
});

test('B2B listing returns Nilton’s saved opportunity and keeps it out of B2G', async () => {
  let queriedWhere;
  const prisma = { opportunity: { findMany: async ({ where }) => { queriedWhere = where; return [row]; } } };
  const scope = require('../../backend/lib/tenantScope.cjs');
  const source = fs.readFileSync(path.join(root, 'backend/api/opportunities.js'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default async function handler', 'return async function handler');
  const handler = new Function('prisma', 'tenantScopedWhere', source)(prisma, scope.tenantScopedWhere);
  const user = { userId: 'nilton', role: 'SELLER', accessB2B: true, accessB2G: true, tenantCompanyId: 'tenant-1' };
  const response = await handler({ method: 'GET', query: { clientType: 'B2B' }, user });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).map(item => item.id), [row.id]);
  assert.equal(queriedWhere.ownerId, 'nilton');
  assert.equal(queriedWhere.tenantCompanyId, 'tenant-1');
  const b2g = await handler({ method: 'GET', query: { clientType: 'B2G' }, user });
  assert.deepEqual(await b2g.json(), []);
});
