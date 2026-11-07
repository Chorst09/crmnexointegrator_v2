const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const api of ['backend', 'apps/api']) {
  async function invoke(role, failure) {
    const calls = [];
    let handler;
    const router = { delete: (route, guard, callback) => { handler = callback; } };
    const source = fs.readFileSync(path.resolve(__dirname, '../../', api, 'api/licensing.cjs'), 'utf8');
    const start = source.indexOf("router.delete('/companies/:id'");
    const end = source.indexOf("router.get('/companies/:id/users'", start);
    const prisma = { $transaction: async callback => {
      calls.push('transaction');
      await callback({
        user: { deleteMany: async () => { calls.push('users'); if (failure) throw failure; } },
        companyLicense: { deleteMany: async () => { calls.push('licenses'); } },
        tenantCompany: { delete: async () => { calls.push('company'); } }
      });
    } };
    new Function('router', 'requireRole', 'isMaster', 'normalizeString', 'prisma', 'console', source.slice(start, end))(
      router, () => null, user => user.role === 'MASTER', value => value, prisma, { error() {} });
    const result = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ user: { role }, params: { id: 'tenant' } }, result);
    return { result, calls };
  }
  test(`${api}: linked company records return 409 and stop deletion`, async () => {
    const { result, calls } = await invoke('MASTER', { code: 'P2003' });
    assert.equal(result.statusCode, 409);
    assert.match(result.body.error, /registros vinculados/);
    assert.deepEqual(calls, ['transaction', 'users']);
  });
  test(`${api}: missing company returns 404`, async () => {
    assert.equal((await invoke('MASTER', { code: 'P2025' })).result.statusCode, 404);
  });
  test(`${api}: administrator cannot delete company`, async () => {
    const { result, calls } = await invoke('ADMIN');
    assert.equal(result.statusCode, 403);
    assert.deepEqual(calls, []);
  });
  test(`${api}: unlinked company deletes in transaction`, async () => {
    const { result, calls } = await invoke('MASTER');
    assert.deepEqual(result.body, { success: true });
    assert.deepEqual(calls, ['transaction', 'users', 'licenses', 'company']);
  });
}
