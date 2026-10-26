const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../backend/lib/prisma.cjs'), 'utf8');

function load(databaseUrl, sharedGlobal = {}) {
  const clients = [];
  const context = {
    global: sharedGlobal,
    process: { env: { NODE_ENV: 'production', DATABASE_URL: databaseUrl }, once() {} },
    console,
    module: { exports: {} },
    require(name) {
      assert.equal(name, '@prisma/client');
      return { PrismaClient: function (options) { clients.push(options); } };
    }
  };
  vm.runInNewContext(source, context);
  return { client: context.module.exports.prisma, clients };
}

test('production reuses one client across module reloads', () => {
  const shared = {};
  const first = load('postgresql://localhost/crm', shared);
  const second = load('postgresql://localhost/crm', shared);
  assert.equal(first.client, second.client);
  assert.equal(first.clients.length, 1);
  assert.equal(second.clients.length, 0);
});

test('default pool is bounded without forcing PgBouncer on direct PostgreSQL', () => {
  const { clients } = load('postgresql://localhost/crm?schema=public');
  const url = new URL(clients[0].datasources.db.url);
  assert.equal(url.searchParams.get('connection_limit'), '10');
  assert.equal(url.searchParams.get('pool_timeout'), '15');
  assert.equal(url.searchParams.get('schema'), 'public');
  assert.equal(url.searchParams.has('pgbouncer'), false);
  assert.equal(url.searchParams.has('statement_cache_size'), false);
});

test('explicit pool and PgBouncer settings are preserved', () => {
  const url = 'postgresql://localhost/crm?connection_limit=4&pgbouncer=true';
  assert.equal(load(url).clients[0].datasources.db.url, url);
});

function loadAppsUrl(databaseUrl) {
  const filename = require.resolve('../../apps/api/lib/prisma.cjs');
  const appsSource = fs.readFileSync(filename, 'utf8');
  let options;
  const fakeRequire = name => {
    if (name === '@prisma/client') return {
      PrismaClient: function (value) {
        options = value;
        this.$executeRawUnsafe = async () => 0;
      }
    };
    if (name === 'fs') return { existsSync: () => false };
    if (name === 'bcryptjs') return {};
    return require(name);
  };
  vm.runInNewContext(`(function(require, module, __dirname, process, console) {${appsSource}\n})`)(
    fakeRequire, { exports: {} }, require('node:path').dirname(filename),
    { env: { NODE_ENV: 'production', DATABASE_URL: databaseUrl }, cwd: () => '/tmp' },
    { log() {}, warn() {}, error() {} }
  );
  return new URL(options.datasources.db.url);
}

test('apps API also bounds its independent pool', () => {
  const url = loadAppsUrl('postgresql://localhost/crm?schema=public');
  assert.equal(url.searchParams.get('connection_limit'), '10');
  assert.equal(url.searchParams.get('pool_timeout'), '15');
  assert.equal(url.searchParams.get('schema'), 'public');
});

test('apps API preserves explicit connection and timeout limits', () => {
  const url = loadAppsUrl('postgresql://localhost/crm?connection_limit=3&pool_timeout=8');
  assert.equal(url.searchParams.get('connection_limit'), '3');
  assert.equal(url.searchParams.get('pool_timeout'), '8');
});
