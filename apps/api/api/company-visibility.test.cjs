const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const root of ['apps/api', 'backend']) {
  const base = path.resolve(__dirname, '../../..', root);
  const visibility = require(path.join(base, 'lib/company-visibility.cjs'));
  const { getPermissionTemplate } = require(path.join(base, 'lib/permissions.cjs'));
  const seller = { userId: 'seller-a', role: 'SELLER', actualRole: 'USER', tenantCompanyId: 'tenant-a', regionId: 'shared-region', name: 'Vendedor A' };
  const companies = [
    { id: 'own', clientType: 'B2B', tenantCompanyId: 'tenant-a', accountManagerId: 'seller-a', opportunities: [] },
    { id: 'other', clientType: 'B2B', tenantCompanyId: 'tenant-a', accountManagerId: 'seller-b', opportunities: [{ ownerId: 'seller-a' }] },
    { id: 'legacy', clientType: 'B2B', tenantCompanyId: 'tenant-a', accountManagerId: null, opportunities: [{ ownerId: 'seller-a' }] },
    { id: 'unassigned', clientType: 'B2B', tenantCompanyId: 'tenant-a', accountManagerId: null, opportunities: [] },
    { id: 'foreign', clientType: 'B2B', tenantCompanyId: 'tenant-b', accountManagerId: 'seller-a', opportunities: [] },
    { id: 'government', clientType: 'B2G', tenantCompanyId: 'tenant-a', accountManagerId: 'seller-b', opportunities: [] }
  ];
  function matches(record, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') return value.every(condition => matches(record, condition));
      if (key === 'OR') return value.some(condition => matches(record, condition));
      if (key === 'opportunities') return record.opportunities.some(opportunity => matches(opportunity, value.some));
      return record[key] === value;
    });
  }
  const prisma = { company: {
    findFirst: async ({ where }) => companies.find(company => matches(company, where)) || null,
    findMany: async ({ where }) => companies.filter(company => matches(company, where)),
    findUnique: async ({ where }) => companies.find(company => company.id === where.id) || null
  } };
  const source = fs.readFileSync(path.join(base, 'api/companies.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default async function handler', 'async function handler');
  const context = vm.createContext({ companyVisibility: visibility, prisma, Response, console,
    tenantScopedWhere: user => user.actualRole === 'MASTER' ? {} : { tenantCompanyId: user.tenantCompanyId },
    isTenantRecordVisible: (user, company) => user.actualRole === 'MASTER' || company.tenantCompanyId === user.tenantCompanyId,
    forbiddenTenantResponse: () => new Response('Forbidden', { status: 403 })
  });
  vm.runInContext(source, context);
  const request = (user, method = 'GET', id, body = {}) => context.handler({ user, method, query: id ? { id } : { clientType: 'B2B' }, url: '/api/companies', json: async () => body });

  test(`${root}: sellers see own B2B companies and legacy opportunities, never shared region or foreign tenant`, async () => {
    const response = await request(seller);
    assert.deepEqual((await response.json()).map(company => company.id), ['own', 'legacy']);
  });
  test(`${root}: direct reads and writes cannot bypass ownership`, async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await request(seller, method, 'other', { id: 'other' })).status, 403);
      assert.equal((await request(seller, method, 'foreign', { id: 'foreign' })).status, 403);
    }
    assert.equal((await request(seller, 'GET', 'own')).status, 200);
  });
  test(`${root}: admin sees all tenant B2B companies and master sees all tenants`, async () => {
    const admin = { ...seller, role: 'ADMIN', actualRole: 'ADMIN', permissions: { ownCompaniesOnly: true } };
    assert.deepEqual((await (await request(admin)).json()).map(company => company.id), ['own', 'other', 'legacy', 'unassigned']);
    assert.equal((await (await request({ ...admin, role: 'MASTER', actualRole: 'MASTER' })).json()).length, 5);
    assert.equal(getPermissionTemplate('ADMIN', { ownCompaniesOnly: true }).ownCompaniesOnly, false);
  });
  test(`${root}: policy can be disabled without removing tenant isolation; B2G keeps its visibility`, async () => {
    assert.equal((await (await request({ ...seller, permissions: { ownCompaniesOnly: false } })).json()).length, 4);
    assert.equal(await visibility.canAccessOwnedCompany(prisma, seller, 'government'), true);
    assert.deepEqual(visibility.companyOwnershipWhere({ role: 'USER' }), { clientType: 'B2G' });
  });
  test(`${root}: new seller companies belong to their creator and assignment cannot be forged`, () => {
    assert.deepEqual(visibility.companyResponsibility(seller, { accountManagerId: 'seller-b' }, true), { accountManagerId: 'seller-a', accountManagerName: 'Vendedor A' });
    assert.deepEqual(visibility.companyResponsibility(seller, { accountManagerId: 'seller-b' }), {});
    assert.equal(visibility.companyResponsibility({ role: 'ADMIN' }, { accountManagerId: 'seller-b' }).accountManagerId, 'seller-b');
  });
}

const accessControl = require('../lib/access-control.cjs');
test('company documents enforce the same seller ownership and tenant scope', async () => {
  const own = { id: 'own', tenantCompanyId: 'tenant-a' };
  const other = { id: 'other', tenantCompanyId: 'tenant-a' };
  const foreign = { id: 'foreign', tenantCompanyId: 'tenant-b' };
  let company = own;
  const prisma = {
    company: {
      findUnique: async () => company,
      findFirst: async ({ where }) => where.id === 'own' && where.tenantCompanyId === 'tenant-a' ? own : null
    },
    companyDocument: { findUnique: async () => ({ id: 'doc', company }) }
  };
  const seller = { role: 'SELLER', userId: 'seller-a', tenantCompanyId: 'tenant-a' };
  assert.equal((await accessControl.canAccessCompany(prisma, seller, company.id)).allowed, true);
  assert.equal((await accessControl.canAccessCompanyDocument(prisma, seller, 'doc')).allowed, true);
  company = other;
  assert.equal((await accessControl.canAccessCompanyDocument(prisma, seller, 'doc')).allowed, false);
  company = foreign;
  assert.equal((await accessControl.canAccessCompanyDocument(prisma, seller, 'doc')).allowed, false);
});
