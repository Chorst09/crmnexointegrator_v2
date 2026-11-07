const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const revenueFields = {
  revenueType: 'String?', contractPeriodMonths: 'Int?',
  monthlyRecurringValue: 'Float?', totalContractValue: 'Float?',
  totalProductsValue: 'Float?', setupValue: 'Float?'
};

for (const api of ['apps/api', 'backend']) {
  test(`${api}: opportunity schema supports nullable revenue fields`, () => {
    const schema = fs.readFileSync(path.join(root, api, 'prisma/schema.prisma'), 'utf8');
    const opportunity = schema.match(/model Opportunity \{([\s\S]*?)\n\}/)[1];
    for (const [field, type] of Object.entries(revenueFields)) {
      const declaration = opportunity.split('\n').map(line => line.trim().split(/\s+/)).find(parts => parts[0] === field);
      assert.ok(declaration, `Opportunity.${field} is missing from ${api}`);
      assert.equal(declaration[1], type);
    }
  });
}

function createHandler() {
  const company = { id: 'company-1', name: 'Cliente', tenantCompanyId: 'tenant-1' };
  const owner = { id: 'seller-1', name: 'Vendedor', role: 'SELLER', accessB2B: true, tenantCompanyId: 'tenant-1' };
  const prisma = {
    user: { findUnique: async () => owner },
    company: { findUnique: async () => company },
    opportunity: {
      findFirst: async () => ({ number: 'B2B-2026-00367' }),
      create: async ({ data }) => ({ id: 'created', ...data })
    }
  };
  prisma.$transaction = async operation => operation(prisma);
  const tenantScope = require('../../backend/lib/tenantScope.cjs');
  const source = fs.readFileSync(path.join(root, 'backend/api/opportunities.js'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default async function handler', 'return async function handler');
  return new Function('prisma', 'getTenantCompanyId', 'isTenantRecordVisible', 'forbiddenTenantResponse', 'tenantScopedWhere', 'validateCustomerOwnership', 'updateCompanyLeadScore', source)(
    prisma, tenantScope.getTenantCompanyId, tenantScope.isTenantRecordVisible,
    () => new Response('Forbidden', { status: 403 }), tenantScope.tenantScopedWhere,
    async () => ({ permitido: true }), async () => {}
  );
}

test('B2B creation preserves recurring revenue values', async () => {
  const response = await createHandler()({ method: 'POST', query: { clientType: 'B2B' },
    user: { userId: 'seller-1', role: 'SELLER', accessB2B: true, tenantCompanyId: 'tenant-1' },
    json: async () => ({ title: 'Backup', companyId: 'company-1', stage: 'QUALIFICATION', value: 15000,
      revenueType: 'MENSAL', contractPeriodMonths: '12', monthlyRecurringValue: '15000',
      totalContractValue: '180000', totalProductsValue: 0, setupValue: '2500' })
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.revenueType, 'MENSAL');
  assert.equal(created.contractPeriodMonths, 12);
  assert.equal(created.monthlyRecurringValue, 15000);
  assert.equal(created.totalContractValue, 180000);
  assert.equal(created.totalProductsValue, 0);
  assert.equal(created.setupValue, 2500);
});

test('B2B creation supports a form without revenue values', async () => {
  const response = await createHandler()({ method: 'POST', query: { clientType: 'B2B' },
    user: { userId: 'seller-1', role: 'SELLER', accessB2B: true, tenantCompanyId: 'tenant-1' },
    json: async () => ({ title: 'Backup', companyId: 'company-1', stage: 'QUALIFICATION', value: 15000 })
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  for (const field of Object.keys(revenueFields)) assert.equal(created[field], null);
});

test('Master creates the opportunity in the session tenant with its selected seller', async () => {
  const response = await createHandler()({ method: 'POST', query: { clientType: 'B2B' },
    user: { userId: 'master-1', role: 'MASTER', accessB2B: true, tenantCompanyId: 'tenant-1' },
    json: async () => ({ title: 'Backup', companyId: 'company-1', ownerId: 'seller-1', value: 15000 })
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.tenantCompanyId, 'tenant-1');
  assert.equal(created.ownerId, 'seller-1');
});

test('An administrator cannot change the opportunity tenant through the submitted body', async () => {
  const response = await createHandler()({ method: 'POST', query: { clientType: 'B2B' },
    user: { userId: 'admin-1', role: 'ADMIN', accessB2B: true, tenantCompanyId: 'tenant-1' },
    json: async () => ({ title: 'Backup', companyId: 'company-1', ownerId: 'seller-1', value: 15000, tenantCompanyId: 'tenant-2' })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tenantCompanyId, 'tenant-1');
});


test('Production startup adds the revenue columns before serving opportunity requests', async () => {
  const vm = require('node:vm');
  const statements = [];
  let finish;
  const completed = new Promise(resolve => { finish = resolve; });
  class PrismaClient {
    async $executeRawUnsafe(sql) { statements.push(sql); }
    async $disconnect() { finish(); }
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/prisma/ensure-schema.cjs'), 'utf8'), {
    require: name => {
      assert.equal(name, '@prisma/client');
      return { PrismaClient };
    },
    console,
    process: { exit: code => assert.fail(`Schema startup failed: ${code}`) }
  });
  await completed;
  const opportunitySql = statements.find(sql => /ALTER TABLE "Opportunity"/.test(sql));
  const sqlTypes = { String: 'TEXT', Int: 'INTEGER', Float: 'DOUBLE PRECISION' };
  for (const [field, type] of Object.entries(revenueFields)) {
    assert.ok(opportunitySql.includes(`ADD COLUMN IF NOT EXISTS "${field}" ${sqlTypes[type.slice(0, -1)]}`),
      `Production startup must add Opportunity.${field} without dropping existing data`);
  }
});

test('B2B creation preserves one-time products and setup, including zero values', async () => {
  const response = await createHandler()({ method: 'POST', query: { clientType: 'B2B' },
    user: { userId: 'seller-1', role: 'SELLER', accessB2B: true, tenantCompanyId: 'tenant-1' },
    json: async () => ({ title: 'Equipamentos', companyId: 'company-1', value: 3000,
      revenueType: 'PONTUAL', totalProductsValue: '3000', setupValue: 0 })
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.revenueType, 'PONTUAL');
  assert.equal(created.totalProductsValue, 3000);
  assert.equal(created.setupValue, 0);
});
