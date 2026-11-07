const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planRepairs, applyRepairs } = require('../../backend/scripts/repair-assigned-record-tenants.cjs');
const owner = { id: 'seller', tenantCompanyId: 'double' };
const date = new Date('2026-11-05T12:00:00Z');
const row = (data = {}) => ({ model: 'opportunity', record: {
  id: 'won', ownerId: 'seller', stage: 'WON', value: 1000, updatedAt: date,
  tenantCompanyId: null, company: { tenantCompanyId: 'double' }, ...data,
} });

test('recupera apenas tenant ausente e mantém conflitos fora do reparo', () => {
  const plan = planRepairs([
    row(), row({ id: 'correct', tenantCompanyId: 'double' }),
    row({ id: 'foreign', tenantCompanyId: 'other' }),
    row({ id: 'foreign-company', company: { tenantCompanyId: 'other' } }),
    { model: 'activity', record: { id: 'task', assignedToId: 'seller', tenantCompanyId: null, updatedAt: date } },
  ], owner);
  assert.deepEqual(plan.repairs.map(item => item.id), ['won', 'task']);
  assert.deepEqual(plan.conflicts.map(item => item.id), ['foreign', 'foreign-company']);
  assert.throws(() => planRepairs([row({ ownerId: 'another' })], owner), /outro responsável/);
});

test('salva backup antes do reparo e altera apenas tenant preservando data, status e valores', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assigned-record-repair-'));
  const rows = [row()];
  const snapshot = { rows, owner, ...planRepairs(rows, owner) };
  const writes = [];
  const prisma = { $transaction: callback => callback({ opportunity: { updateMany: async args => {
    assert.equal(fs.readdirSync(dir).length, 1);
    writes.push(args);
    return { count: 1 };
  } } }) };
  try {
    const backup = await applyRepairs(prisma, snapshot, dir);
    assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(backup)).rows[0].record.stage, 'WON');
    assert.deepEqual(writes[0].data, { tenantCompanyId: 'double', updatedAt: date });
    assert.equal(writes[0].where.tenantCompanyId, null);
    assert.equal(writes[0].where.ownerId, 'seller');
    assert.deepEqual(writes[0].where.owner, { tenantCompanyId: 'double' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('mudança concorrente interrompe o reparo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assigned-record-repair-'));
  try {
    const rows = [row()];
    const prisma = { $transaction: callback => callback({ opportunity: { updateMany: async () => ({ count: 0 }) } }) };
    await assert.rejects(applyRepairs(prisma, { rows, owner, ...planRepairs(rows, owner) }, dir), /transação revertida/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
