const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const flow = (targetArea, sourceArea = 'B2B') => `Solicitação\n\n[CRM_ACTIVITY_FLOW]${JSON.stringify({ sourceArea, targetArea })}`;
const user = { userId: 'operator', role: 'SELLER', actualRole: 'USER', tenantCompanyId: 'double', accessPreSales: true };
const rows = [
  { id: 'own', assignedToId: 'operator', tenantCompanyId: 'double', description: flow('B2B') },
  { id: 'silvana', assignedToId: 'silvana', tenantCompanyId: 'double', description: flow('PRE_VENDAS') },
  { id: 'fabio-50mbps', assignedToId: 'fabio', tenantCompanyId: 'double', description: flow('PRE_VENDAS') },
  { id: 'fabio-200mbps', assignedToId: 'fabio', tenantCompanyId: 'double', description: flow('PRE_VENDAS') },
  { id: 'another-seller', assignedToId: 'new-seller', tenantCompanyId: 'double', description: flow('PRE_VENDAS') },
  { id: 'returned', assignedToId: 'silvana', tenantCompanyId: 'double', description: flow('B2B', 'PRE_VENDAS') },
  { id: 'private', assignedToId: 'silvana', tenantCompanyId: 'double', description: flow('B2B') },
  { id: 'foreign', assignedToId: 'someone', tenantCompanyId: 'other', description: flow('PRE_VENDAS') },
];

function setup(file) {
  const routes = {};
  const queries = [];
  const updates = [];
  const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (url, ...handlers) => { routes[`${method} ${url}`] = handlers.at(-1); }]));
  const prisma = {
    activity: {
      findMany: async ({ where }) => {
        queries.push(where);
        return rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value));
      },
      findUnique: async ({ where }) => rows.find(row => row.id === where.id),
      update: async args => { updates.push(args); return { ...rows.find(row => row.id === args.where.id), ...args.data }; },
    },
    preSalesRequest: { findFirst: async () => null },
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: name => name === 'express' ? { Router: () => router }
      : name.includes('prisma') ? { prisma }
      : name.includes('tenantScope') ? require('../../backend/lib/tenantScope.cjs')
      : name.includes('access-control') ? { getTenantId: value => value.tenantCompanyId || null }
      : name.includes('pre-sales-closure') || name.includes('permissions') ? require(require('node:path').resolve(require('node:path').dirname(file), name))
      : require(name),
    module: { exports: {} }, console,
  });
  const invoke = async (route, authenticatedUser, { body = {}, query = {} } = {}) => {
    const result = { status: 200 };
    const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
    await routes[route]({ user: authenticatedUser, body, query }, res);
    return result;
  };
  return { invoke, queries, updates };
}

for (const file of ['backend/api/activities-simple.cjs', 'apps/api/api/activities-simple.cjs']) {
  test(`${file}: operador com acesso ao pré-vendas recebe a fila da mesma empresa`, async () => {
    const { invoke, queries } = setup(file);
    const result = await invoke('get /', user);
    assert.equal(result.status, 200);
    assert.deepEqual(Array.from(result.data, row => row.id), ['own', 'silvana', 'fabio-50mbps', 'fabio-200mbps', 'another-seller', 'returned']);
    assert.equal(queries[0].tenantCompanyId, 'double');
  });

  test(`${file}: fila inclui demandas de todos os vendedores sem depender de nome ou ID`, async () => {
    const { invoke } = setup(file);
    const inbound = ['silvana', 'fabio-50mbps', 'fabio-200mbps', 'another-seller'];
    for (const userId of ['operator', 'silvana', 'fabio', 'new-seller', 'seller-without-activities', 'new-operator']) {
      const result = await invoke('get /', { ...user, userId });
      assert.equal(result.status, 200);
      for (const id of inbound) assert.ok(result.data.some(row => row.id === id), `${userId} deve receber ${id}`);
      assert.ok(!result.data.some(row => row.id === 'foreign'));
      if (userId !== 'silvana') assert.ok(!result.data.some(row => row.id === 'private'));
    }
  });

  test(`${file}: vendedor sem acesso ao módulo recebe apenas suas atividades`, async () => {
    const { invoke } = setup(file);
    const result = await invoke('get /', { ...user, accessPreSales: false });
    assert.deepEqual(Array.from(result.data, row => row.id), ['own']);
  });

  test(`${file}: sem tenant não há acesso à fila de outra empresa`, async () => {
    const { invoke } = setup(file);
    const result = await invoke('get /', { ...user, tenantCompanyId: null });
    assert.deepEqual(Array.from(result.data, row => row.id), ['own']);
  });

  test(`${file}: filtro explícito de responsável continua sendo respeitado`, async () => {
    const { invoke } = setup(file);
    const result = await invoke('get /', user, { query: { userId: 'operator' } });
    assert.deepEqual(Array.from(result.data, row => row.id), ['own']);
  });

  test(`${file}: permite trabalhar na fila e bloqueia atividades privadas e de outra empresa`, async () => {
    const { invoke, updates } = setup(file);
    assert.equal((await invoke('put /', user, { body: { id: 'silvana', status: 'IN_PROGRESS' } })).status, 200);
    assert.equal((await invoke('put /', user, { body: { id: 'fabio-50mbps', status: 'IN_PROGRESS' } })).status, 200);
    assert.equal((await invoke('put /', user, { body: { id: 'fabio-200mbps', status: 'IN_PROGRESS' } })).status, 200);
    assert.equal((await invoke('put /', user, { body: { id: 'another-seller', status: 'IN_PROGRESS' } })).status, 200);
    assert.equal(updates.length, 4);
    assert.equal((await invoke('put /', user, { body: { id: 'private', status: 'IN_PROGRESS' } })).status, 403);
    assert.equal((await invoke('put /', user, { body: { id: 'foreign', status: 'IN_PROGRESS' } })).status, 403);
    assert.equal((await invoke('put /', { ...user, accessPreSales: false }, { body: { id: 'silvana', status: 'IN_PROGRESS' } })).status, 403);
    assert.equal(updates.length, 4);
  });
}
