const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
for (const root of ['backend', 'apps/api']) {
  function setup() {
    let saved = { id: 'seller', name: 'Ana', email: 'ana@example.com', role: 'SELLER', tenantCompanyId: null, phone: '(11) 99999-0000' };
    const prisma = { user: {
      findFirst: async () => null,
      findUnique: async () => saved,
      findMany: async () => [saved],
      create: async ({ data }) => (saved = { id: 'seller', ...data }),
      update: async ({ data }) => (saved = { ...saved, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) })
    } };
    const source = fs.readFileSync(path.resolve(__dirname, '../..', root, 'api/users.js'), 'utf8')
      .replace(/^import .*;$/gm, '').replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'bcrypt', source)(prisma, { hash: async () => 'hashed' });
    return async (method, body = {}) => handler({ method, query: {}, user: { userId: 'admin', role: 'MASTER' }, json: async () => body });
  }
  test(`${root}: create, read, update and clear user phone`, async () => {
    const run = setup();
    let response = await run('POST', { name: 'Ana', email: 'ana@example.com', password: 'test', role: 'SELLER', phone: '  (11) 98888-0000  ' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).phone, '(11) 98888-0000');
    response = await run('GET');
    assert.equal((await response.json())[0].phone, '(11) 98888-0000');
    response = await run('PUT', { id: 'seller', name: 'Ana' });
    assert.equal((await response.json()).phone, '(11) 98888-0000');
    response = await run('PUT', { id: 'seller', phone: '(21) 97777-0000' });
    assert.equal((await response.json()).phone, '(21) 97777-0000');
    response = await run('PUT', { id: 'seller', phone: '' });
    assert.equal((await response.json()).phone, null);
  });
  test(`${root}: customer assignment carries the seller contact profile`, async () => {
    const { resolveCompanyAssignment } = require(path.resolve(__dirname, '../..', root, 'lib/company-assignment.cjs'));
    const user = { id: 'seller', name: 'Ana', email: 'ana@example.com', phone: '(11) 99999-0000', role: 'SELLER' };
    const result = await resolveCompanyAssignment({ user: { findFirst: async () => user } }, { userId: 'seller', role: 'SELLER' }, { clientType: 'B2B' }, null, true);
    assert.deepEqual(result.data, { accountManagerId: 'seller', accountManagerName: 'Ana', accountManagerEmail: user.email, accountManagerPhone: user.phone, accountManagerPosition: 'SELLER' });
  });
}
