const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('Drive status responds from local state while the cloud query is pending', async () => {
  let handler, response, started = false;
  const router = { use() {}, get(_path, fn) { handler = fn; }, post() {} };
  const source = fs.readFileSync(require.resolve('../../backend/api/drive-backup.cjs'), 'utf8');
  const fakeFs = {
    readFileSync(file) {
      if (file.endsWith('status.json')) return JSON.stringify({ running: false, latest: 'copy.tar.gz', uploaded: true });
      if (file.endsWith('remote-files.json')) return JSON.stringify({ files: [{ name: 'copy.tar.gz', size: 10 }] });
      return '0 18 * * * root';
    }, existsSync: () => true
  };
  vm.runInNewContext(source, {
    require(name) { return name === '../lib/backup-health.cjs' ? { backupFreshness: () => ({ overdue: false }), cronHealth: async () => ({ installed: true, serviceActive: true, active: true }) } : name === 'express' ? { Router: () => router } : name === 'fs' ? fakeFs : name === 'child_process' ? { execFile() { started = true; }, spawn() {} } : require(name); },
    module: { exports: {} }, __dirname: '/application/api'
  });
  await handler({}, { set() {}, json(data) { response = data; } });
  assert.equal(response.scheduled, true);
  assert.equal(response.files.length, 1);
  assert.equal(started, true);
});
