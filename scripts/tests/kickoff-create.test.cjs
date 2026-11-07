const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const file of ['apps/api/api/kickoff.cjs', 'backend/api/kickoff.js']) {
  function setup({ conflict = false } = {}) {
    const routes = {};
    const saved = [];
    const router = new Proxy({}, { get: (_, method) => (route, ...handlers) => {
      routes[`${method} ${route}`] = handlers.at(-1);
    }});
    const prisma = {
      opportunity: { findUnique: async () => ({ id: 'opp', companyId: 'company', tenantCompanyId: 'tenant' }) },
      kickoffTemplate: { findFirst: async () => null },
      kickoffMeeting: {
        findMany: async () => [{ number: `KICK${new Date().getFullYear()}0001` }, { number: `KICK${new Date().getFullYear()}0003` }],
        create: async ({ data }) => {
          saved.push(data);
          if (conflict && saved.length === 1) throw Object.assign(new Error('duplicate'), { code: 'P2002', meta: { target: ['number'] } });
          return { id: 'meeting', ...data };
        }
      }
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), {
      require: name => name === 'express' ? { Router: () => router } : name.includes('prisma') ? { prisma } : name.includes('tenantScope') ? { getTenantCompanyId: u => u.tenantCompanyId } : { authenticateToken() {}, requireRole: () => () => {} },
      module: { exports: {} }, console
    });
    return { saved, run: async (date = '2026-10-28') => {
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await routes['post /meetings']({ body: { title: 'Kickoff', phase: 'ALINHAMENTO_INTERNO', opportunityId: 'opp', scheduledDate: date }, user: { userId: 'user', tenantCompanyId: 'tenant' } }, response);
      return response;
    }};
  }
  test(`${file}: creation after deletion uses next unused number`, async () => {
    const { run, saved } = setup();
    assert.equal((await run()).statusCode, 201);
    assert.ok(saved[0].number.endsWith('0004'));
    assert.equal(saved[0].companyId, 'company');
    assert.equal(saved[0].ownerId, 'user');
  });
  test(`${file}: concurrent number collision is retried`, async () => {
    const { run, saved } = setup({ conflict: true });
    assert.equal((await run()).statusCode, 201);
    assert.equal(saved.length, 2);
    assert.ok(saved[1].number.endsWith('0005'));
  });
  test(`${file}: invalid date returns 400 before saving`, async () => {
    const { run, saved } = setup();
    assert.equal((await run('invalid')).statusCode, 400);
    assert.equal(saved.length, 0);
  });
}
