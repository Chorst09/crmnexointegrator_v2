const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const api of ['backend', 'apps/api']) {
  async function remove(user, { owner = 'owner', status = 'ABERTA', tenant = 'tenant', exists = true } = {}) {
    let handler;
    let deleted = false;
    const router = { use() {}, get() {}, post() {}, put() {}, patch() {}, delete(route, callback) { handler = callback; } };
    const prisma = { preSalesRequest: {
      findUnique: async () => exists ? { id: 'request', solicitanteId: owner, status, solicitante: { tenantCompanyId: tenant } } : null,
      delete: async () => { deleted = true; }
    } };
    const source = fs.readFileSync(path.resolve(__dirname, '../../', api, 'api/pre-vendas.cjs'), 'utf8');
    vm.runInNewContext(source, {
      require(name) {
        if (name === 'express') return { Router: () => router };
        if (name.includes('prisma')) return { prisma };
        if (name.includes('auth')) return { authenticateToken() {} };
        return require(path.resolve(__dirname, '../../', api, 'api', name));
      }, module: { exports: {} }, console
    });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ params: { id: 'request' }, user }, res);
    return { code: res.statusCode, deleted };
  }
  for (const role of ['MASTER', 'ADMIN']) {
    test(`${api}: ${role} deletes another user's finalized budget`, async () => {
      assert.deepEqual(await remove({ userId: 'admin', role, tenantCompanyId: 'tenant' }, { status: 'FINALIZADA' }), { code: 200, deleted: true });
    });
  }
  test(`${api}: actualRole recognizes MASTER`, async () => {
    assert.equal((await remove({ role: 'USER', actualRole: 'MASTER', userId: 'admin' })).code, 200);
  });
  test(`${api}: owner can delete an open budget using id`, async () => {
    assert.equal((await remove({ id: 'owner', role: 'USER', tenantCompanyId: 'tenant' })).code, 200);
  });
  test(`${api}: another user cannot delete`, async () => {
    assert.deepEqual(await remove({ userId: 'other', role: 'USER' }), { code: 403, deleted: false });
  });
  test(`${api}: owner cannot delete finalized budget`, async () => {
    assert.deepEqual(await remove({ userId: 'owner', role: 'USER' }, { status: 'FINALIZADA' }), { code: 400, deleted: false });
  });
  test(`${api}: missing budget returns 404`, async () => {
    assert.deepEqual(await remove({ role: 'MASTER' }, { exists: false }), { code: 404, deleted: false });
  });
  if (api === 'backend') test(`${api}: tenant admin cannot delete another tenant's budget`, async () => {
    assert.deepEqual(await remove({ role: 'ADMIN', tenantCompanyId: 'other' }), { code: 403, deleted: false });
  });
}
