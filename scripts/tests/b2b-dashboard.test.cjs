const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const analytics = import('../../apps/api/lib/b2bDashboardAnalytics.js');
const now = new Date('2026-10-14T15:00:00Z');
const opportunity = overrides => ({ id: 'opp', stage: 'LEAD', value: 1000, probability: 15, ownerId: 'owner-1', owner: { id: 'owner-1', name: 'Gerente Um' }, leadEntryDate: '2026-03-01', createdAt: '2026-10-01', updatedAt: '2026-10-01', projectClientType: 'NEW_CLIENT', projectTower: 'Conectividade', ...overrides });

test('a portfolio without wins still has history, owners and full pipeline totals', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const rows = Array.from({ length: 362 }, (_, index) => opportunity({ id: `opp-${index}` }));
  const result = buildB2BDashboardAnalytics(rows, { now });
  assert.equal(result.kpis.totalOpportunities, 362);
  assert.equal(result.kpis.wonValue, 0);
  assert.equal(result.kpis.wonOpportunities, 0);
  assert.equal(result.kpis.pipelineValue, 362000);
  assert.equal(result.kpis.weightedPipelineValue, 54300);
  assert.equal(result.charts.timeline.find(row => row.date === '2026-03-01').entries, 362);
  assert.equal(result.charts.sellerPerformance[0].open, 362);
  assert.equal(result.insights.agingRows.find(row => row.label === '+90 dias').count, 362);
  assert.equal(result.insights.towerRows[0].count, 362);
});

test('history uses entry and actual closure dates, excludes missing dates and fills zero months', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const result = buildB2BDashboardAnalytics([
    opportunity({ id: 'won', stage: 'WON', actualCloseDate: '2026-04-17', updatedAt: '2026-10-10' }),
    opportunity({ id: 'lost', stage: 'LOST', exitDate: '2026-05-15' }),
    opportunity({ id: 'undated-win', stage: 'WON', actualCloseDate: null }),
    opportunity({ id: 'no-entry', leadEntryDate: null, createdAt: null })
  ], { now });
  assert.equal(result.charts.timeline.length, 10);
  assert.equal(result.charts.timeline[0].entries, 0);
  assert.equal(result.charts.timeline[3].won, 1);
  assert.equal(result.charts.timeline[3].revenue, 1000);
  assert.equal(result.charts.timeline[4].lost, 1);
  assert.equal(result.charts.timeline[9].won, 0);
  assert.equal(result.kpis.undatedClosures, 1);
  assert.equal(result.kpis.missingEntryDates, 1);
  assert.equal(result.insights.agingRows.find(row => row.label === 'Sem data').count, 1);
  assert.equal(result.kpis.pipelineValue, 1000);
});

test('forecast follows expected dates and individual probabilities, separating overdue and undated deals', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const result = buildB2BDashboardAnalytics([
    opportunity({ id: 'due', expectedCloseDate: '2026-10-14', value: 1000, probability: 30 }),
    opportunity({ id: 'future', expectedCloseDate: '2026-11-05', value: 2000, probability: 75 }),
    opportunity({ id: 'overdue', expectedCloseDate: '2026-10-13' }),
    opportunity({ id: 'undated', expectedCloseDate: null }),
    opportunity({ id: 'won', stage: 'WON', expectedCloseDate: '2026-11-01' }),
    opportunity({ id: 'beyond-horizon', expectedCloseDate: '2027-12-01' })
  ], { now });
  assert.equal(result.charts.forecast.length, 6);
  assert.equal(result.charts.forecast[0].nominal, 1000);
  assert.equal(result.charts.forecast[0].forecast, 300);
  assert.equal(result.charts.forecast[1].forecast, 1500);
  assert.equal(result.charts.forecast[2].forecast, 0);
  assert.equal(result.charts.forecast.reduce((sum, row) => sum + row.deals, 0), 2);
  assert.equal(result.kpis.overdueOpportunities, 1);
  assert.equal(result.kpis.unscheduledOpportunities, 1);
  assert.ok(!Object.hasOwn(result.charts.forecast[0], 'target'));
  assert.equal(result.insights.riskRows[0].id, 'overdue');
});

test('rolling 30 days differs from current month, with inclusive boundaries', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const rows = [opportunity({ leadEntryDate: '2026-09-15' }), opportunity({ leadEntryDate: '2026-09-14' }), opportunity({ leadEntryDate: '2026-10-14' })];
  const rolling = buildB2BDashboardAnalytics(rows, { now, period: '30d' });
  const monthly = buildB2BDashboardAnalytics(rows, { now, period: 'month' });
  assert.equal(rolling.period.start, '2026-09-15');
  assert.equal(rolling.charts.timeline.length, 30);
  assert.equal(rolling.kpis.newOpportunities, 2);
  assert.equal(monthly.kpis.newOpportunities, 1);
  assert.equal(monthly.period.start, '2026-10-01');
  assert.equal(monthly.kpis.totalOpportunities, 3);
});

test('calendar periods use São Paulo today and all history includes older entries', async () => {
  const { getB2BPeriod, buildB2BDashboardAnalytics } = await analytics;
  assert.equal(getB2BPeriod('month', new Date('2026-11-01T01:00:00Z')).end.toISOString().slice(0, 10), '2026-10-31');
  assert.equal(getB2BPeriod('quarter', now).start.toISOString().slice(0, 10), '2026-10-01');
  assert.equal(getB2BPeriod('6', now).start.toISOString().slice(0, 10), '2026-05-01');
  const result = buildB2BDashboardAnalytics([opportunity({ leadEntryDate: '2025-12-12' })], { now, period: 'all' });
  assert.equal(result.period.start, '2025-12-01');
  assert.equal(result.kpis.newOpportunities, 1);
});

test('temperature and financial charts contain only the open portfolio, including zero-valued deals', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const rows = [0, 1, 25, 26, 50, 51, 75, 76, 100].map((probability, index) => opportunity({ id: String(index), probability, value: 0 }));
  rows.push(opportunity({ stage: 'WON', probability: 100, value: 99999 }));
  rows.push(opportunity({ stage: 'LOST', probability: 0, value: 99999 }));
  const result = buildB2BDashboardAnalytics(rows, { now });
  assert.deepEqual(result.insights.temperatureRows.map(row => row.count), [1, 2, 2, 2, 2]);
  assert.equal(result.kpis.pipelineValue, 0);
  assert.equal(result.kpis.conversionRate, 50);
  assert.equal(result.kpis.unpricedOpportunities, 9);
  assert.equal(result.insights.stageRows.reduce((sum, row) => sum + row.count, 0), 9);
  assert.equal(result.insights.clientTypeRows[0].count, 9);
});

test('an empty portfolio produces truthful zeros and a complete period axis', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const result = buildB2BDashboardAnalytics([], { now });
  assert.equal(result.kpis.totalOpportunities, 0);
  assert.equal(result.kpis.conversionRate, 0);
  assert.equal(result.charts.timeline.length, 10);
  assert.equal(result.charts.sellerPerformance.length, 0);
  assert.equal(result.insights.riskRows.length, 0);
});

test('fallback timestamps use São Paulo midnight while imported calendar dates retain their day', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const result = buildB2BDashboardAnalytics([
    opportunity({ id: 'timestamp', leadEntryDate: null, createdAt: '2026-10-01T01:30:00Z', stage: 'WON', actualCloseDate: '2026-10-01T02:30:00Z' }),
    opportunity({ id: 'import', leadEntryDate: '2026-10-01T00:00:00Z' })
  ], { now, period: 'month' });
  assert.equal(result.kpis.newOpportunities, 1);
  assert.equal(result.kpis.periodWon, 0);
  assert.equal(result.charts.timeline[0].entries, 1);
  assert.equal(result.kpis.pipelineValue, 1000);
});

test('alerts prioritize overdue, 30 days idle, missing forecast and missing commercial value', async () => {
  const { buildB2BDashboardAnalytics } = await analytics;
  const result = buildB2BDashboardAnalytics([
    opportunity({ id: 'unpriced', value: 0, expectedCloseDate: '2026-11-01' }),
    opportunity({ id: 'unscheduled', expectedCloseDate: null }),
    opportunity({ id: 'idle', updatedAt: '2026-09-14T15:00:00Z', expectedCloseDate: '2026-11-01' }),
    opportunity({ id: 'overdue', expectedCloseDate: '2026-10-13', probability: 70 }),
    opportunity({ id: 'won', stage: 'WON', actualCloseDate: '2026-10-14', value: 900000 })
  ], { now });
  assert.deepEqual(result.insights.riskRows.map(row => row.id), ['overdue', 'idle', 'unscheduled', 'unpriced']);
  assert.equal(result.kpis.weightedPipelineValue, 1000);
  assert.equal(result.kpis.overdueWeightedValue, 700);
  assert.equal(result.kpis.unscheduledWeightedValue, 150);
  assert.equal(result.kpis.pipelineTemperature, 28.75);
});

test('Other categories preserve every source, owner status and financial total', () => {
  const source = fs.readFileSync(path.resolve('apps/web/src/pages/Dashboard.jsx'), 'utf8');
  const expression = source.split('const topCategories = ')[1].split('const countOptions')[0].trim().replace(/;$/, '');
  const topCategories = new Function(`return (${expression})`)();
  const rows = Array.from({ length: 20 }, (_, index) => ({ label: `Category ${index}`, count: index + 1, value: index * 123, weightedValue: index * 45, open: index, won: index + 2, lost: index + 3 }));
  for (const fields of [['count', 'value', 'weightedValue'], ['open', 'won', 'lost']]) {
    const grouped = topCategories(rows, 7, fields);
    assert.equal(grouped.length, 7);
    assert.equal(grouped.at(-1).label, 'Outros');
    fields.forEach(field => assert.equal(grouped.reduce((sum, row) => sum + row[field], 0), rows.reduce((sum, row) => sum + row[field], 0)));
  }
});

for (const apiFile of ['apps/api/api/dashboard.js', 'backend/api/dashboard.js']) {
  test(`${apiFile}: full portfolio query enforces tenant, owner and probability scopes`, async () => {
    const { buildB2BDashboardAnalytics } = await analytics;
    const calls = [];
    const prisma = {
      company: { count: async query => { calls.push(['company', query]); return 1; } },
      opportunity: {
        count: async query => { calls.push(['count', query]); return 362; },
        findMany: async query => { calls.push(['rows', query]); return Array.from({ length: 362 }, (_, index) => opportunity({ id: String(index) })); },
        groupBy: async query => { calls.push(['probabilities', query]); return [{ probability: 15, _count: { probability: 362 } }]; }
      }
    };
    const source = fs.readFileSync(path.resolve(apiFile), 'utf8').replace(/^import .*;\n/gm, '').replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'getTenantCompanyId', 'buildB2BDashboardAnalytics', source)(prisma, user => user.tenantCompanyId, buildB2BDashboardAnalytics);
    const response = await handler({ method: 'GET', query: { type: 'b2b', ownerId: 'another-owner', temperature: '25', period: 'year' }, user: { id: 'owner-1', role: 'SELLER', tenantCompanyId: 'tenant-1' } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.kpis.totalOpportunities, 362);
    assert.equal(result.charts.sellerPerformance[0].open, 362);
    const query = calls.find(([name]) => name === 'rows')[1];
    assert.equal(query.where.ownerId, 'owner-1');
    assert.equal(query.where.tenantCompanyId, 'tenant-1');
    assert.deepEqual(query.where.probability, { gte: 1, lte: 25 });
    assert.deepEqual(query.where.company, { clientType: 'B2B' });
    assert.ok(!Object.hasOwn(query, 'take'));
    assert.deepEqual(query.select.owner, { select: { id: true, name: true } });
    assert.deepEqual(query.select.company, { select: { id: true, name: true } });
    assert.deepEqual(calls.find(([name]) => name === 'probabilities')[1].where, query.where);
    calls.length = 0;
    await handler({ method: 'GET', query: { type: 'b2b', ownerId: 'selected-owner' }, user: { id: 'admin', role: 'MASTER', tenantCompanyId: 'tenant-1' } });
    assert.equal(calls.find(([name]) => name === 'rows')[1].where.ownerId, 'selected-owner');
    calls.length = 0;
    const forbidden = await handler({ method: 'GET', query: { type: 'b2b' }, user: { role: 'SELLER', tenantCompanyId: 'tenant-1' } });
    assert.equal(forbidden.status, 403);
    assert.equal(calls.length, 0);
    const moduleDenied = await handler({ method: 'GET', query: { type: 'b2b' }, user: { id: 'owner-1', role: 'USER', accessB2B: false } });
    assert.equal(moduleDenied.status, 403);
    assert.equal(calls.length, 0);
    for (const role of ['USER', 'SELLER', 'PRE_SALES']) {
      calls.length = 0;
      await handler({ method: 'GET', query: { type: 'b2b', ownerId: 'another-owner' }, user: { id: 'owner-1', role, tenantCompanyId: 'tenant-1' } });
      assert.equal(calls.find(([name]) => name === 'rows')[1].where.ownerId, 'owner-1');
    }
    calls.length = 0;
    await handler({ method: 'GET', query: { type: 'b2b' }, user: { id: 'legacy-admin', role: 'ADMIN' } });
    assert.equal(calls.find(([name]) => name === 'rows')[1].where.tenantCompanyId, null);
    calls.length = 0;
    await handler({ method: 'GET', query: { type: 'b2b', ownerId: 'other-tenant-owner' }, user: { id: 'admin', role: 'ADMIN', tenantCompanyId: 'tenant-1' } });
    assert.equal(calls.find(([name]) => name === 'rows')[1].where.tenantCompanyId, 'tenant-1');
  });
}
