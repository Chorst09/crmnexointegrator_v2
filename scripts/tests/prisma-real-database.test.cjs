const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(require.resolve('../../apps/api/lib/prisma.cjs'), 'utf8');
function load(env) {
  const failure = new Error('SQL failure');
  const client = { $executeRawUnsafe: async () => 0, $queryRawUnsafe: async () => { throw failure; },
    $transaction: async () => { throw failure; } };
  const module = { exports: {} };
  const fakeRequire = name => name === '@prisma/client' ? { PrismaClient: function () { return client; } } : name === 'bcryptjs' ? { hashSync: () => 'hash' } : name === 'fs' ? { existsSync: () => false } : require(name);
  vm.runInNewContext(`(function(require,module,__dirname,process,console){${source}\n})`, {})(fakeRequire, module, path.dirname(require.resolve('../../apps/api/lib/prisma.cjs')), { env, cwd: () => '/tmp' }, { log() {}, warn() {} });
  return { prisma: module.exports.prisma, client, failure };
}
test('configured database remains authoritative after SQL errors', async () => {
  const { prisma, client, failure } = load({ DATABASE_URL: 'postgresql://configured/database', NODE_ENV: 'production' });
  assert.equal(prisma, client);
  await assert.rejects(prisma.$queryRawUnsafe('bad SQL'), e => e === failure);
  await assert.rejects(prisma.$queryRawUnsafe('another query'), e => e === failure);
  await assert.rejects(prisma.$transaction(() => {}), e => e === failure);
});
test('production cannot start with a demonstration database', () => {
  assert.throws(() => load({ NODE_ENV: 'production' }), /DATABASE_URL/);
});
