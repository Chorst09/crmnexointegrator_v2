const test = require('node:test');
const assert = require('node:assert/strict');
const now = new Date('2026-10-14T15:00:00Z');
const row = extra => ({ id: 'base', title: 'Contrato', stage: 'WON', projectType: 'MONTHLY', monthlyValue: 100, projectMonths: 2, actualCloseDate: '2026-09-01', company: { name: 'Cliente' }, ...extra });

for (const root of ['apps/api', 'backend']) {
  const analytics = import(`../../${root}/lib/b2bDashboardAnalytics.js`);
  test(`${root}: detail, product/setup breakdown and monthly totals reconcile with KPIs`, async () => {
    const { buildB2BDashboardAnalytics: build } = await analytics;
    const result = build([
      row({ id: 'short' }),
      row({ id: 'long', actualCloseDate: '2026-10-10', monthlyValue: 400, projectMonths: 3, revenueType: 'MENSAL', setupValue: 20 }),
      row({ id: 'single', projectType: 'SINGLE', value: 300, installationFee: 50, actualCloseDate: '2026-10-10' }),
      row({ id: 'future', stage: 'PROPOSAL', expectedCloseDate: '2026-11-02', monthlyValue: 200, projectMonths: 12, probability: 50, installationFee: 10 }),
      row({ id: 'undated', actualCloseDate: null })
    ], { now, period: 'month' });
    const i = result.revenueInsights;
    assert.equal(result.revenue.activeMrr, 500);
    assert.deepEqual(i.breakdown, { products: 300, setup: 70 });
    for (const metric of ['activeMrr', 'periodRecurring', 'periodOneTime', 'recurringPipelineMonthly', 'recurringPipelineTotal', 'oneTimePipeline']) {
      assert.equal(i.details[metric].reduce((n, r) => n + r.amount, 0), result.revenue[metric], metric);
    }
    assert.equal(i.monthly[0].total, 870);
    assert.equal(i.monthly[0].total, result.revenue.periodRecurring + result.revenue.periodOneTime);
    assert.equal(i.comparison.metrics.total.percent, null);
    assert.equal(i.comparison.start, '2026-09-17');
    assert.equal(i.comparison.end, '2026-09-30');
    assert.equal(i.exclusions.undatedWins, 1);
    assert.deepEqual(i.expirations.bands.map(b => b.monthlyRevenue), [100, 100, 500]);
    assert.equal(i.projection.length, 12);
    assert.equal(i.projection[0].month, '2026-11-01');
    assert.equal(i.projection[0].recurring, 400);
    assert.equal(i.projection[1].recurring, 400);
    assert.equal(i.projection[2].recurring, 0);
    assert.equal(i.projection[0].potential, 105);
    assert.equal(i.projection[1].potential, 100);
  });
  test(`${root}: previous equal-length window uses calendar payments and handles all/empty`, async () => {
    const { buildB2BDashboardAnalytics: build } = await analytics;
    const i = build([row({})], { now, period: '30d' }).revenueInsights;
    assert.equal(i.comparison.days, 30);
    assert.equal(i.comparison.metrics.periodRecurring.previous, 100);
    assert.equal(i.comparison.metrics.periodRecurring.current, 100);
    assert.equal(i.comparison.metrics.periodRecurring.percent, 0);
    const empty = build([], { now, period: 'all' }).revenueInsights;
    assert.equal(empty.comparison.available, false);
    assert.equal(empty.projection.length, 12);
    assert.equal(empty.expirations.rows.length, 0);
    assert.ok(empty.monthly.every(r => r.total === 0));
  });
  test(`${root}: month-end expiry and projections clamp dates and exclude lost/overdue deals`, async () => {
    const { buildB2BDashboardAnalytics: build } = await analytics;
    const i = build([
      row({ actualCloseDate: '2026-01-31', projectMonths: 2 }),
      row({ id: 'lost', stage: 'LOST', expectedCloseDate: '2026-03-01', value: 99999 }),
      row({ id: 'overdue', stage: 'PROPOSAL', expectedCloseDate: '2026-02-01' })
    ], { now: new Date('2026-02-28T15:00:00Z'), period: 'month' }).revenueInsights;
    assert.equal(i.monthly[0].recurring, 100);
    assert.equal(i.expirations.rows[0].end, '2026-03-31');
    assert.equal(i.expirations.bands[0].count, 0);
    assert.equal(i.expirations.bands[1].count, 1);
    assert.equal(i.projection[0].recurring, 0);
    assert.ok(i.projection.every(r => r.potential === 0));
    assert.equal(i.exclusions.unscheduledOpen, 1);
  });
}
