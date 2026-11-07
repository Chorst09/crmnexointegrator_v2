const test = require('node:test');
const assert = require('node:assert/strict');
for (const root of ['apps/api', 'backend']) {
  const { expirationSchedule, normalizeContract, contractScope } = require(`../../${root}/lib/contract-service.cjs`);
  const { createContractsRouter } = require(`../../${root}/lib/contracts-router.cjs`);
  test(`${root}: warns 30 calendar days before expiry at 9am Brasilia, including month/leap boundaries`, () => {
    const schedule = expirationSchedule({ expirationAlert: true, status: 'ACTIVE', endDate: '2028-03-15' }, new Date('2028-01-01'));
    assert.equal(schedule.alertAt.toISOString(), '2028-02-14T12:00:00.000Z');
    assert.equal(schedule.expiresAt.toISOString(), '2028-03-16T02:59:59.000Z');
    for (const status of ['DRAFT', 'CANCELLED', 'EXPIRED', 'RENEWED', 'AWAITING_SIGNATURE']) assert.equal(expirationSchedule({ expirationAlert: true, status, endDate: '2028-03-15' }), null);
    assert.equal(expirationSchedule({ expirationAlert: false, status: 'ACTIVE', endDate: '2028-03-15' }), null);
    assert.equal(expirationSchedule({ expirationAlert: true, status: 'ACTIVE' }), null);
    assert.equal(expirationSchedule({ expirationAlert: true, status: 'ACTIVE', endDate: '2020-01-01' }), null);
  });
  test(`${root}: drafts have no fabricated dates and activation requires valid dates`, () => {
    const draft = { number: 'C-1', title: 'Arquivo anexado', status: 'DRAFT', value: 0 };
    assert.equal(normalizeContract(draft).error, undefined);
    assert.ok(normalizeContract({ status: 'ACTIVE' }, draft).error);
    assert.ok(normalizeContract({ startDate: '2026-03-01', endDate: '2026-02-30' }, draft).error);
    assert.ok(normalizeContract({ startDate: '2026-03-01', endDate: '2026-02-01' }, draft).error);
    const valid = normalizeContract({ startDate: '2026-01-01', endDate: '2026-12-31', status: 'ACTIVE', expirationAlert: true }, draft);
    assert.equal(valid.error, undefined); assert.equal(valid.data.endDate.toISOString(), '2026-12-31T00:00:00.000Z');
    assert.ok(normalizeContract({ value: 'invalid' }, draft).error);
    assert.ok(normalizeContract({ expirationAlert: 'true' }, draft).error);
    assert.deepEqual(normalizeContract({ sourceDocumentId: 'spoof' }, draft).data, {});
  });
  test(`${root}: scope includes tenant, account ownership and source opportunity restrictions`, () => {
    const scope = contractScope({ id: 'seller', role: 'USER', email: 'seller@test', tenantCompanyId: 'tenant', accessB2B: true });
    assert.equal(scope.AND[0].company.AND[0].tenantCompanyId, 'tenant');
    assert.deepEqual(scope.AND[0].company.AND[2].clientType.in, ['B2B']);
    assert.equal(scope.AND[1].OR[1].opportunity.ownerId, 'seller');
    assert.equal(contractScope({ role: 'USER' }).AND[0].company.AND[0].tenantCompanyId, '__missing_tenant__');
  });
  function fixture(denied = false) {
    const existing = { id: 'copy', companyId: 'company', opportunityId: 'opportunity', sourceDocumentId: 'source', number: 'ANEXO-source', title: 'Contrato', status: 'DRAFT', value: 0 };
    const updates = [];
    const prisma = {
      contract: {
        findFirst: async ({ where }) => { assert.equal(where.AND[0].company.AND[0].tenantCompanyId, 'tenant'); return denied ? null : existing; },
        update: async ({ data }) => { updates.push(data); return { ...existing, ...data }; }
      },
      company: { findFirst: async () => ({ id: 'company', tenantCompanyId: 'tenant' }) },
      opportunity: { findFirst: async () => ({ id: 'opportunity', company: { clientType: 'B2B' } }) }
    };
    const router = createContractsRouter({ prisma, authenticateToken: (_req, _res, next) => next(), uploadDir: '/tmp/contract-test-unused' });
    const handler = router.stack.find(item => item.route?.path === '/:id' && item.route.methods.put).route.stack[0].handle;
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
    const invoke = async body => {
      await handler({ params: { id: 'copy' }, user: { id: 'seller', role: 'USER', email: 'seller@test', tenantCompanyId: 'tenant', accessB2B: true }, body }, response, error => { throw error; });
      return response;
    };
    return { invoke, updates };
  }
  test(`${root}: draft copy can be activated and renewed; origin cannot be reassigned`, async () => {
    const f = fixture();
    assert.equal((await f.invoke({ status: 'ACTIVE', startDate: '2026-01-01', endDate: '2027-01-01' })).statusCode, 200);
    assert.equal(f.updates[0].opportunityId, 'opportunity');
    assert.equal((await f.invoke({ companyId: 'other' })).statusCode, 400);
    assert.equal((await f.invoke({ opportunityId: '' })).statusCode, 400);
    assert.equal(f.updates.length, 1);
  });
  test(`${root}: denied contract cannot be updated`, async () => {
    const f = fixture(true); assert.equal((await f.invoke({ title: 'changed' })).statusCode, 404); assert.equal(f.updates.length, 0);
  });
}
