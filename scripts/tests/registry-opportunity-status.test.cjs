const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const approvals = ['EM_ANALISE', 'APROVADO', 'NEGADO'];

for (const file of ['backend/api/prevendas-cadastros.js', 'apps/api/api/prevendas-cadastros.js']) {
  test(`${file}: approval statuses survive create, update and read`, async () => {
    let saved = null;
    const prisma = { systemSetting: {
      findUnique: async () => saved ? { value: saved } : null,
      upsert: async ({ create, update }) => { saved = saved ? update.value : create.value; }
    } };
    const source = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(/^import .*;\n/gm, '')
      .replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'crypto', source)(prisma, crypto);
    const request = (method, suffix = '', body = {}) => ({
      method, url: `/api/prevendas-cadastros/oportunidades${suffix}`,
      user: { userId: 'test-user', name: 'Teste' }, json: async () => body
    });
    for (const [legacy, expected] of [['ABERTA', 'EM_ANALISE'], ['GANHA', 'APROVADO'], ['PERDIDA', 'NEGADO'], ['DEVOLVIDA', 'NEGADO'], ['AGUARDANDO_APROVACAO', 'EM_ANALISE']]) {
      const response = await handler(request('POST', '', { titulo: 'Registro antigo', status: legacy }));
      assert.equal((await response.json()).status, expected);
    }
    for (const status of approvals) {
      const created = await handler(request('POST', '', { titulo: 'Registro de teste', status }));
      assert.equal(created.status, 201);
      const row = await created.json();
      assert.equal(row.status, status);
      const read = await (await handler(request('GET', `/${row.id}`))).json();
      assert.equal(read.status, status);
      for (const nextStatus of approvals) {
        await handler(request('PUT', `/${row.id}`, { status: nextStatus }));
        const updated = await (await handler(request('GET', `/${row.id}`))).json();
        assert.equal(updated.status, nextStatus);
        assert.equal(updated.titulo, 'Registro de teste');
      }
    }
  });
}

test('approval labels are readable and approval does not mean a won sale', async () => {
  const { getRegistryStatusLabel, isRegistryOpportunityOpen, REGISTRY_OPPORTUNITY_STATUSES } = await import('../../apps/web/src/utils/registry-opportunity-status.mjs');
  assert.equal(getRegistryStatusLabel('AGUARDANDO_APROVACAO'), 'Em análise');
  assert.equal(getRegistryStatusLabel('APROVADO'), 'Aprovado');
  assert.equal(getRegistryStatusLabel('NEGADO'), 'Negado');
  assert.equal(isRegistryOpportunityOpen('AGUARDANDO_APROVACAO'), true);
  assert.equal(isRegistryOpportunityOpen('APROVADO'), true);
  assert.equal(isRegistryOpportunityOpen('NEGADO'), false);
  assert.deepEqual(REGISTRY_OPPORTUNITY_STATUSES.map(item => item.value), approvals);
  assert.equal(getRegistryStatusLabel('GANHA'), 'Aprovado');
  assert.equal(getRegistryStatusLabel('PERDIDA'), 'Negado');
  assert.equal(getRegistryStatusLabel('ABERTA'), 'Em análise');
});
