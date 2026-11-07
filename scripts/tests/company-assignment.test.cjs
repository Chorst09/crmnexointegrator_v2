const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCompanyAssignment } = require('../../backend/lib/company-assignment.cjs');
const owners = [{ id: 'seller-a', name: 'A', tenantCompanyId: 'tenant-a' }, { id: 'seller-b', name: 'B', tenantCompanyId: 'tenant-b' }];
const prisma = { user: { findFirst: async ({ where }) => owners.find(o => o.id === where.id && o.tenantCompanyId === where.tenantCompanyId) || null } };
const master = { id: 'master', actualRole: 'MASTER', tenantCompanyId: 'tenant-a' };
test('MASTER can assign a legacy global company to a seller from their tenant', async () => {
  const result = await resolveCompanyAssignment(prisma, master, { clientType: 'B2G', accountManagerId: 'seller-a' }, null, false);
  assert.equal(result.data.accountManagerId, 'seller-a');
});
test('an existing tenant boundary takes precedence over MASTER tenant', async () => {
  const result = await resolveCompanyAssignment(prisma, master, { accountManagerId: 'seller-a' }, 'tenant-b', false);
  assert.ok(result.error);
});
test('legacy assignments still reject users from unrelated tenants', async () => {
  const result = await resolveCompanyAssignment(prisma, master, { accountManagerId: 'seller-b' }, null, false);
  assert.ok(result.error);
});
test('seller cannot reassign another seller', async () => {
  const result = await resolveCompanyAssignment(prisma, { id: 'seller-a', role: 'SELLER', tenantCompanyId: 'tenant-a' }, { clientType: 'B2B', accountManagerId: 'seller-b' }, 'tenant-a', false);
  assert.ok(result.error);
});
test('updates without an assignment preserve the existing owner', async () => {
  assert.deepEqual(await resolveCompanyAssignment(prisma, master, {}, null, false), { data: {} });
});
test('an explicit empty owner clears the assignment', async () => {
  assert.deepEqual(await resolveCompanyAssignment(prisma, master, { accountManagerId: null }, null, false), { data: { accountManagerId: null, accountManagerName: null, accountManagerEmail: null, accountManagerPhone: null, accountManagerPosition: null } });
});
