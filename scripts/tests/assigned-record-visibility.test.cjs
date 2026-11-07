const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scope = require('../../backend/lib/tenantScope.cjs');
const seller = { id: 'silvana', userId: 'silvana', name: 'Silvana', role: 'SELLER', actualRole: 'USER', tenantCompanyId: 'double', accessB2B: true };
const company = { id: 'client', name: 'Cliente B2B', clientType: 'B2B', tenantCompanyId: 'double' };
const quiet = { log() {}, warn() {}, error() {} };
const matches = (row, where) => Object.entries(where).every(([key, value]) => {
  if (key === 'owner') return !value.email?.not || row.owner?.email !== value.email.not;
  if (value && typeof value === 'object') return !('not' in value) || row[key] !== value.not;
  return value === undefined || row[key] === value;
});

function setup(base, file) {
  const records = [];
  const users = [seller, { ...seller, id: 'other', userId: 'other' }];
  const prisma = {
    user: { findUnique: async ({ where }) => users.find(user => user.id === where.id) || null },
    company: {
      findUnique: async ({ where }) => where.id === company.id ? company : null,
      findFirst: async ({ where }) => matches(company, where) ? company : null,
    },
    preSalesRequest: { findFirst: async () => null },
    commission: { findUnique: async () => null, upsert: async ({ create }) => create },
  };
  const table = {
    create: async ({ data }) => {
      const row = { id: `record-${records.length}`, ...data, company, owner: seller, assignedTo: seller };
      records.push(row);
      return row;
    },
    findFirst: async () => null,
    findUnique: async ({ where }) => records.find(row => row.id === where.id) || null,
    findMany: async ({ where }) => records.filter(row => matches(row, where)),
  };
  prisma.opportunity = file === 'opportunities.js' ? table : { findUnique: async () => null };
  prisma.activity = table;
  prisma.$transaction = async callback => callback(prisma);
  const filename = path.resolve(base, 'api', file);
  let invoke;
  if (file.endsWith('.cjs')) {
    const routes = {};
    const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (url, ...handlers) => { routes[method] = handlers.at(-1); }]));
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require(name) {
        if (name === 'express') return { Router: () => router };
        if (name.includes('prisma')) return { prisma };
        return require(path.resolve(path.dirname(filename), name));
      }, module: { exports: {} }, console: quiet,
    });
    invoke = async (method, user, body = {}) => {
      const result = { status: 200 };
      const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
      await routes[method.toLowerCase()]({ user, body, query: {} }, res);
      return result;
    };
  } else {
    const source = fs.readFileSync(filename, 'utf8')
      .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\n/gm, '')
      .replace('export default async function handler', 'return async function handler');
    const bindings = {
      prisma, console: quiet,
      getTenantCompanyId: scope.getTenantCompanyId, tenantScopedWhere: scope.tenantScopedWhere,
      isTenantRecordVisible: scope.isTenantRecordVisible,
      forbiddenTenantResponse: () => new Response('Forbidden', { status: 403 }),
      validateCustomerOwnership: async () => ({ permitido: true }),
      updateCompanyLeadScore: async () => {}, syncCompanyStatusWithOpportunityPipeline: async () => {},
      normalizeProjectClientType: value => value || null, normalizeProjectName: (value, fallback) => value || fallback,
    };
    const handler = new Function(...Object.keys(bindings), source)(...Object.values(bindings));
    invoke = async (method, user, body = {}) => {
      const response = await handler({ method, user, query: { clientType: 'B2B' }, json: async () => body });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: response.status, data };
    };
  }
  const body = file === 'opportunities.js'
    ? { title: 'Contrato ganho', companyId: company.id, ownerId: seller.id, stage: 'WON', value: 1000 }
    : { subject: 'Contato comercial', assignedToId: seller.id, companyId: company.id, type: 'TASK' };
  return { invoke, records, users, body };
}

for (const base of ['backend', 'apps/api']) {
  for (const file of ['opportunities.js', 'activities-simple.cjs', 'activities.js']) {
    for (const role of ['MASTER', 'ADMIN']) {
      test(`${base}/${file}: ${role} cria para Silvana e ela recebe o registro`, async () => {
        for (const tenantCompanyId of role === 'MASTER' ? [null, 'master-company'] : ['double']) {
          const { invoke, records, body } = setup(base, file);
          const actor = { userId: 'creator', role, tenantCompanyId, accessB2B: true };
          const created = await invoke('POST', actor, { ...body, tenantCompanyId: 'forged-tenant' });
          assert.equal(created.status, 200, JSON.stringify(created.data));
          assert.equal(records.length, 1);
          assert.equal(records[0].tenantCompanyId, 'double');
          assert.equal(records[0][file === 'opportunities.js' ? 'ownerId' : 'assignedToId'], seller.id);
          if (file === 'opportunities.js') assert.equal(records[0].stage, 'WON');
          const listed = await invoke('GET', seller);
          assert.equal(listed.status, 200);
          assert.deepEqual(Array.from(listed.data, row => row.id), [records[0].id]);
          const foreign = await invoke('GET', { ...seller, tenantCompanyId: 'foreign' });
          assert.equal(foreign.data.length, 0);
        }
      });
    }

    test(`${base}/${file}: Admin não atribui registros a outro tenant`, async () => {
      const { invoke, records, body } = setup(base, file);
      const result = await invoke('POST', { userId: 'admin', role: 'ADMIN', tenantCompanyId: 'foreign', accessB2B: true }, body);
      assert.equal(result.status, 403, JSON.stringify(result.data));
      assert.equal(records.length, 0);
    });

    test(`${base}/${file}: vendedor continua criando apenas para si`, async () => {
      const { invoke, records, body } = setup(base, file);
      const result = await invoke('POST', seller, { ...body, ownerId: 'other', assignedToId: 'other' });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(records[0][file === 'opportunities.js' ? 'ownerId' : 'assignedToId'], seller.id);
    });

    test(`${base}/${file}: responsável inexistente não vira atribuição ao criador`, async () => {
      const { invoke, records, body } = setup(base, file);
      const result = await invoke('POST', { userId: 'master', role: 'MASTER', accessB2B: true }, { ...body, ownerId: 'missing', assignedToId: 'missing' });
      assert.equal(result.status, 400, JSON.stringify(result.data));
      assert.equal(records.length, 0);
    });

    test(`${base}/${file}: regra vale para qualquer gerente de contas`, async () => {
      const { invoke, records, body } = setup(base, file);
      const result = await invoke('POST', { userId: 'master', role: 'MASTER', accessB2B: true }, { ...body, ownerId: 'other', assignedToId: 'other' });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const listed = await invoke('GET', { ...seller, id: 'other', userId: 'other' });
      assert.deepEqual(Array.from(listed.data, row => row.id), [records[0].id]);
    });

    test(`${base}/${file}: Master não vincula cliente de outro tenant ao gerente`, async () => {
      const { invoke, records, users, body } = setup(base, file);
      users[0] = { ...seller, tenantCompanyId: 'another-company' };
      const result = await invoke('POST', { userId: 'master', role: 'MASTER', accessB2B: true }, body);
      assert.equal(result.status, 403, JSON.stringify(result.data));
      assert.equal(records.length, 0);
    });
  }
}
