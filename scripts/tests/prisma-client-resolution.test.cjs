const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('API uses its own Prisma Client even when a legacy backend client exists', () => {
  const imports = [];
  class PrismaClient {
    async $executeRawUnsafe() {}
  }
  const localRequire = id => {
    imports.push(id);
    if (id.endsWith('@prisma/client')) return { PrismaClient };
    if (id === 'fs') return { existsSync: () => true };
    if (id === 'bcryptjs') return {};
    return require(id);
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../apps/api/lib/prisma.cjs'), 'utf8');
  const apiModule = { exports: {} };
  new Function('require', 'module', 'process', '__dirname', 'console', source)(
    localRequire, apiModule,
    { env: { DATABASE_URL: 'postgresql://test@localhost/crm', NODE_ENV: 'production' } },
    path.resolve(__dirname, '../../apps/api/lib'),
    { log() {}, error() {} }
  );
  assert.ok(apiModule.exports.prisma instanceof PrismaClient);
  assert.deepEqual(imports.filter(id => id.includes('@prisma/client')), ['@prisma/client']);
});
