const test = require('node:test');
const assert = require('node:assert/strict');

for (const api of ['backend', 'apps/api']) {
  const { listLeadAccountManagers } = require(`../../${api}/lib/lead-account-managers.cjs`);
  const users = [
    { id: 'seller', name: 'A', role: 'SELLER', tenantCompanyId: 'tenant-a', accessB2B: true, accessB2G: false },
    { id: 'user', name: 'B', role: 'USER', tenantCompanyId: 'tenant-a', accessB2B: true, accessB2G: true },
    { id: 'user-b2b', name: 'C', role: 'USER_B2B', tenantCompanyId: 'tenant-a', accessB2B: true },
    { id: 'external', name: 'D', role: 'USER', tenantCompanyId: 'tenant-b', accessB2B: true },
    { id: 'b2g', name: 'E', role: 'USER', tenantCompanyId: 'tenant-a', accessB2B: false, accessB2G: true },
    { id: 'global', name: 'F', role: 'USER', tenantCompanyId: null, accessB2B: true },
  ];
  const prisma = { user: { findMany: async ({ where, select }) => {
    assert.equal(select.password, undefined);
    return users.filter(u => u.tenantCompanyId === where.tenantCompanyId
      && (!where.id || u.id === where.id)
      && (!where.role || where.role.in.includes(u.role))
      && (!where.accessB2B || u.accessB2B) && (!where.accessB2G || u.accessB2G))
      .map(({ id, name }) => ({ id, name, email: `${id}@example.test`, opportunities: [{ value: 20 }, { value: 30 }] }));
  } } };
  for (const role of ['ADMIN', 'MASTER']) test(`${api}: ${role} sees all eligible account managers in its tenant`, async () => {
    const result = await listLeadAccountManagers(prisma, { id: 'admin', role, tenantCompanyId: 'tenant-a' });
    assert.deepEqual(result.map(u => u.id), ['seller', 'user', 'user-b2b']);
    assert.equal(result[0].activeOpportunities, 2); assert.equal(result[0].totalValue, 50);
    assert.equal(result[0].opportunities, undefined);
  });
  for (const role of ['USER', 'SELLER', 'USER_B2B', 'MANAGER']) test(`${api}: ${role} only sees itself, even with broad permissions`, async () => {
    const result = await listLeadAccountManagers(prisma, { userId: 'user', role, tenantCompanyId: 'tenant-a', permissions: { ownCompaniesOnly: false } });
    assert.deepEqual(result.map(u => u.id), ['user']);
  });
  test(`${api}: actual role controls elevation`, async () => {
    const result = await listLeadAccountManagers(prisma, { id: 'user', role: 'ADMIN', actualRole: 'USER', tenantCompanyId: 'tenant-a' });
    assert.deepEqual(result.map(u => u.id), ['user']);
  });
  test(`${api}: missing tenant does not expose other tenants`, async () => {
    assert.deepEqual((await listLeadAccountManagers(prisma, { id: 'admin', role: 'ADMIN' })).map(u => u.id), ['global']);
  });
  test(`${api}: B2G keeps module boundaries`, async () => {
    assert.deepEqual((await listLeadAccountManagers(prisma, { id: 'admin', role: 'ADMIN', tenantCompanyId: 'tenant-a' }, 'B2G')).map(u => u.id), ['user', 'b2g']);
  });
  test(`${api}: absent identity fails closed`, async () => {
    assert.deepEqual(await listLeadAccountManagers(prisma, { role: 'ADMIN', tenantCompanyId: 'tenant-a' }), []);
  });
}
