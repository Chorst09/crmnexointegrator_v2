const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const api of ['backend', 'apps/api']) {
  function setup(deleteError) {
    let deleted = false;
    const prisma = { user: {
      findUnique: async () => ({ id: 'owner', tenantCompanyId: 'tenant', isCompanyOwner: true }),
      delete: async () => { if (deleteError) throw deleteError; deleted = true; }
    } };
    const source = fs.readFileSync(path.resolve(__dirname, '../../', api, 'api/users.js'), 'utf8')
      .replace(/^import .*;\n/gm, '')
      .replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'bcrypt', source)(prisma, {});
    return { handler, deleted: () => deleted };
  }
  test(`${api}: linked records return a clear conflict without deletion`, async () => {
    const fixture = setup({ code: 'P2003' });
    const response = await fixture.handler({ method: 'DELETE', user: { role: 'MASTER' },
      json: async () => ({ id: 'owner' }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /registros vinculados/);
    assert.equal(fixture.deleted(), false);
  });
  for (const [role, tenantCompanyId, expected] of [
    ['MASTER', 'other-tenant', 200], ['ADMIN', 'tenant', 403],
    ['ADMIN', 'other-tenant', 403], ['USER', 'tenant', 403]
  ]) {
    test(`${api}: ${role}/${tenantCompanyId} deleting company owner returns ${expected}`, async () => {
      const fixture = setup();
      const response = await fixture.handler({ method: 'DELETE',
        user: { role, tenantCompanyId }, json: async () => ({ id: 'owner' }) });
      assert.equal(response.status, expected);
      assert.equal(fixture.deleted(), expected === 200);
    });
  }
}
