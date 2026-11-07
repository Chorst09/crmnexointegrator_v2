const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const file of ['backend/api/simulator-proposals.js', 'apps/api/api/simulator-proposals.cjs']) {
  test(`${file}: lista propostas pelo ID e pelo e-mail do usuário`, async () => {
    const routes = {};
    let query;
    const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (url, ...handlers) => { routes[`${method} ${url}`] = handlers.at(-1); }]));
    vm.runInNewContext(fs.readFileSync(path.resolve(file), 'utf8'), {
      require: name => name.includes('simulator-proposal-owner') ? require('../../backend/lib/simulator-proposal-owner.cjs') : name === 'express' ? { Router: () => router }
        : name.includes('prisma') ? { prisma: { simulatorProposal: { findMany: async args => { query = args; return []; } } } }
        : name.includes('chorst-privacy') ? { canAccessChorstData: () => false }
        : { authenticateToken() {} },
      module: { exports: {} }, console,
    });
    const user = { userId: 'fabio-id', email: 'fabio.oliveira@doubletelecom.com.br', role: 'SELLER' };
    const res = { json: value => value, status() { return this; } };
    await routes['get /']({ user, query: { type: 'vm', all: 'true' } }, res);
    const where = JSON.parse(JSON.stringify(query.where));
    assert.deepEqual(where.OR, [
      { createdBy: user.userId },
      { createdBy: { equals: user.email, mode: 'insensitive' } },
    ]);
    assert.equal(where.type, 'VM');
    assert.equal(query.take, 1000);
    if (file.startsWith('apps/')) assert.ok(where.AND.length, 'preserva isolamento existente');
    await routes['get /']({ user: { ...user, role: 'ADMIN' }, query: {} }, res);
    assert.equal(query.where.OR, undefined, 'preserva acesso administrativo');
  });
}

for (const file of ['backend/api/simulator-proposals.js', 'apps/api/api/simulator-proposals.cjs']) {
  test(`${file}: POST com número repetido cria novo registro sem alterar o anterior`, async () => {
    const routes = {};
    let inserted;
    const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (url, ...handlers) => { routes[`${method} ${url}`] = handlers.at(-1); }]));
    vm.runInNewContext(fs.readFileSync(path.resolve(file), 'utf8'), {
      require: name => name.includes('simulator-proposal-owner') ? require('../../backend/lib/simulator-proposal-owner.cjs') : name === 'express' ? { Router: () => router }
        : name === 'crypto' ? require('node:crypto')
        : name.includes('prisma') ? { prisma: { simulatorProposal: {
          findFirst: async () => ({ id: 'old', baseId: 'Prop_Inter_Radio_003_v1' }),
          update: async () => { throw new Error('Não pode sobrescrever'); },
          create: async ({ data }) => { inserted = data; return data; },
        } } }
        : name.includes('chorst-privacy') ? { canAccessChorstData: () => false }
        : { authenticateToken() {} },
      module: { exports: {} }, console,
    });
    let status;
    const res = { json: value => value, status(value) { status = value; return this; } };
    await routes['post /']({ user: { email: 'fabio@example.com' }, body: { base_id: 'Prop_Inter_Radio_003_v1', client: 'Intelle', type: 'RADIO' } }, res);
    assert.equal(status, 201);
    assert.notEqual(inserted.id, 'old');
    assert.ok(inserted.baseId.startsWith('Prop_Inter_Radio_003_v1_'));
    assert.equal(inserted.client, 'Intelle');
  });
}
