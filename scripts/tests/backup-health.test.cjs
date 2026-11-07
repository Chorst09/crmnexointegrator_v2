const { test } = require('node:test');
const assert = require('node:assert/strict');
const { backupFreshness } = require('../../backend/lib/backup-health.cjs');

test('yesterday Drive upload remains current before 18h Brasília', () => {
  const result = backupFreshness('2026-10-22T21:01:28Z', 18, 0, new Date('2026-10-23T12:00:00Z'));
  assert.equal(result.overdue, false);
  assert.equal(result.nextBackupAt, '2026-10-23T21:00:00.000Z');
});
test('yesterday local dump is overdue after 02h30 Brasília', () => {
  const result = backupFreshness('2026-10-22T11:52:37Z', 2, 30, new Date('2026-10-23T12:00:00Z'));
  assert.equal(result.overdue, true);
  assert.equal(result.expectedBackupAt, '2026-10-23T05:30:00.000Z');
});
test('Drive becomes overdue after the scheduled hour without a new upload', () => {
  assert.equal(backupFreshness('2026-10-22T21:01:28Z', 18, 0, new Date('2026-10-23T21:10:00Z')).overdue, true);
});
test('missing and invalid dates are overdue, including across month boundaries', () => {
  for (const date of [undefined, 'invalid']) {
    const result = backupFreshness(date, 2, 30, new Date('2026-11-01T04:00:00Z'));
    assert.equal(result.overdue, true);
    assert.equal(result.expectedBackupAt, '2026-10-31T05:30:00.000Z');
  }
});
