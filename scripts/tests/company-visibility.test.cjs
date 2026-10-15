const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seller = { userId: 'seller-1', actualRole: 'USER', role: 'SELLER', tenantCompanyId: 'tenant-1' };

for (const root of ['apps/api', 'backend']) {
  const visibility = require(`../../${root}/lib/company-visibility.cjs`);
  const { getPermissionTemplate } = require(`../../${root}/lib/permissions.cjs`);
  test(`${root}: seller defaults and saved policy aliases`, () => {
    assert.equal(visibility.ownCompaniesOnly(seller), true);
    assert.equal(getPermissionTemplate('USER').somenteSuasEmpresas, true);
    assert.equal(visibility.ownCompaniesOnly({ ...seller, permissions: getPermissionTemplate('USER', { ownCompaniesOnly: false }) }), false);
    for (const role of ['ADMIN', 'MASTER']) {
      assert.equal(visibility.ownCompaniesOnly({ ...seller, actualRole: role, permissions: { somenteSuasEmpresas: true } }), false);
    }
  });

  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(clause => matches(row, clause));
    if (key === 'opportunities') return row.opportunities?.some(o => o.ownerId === value.some.ownerId);
    return row[key] === value;
  });
  const rows = [
    { id: 'own', clientType: 'B2B', tenantCompanyId: 'tenant-1', accountManagerId: 'seller-1' },
    { id: 'other', clientType: 'B2B', tenantCompanyId: 'tenant-1', accountManagerId: 'seller-2', opportunities: [{ ownerId: 'seller-1' }] },
    { id: 'legacy', clientType: 'B2B', tenantCompanyId: 'tenant-1', accountManagerId: null, opportunities: [{ ownerId: 'seller-1' }] },
    { id: 'unassigned', clientType: 'B2B', tenantCompanyId: 'tenant-1', accountManagerId: null },
    { id: 'cross-tenant', clientType: 'B2B', tenantCompanyId: 'tenant-2', accountManagerId: 'seller-1' },
    { id: 'public', clientType: 'B2G', tenantCompanyId: 'tenant-1', accountManagerId: null }
  ];
  const prisma = { user: { findFirst: async ({ where }) => where.id === seller.userId && where.tenantCompanyId === seller.tenantCompanyId ? { id: seller.userId, name: 'Vendedor Um' } : null }, company: {
    create: async ({ data }) => ({ id: 'created', ...data }),
    findFirst: async ({ where }) => rows.find(row => matches(row, where)) || null,
    findUnique: async ({ where }) => rows.find(row => row.id === where.id) || null,
    findMany: async ({ where }) => rows.filter(row => matches(row, where))
  } };
  test(`${root}: explicit owner wins over opportunities, legacy fallback and tenant isolation`, async () => {
    assert.equal(await visibility.canViewCompany(prisma, seller, 'own'), true);
    assert.equal(await visibility.canViewCompany(prisma, seller, 'legacy'), true);
    for (const id of ['other', 'unassigned', 'cross-tenant']) assert.equal(await visibility.canViewCompany(prisma, seller, id), false);
    assert.equal(await visibility.canViewCompany(prisma, seller, 'public'), true);
    assert.equal(await visibility.canViewCompany(prisma, { ...seller, actualRole: 'ADMIN' }, 'other'), true);
  });

  // Run the actual route logic with an in-memory database, without touching local data.
  let source = fs.readFileSync(path.join(__dirname, '../../', root, 'api/companies.js'), 'utf8');
  source = source.replace(/^import .*;\n/gm, '').replace('export default async function handler', 'return async function handler');
  const handler = new Function('prisma', 'companyVisibility', 'tenantScopedWhere', 'isTenantRecordVisible', 'forbiddenTenantResponse', 'getTenantCompanyId', 'validateCustomerOwnership', 'updateCompanyLeadScore', source)(
    prisma, visibility, user => ({ tenantCompanyId: user.tenantCompanyId }),
    (user, row) => row.tenantCompanyId === user.tenantCompanyId,
    () => new Response('Acesso negado', { status: 403 }),
    user => user.tenantCompanyId, async () => ({ permitido: true }), async () => {}
  );
  test(`${root}: new companies belong to the seller and cannot be assigned to another user`, async () => {
    const post = body => handler({ method: 'POST', user: seller, json: async () => ({ name: 'Nova empresa', clientType: 'B2B', status: 'ACTIVE', autoDistribute: false, ...body }) });
    const response = await post({ accountManagerName: 'Nome adulterado' });
    const created = await response.json();
    assert.equal(created.accountManagerId, seller.userId);
    assert.equal(created.accountManagerName, 'Vendedor Um');
    assert.equal((await post({ accountManagerId: 'seller-2' })).status, 403);
  });

  test(`${root}: list and direct GET/PUT/DELETE enforce the same owner restriction`, async () => {
    const list = await handler({ method: 'GET', query: { clientType: 'B2B' }, user: seller });
    assert.deepEqual((await list.json()).map(row => row.id), ['own', 'legacy']);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await handler({ method, query: { id: 'other' }, user: seller, json: async () => ({ id: 'other' }) });
      assert.equal(response.status, 403);
    }
  });
}
