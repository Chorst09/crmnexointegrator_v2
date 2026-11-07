const test = require('node:test');
const assert = require('node:assert/strict');
for (const root of ['apps/api', 'backend']) {
  const { normalizeLeadNextAction: normalize } = require(`../../${root}/lib/lead-next-action.cjs`);
  test(`${root}: validates paired action/date and reminder`, () => {
    assert.ok(normalize({ leadNextAction: 'Ligar' }).error);
    assert.ok(normalize({ leadNextActionAt: '2026-11-06T10:00:00Z' }).error);
    assert.ok(normalize({ leadNextAction: 'Ligar', leadNextActionAt: 'invalid' }).error);
    assert.ok(normalize({ leadNextAction: 'Ligar', leadNextActionAt: '2026-11-06T10:00:00' }).error);
    assert.ok(normalize({ leadReminderMinutes: -1 }).error);
    const valid = normalize({ leadNextAction: ' Ligar ', leadNextActionAt: '2026-11-06T10:00:00-03:00', leadReminderMinutes: 60 });
    assert.equal(valid.data.leadNextAction, 'Ligar');
    assert.equal(valid.data.leadNextActionAt.toISOString(), '2026-11-06T13:00:00.000Z');
    assert.deepEqual(normalize({ name: 'Outro campo' }), { data: {} });
    assert.equal(normalize({ leadReminderMinutes: 30 }, valid.data).data.leadNextAction, 'Ligar');
    assert.equal(normalize({ leadNextAction: null, leadNextActionAt: null }, valid.data).data.leadNextActionAt, null);
  });
}
